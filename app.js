// RFCat Web UI/event wiring. Hardware/protocol logic lives under js/.
import { C } from "./js/rfcat/constants.js";
import { R } from "./js/radio/registers.js";
import { RFCatUSB } from "./js/rfcat/device.js";
import { hex } from "./js/core/bytes.js";
import { $, log } from "./js/ui/log.js";
import { renderWaveformPreview, clearWaveformPreview } from "./js/ui/waveform.js";
import { exportProtocolToIPython } from "./js/export/ipython.js";
import { decodeRxPacket, decoderProtocols, splitRxStatus } from "./js/rx/decode.js";
import { bytesToPulseRuns, pulseDistribution, estimateBasePulse } from "./js/rx/pulses.js";
import { initWorkspace } from "./js/ui/workspace.js";
import { deleteCaptureSession, getCaptureSession, listCaptureSessions, saveCaptureSession } from "./js/storage/capture-session-store.js";
import { parseFlipperRawSub, pulseRunsToFlipperTimings, serializeFlipperRawSub } from "./js/flipper/subghz.js";

import { protocols, getProtocol } from "./js/protocols/index.js";

import {
    renderProtocolSelector,
    renderProtocolFields,
    getProtocolValues,
} from "./js/ui/protocols.js";

const d = new RFCatUSB();
const protocolSelect = $("protocol");
const protocolFields = $("protocol-fields");
const waveformPreview = $("waveform-preview");

initWorkspace();

renderProtocolSelector(protocolSelect, protocols);

const rxProtocolSelect = $("rx-protocol");
const rxProtocolModel = $("rx-protocol-model");
const rxProtocolModelLabel = $("rx-protocol-model-label");
const rxDecoders = decoderProtocols(protocols);
const rxDecoderGroups = new Map();

for (const protocol of rxDecoders) {
    if (protocol.decoderGroup) {
        if (!rxDecoderGroups.has(protocol.decoderGroup)) rxDecoderGroups.set(protocol.decoderGroup, []);
        rxDecoderGroups.get(protocol.decoderGroup).push(protocol);
        continue;
    }
    const option = document.createElement("option");
    option.value = protocol.id;
    option.textContent = protocol.name;
    rxProtocolSelect.append(option);
}
for (const group of rxDecoderGroups.keys()) {
    const option = document.createElement("option");
    option.value = `group:${group}`;
    option.textContent = group;
    rxProtocolSelect.append(option);
}

function selectedRxProtocolId() {
    return rxProtocolSelect.value.startsWith("group:") ? rxProtocolModel.value : rxProtocolSelect.value;
}

function renderRxProtocolModel() {
    const group = rxProtocolSelect.value.startsWith("group:") ? rxProtocolSelect.value.slice(6) : null;
    const models = group ? rxDecoderGroups.get(group) ?? [] : [];
    rxProtocolModel.replaceChildren();
    for (const protocol of models) {
        const option = document.createElement("option");
        option.value = protocol.id;
        option.textContent = protocol.name.startsWith(`${group} `) ? protocol.name.slice(group.length + 1) : protocol.name;
        rxProtocolModel.append(option);
    }
    rxProtocolModelLabel.hidden = models.length === 0;
    rxProtocolModelLabel.style.display = models.length === 0 ? "none" : "";
}
renderRxProtocolModel();
const rxCaptures = [];
let pulseRuns = [];
let pocsagRolling = new Uint8Array();
let t112Rolling = new Uint8Array();
let t119Rolling = new Uint8Array();
let td157Rolling = new Uint8Array();
let td161Rolling = new Uint8Array();
let td164Rolling = new Uint8Array();
let td165Rolling = new Uint8Array();
let td174Rolling = new Uint8Array();
let lastPocsagFingerprint = null;
const POCSAG_ROLLING_MAX = 1020;

function appendRollingBytes(existing, incoming, maxBytes = POCSAG_ROLLING_MAX) {
    const joined = new Uint8Array(existing.length + incoming.length);
    joined.set(existing);
    joined.set(incoming, existing.length);
    return joined.length > maxBytes ? joined.slice(joined.length - maxBytes) : joined;
}


function resetPocsagRolling() {
    pocsagRolling = new Uint8Array();
    t112Rolling = new Uint8Array();
    t119Rolling = new Uint8Array();
    td157Rolling = new Uint8Array();
    td161Rolling = new Uint8Array();
    td164Rolling = new Uint8Array();
    td165Rolling = new Uint8Array();
    td174Rolling = new Uint8Array();
    lastPocsagFingerprint = null;
}

function pocsagFingerprint(decoded) {
    if (decoded?.protocol?.id !== "pocsag" || !decoded.fields) return null;
    const f = decoded.fields;
    return [f.capcode, f.function, f.message, f.polarity].join("|");
}

function selectProtocol() {
    const protocol = getProtocol(protocolSelect.value);

    if (!protocol) {
        protocolFields.replaceChildren();
        return;
    }

    renderProtocolFields(protocolFields, protocol);
    updateProtocolPreview();
}

let previewGeneration = 0;

async function updateProtocolPreview() {
    const generation = ++previewGeneration;
    const protocol = getProtocol(protocolSelect.value);
    if (!protocol) return clearWaveformPreview(waveformPreview);

    try {
        const values = getProtocolValues(protocolFields, protocol);
        const encoded = await protocol.encode(values);
        if (generation !== previewGeneration) return;
        renderWaveformPreview(waveformPreview, encoded);
    } catch (e) {
        if (generation !== previewGeneration) return;
        clearWaveformPreview(waveformPreview);
        waveformPreview.textContent = `Preview unavailable: ${e.message}`;
    }
}

function debounce(fn, delay = 100) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

const updateProtocolPreviewDebounced = debounce(updateProtocolPreview, 100);

// Text/number input can fire on every keystroke. Debounce those redraws so
// editing a value does not continuously rebuild the preview and shift layout.
protocolFields.addEventListener("input", updateProtocolPreviewDebounced);
// Selects, checkboxes, and committed edits should update immediately.
protocolFields.addEventListener("change", updateProtocolPreview);

// The canvas is responsive, but a resize can emit many events in quick
// succession. Re-render once the resize settles.
window.addEventListener("resize", debounce(updateProtocolPreview, 100));

protocolSelect.addEventListener("change", selectProtocol);

selectProtocol();

let listening = false,
    pc = 0,
    bc = 0,
    decodedCount = 0,
    rejectedCount = 0,
    duplicateCount = 0,
    monitorTimer = null;

const marcName = (n) =>
    ({
        1: "IDLE",

        13: "RX",

        14: "RX_END",

        15: "RX_RST",

        17: "TX",

        18: "TX_END",

        19: "RXTX_SWITCH",

        20: "TXRX_SWITCH",

        21: "RX_OVERFLOW",

        22: "FSTXON",

        23: "TX_UNDERFLOW",
    })[n] || `0x${n.toString(16).padStart(2, "0")}`;

const rssiDbm = (raw) => {
    const signed = raw >= 128 ? raw - 256 : raw;

    return signed / 2 - 74;
};

async function updateLiveRadio() {
    if (!d.device?.opened) return;

    try {
        const [rssi, lqi, marc] = await Promise.all([
            d.peek(R.RSSI),

            d.peek(R.LQI),

            d.peek(R.MARCSTATE),
        ]);

        $("rssi").textContent = `${rssiDbm(rssi[0]).toFixed(1)} dBm`;

        $("lqi").textContent = String(lqi[0] & 0x7f);

        $("rxstate").textContent = marcName(marc[0] & 0x1f);
    } catch {}
}

function setMonitor(on) {
    if (monitorTimer) {
        clearInterval(monitorTimer);

        monitorTimer = null;
    }

    if (on) {
        updateLiveRadio();

        monitorTimer = setInterval(updateLiveRadio, 500);
    }
}

function enabled(v) {
    for (const id of [
        "apply",
        "readcfg",
        "idle",
        "rx",
        "listen",
        "protocol-transmit",
    ]) {
        $(id).disabled = !v;
    }
}

enabled(false);

function updatePacketControlState() {
    const variable = $("lengthmode").value === "variable";

    $("pktlenlabel").textContent = variable
        ? "Maximum packet length (bytes)"
        : "Packet length (bytes)";

    $("deviceaddr").disabled = Number($("addrcheck").value) === 0;
}

