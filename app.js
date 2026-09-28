// RFCat Web UI/event wiring. Hardware/protocol logic lives under js/.
import { RADIO_PRESETS } from "./js/radio/presets.js";
import { C } from "./js/rfcat/constants.js";
import { R } from "./js/radio/registers.js";
import { RFCatUSB } from "./js/rfcat/device.js";
import { hex, parseHex } from "./js/core/bytes.js";
import { encodeCame12 } from "./js/protocols/came12.js";
import { parseBinarySymbols } from "./js/protocols/binary.js";
import { encodeLrsPager } from "./js/protocols/lrs.js";
import { encodeTeslaChargePort } from "./js/protocols/tesla.js";
import { $, log } from "./js/ui/log.js";

const d = new RFCatUSB();

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
    for (const id of ["apply", "readcfg", "idle", "rx", "listen", "transmit"])
        $(id).disabled = !v;
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

function showRadioPreset(preset) {
    $("freq").value = (preset.frequency / 1_000_000).toFixed(3);

    $("drate").value = String(preset.dataRate);

    $("mod").value = String(preset.modulation);

    $("sync").value = preset.syncWord
        .toString(16)
        .padStart(4, "0")
        .toUpperCase();

    $("syncmode").value = String(preset.syncMode);

    $("lowball").checked = Boolean(preset.lowball);

    if (preset.bandwidth !== undefined) {
        $("bw").value = String(preset.bandwidth / 1000);
    }
}

function getLrsAlert() {
    const value = $("lrs-alert").value;
    return value === "manual"
        ? Number($("lrs-manual-alert").value)
        : Number(value);
}

function updateLrsPreview() {
    try {
        const packet = encodeLrsPager({
            restaurantId: $("lrs-rest-id").value,
            pagerId: $("lrs-pager-id").value,
            alertType: getLrsAlert(),
        });
        $("lrs-packet-preview").textContent = packet.hex.toUpperCase();
    } catch (e) {
        $("lrs-packet-preview").textContent = e.message;
    }
}
function updateTeslaFrequency() {
    const mhz = Number($("tesla-frequency").value);

    $("freq").value = mhz;

    log(`Tesla frequency selected: ${mhz.toFixed(3)} MHz`);
}
function updateTeslaPreview() {
    try {
        const encoded = encodeTeslaChargePort({
            repeats: $("tesla-repeats").value,
        });

        $("tesla-packet-preview").textContent = hex(encoded.bytes);
    } catch (e) {
        $("tesla-packet-preview").textContent = e.message;
    }
}

function updateTxMode() {
    const mode = $("txmode").value;

    const isLrs = mode === "lrs";
    const isTesla = mode === "tesla";

    $("lrs-options").hidden = !isLrs;
    $("tesla-options").hidden = !isTesla;

    // Protocol modes generate their own payload.
    $("payload-row").hidden = isLrs || isTesla;

    if (RADIO_PRESETS[mode]) {
        showRadioPreset(RADIO_PRESETS[mode]);
    }

    if (isLrs) {
        updateLrsPreview();
    }

    if (isTesla) {
        updateTeslaPreview();
        updateTeslaFrequency();
    }
}

$("txmode").addEventListener("change", updateTxMode);
$("lrs-alert").addEventListener("change", () => {
    $("lrs-manual-row").hidden = $("lrs-alert").value !== "manual";
    updateLrsPreview();
});
for (const id of ["lrs-rest-id", "lrs-pager-id", "lrs-manual-alert"]) {
    $(id).addEventListener("input", updateLrsPreview);
}
updateTxMode();

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

$("transmit").onclick = async () => {
    try {
        const mode = $("txmode").value;

        let b;
        if (mode === "came12") {
            await d.setDataRate(3125);

            const encoded = encodeCame12($("payload").value, {
                repeats: 3,
                gapT: 31,
            });

            b = encoded.bytes;

            log(
                `CAME-12 TX: ${encoded.code} · ` +
                    `${encoded.repeats} bursts · ` +
                    `${encoded.waveform.length} symbols · ` +
                    `${b.length} bytes`,
            );
        } else if (mode === "binary") {
            const parsed = parseBinarySymbols($("payload").value);

            b = parsed.bytes;

            const rate = Number($("drate").value);
            const durationMs = (parsed.symbols / rate) * 1000;

            log(
                `OOK TX: ${parsed.symbols} symbols · ` +
                    `${b.length} bytes · ` +
                    `${hex(b)} · ` +
                    `~${durationMs.toFixed(3)} ms @ ${rate} baud`,
            );
        } else if (mode === "lrs") {
            await d.mode(C.RF_IDLE);
            await d.setFrequency(467_750_000);
            await d.setModulation(0x00); // 2-FSK
            await d.setSync(0x0000, 0);
            const deviation = await d.setDeviation(15_000);
            await d.setDataRate(625);
            await d.setManchester(true);
            const power = await d.setMaxPower();
            await d.setAmpMode(true);

            const encoded = encodeLrsPager({
                restaurantId: $("lrs-rest-id").value,
                pagerId: $("lrs-pager-id").value,
                alertType: getLrsAlert(),
            });

            log(
                `LRS TX: restaurant ${encoded.restaurantId} · ` +
                    `pager ${encoded.pagerId} · alert ${encoded.alertType} · ` +
                    `467.750 MHz · 2-FSK · 625 baud · ` +
                    `${Math.round(deviation)} Hz deviation · Manchester · ` +
                    `PA 0x${power.toString(16).toUpperCase()} · ${b.length} bytes`,
            );
        } else if (mode === "tesla") {
            const frequencyMHz = Number($("tesla-frequency").value);

            // Configure the radio automatically for Tesla TX.
            await d.mode(C.RF_IDLE);
            await d.setFrequency(frequencyMHz * 1_000_000);
            await d.setDataRate(2500);
            await d.setModulation(0x30); // ASK/OOK
            await d.setSync(0x0000, 0);
            await d.setManchester(false);

            const encoded = encodeTeslaChargePort({
                repeats: $("tesla-repeats").value,
            });

            b = encoded.bytes;

            log(
                `Tesla TX: ` +
                    `${frequencyMHz.toFixed(3)} MHz · ` +
                    `ASK/OOK · 2500 baud · ` +
                    `${encoded.repeats} frames · ` +
                    `${encoded.frameLength} bytes/frame · ` +
                    `${encoded.totalLength} bytes total`,
            );
            b = encoded.bytes;
        } else {
            b = parseHex($("payload").value);

            if (!b.length) {
                throw new Error("Enter a hex payload");
            }
        }

        if (b.length > 255) {
            throw new Error("TX payload cannot exceed 255 bytes");
        }

        if (mode === "tesla") {
            await d.setTxPaPower(1);
            await d.setAmpMode(true);
        }

        await d.transmit(
            b,
            Number($("repeat").value),
            Number($("offset").value),
        );

        log(`TX ${b.length} bytes: ${hex(b)}`);

        if (mode === "lrs" || mode === "tesla") {
            await d.mode(C.RF_IDLE);
            await d.setAmpMode(false);
        }
    } catch (e) {
        log(`ERROR: ${e.message}`);
    }
};

$("clear").onclick = () => {
    $("packetList").innerHTML =
        '\<div class="empty">No packets captured.\</div>';

    pc = bc = 0;

    $("packets").textContent = $("bytes").textContent = "0";
};

$("clearlog").onclick = () => ($("log").textContent = "");
$("tesla-frequency").addEventListener("change", () => {
    updateTeslaFrequency();
});
$("tesla-repeats").addEventListener("input", updateTeslaPreview);

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
