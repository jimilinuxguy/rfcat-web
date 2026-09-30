// RFCat Web UI/event wiring. Hardware/protocol logic lives under js/.
import { C } from "./js/rfcat/constants.js";
import { R } from "./js/radio/registers.js";
import { RFCatUSB } from "./js/rfcat/device.js";
import { hex } from "./js/core/bytes.js";
import { $, log } from "./js/ui/log.js";
import { renderWaveformPreview, clearWaveformPreview } from "./js/ui/waveform.js";
import { exportProtocolToIPython } from "./js/export/ipython.js";

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

$("listen").onclick = async () => {
    try {
        listening = !listening;

        $("listen").textContent = listening
            ? "Stop listening"
            : "Start listening";

        if (listening) {
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

            log("Listening stopped");

            $("rxstate").textContent = "IDLE";
        }
    } catch (e) {
        listening = false;

        $("listen").textContent = "Start listening";

        log(`ERROR: ${e.message}`);
    }
};

d.addEventListener("packet", (e) => {
    if (!listening) return;

    const b = e.detail;

    pc++;

    bc += b.length;

    $("packets").textContent = pc;

    $("bytes").textContent = bc;

    const empty = $(".empty");

    if (empty) empty.remove();

    const el = document.createElement("div");

    el.className = "packet";

    el.innerHTML =
        `\<div class="meta">` +
        `${new Date().toLocaleTimeString()} · ${b.length} bytes` +
        `\</div>` +
        `\<div class="hex">\</div>`;

    el.querySelector(".hex").textContent = hex(b);

    $("packetList").prepend(el);

    log(`RF RX ${b.length} bytes: ${hex(b)}`);
});


$("clear").onclick = () => {
    $("packetList").innerHTML =
        '\<div class="empty">No packets captured.\</div>';

    pc = bc = 0;

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