$("lengthmode").addEventListener("change", updatePacketControlState);

$("addrcheck").addEventListener("change", updatePacketControlState);

updatePacketControlState();


async function refresh() {
    const c = await d.config();

    $("freq").value = (c.freq / 1e6).toFixed(6);

    $("drate").value = Math.round(c.rate);

    $("bw").value = (c.bw / 1e3).toFixed(3);

    $("mod").value = String(c.mod);

    $("sync").value = c.sync.toString(16).padStart(4, "0").toUpperCase();

    $("syncmode").value = String(c.syncMode);

    $("lengthmode").value = c.lengthMode;

    $("pktlen").value = c.packetLength;

    $("crc").checked = c.crc;

    $("whitening").checked = c.whitening;

    $("appendstatus").checked = c.appendStatus;

    $("addrcheck").value = String(c.addressCheck);

    $("deviceaddr").value = c.deviceAddress

        .toString(16)

        .padStart(2, "0")

        .toUpperCase();

    updatePacketControlState();

    $("configSummary").textContent =
        `${(c.freq / 1e6).toFixed(6)} MHz · ${Math.round(c.rate)} baud · ${(c.bw / 1e3).toFixed(1)} kHz BW · ` +
        `${c.lengthMode} packet · ${c.packetLength} byte${c.lengthMode === "variable" ? " max" : "s"} · ` +
        `CRC ${c.crc ? "on" : "off"} · MARCSTATE 0x${c.marc.toString(16).padStart(2, "0")}`;

    log(
        `Radio readback: ${(c.freq / 1e6).toFixed(6)} MHz · ${Math.round(c.rate)} baud · ${(c.bw / 1e3).toFixed(3)} kHz BW · ` +
            `sync ${c.sync.toString(16).padStart(4, "0").toUpperCase()} mode ${c.syncMode} · ` +
            `${c.lengthMode} packet ${c.packetLength}${c.lengthMode === "variable" ? " max" : " bytes"} · ` +
            `CRC ${c.crc ? "on" : "off"} · whitening ${c.whitening ? "on" : "off"} · ` +
            `append status ${c.appendStatus ? "on" : "off"} · addr check ${c.addressCheck} · ` +
            `addr 0x${c.deviceAddress.toString(16).padStart(2, "0").toUpperCase()} · ` +
            `PKTCTRL0 0x${c.pktctrl0.toString(16).padStart(2, "0")} · PKTCTRL1 0x${c.pktctrl1.toString(16).padStart(2, "0")} · ` +
            `MARCSTATE 0x${c.marc.toString(16).padStart(2, "0")}`,
    );

    const dump = await d.dumpRadioRegisters();

    log("RADIO REGISTER DUMP:\n" + dump);

    return c;
}
$("protocol-export-ipython").onclick = async () => {
    try {
        const protocol = getProtocol(protocolSelect.value);
        if (!protocol) throw new Error("No protocol selected");

        const values = getProtocolValues(protocolFields, protocol);
        const encoded = await protocol.encode(values);

        if (!(encoded?.bytes instanceof Uint8Array) || !encoded.bytes.length) {
            throw new Error(`${protocol.name} generated no TX payload`);
        }

        const code = await exportProtocolToIPython(protocol, values, encoded);
        $("ipython-export-code").value = code;
        $("ipython-export-dialog").showModal();
    } catch (e) {
        log(`IPython export error: ${e.message}`);
    }
};

$("ipython-export-close").onclick = () => $("ipython-export-dialog").close();

$("ipython-export-copy").onclick = async () => {
    try {
        await navigator.clipboard.writeText($("ipython-export-code").value);
        $("ipython-export-copy").textContent = "Copied";
        setTimeout(() => { $("ipython-export-copy").textContent = "Copy"; }, 1200);
    } catch (e) {
        $("ipython-export-code").select();
        log(`Clipboard unavailable: ${e.message}`);
    }
};

$("protocol-transmit").onclick = async () => {
    const transmitButton = $("protocol-transmit");

    if (transmitButton.disabled) {
        return;
    }

    transmitButton.disabled = true;

    try {
        if (!d.device?.opened) {
            throw new Error("RFCat device is not connected");
        }

        const protocol = getProtocol(protocolSelect.value);

        if (!protocol) {
            throw new Error("No protocol selected");
        }

        const values = getProtocolValues(protocolFields, protocol);

        const encoded = await protocol.encode(values);

        if (protocol.analysisOnly) {
            throw new Error(`${protocol.name} is analysis-only and cannot transmit`);
        }

        if (!(encoded?.bytes instanceof Uint8Array)) {
            throw new Error(`${protocol.name} did not return a Uint8Array`);
        }

        if (!encoded.bytes.length) {
            throw new Error(`${protocol.name} generated an empty payload`);
        }

        if (protocol.configure) {
            await protocol.configure(d, values);
        }

        if (encoded.summary) {
            log(encoded.summary);
        }

        await protocol.transmit(d, encoded, values);

        log(`TX ${encoded.bytes.length} bytes: ` + hex(encoded.bytes));
    } catch (e) {
        log(`Protocol TX error: ${e.message}`);
    } finally {
        transmitButton.disabled = false;
    }
};

$("connect").onclick = async () => {
    try {
        if (d.device) {
            setMonitor(false);

            await d.disconnect();

            document.body.classList.remove("connected");

            $("status").textContent = "Disconnected";

            $("connect").textContent = "Connect YS1";

            enabled(false);

            return;
        }

        await d.connect();

        document.body.classList.add("connected");

        $("status").textContent =
            `${d.device.productName || "RFCat"} connected`;

        $("connect").textContent = "Disconnect";

        enabled(true);

        log(
            `Connected VID ${d.device.vendorId.toString(16)} PID ${d.device.productId.toString(16)}`,
        );

        await refresh();
    } catch (e) {
        log(`ERROR: ${e.message}`);

        alert(e.message);
    }
};

$("readcfg").onclick = () => refresh().catch((e) => log(`ERROR: ${e.message}`));

$("idle").onclick = () =>
    d

        .mode(C.RF_IDLE)

        .then(() => log("Radio → IDLE"))

        .catch((e) => log(e.message));

$("rx").onclick = () =>
    d

        .mode(C.RF_RX)

        .then(() => log("Radio → RX"))

        .catch((e) => log(e.message));

$("apply").onclick = async () => {
    try {
        await d.mode(C.RF_IDLE);

        await d.setFrequency(Number($("freq").value) * 1e6);

        await d.setDataRate(Number($("drate").value));

        await d.setBandwidth(Number($("bw").value) * 1e3);

        await d.setModulation(Number($("mod").value));

        await d.setSync(
            parseInt($("sync").value, 16),

            Number($("syncmode").value),
        );

        const deviceAddress = parseInt($("deviceaddr").value, 16);

        if (
            !Number.isInteger(deviceAddress) ||
            deviceAddress < 0 ||
            deviceAddress > 255
        )
            throw new Error("Device address must be one byte of hex (00-FF)");

        await d.setPacketConfig({
            lengthMode: $("lengthmode").value,

            packetLength: Number($("pktlen").value),

            crc: $("crc").checked,

            whitening: $("whitening").checked,

            appendStatus: $("appendstatus").checked,

            addressCheck: Number($("addrcheck").value),

            deviceAddress,
        });

        if ($("lowball")?.checked) {
            await d.lowball();
        }

        await refresh();

        log("Radio configuration applied");
    } catch (e) {
        log(`ERROR: ${e.message}`);
    }
};

