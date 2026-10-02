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
    applySelectedRxProtocol();
});
rxProtocolModel.addEventListener("change", applySelectedRxProtocol);

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
window.addEventListener("resize", debounce(renderPulseAnalyzer, 100));
renderPulseAnalyzer();

function rxCaptureVisible(capture) {
    const filter = $("rx-filter").value;
    if (filter === "decoded") return !!capture.decoded && !capture.decoded.error;
    if (filter === "unknown") return !capture.decoded || !!capture.decoded.error;
    return true;
}

function applyRxFilter() {
    for (const el of $("packetList").querySelectorAll(".packet")) {
        const capture = rxCaptures[Number(el.dataset.captureIndex)];
        el.classList.toggle("filtered", !capture || !rxCaptureVisible(capture));
    }
}

$("rx-filter").addEventListener("change", applyRxFilter);

$("rx-export").onclick = () => {
    if (!rxCaptures.length) return log("No RX captures to export");
    const data = rxCaptures.map(({ bytes, ...capture }) => ({ ...capture, hex: hex(bytes) }));
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

    // LRS hardware sync can occasionally false-lock. Only surface frames that
    // pass the protocol header, structure, and checksum validation.
    if (decodeMode === "lrs" && decoded?.protocol?.id !== "lrs") return;

    const fingerprint = pocsagFingerprint(decoded);
    const duplicatePocsag = fingerprint != null && fingerprint === lastPocsagFingerprint;
    if (fingerprint != null) lastPocsagFingerprint = fingerprint;

    pc++;
    bc += b.length;
    $("packets").textContent = pc;
    $("bytes").textContent = bc;
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
    };
    const captureIndex = rxCaptures.push(capture) - 1;

    $("packetList").querySelector(".empty")?.remove();
    const el = document.createElement("div");
    el.className = "packet";
    el.dataset.captureIndex = String(captureIndex);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${new Date().toLocaleTimeString()} · ${b.length} bytes` +
        (status.rssi != null ? ` · ${status.rssi.toFixed(1)} dBm · LQI ${status.lqi}${status.crcOk ? " · CRC OK" : ""}` : "");
    el.append(meta);

    if (decoded?.error) {
        const error = document.createElement("div");
        error.className = "rx-error";
        error.textContent = `${decoded.protocol.name}: ${decoded.error}`;
        el.append(error);
    } else if (decoded) {
        const result = document.createElement("div");
        result.className = "decoded";
        const strong = document.createElement("strong");
        strong.textContent = decoded.protocol.name;
        result.append(strong, document.createTextNode(decoded.summary ? ` · ${decoded.summary}` : ""));
        el.append(result);
        if (decoded.fields) {
            const fields = document.createElement("div");
            fields.className = "rx-fields";
            fields.textContent = Object.entries(decoded.fields).map(([k, v]) => `${k}=${v}`).join(" · ");
            el.append(fields);
        }
    }

    const raw = document.createElement("div");
    raw.className = "hex";
    raw.textContent = hex(b);
    el.append(raw);
    el.classList.toggle("filtered", !rxCaptureVisible(capture));
    $("packetList").prepend(el);

    log(`RF RX ${b.length} bytes${decoded?.protocol ? ` · ${decoded.protocol.name}` : ""}: ${hex(b)}`);
});

$("clear").onclick = () => {
    $("packetList").innerHTML =
        '\<div class="empty">No packets captured.\</div>';

    pc = bc = 0;
    rxCaptures.length = 0;
    resetPocsagRolling();

    $("packets").textContent = $("bytes").textContent = "0";
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
