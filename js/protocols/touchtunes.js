import { buildWaveformAnalysis, packWaveform } from "../encoding/waveform.js";

export const TOUCHTUNES_FREQUENCY_HZ = 433_920_000;
export const TOUCHTUNES_SYMBOL_RATE = 1766;
export const TOUCHTUNES_T_US = 1_000_000 / TOUCHTUNES_SYMBOL_RATE;

export const TOUCHTUNES_COMMANDS = Object.freeze({
    On_Off: 0x78,
    Pause: 0x32,
    P1: 0x70,
    P2_Edit_Queue: 0x60,
    P3_Skip: 0xca,
    F1_Restart: 0x20,
    F2_Key: 0xa0,
    F3_Mic_A_Mute: 0x30,
    F4_Mic_B_Mute: 0xb0,
    Mic_Vol_Plus_Up_Arrow: 0xf2,
    Mic_Vol_Minus_Down_Arrow: 0x80,
    A_Left_Arrow: 0x84,
    B_Right_Arrow: 0xc4,
    OK: 0x44,
    Music_Vol_Zone_1Up: 0xd0,
    Music_Vol_Zone_1Down: 0x50,
    Music_Vol_Zone_2Up: 0x90,
    Music_Vol_Zone_2Down: 0x10,
    Music_Vol_Zone_3Up: 0xc0,
    Music_Vol_Zone_3Down: 0x40,
    "1": 0xf0,
    "2": 0x08,
    "3": 0x88,
    "4": 0x48,
    "5": 0xc8,
    "6": 0x28,
    "7": 0xa8,
    "8": 0x68,
    "9": 0xe8,
    "0": 0x98,
    "Music_Karaoke(*)": 0x18,
    "Lock_Queue(#)": 0x58,
});

function byteBits(value) {
    return (value & 0xff).toString(2).padStart(8, "0");
}

export function buildTouchTunesLogicalFrame(pin, command) {
    pin = Number(pin);
    command = Number(command);
    if (!Number.isInteger(pin) || pin < 0 || pin > 255) throw new Error("PIN must be an integer from 0 to 255");
    if (!Number.isInteger(command) || command < 0 || command > 255) throw new Error("Command must be an 8-bit value");

    // The original encoder starts with sync byte 0x5D, then appends the
    // PIN least-significant bit first, followed by command and complement.
    const pinLsbFirst = byteBits(pin).split("").reverse().join("");
    return byteBits(0x5d) + pinLsbFirst + byteBits(command) + byteBits(command ^ 0xff);
}

export function encodeTouchTunes(pin, command) {
    const logicalBits = buildTouchTunesLogicalFrame(pin, command);
    let body = "";
    for (const bit of logicalBits) body += bit === "0" ? "10" : "1000";

    // The_Fonz.py: 16 HIGH + 8 LOW preamble, encoded body, then 1000 tail.
    const waveform = "1".repeat(16) + "0".repeat(8) + body + "1000";
    const packed = packWaveform(waveform);
    return { ...packed, logicalBits, body, pin: Number(pin), command: Number(command) };
}

const touchtunes = {
    id: "touchtunes",
    name: "TouchTunes Remote (Jukebox)",
    description: "TouchTunes 433.92 MHz remote encoder ported from The_Fonz.py. For jukeboxes/test receivers you own or are authorized to control; brute-force and jamming features are intentionally not included.",
    fields: [
        { id: "pin", label: "Remote PIN (0-255)", type: "number", min: 0, max: 255, step: 1, value: 0 },
        {
            id: "command", label: "Command", type: "select", value: "0x44",
            options: Object.entries(TOUCHTUNES_COMMANDS).map(([label, value]) => ({
                label: `${label} (0x${value.toString(16).toUpperCase().padStart(2, "0")})`,
                value: `0x${value.toString(16).padStart(2, "0")}`,
            })),
        },
        { id: "repeats", label: "Transmissions", type: "number", min: 1, max: 20, step: 1, value: 1 },
    ],

    encode(values) {
        const command = Number.parseInt(String(values.command), 16);
        const encoded = encodeTouchTunes(Number(values.pin), command);
        const analysis = buildWaveformAnalysis({
            waveform: encoded.waveform,
            symbolRate: TOUCHTUNES_SYMBOL_RATE,
            label: "TouchTunes ASK/OOK",
            requestedTimings: [
                { name: "T", symbols: 1, requestedUs: TOUCHTUNES_T_US },
                { name: "0 pulse", symbols: 2, requestedUs: 2 * TOUCHTUNES_T_US },
                { name: "1 pulse", symbols: 4, requestedUs: 4 * TOUCHTUNES_T_US },
                { name: "Preamble HIGH", symbols: 16, requestedUs: 16 * TOUCHTUNES_T_US },
                { name: "Preamble LOW", symbols: 8, requestedUs: 8 * TOUCHTUNES_T_US },
            ],
        });
        return {
            ...encoded,
            analysis,
            modulation: "ASK/OOK · 0→10, 1→1000",
            summary: `TouchTunes TX: PIN ${encoded.pin} · command 0x${command.toString(16).toUpperCase().padStart(2, "0")} · ${encoded.symbols} symbols · ${encoded.bytes.length} bytes`,
        };
    },

    async configure(device) {
        await device.mode(0x04);
        await device.setFrequency(TOUCHTUNES_FREQUENCY_HZ);
        await device.setModulation(0x30);
        await device.setDataRate(TOUCHTUNES_SYMBOL_RATE);
        await device.setSync(0x0000, 0);
        await device.setManchester(false);
        await device.configureAskOokPa();
    },

    async transmit(device, encoded, values) {
        const transmissions = Number(values.repeats ?? 1);
        if (!Number.isInteger(transmissions) || transmissions < 1 || transmissions > 20) throw new Error("Transmissions must be from 1 to 20");
        await device.setAmpMode(true);
        try {
            await device.transmit(encoded.bytes, transmissions - 1, 0);
        } finally {
            await device.mode(0x04);
            await device.setAmpMode(false);
        }
    },
};

export default touchtunes;