async function configureProtocolReceiver(protocol) {
    const preset = protocol?.rxPreset;
    if (!preset) return;

    if (listening) {
        await d.mode(C.RF_IDLE);
        listening = false;
    }
    await d.mode(C.RF_IDLE);
    await d.setFrequency(preset.frequency);
    await d.setDataRate(preset.dataRate);
    await d.setBandwidth(preset.bandwidth);
    await d.setModulation(preset.modulation);
    if (preset.deviation != null) await d.setDeviation(preset.deviation);
    await d.setSync(preset.syncWord, preset.syncMode);
    await d.setManchester(preset.manchester);
    await d.setPacketConfig({
        lengthMode: preset.lengthMode,
        packetLength: preset.packetLength,
        crc: preset.crc,
        whitening: preset.whitening,
        appendStatus: preset.appendStatus,
        addressCheck: preset.addressCheck,
        deviceAddress: preset.deviceAddress,
    });
    if (preset.lowball) await d.lowball();

    $("freq").value = (preset.frequency / 1e6).toFixed(3);
    $("drate").value = String(preset.dataRate);
    $("bw").value = (preset.bandwidth / 1e3).toFixed(3);
    $("mod").value = String(preset.modulation);
    $("sync").value = preset.syncWord.toString(16).padStart(4, "0").toUpperCase();
    $("syncmode").value = String(preset.syncMode);
    $("lengthmode").value = preset.lengthMode;
    $("pktlen").value = String(preset.packetLength);
    $("crc").checked = preset.crc;
    $("whitening").checked = preset.whitening;
    $("appendstatus").checked = preset.appendStatus;
    $("addrcheck").value = String(preset.addressCheck);
    $("deviceaddr").value = preset.deviceAddress.toString(16).padStart(2, "0").toUpperCase();
    $("lowball").checked = !!preset.lowball;
    updatePacketControlState();
    resetPocsagRolling();

    await d.mode(C.RF_RX);
    listening = true;
    $("listen").textContent = "Stop listening";
    $("rxstate").textContent = "RX";
    log(`${protocol.name} RX started: ${(preset.frequency / 1e6).toFixed(3)} MHz · ${preset.dataRate} baud · ${(preset.bandwidth / 1e3).toFixed(3)} kHz BW · ${preset.modulation === 0x00 ? "2-FSK" : "raw OOK"}`);
}

function applySelectedRxProtocol() {
    const protocol = getProtocol(selectedRxProtocolId());
    if (!protocol?.rxPreset || !d.device) return;
    configureProtocolReceiver(protocol).catch((e) => log(`${protocol.name} RX error: ${e.message}`));
}
rxProtocolSelect.addEventListener("change", () => {
    renderRxProtocolModel();
    redecodeOfflineCaptures();
    applySelectedRxProtocol();
});
rxProtocolModel.addEventListener("change", () => {
    redecodeOfflineCaptures();
    applySelectedRxProtocol();
});

async function configurePocsagReceiver() {
    const frequencyMHz = Number($("pocsag-rx-frequency").value);
    const baud = Number($("pocsag-rx-baud").value);
    if (!Number.isFinite(frequencyMHz) || frequencyMHz <= 0) throw new Error("POCSAG RX frequency must be positive");
    if (![512, 1200, 2400].includes(baud)) throw new Error("POCSAG RX baud must be 512, 1200, or 2400");

    if (listening) {
        await d.mode(C.RF_IDLE);
        listening = false;
    }

    await d.mode(C.RF_IDLE);
    await d.setFrequency(frequencyMHz * 1e6);
    await d.setDataRate(baud);
    await d.setBandwidth(93_750);
    await d.setModulation(0x00);
    await d.setDeviation(4_500);
    await d.setSync(0x832d, 0);
    await d.setManchester(false);
    await d.setPacketConfig({
        lengthMode: "fixed",
        packetLength: 255,
        crc: false,
        whitening: false,
        appendStatus: false,
        addressCheck: 0,
        deviceAddress: 0,
    });

    $("freq").value = frequencyMHz.toFixed(3);
    $("drate").value = String(baud);
    $("bw").value = "93.750";
    $("mod").value = "0";
    $("sync").value = "832D";
    $("syncmode").value = "0";
    $("lengthmode").value = "fixed";
    $("pktlen").value = "255";
    $("crc").checked = false;
    $("whitening").checked = false;
    $("appendstatus").checked = false;
    $("addrcheck").value = "0";
    $("lowball").checked = false;
    rxProtocolSelect.value = "pocsag";
    renderRxProtocolModel();
    updatePacketControlState();
    resetPocsagRolling();

    await d.mode(C.RF_RX);
    listening = true;
    $("listen").textContent = "Stop listening";
    $("pocsag-rx-start").textContent = "Restart POCSAG RX";
    $("rxstate").textContent = "RX";
    log(`POCSAG RX started: ${frequencyMHz.toFixed(3)} MHz · ${baud} baud · 93.750 kHz BW · 2-FSK · rolling decode enabled`);
}

$("pocsag-rx-start").onclick = () =>
    configurePocsagReceiver().catch((e) => log(`POCSAG RX error: ${e.message}`));

$("listen").onclick = async () => {
    try {
        listening = !listening;

        $("listen").textContent = listening
            ? "Stop listening"
            : "Start listening";

        if (listening) {
            resetPocsagRolling();
            // Critical: enter RX and then leave the radio alone.

            await d.mode(C.RF_RX);

            log("Listening for RFCat RX packets");

            log(
                `Configured: ${$("freq").value} MHz · ` +
                    `${$("drate").value} baud · ` +
                    `${$("bw").value} kHz BW · ` +
                    `sync ${$("sync").value} · ` +
                    `mode ${$("syncmode").value} · ` +
                    `${$("lengthmode").value} packet · ` +
                    `${$("pktlen").value}${$("lengthmode").value === "variable" ? " max" : " bytes"} · ` +
                    `lowball ${$("lowball")?.checked ? "on" : "off"}`,
            );

            $("rxstate").textContent = "RX";
        } else {
            await d.mode(C.RF_IDLE);

            resetPocsagRolling();
            $("pocsag-rx-start").textContent = "Start POCSAG RX";

            log("Listening stopped");

            $("rxstate").textContent = "IDLE";
        }
    } catch (e) {
        listening = false;

        $("listen").textContent = "Start listening";

        log(`ERROR: ${e.message}`);
    }
};


function renderPulseAnalyzer() {
    const rate = Number($("drate").value);
    const canvas = $("pulse-canvas");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, canvas.clientWidth || 900);
    const height = 180;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    $("pulse-count").textContent = String(pulseRuns.length);
    $("pulse-sample").textContent = Number.isFinite(rate) && rate > 0 ? `${(1e6 / rate).toFixed(2)} µs` : "—";
    const totalUs = pulseRuns.reduce((n, r) => n + r.durationUs, 0);
    $("pulse-duration").textContent = pulseRuns.length ? `${(totalUs / 1000).toFixed(3)} ms` : "—";

    const groups = pulseDistribution(pulseRuns);
    const base = estimateBasePulse(groups);
    $("pulse-base").textContent = base == null ? "—" : `${base.toFixed(1)} µs`;
    $("pulse-distribution").textContent = groups.length
        ? groups.slice(0, 12).map((g) => `${g.meanUs.toFixed(1)} µs × ${g.count}  [${g.minUs.toFixed(1)}–${g.maxUs.toFixed(1)}]`).join("  ·  ")
        : "No pulse data captured.";

    if (!pulseRuns.length) return;
    const shown = pulseRuns.slice(0, 180);
    const shownUs = shown.reduce((n, r) => n + r.durationUs, 0);
    const left = 16, right = width - 16, high = 42, low = 138;
    ctx.strokeStyle = "#59a6ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let x = left;
    ctx.moveTo(x, shown[0].level ? high : low);
    for (const run of shown) {
        const y = run.level ? high : low;
        const nx = x + (run.durationUs / shownUs) * (right - left);
        ctx.lineTo(x, y);
        ctx.lineTo(nx, y);
        x = nx;
    }
    ctx.stroke();
}

function appendPulseBytes(bytes) {
    const rate = Number($("drate").value);
    if (!Number.isFinite(rate) || rate <= 0 || !(bytes instanceof Uint8Array) || !bytes.length) return;
    const runs = bytesToPulseRuns(bytes, rate);
    if (pulseRuns.length && runs.length && pulseRuns[pulseRuns.length - 1].level === runs[0].level) {
        const last = pulseRuns[pulseRuns.length - 1];
        const first = runs.shift();
        last.symbols += first.symbols;
        last.durationUs += first.durationUs;
    }
    pulseRuns.push(...runs);
    if (pulseRuns.length > 4096) pulseRuns = pulseRuns.slice(-4096);
    renderPulseAnalyzer();
}

$("pulse-clear").onclick = () => { pulseRuns = []; renderPulseAnalyzer(); };
$("pulse-export").onclick = () => {
    if (!pulseRuns.length) return log("No pulse data to export");
    const groups = pulseDistribution(pulseRuns);
    const data = {
        exportedAt: new Date().toISOString(),
        frequencyHz: Number($("freq").value) * 1e6,
        dataRate: Number($("drate").value),
        estimatedBasePulseUs: estimateBasePulse(groups),
        distribution: groups,
        runs: pulseRuns,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rfcat-pulses-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
$("flipper-import").onclick = () => $("flipper-file").click();
$("flipper-file").onchange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
        const raw = parseFlipperRawSub(await file.text());
        $("freq").value = String(raw.frequency / 1e6);
        pulseRuns = raw.timings.map((timing) => ({
            level: timing > 0 ? 1 : 0,
            symbols: null,
            durationUs: Math.abs(timing),
        }));
        renderPulseAnalyzer();
        log(`Imported Flipper RAW .sub: ${raw.timings.length} runs at ${(raw.frequency / 1e6).toFixed(6)} MHz (${raw.preset})`);
    } catch (error) {
        log(`Flipper .sub import error: ${error.message}`);
    }
};
$("flipper-export").onclick = () => {
    if (!pulseRuns.length) return log("No pulse data to export to Flipper");
    try {
        const text = serializeFlipperRawSub({
            frequency: Number($("freq").value) * 1e6,
            timings: pulseRunsToFlipperTimings(pulseRuns),
        });
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rfcat-raw-${new Date().toISOString().replace(/[:.]/g, "-")}.sub`;
        a.click();
        URL.revokeObjectURL(url);
        log("Exported pulse analyzer data as Flipper RAW .sub");
    } catch (error) {
        log(`Flipper .sub export error: ${error.message}`);
    }
};
window.addEventListener("resize", debounce(renderPulseAnalyzer, 100));
renderPulseAnalyzer();

function rxCaptureVisible(capture) {
    const filter = $("rx-filter").value;
    if (filter === "decoded") return !!capture.decoder && !capture.error;
    if (filter === "unknown") return !capture.decoder || !!capture.error;
    return true;
}

function applyRxFilter() {
    for (const el of $("packetList").querySelectorAll(".packet")) {
        const capture = rxCaptures[Number(el.dataset.captureIndex)];
        el.classList.toggle("filtered", !capture || !rxCaptureVisible(capture));
    }
}

$("rx-filter").addEventListener("change", applyRxFilter);

function updateRxAnalyzerStats() {
    $("packets").textContent = String(pc);
    $("bytes").textContent = String(bc);
    $("rx-decoded").textContent = String(decodedCount);
    $("rx-rejected").textContent = String(rejectedCount);
    $("rx-duplicates").textContent = String(duplicateCount);
}

let activeSessionId = null;



async function listSessions() {
    return listCaptureSessions();
}

async function getSession(id) {
    return id ? getCaptureSession(id) : null;
}

function sessionCaptureData() {
    return rxCaptures.map(({ bytes, ...capture }) => ({ ...capture, hex: hex(bytes) }));
}

function currentSessionSnapshot(name, id = activeSessionId ?? crypto.randomUUID()) {
    return {
        id,
        name,
        notes: $("session-notes").value.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        decoder: rxProtocolSelect.value,
        model: rxProtocolModel.value || null,
        filter: $("rx-filter").value,
        frequencyMHz: $("freq").value,
        dataRate: $("drate").value,
        radio: {
            frequencyMHz: $("freq").value,
            dataRate: $("drate").value,
            bandwidthKHz: $("bw").value,
            modulation: $("mod").value,
            syncWord: $("sync").value,
            syncMode: $("syncmode").value,
            lengthMode: $("lengthmode").value,
            packetLength: $("pktlen").value,
            crc: $("crc").checked,
            whitening: $("whitening").checked,
            appendStatus: $("appendstatus").checked,
            lowball: $("lowball")?.checked ?? false,
        },
        captures: sessionCaptureData(),
    };
}

async function refreshSessionList(selectId = activeSessionId) {
    const sessions = await listSessions();
    const query = $("library-search")?.value.trim().toLowerCase() ?? "";
    const visibleSessions = query ? sessions.filter((session) => `${session.name} ${session.notes} ${session.decoder ?? ""} ${session.frequencyMHz ?? ""}`.toLowerCase().includes(query)) : sessions;
    const select = $("session-select");
    select.replaceChildren();
    if (!visibleSessions.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = query ? "No matching captures" : "No saved sessions";
        select.append(option);
    } else {
        for (const session of visibleSessions) {
            const option = document.createElement("option");
            option.value = session.id;
            option.textContent = `${session.name} · ${session.captures?.length ?? 0} captures`;
            select.append(option);
        }
        if (selectId && visibleSessions.some((session) => session.id === selectId)) select.value = selectId;
    }
    $("session-status").textContent = activeSessionId ? "Saved" : "Unsaved";
}

async function saveSession() {
    const existing = activeSessionId ? await getSession(activeSessionId) : null;
    const name = existing?.name ?? prompt("Session name", "Capture session");
    if (!name?.trim()) return;
    const snapshot = currentSessionSnapshot(name.trim(), existing?.id);
    if (existing?.createdAt) snapshot.createdAt = existing.createdAt;
    await saveCaptureSession(snapshot);
    activeSessionId = snapshot.id;
    await refreshSessionList(activeSessionId);
    log(`Saved capture session "${snapshot.name}" with ${snapshot.captures.length} captures`);
}

async function openSavedSession(id) {
    const session = await getSession(id);
    if (!session) return;
    activeSessionId = session.id;
    $("session-notes").value = session.notes ?? "";
    if (session.decoder && [...rxProtocolSelect.options].some((option) => option.value === session.decoder)) {
        rxProtocolSelect.value = session.decoder;
        renderRxProtocolModel();
        if (session.model && [...rxProtocolModel.options].some((option) => option.value === session.model)) {
            rxProtocolModel.value = session.model;
        }
    }
    if (session.filter) $("rx-filter").value = session.filter;
    const radio = session.radio ?? {};
    if (radio.frequencyMHz ?? session.frequencyMHz) $("freq").value = radio.frequencyMHz ?? session.frequencyMHz;
    if (radio.dataRate ?? session.dataRate) $("drate").value = radio.dataRate ?? session.dataRate;
    if (radio.bandwidthKHz != null) $("bw").value = radio.bandwidthKHz;
    if (radio.modulation != null) $("mod").value = radio.modulation;
    if (radio.syncWord != null) $("sync").value = radio.syncWord;
    if (radio.syncMode != null) $("syncmode").value = radio.syncMode;
    if (radio.lengthMode != null) $("lengthmode").value = radio.lengthMode;
    if (radio.packetLength != null) $("pktlen").value = radio.packetLength;
    if (typeof radio.crc === "boolean") $("crc").checked = radio.crc;
    if (typeof radio.whitening === "boolean") $("whitening").checked = radio.whitening;
    if (typeof radio.appendStatus === "boolean") $("appendstatus").checked = radio.appendStatus;
    if (typeof radio.lowball === "boolean" && $("lowball")) $("lowball").checked = radio.lowball;
    updatePacketControlState();

    rxCaptures.length = 0;
    comparedCaptureIndexes.clear();
    updateCompareButton();
    $("rx-compare-panel").hidden = true;
    $("rx-infer-panel").hidden = true;
    pc = bc = decodedCount = rejectedCount = duplicateCount = 0;
    $("packetList").innerHTML = '<div class="empty">No packets captured.</div>';

    for (const item of session.captures ?? []) renderRxCapture(redecodeImportedCapture(item));
    updateRxAnalyzerStats();
    applyRxFilter();
    await refreshSessionList(activeSessionId);
    log(`Opened capture session "${session.name}" with ${session.captures?.length ?? 0} captures`);
}

$("session-new").onclick = () => {
    activeSessionId = null;
    $("session-notes").value = "";
    rxCaptures.length = 0;
    comparedCaptureIndexes.clear();
    updateCompareButton();
    $("rx-compare-panel").hidden = true;
    $("rx-infer-panel").hidden = true;
    pc = bc = decodedCount = rejectedCount = duplicateCount = 0;
    $("packetList").innerHTML = '<div class="empty">No packets captured.</div>';
    updateRxAnalyzerStats();
    refreshSessionList();
    log("Started a new capture session");
};
$("session-save").onclick = () => saveSession().catch((error) => log(`Session save error: ${error.message}`));
$("session-open").onclick = () => openSavedSession($("session-select").value).catch((error) => log(`Session open error: ${error.message}`));
$("session-rename").onclick = async () => {
    const session = await getSession($("session-select").value);
    if (!session) return;
    const name = prompt("Rename session", session.name);
    if (!name?.trim()) return;
    session.name = name.trim();
    session.updatedAt = new Date().toISOString();
    await saveCaptureSession(session);
    activeSessionId = session.id;
    await refreshSessionList(activeSessionId);
};
$("session-delete").onclick = async () => {
    const id = $("session-select").value;
    const session = await getSession(id);
    if (!session || !confirm(`Delete session "${session.name}"?`)) return;
    await deleteCaptureSession(id);
    if (activeSessionId === id) activeSessionId = null;
    await refreshSessionList();
    log(`Deleted capture session "${session.name}"`);
};
$("session-notes").addEventListener("input", () => {
    if (activeSessionId) $("session-status").textContent = "Modified";
});
$("library-search").addEventListener("input", debounce(() => refreshSessionList(), 120));
$("session-export").onclick = async () => {
    const session = await getSession($("session-select").value);
    if (!session) return log("Select a saved capture session to export");
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rfcat-session-${session.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "capture"}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
refreshSessionList().catch((error) => log(`Capture library error: ${error.message}`));

const comparedCaptureIndexes = new Set();

function updateCompareButton() {
    const count = comparedCaptureIndexes.size;
    $("rx-compare").textContent = `Compare (${count})`;
    $("rx-compare").disabled = count < 2;
    $("rx-infer").disabled = count < 2;
    $("preset-build").disabled = count < 2;
}

function compareByteRows(captures) {
    const maxLength = Math.max(...captures.map((capture) => capture.bytes.length));
    const changed = new Set();
    for (let i = 0; i < maxLength; i++) {
        const values = captures.map((capture) => capture.bytes[i]);
        if (values.some((value) => value !== values[0])) changed.add(i);
    }
    return { maxLength, changed };
}

function renderCaptureCompare() {
    const captures = [...comparedCaptureIndexes]
        .sort((a, b) => a - b)
        .map((index) => ({ index, capture: rxCaptures[index] }))
        .filter(({ capture }) => capture);
    if (captures.length < 2) return;

    const body = $("rx-compare-body");
    body.innerHTML = "";
    const { maxLength, changed } = compareByteRows(captures.map(({ capture }) => capture));

    const status = document.createElement("div");
    status.className = `rx-compare-status ${changed.size === 0 ? "identical" : "different"}`;
    status.textContent = changed.size === 0
        ? "✓ Identical captures"
        : `△ ${changed.size} byte${changed.size === 1 ? "" : "s"} differ`;
    body.append(status);

    const summary = document.createElement("div");
    summary.className = "rx-compare-summary";
    summary.textContent = `${captures.length} captures · max ${maxLength} bytes`;
    body.append(summary);

    const bytes = document.createElement("div");
    bytes.className = "rx-compare-bytes";
    for (const [rowIndex, { capture }] of captures.entries()) {
        const row = document.createElement("div");
        row.className = "rx-compare-row";
        const label = document.createElement("span");
        label.className = "rx-compare-label";
        label.textContent = String.fromCharCode(65 + rowIndex);
        row.append(label);
        const hexRow = document.createElement("div");
        hexRow.className = "rx-compare-hex";
        for (let i = 0; i < maxLength; i++) {
            const cell = document.createElement("span");
            cell.className = "rx-compare-byte";
            if (changed.has(i)) cell.classList.add("changed");
            cell.title = `byte ${i}`;
            cell.textContent = capture.bytes[i] == null ? "--" : capture.bytes[i].toString(16).padStart(2, "0").toUpperCase();
            hexRow.append(cell);
        }
        row.append(hexRow);
        bytes.append(row);
    }
    body.append(bytes);

    const fieldNames = [...new Set(captures.flatMap(({ capture }) => Object.keys(capture.fields ?? {})))];
    if (fieldNames.length) {
        const table = document.createElement("table");
        table.className = "rx-compare-fields";
        const head = document.createElement("tr");
        head.innerHTML = "<th>Field</th>" + captures.map((_, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join("");
        table.append(head);
        for (const field of fieldNames) {
            const values = captures.map(({ capture }) => capture.fields?.[field]);
            const tr = document.createElement("tr");
            const different = values.some((value) => String(value ?? "—") !== String(values[0] ?? "—"));
            if (different) tr.className = "changed";
            const name = document.createElement("th");
            name.textContent = field;
            tr.append(name);
            for (const value of values) {
                const td = document.createElement("td");
                td.textContent = value ?? "—";
                tr.append(td);
            }
            table.append(tr);
        }
        body.append(table);
    }

    $("rx-compare-panel").hidden = false;
}

function inferenceLabel(index) {
    return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function exactFieldMatchesByte(captures, offset) {
    const commonFields = [...new Set(captures.flatMap((capture) => Object.keys(capture.fields ?? {})))];
    const matches = [];
    for (const field of commonFields) {
        const values = captures.map((capture) => capture.fields?.[field]);
        if (values.some((value) => value == null)) continue;
        const numeric = values.map(Number);
        if (numeric.some((value) => !Number.isFinite(value))) continue;
        if (numeric.every((value, i) => value === captures[i].bytes[offset])) matches.push(field);
    }
    return matches;
}

function renderFieldInference() {
    const selected = [...comparedCaptureIndexes].sort((a, b) => a - b)
        .map((index) => rxCaptures[index]).filter(Boolean);
    if (selected.length < 2) return;

    const body = $("rx-infer-body");
    body.replaceChildren();
    const maxLength = Math.max(...selected.map((capture) => capture.bytes.length));
    const changing = [];

    for (let offset = 0; offset < maxLength; offset++) {
        const values = selected.map((capture) => capture.bytes[offset]);
        if (values.some((value) => value !== values[0])) changing.push(offset);
    }

    const summary = document.createElement("div");
    summary.className = "rx-compare-summary";
    summary.textContent = `${selected.length} captures · ${changing.length} changing byte position${changing.length === 1 ? "" : "s"} · ${maxLength} byte maximum`;
    body.append(summary);

    const table = document.createElement("table");
    table.className = "rx-compare-fields rx-infer-table";
    const head = document.createElement("tr");
    for (const title of ["Offset", "Values", "Bit changes", "Observation"]) {
        const th = document.createElement("th");
        th.textContent = title;
        head.append(th);
    }
    table.append(head);

    for (let offset = 0; offset < maxLength; offset++) {
        const values = selected.map((capture) => capture.bytes[offset]);
        const differs = values.some((value) => value !== values[0]);
        const tr = document.createElement("tr");
        if (differs) tr.className = "changed";

        const offsetCell = document.createElement("td");
        offsetCell.textContent = String(offset);
        const valuesCell = document.createElement("td");
        valuesCell.className = "rx-infer-values";
        valuesCell.textContent = values.map((value) => value == null ? "—" : value.toString(16).padStart(2, "0").toUpperCase()).join(" ");

        let changeMask = 0;
        const present = values.filter((value) => value != null);
        if (present.length) {
            for (const value of present.slice(1)) changeMask |= present[0] ^ value;
        }
        const bitsCell = document.createElement("td");
        bitsCell.className = "rx-infer-bits";
        bitsCell.textContent = changeMask.toString(2).padStart(8, "0");

        const observation = document.createElement("td");
        if (!differs) {
            observation.textContent = "Constant";
        } else {
            const matches = values.every((value) => value != null) ? exactFieldMatchesByte(selected, offset) : [];
            observation.textContent = matches.length
                ? `Correlated: exact value match with ${matches.join(", ")} across ${selected.length}/${selected.length} captures`
                : "Changing";
        }
        tr.append(offsetCell, valuesCell, bitsCell, observation);
        table.append(tr);
    }
    body.append(table);

    const bitTitle = document.createElement("h4");
    bitTitle.textContent = "Changing bytes";
    body.append(bitTitle);
    for (const offset of changing) {
        const block = document.createElement("div");
        block.className = "rx-infer-bit-block";
        const title = document.createElement("strong");
        title.textContent = `Byte ${offset}`;
        block.append(title);
        selected.forEach((capture, i) => {
            const row = document.createElement("div");
            const value = capture.bytes[offset];
            row.textContent = `${inferenceLabel(i)}  ${value == null ? "—" : value.toString(16).padStart(2, "0").toUpperCase()}  ${value == null ? "--------" : value.toString(2).padStart(8, "0")}`;
            block.append(row);
        });
        body.append(block);
    }

    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Correlations are descriptive only. Matching changes do not prove a field's encoding or meaning.";
    body.append(note);
    $("rx-infer-panel").hidden = false;
}

const PRESET_STORAGE_KEY = "rfcat-web.protocol-presets";
const presetCaptureRoles = new Map();

function selectedInferenceCaptures() {
    return [...comparedCaptureIndexes].sort((a, b) => a - b)
        .map((index) => ({ index, capture: rxCaptures[index] })).filter(({ capture }) => capture);
}

function sumMod255(bytes, start, end) {
    let sum = 0;
    for (let i = start; i <= end; i++) sum = (sum + bytes[i]) % 255;
    return sum;
}

function inferChecksum(captures, offset) {
    if (offset < 1 || captures.some((capture) => capture.bytes.length <= offset)) return null;
    if (captures.every((capture) => sumMod255(capture.bytes, 0, offset - 1) === capture.bytes[offset])) {
        return { algorithm: "sum-mod-255", start: 0, end: offset - 1 };
    }
    return null;
}

function suggestedPresetFields(captures) {
    const maxLength = Math.max(...captures.map((capture) => capture.bytes.length));
    const fields = [];
    for (let offset = 0; offset < maxLength; offset++) {
        const values = captures.map((capture) => capture.bytes[offset]);
        const constant = values.every((value) => value != null && value === values[0]);
        const correlations = constant ? [] : exactFieldMatchesByte(captures, offset);
        const checksum = constant ? null : inferChecksum(captures, offset);
        fields.push({
            offset, length: 1,
            name: checksum ? "checksum" : (correlations[0] ?? `byte${offset}`),
            type: constant ? "constant" : (checksum ? "checksum-sum255" : "uint8"),
            value: constant ? values[0] : null,
            mask: 255,
            checksum,
        });
    }
    return fields;
}

function presetRow(field) {
    const row = document.createElement("div");
    row.className = "preset-field-row";
    row.dataset.offset = field.offset;
    const offset = document.createElement("input");
    offset.className = "preset-field-offset"; offset.type = "number"; offset.min = "0"; offset.value = field.offset;
    const length = document.createElement("input");
    length.className = "preset-field-length"; length.type = "number"; length.min = "1"; length.value = field.length ?? 1;
    const name = document.createElement("input");
    name.className = "preset-field-name"; name.value = field.name;
    const type = document.createElement("select");
    type.className = "preset-field-type";
    for (const [value, label] of [["constant","Constant"],["uint8","uint8"],["uint16be","uint16 BE"],["uint16le","uint16 LE"],["bytes","Byte range"],["bitfield","Bit field"],["ignore","Ignore"],["checksum-sum255","Checksum sum mod 255"]]) {
        const option = document.createElement("option"); option.value=value; option.textContent=label; type.append(option);
    }
    type.value = field.type;
    const value = document.createElement("input");
    value.className = "preset-field-value";
    value.placeholder = "hex / mask";
    value.value = field.type === "constant" ? field.value.toString(16).padStart(2,"0").toUpperCase() : (field.type === "bitfield" ? (field.mask ?? 255).toString(16).padStart(2,"0").toUpperCase() : "");
    row.append(offset,length,name,type,value);
    return row;
}

function renderPresetRoles(entries) {
    const host=$("preset-capture-roles"); host.replaceChildren();
    entries.forEach(({index},i)=>{
        if(!presetCaptureRoles.has(index)) presetCaptureRoles.set(index,"positive");
        const row=document.createElement("label"); row.className="preset-role";
        const select=document.createElement("select");
        [["positive","Should match"],["negative","Should reject"],["unknown","Unknown"]].forEach(([v,l])=>{const o=document.createElement("option");o.value=v;o.textContent=l;select.append(o);});
        select.value=presetCaptureRoles.get(index);
        select.onchange=()=>presetCaptureRoles.set(index,select.value);
        row.append(document.createTextNode(`${inferenceLabel(i)} `),select); host.append(row);
    });
}

function renderPresetBuilder() {
    const entries=selectedInferenceCaptures(); if(entries.length<2)return;
    const captures=entries.map(x=>x.capture);
    $("preset-length").value=String(Math.max(...captures.map(x=>x.bytes.length)));
    renderPresetRoles(entries);
    const host=$("preset-fields"); host.replaceChildren();
    const head=document.createElement("div"); head.className="preset-field-head";
    ["Offset","Length","Name","Type","Value / mask"].forEach(label=>{const s=document.createElement("span");s.textContent=label;head.append(s);}); host.append(head);
    suggestedPresetFields(captures).forEach(field=>host.append(presetRow(field)));
    $("preset-result").replaceChildren(); $("preset-builder").hidden=false;
}

function readPresetDefinition() {
    const fields=[...$("preset-fields").querySelectorAll(".preset-field-row")].map(row=>{
        const type=row.querySelector(".preset-field-type").value, raw=row.querySelector(".preset-field-value").value.trim();
        const offset=Number(row.querySelector(".preset-field-offset").value), length=Math.max(1,Number(row.querySelector(".preset-field-length").value)||1);
        const field={offset,length,name:row.querySelector(".preset-field-name").value.trim()||`field${offset}`,type};
        if(type==="constant") field.value=parseInt(raw,16);
        if(type==="bitfield") field.mask=parseInt(raw||"FF",16);
        if(type==="checksum-sum255"){field.algorithm="sum-mod-255";field.start=0;field.end=offset-1;}
        return field;
    });
    return {schema:"rfcat-web-protocol",version:1,id:$("preset-id").value.trim()||"draft-protocol",name:$("preset-name").value.trim()||"Draft Protocol",frame:{length:Number($("preset-length").value)||null},fields};
}

function validatePreset(preset) {
    if(preset?.schema!=="rfcat-web-protocol"||preset.version!==1||!Array.isArray(preset.fields)) throw new Error("Unsupported protocol preset schema");
    for(const field of preset.fields) if(!Number.isInteger(field.offset)||field.offset<0||!Number.isInteger(field.length)||field.length<1) throw new Error("Invalid field range");
    return preset;
}

function decodeWithPreset(bytes,preset) {
    if(preset.frame?.length && bytes.length!==preset.frame.length) return {matched:false,error:`length ${bytes.length}, expected ${preset.frame.length}`};
    const decoded={};
    for(const field of preset.fields){
        if(field.type==="ignore")continue;
        if(field.offset+field.length>bytes.length)return{matched:false,error:`missing range ${field.offset}..${field.offset+field.length-1}`};
        const b=bytes[field.offset];
        if(field.type==="constant"){if(!Number.isFinite(field.value)||b!==field.value)return{matched:false,error:`byte ${field.offset} constant mismatch`};}
        else if(field.type==="uint8")decoded[field.name]=b;
        else if(field.type==="uint16be"){decoded[field.name]=(b<<8)|bytes[field.offset+1];}
        else if(field.type==="uint16le"){decoded[field.name]=b|(bytes[field.offset+1]<<8);}
        else if(field.type==="bytes")decoded[field.name]=hex(bytes.slice(field.offset,field.offset+field.length));
        else if(field.type==="bitfield")decoded[field.name]=b&(Number.isFinite(field.mask)?field.mask:255);
        else if(field.type==="checksum-sum255"){const actual=sumMod255(bytes,field.start??0,field.end??field.offset-1);if(actual!==b)return{matched:false,error:`checksum mismatch at byte ${field.offset}: expected ${actual.toString(16).padStart(2,"0").toUpperCase()}`};decoded[field.name]=b;}
    }
    return{matched:true,fields:decoded};
}

function previewPreset() {
    const preset=validatePreset(readPresetDefinition()), entries=selectedInferenceCaptures(), result=$("preset-result"); result.replaceChildren();
    let positive=0,positiveOk=0,negative=0,negativeOk=0,unknown=0,unknownMatch=0;
    entries.forEach(({index,capture},i)=>{
        const decoded=decodeWithPreset(capture.bytes,preset),role=presetCaptureRoles.get(index)||"positive";
        if(role==="positive"){positive++;if(decoded.matched)positiveOk++;}else if(role==="negative"){negative++;if(!decoded.matched)negativeOk++;}else{unknown++;if(decoded.matched)unknownMatch++;}
        const row=document.createElement("div");row.className=`preset-preview-row ${decoded.matched?"matched":"rejected"}`;
        row.textContent=decoded.matched?`${inferenceLabel(i)} · ${role} · matched · ${Object.entries(decoded.fields).map(([k,v])=>`${k}=${v}`).join(" · ")}`:`${inferenceLabel(i)} · ${role} · rejected · ${decoded.error}`;result.append(row);
    });
    const summary=document.createElement("strong");summary.className="preset-preview-summary";
    summary.textContent=`Positive ${positiveOk}/${positive} matched · Negative ${negativeOk}/${negative} rejected · Unknown ${unknownMatch}/${unknown} matched`;result.prepend(summary);
}

function savedPresets(){try{return JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY)||"[]");}catch{return[];}}
function loadPresetIntoBuilder(preset){
    validatePreset(preset);$("preset-name").value=preset.name||"Draft Protocol";$("preset-id").value=preset.id||"draft-protocol";$("preset-length").value=preset.frame?.length||"";
    const host=$("preset-fields");host.replaceChildren();const head=document.createElement("div");head.className="preset-field-head";["Offset","Length","Name","Type","Value / mask"].forEach(x=>{const s=document.createElement("span");s.textContent=x;head.append(s);});host.append(head);
    preset.fields.forEach(field=>host.append(presetRow(field)));$("preset-builder").hidden=false;
}
$("preset-build").onclick=renderPresetBuilder;
$("preset-close").onclick=()=>{$("preset-builder").hidden=true;};
$("preset-preview").onclick=previewPreset;
$("preset-all-positive").onclick=()=>{selectedInferenceCaptures().forEach(({index})=>presetCaptureRoles.set(index,"positive"));renderPresetRoles(selectedInferenceCaptures());};
$("preset-last-negative").onclick=()=>{const e=selectedInferenceCaptures();e.forEach(({index})=>presetCaptureRoles.set(index,"positive"));if(e.length)presetCaptureRoles.set(e[e.length-1].index,"negative");renderPresetRoles(e);};
$("preset-save").onclick=()=>{const preset=validatePreset(readPresetDefinition()),presets=savedPresets().filter(x=>x.id!==preset.id);presets.push({...preset,updatedAt:new Date().toISOString()});localStorage.setItem(PRESET_STORAGE_KEY,JSON.stringify(presets));log(`Saved local protocol preset "${preset.name}"`);previewPreset();};
$("preset-export").onclick=()=>{const preset=validatePreset(readPresetDefinition()),blob=new Blob([JSON.stringify(preset,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`${preset.id||"protocol-preset"}.json`;a.click();URL.revokeObjectURL(url);};
$("preset-import").onclick=()=>$("preset-import-file").click();
$("preset-import-file").addEventListener("change",async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;try{loadPresetIntoBuilder(JSON.parse(await file.text()));log(`Imported protocol preset ${file.name}`);}catch(error){log(`Protocol preset import error: ${error.message}`);}});

$("rx-infer").onclick = renderFieldInference;
$("rx-infer-close").onclick = () => { $("rx-infer-panel").hidden = true; };

$("rx-compare").onclick = renderCaptureCompare;
$("rx-compare-close").onclick = () => { $("rx-compare-panel").hidden = true;
    $("rx-infer-panel").hidden = true; };

function renderRxCapture(capture) {
    const captureIndex = rxCaptures.push(capture) - 1;
    if (activeSessionId) $("session-status").textContent = "Modified";
    $("packetList").querySelector(".empty")?.remove();

    const el = document.createElement("div");
    el.className = "packet";
    el.dataset.captureIndex = String(captureIndex);

    const selector = document.createElement("label");
    selector.className = "rx-compare-select";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = comparedCaptureIndexes.has(captureIndex);
    checkbox.setAttribute("aria-label", "Select capture for comparison");
    checkbox.onchange = () => {
        if (checkbox.checked) comparedCaptureIndexes.add(captureIndex);
        else comparedCaptureIndexes.delete(captureIndex);
        el.classList.toggle("compare-selected", checkbox.checked);
        updateCompareButton();
    };
    selector.append(checkbox, document.createTextNode(" Compare"));
    el.append(selector);

    const meta = document.createElement("div");
    meta.className = "meta";
    const when = capture.timestamp ? new Date(capture.timestamp) : new Date();
    meta.textContent = `${Number.isNaN(when.getTime()) ? "Imported" : when.toLocaleTimeString()} · ${capture.bytes.length} bytes` +
        (capture.imported ? " · imported" : "") +
        (capture.rssi != null ? ` · ${Number(capture.rssi).toFixed(1)} dBm · LQI ${capture.lqi ?? "—"}${capture.crcOk ? " · CRC OK" : ""}` : "");
    el.append(meta);

    if (capture.error) {
        const error = document.createElement("div");
        error.className = "rx-error";
        error.textContent = `${capture.protocol ?? capture.decoder ?? "Decoder"}: ${capture.error}`;
        el.append(error);
    } else if (capture.decoder) {
        const result = document.createElement("div");
        result.className = "decoded";
        const strong = document.createElement("strong");
        strong.textContent = capture.protocol ?? capture.decoder;
        result.append(strong, document.createTextNode(capture.summary ? ` · ${capture.summary}` : ""));
        el.append(result);
        if (capture.fields) {
            const fields = document.createElement("div");
            fields.className = "rx-fields";
            fields.textContent = Object.entries(capture.fields).map(([k, v]) => `${k}=${v}`).join(" · ");
            el.append(fields);
        }
    } else {
        const rejected = document.createElement("div");
        rejected.className = "rx-rejected";
        rejected.textContent = capture.decodeMode === "raw" ? "Raw capture" : "Unknown / rejected";
        el.append(rejected);
    }

    const raw = document.createElement("div");
    raw.className = "hex";
    raw.textContent = hex(capture.bytes);
    el.append(raw);

    const actions = document.createElement("div");
    actions.className = "rx-capture-actions";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy hex";
    copy.onclick = async () => {
        try {
            await navigator.clipboard.writeText(hex(capture.bytes));
            copy.textContent = "Copied";
            setTimeout(() => { copy.textContent = "Copy hex"; }, 1200);
        } catch (error) {
            log(`Clipboard unavailable: ${error.message}`);
        }
    };
    actions.append(copy);

    if (capture.decoder && capture.fields && getProtocol(capture.decoder)) {
        const useTx = document.createElement("button");
        useTx.type = "button";
        useTx.textContent = "Use for TX";
        useTx.onclick = () => {
            const protocol = getProtocol(capture.decoder);
            protocolSelect.value = protocol.id;
            renderProtocolFields(protocolFields, protocol);
            for (const [field, value] of Object.entries(capture.fields)) {
                const input = protocolFields.querySelector(`[data-protocol-field="${field}"]`);
                if (!input) continue;
                if (input.type === "checkbox") input.checked = Boolean(value);
                else input.value = String(value);
                input.dispatchEvent(new Event("change", { bubbles: true }));
            }
            document.querySelector(".transmitter-card")?.setAttribute("open", "");
            updateProtocolPreview();
            log(`Loaded ${protocol.name} capture into transmitter fields; transmission was not started`);
        };
        actions.append(useTx);
    }
    el.append(actions);
    el.classList.toggle("filtered", !rxCaptureVisible(capture));
    $("packetList").prepend(el);
}

function parseImportedHex(value) {
    if (typeof value !== "string") throw new Error("Capture is missing hex data");
    const clean = value.replace(/[^0-9a-f]/gi, "");
    if (!clean.length || clean.length % 2) throw new Error("Capture hex must contain complete bytes");
    return Uint8Array.from(clean.match(/../g).map((pair) => parseInt(pair, 16)));
}

function redecodeImportedCapture(item) {
    const bytes = parseImportedHex(item.hex);
    const mode = selectedRxProtocolId();
    const decoded = decodeRxPacket(bytes, mode, {
        frequencyHz: item.frequencyHz ?? Number($("freq").value) * 1e6,
        dataRate: item.dataRate ?? Number($("drate").value),
        rssi: item.rssi ?? null,
        lqi: item.lqi ?? null,
        crcOk: item.crcOk ?? null,
    }, protocols);

    pc++;
    bc += bytes.length;
    if (decoded && !decoded.error) decodedCount++;
    else if (mode !== "raw") rejectedCount++;

    return {
        timestamp: item.timestamp ?? new Date().toISOString(),
        bytes,
        rssi: item.rssi ?? null,
        lqi: item.lqi ?? null,
        crcOk: item.crcOk ?? null,
        decoder: decoded?.protocol?.id ?? null,
        protocol: decoded?.protocol?.name ?? null,
        summary: decoded?.summary ?? null,
        fields: decoded?.fields ?? null,
        error: decoded?.error ?? null,
        imported: true,
        frequencyHz: item.frequencyHz ?? null,
        dataRate: item.dataRate ?? null,
        bandwidthKHz: item.bandwidthKHz ?? null,
        modulation: item.modulation ?? null,
        syncWord: item.syncWord ?? null,
        decodeMode: mode,
    };
}

function redecodeOfflineCaptures() {
    const imported = rxCaptures.filter((capture) => capture.imported);
    if (!imported.length) return;

    const source = imported.map((capture) => ({
        timestamp: capture.timestamp,
        hex: hex(capture.bytes),
        rssi: capture.rssi,
        lqi: capture.lqi,
        crcOk: capture.crcOk,
        frequencyHz: capture.frequencyHz,
        dataRate: capture.dataRate,
        bandwidthKHz: capture.bandwidthKHz,
        modulation: capture.modulation,
        syncWord: capture.syncWord,
    }));

    rxCaptures.length = 0;
    comparedCaptureIndexes.clear();
    updateCompareButton();
    $("rx-compare-panel").hidden = true;
    $("rx-infer-panel").hidden = true;
    pc = bc = decodedCount = rejectedCount = duplicateCount = 0;
    $("packetList").innerHTML = '<div class="empty">No packets captured.</div>';

    for (const item of source) renderRxCapture(redecodeImportedCapture(item));
    updateRxAnalyzerStats();
    log(`Re-decoded ${source.length} imported capture${source.length === 1 ? "" : "s"} using ${selectedRxProtocolId()}`);
}

$("rx-import").onclick = () => $("rx-import-file").click();
$("rx-import-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed)) throw new Error("RX capture JSON must contain an array");
        let imported = 0;
        for (const item of parsed) {
            try {
                renderRxCapture(redecodeImportedCapture(item));
                imported++;
            } catch (error) {
                log(`Skipped imported capture: ${error.message}`);
            }
        }
        updateRxAnalyzerStats();
        log(`Imported and re-decoded ${imported} RX capture${imported === 1 ? "" : "s"} using ${selectedRxProtocolId()}`);
    } catch (error) {
        log(`RX import error: ${error.message}`);
    }
});

$("rx-export").onclick = () => {
    if (!rxCaptures.length) return log("No RX captures to export");
    const data = rxCaptures.map(({ bytes, ...capture }) => ({
        ...capture,
        frequencyHz: capture.frequencyHz ?? Number($("freq").value) * 1e6,
        dataRate: capture.dataRate ?? Number($("drate").value),
        decodeMode: capture.decodeMode ?? selectedRxProtocolId(),
        hex: hex(bytes),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rfcat-rx-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

d.addEventListener("packet", (e) => {
    if (!listening) return;

    const received = e.detail;
    const status = splitRxStatus(received, $("appendstatus").checked);
    const b = status.payload;
    const decodeMode = selectedRxProtocolId();

    appendPulseBytes(b);
    const decodeBytes = decodeMode === "pocsag"
        ? (pocsagRolling = appendRollingBytes(pocsagRolling, b))
        : decodeMode === "retekess-t112"
            ? (t112Rolling = appendRollingBytes(t112Rolling, b))
            : decodeMode === "retekess-t119"
                ? (t119Rolling = appendRollingBytes(t119Rolling, b))
                : decodeMode === "retekess-td157"
                    ? (td157Rolling = appendRollingBytes(td157Rolling, b))
                    : decodeMode === "retekess-td161"
                        ? (td161Rolling = appendRollingBytes(td161Rolling, b))
                        : decodeMode === "retekess-td164"
                            ? (td164Rolling = appendRollingBytes(td164Rolling, b))
                            : decodeMode === "retekess-td165"
                                ? (td165Rolling = appendRollingBytes(td165Rolling, b))
                                : decodeMode === "retekess-td174"
                                    ? (td174Rolling = appendRollingBytes(td174Rolling, b))
                                    : b;
    const decoded = decodeRxPacket(decodeBytes, decodeMode, {
        frequencyHz: Number($("freq").value) * 1e6,
        dataRate: Number($("drate").value),
        rssi: status.rssi,
        lqi: status.lqi,
        crcOk: status.crcOk,
    }, protocols);

    pc++;
    bc += b.length;
    if (decoded && !decoded.error) decodedCount++;
    else if (decodeMode !== "raw") rejectedCount++;

    // LRS hardware sync can occasionally false-lock. Count rejected RF events
    // in analyzer statistics, but only surface checksum-valid LRS pages.
    if (decodeMode === "lrs" && decoded?.protocol?.id !== "lrs") {
        updateRxAnalyzerStats();
        return;
    }

    const fingerprint = pocsagFingerprint(decoded);
    const duplicatePocsag = fingerprint != null && fingerprint === lastPocsagFingerprint;
    if (fingerprint != null) lastPocsagFingerprint = fingerprint;
    if (duplicatePocsag) duplicateCount++;
    updateRxAnalyzerStats();
    if (status.rssi != null) $("rssi").textContent = `${status.rssi.toFixed(1)} dBm`;
    if (status.lqi != null) $("lqi").textContent = String(status.lqi);

    if (duplicatePocsag) {
        log(`POCSAG duplicate suppressed: ${decoded.summary}`);
        return;
    }

    const capture = {
        timestamp: new Date().toISOString(),
        bytes: b,
        rssi: status.rssi,
        lqi: status.lqi,
        crcOk: status.crcOk,
        decoder: decoded?.protocol?.id ?? null,
        protocol: decoded?.protocol?.name ?? null,
        summary: decoded?.summary ?? null,
        fields: decoded?.fields ?? null,
        error: decoded?.error ?? null,
        frequencyHz: Number($("freq").value) * 1e6,
        dataRate: Number($("drate").value),
        bandwidthKHz: Number($("bw").value),
        modulation: Number($("mod").value),
        syncWord: $("sync").value,
        decodeMode,
    };
    renderRxCapture(capture);

    log(`RF RX ${b.length} bytes${decoded?.protocol ? ` · ${decoded.protocol.name}` : ""}: ${hex(b)}`);
});

$("clear").onclick = () => {
    $("packetList").innerHTML =
        '\<div class="empty">No packets captured.\</div>';

    pc = bc = decodedCount = rejectedCount = duplicateCount = 0;
    rxCaptures.length = 0;
    resetPocsagRolling();

    updateRxAnalyzerStats();
};

$("clearlog").onclick = () => ($("log").textContent = "");

navigator.usb?.addEventListener("disconnect", (e) => {
    if (e.device === d.device) {
        setMonitor(false);

        d.running = false;

        d.device = null;

        document.body.classList.remove("connected");

        $("status").textContent = "Disconnected";

        $("connect").textContent = "Connect YS1";

        enabled(false);

        log("Device disconnected");
    }
});

log(
    navigator.usb
        ? "WebUSB ready. Connect a YARD Stick One."
        : "WebUSB unavailable in this browser.",
);
