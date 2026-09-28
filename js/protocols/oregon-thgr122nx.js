import { encodeManchester } from "../encoding/manchester.js";

const SENSOR_ID = [0x1, 0xd, 0x2, 0x0];

function checksumNibbles(nibbles) {
    let sum = 0;

    for (const nibble of nibbles) {
        sum += nibble;
        sum += (sum >> 8) & 1;
        sum &= 0xff;
    }

    return sum;
}

function crc8Nibbles(nibbles, initial = 0x42) {
    let crc = initial;

    /*
     * Oregon CRC-8-CCITT:
     * polynomial x^8 + x^2 + x + 1 = 0x07.
     *
     * Nibbles enter the CRC MSB-first even though
     * they're transmitted OTA LSB-first.
     */
    for (const nibble of nibbles) {
        for (let bit = 3; bit >= 0; bit--) {
            const input = (nibble >> bit) & 1;
            const top = (crc >> 7) & 1;

            crc = (crc << 1) & 0xff;

            if (top ^ input) {
                crc ^= 0x07;
            }
        }
    }

    return crc;
}

function nibbleBitsLsbFirst(nibble) {
    let bits = "";

    for (let bit = 0; bit < 4; bit++) {
        bits += (nibble >> bit) & 1;
    }

    return bits;
}

export function buildThgr122nxNibbles({
    channel = 1,
    rollingId = 0x6b,
    temperature = 19.0,
    humidity = 37,
    batteryLow = false,
    unknownNibble = 0x8,
} = {}) {
    channel = Number(channel);
    rollingId = Number(rollingId);
    temperature = Number(temperature);
    humidity = Number(humidity);

    if (![1, 2, 3].includes(channel)) {
        throw new Error("Channel must be 1, 2, or 3");
    }

    if (!Number.isInteger(rollingId) || rollingId < 0 || rollingId > 0xff) {
        throw new Error("Rolling ID must be 0–255");
    }

    if (
        !Number.isFinite(temperature) ||
        temperature < -99.9 ||
        temperature > 99.9
    ) {
        throw new Error("Temperature must be between -99.9 and 99.9 °C");
    }

    if (!Number.isInteger(humidity) || humidity < 0 || humidity > 99) {
        throw new Error("Humidity must be 0–99%");
    }

    const n = new Array(24).fill(0);

    // Preamble.
    n[0] = 0xf;
    n[1] = 0xf;
    n[2] = 0xf;
    n[3] = 0xf;

    // Sync.
    n[4] = 0xa;

    // Sensor ID 1D20.
    n[5] = SENSOR_ID[0];
    n[6] = SENSOR_ID[1];
    n[7] = SENSOR_ID[2];
    n[8] = SENSOR_ID[3];

    // Channel.
    n[9] = 1 << (channel - 1);

    // Rolling ID.
    n[10] = (rollingId >> 4) & 0xf;
    n[11] = rollingId & 0xf;

    // Flags.
    n[12] = batteryLow ? 0x4 : 0x0;

    // Temperature BCD.
    const temp10 = Math.round(Math.abs(temperature) * 10);

    n[13] = temp10 % 10;
    n[14] = Math.floor(temp10 / 10) % 10;
    n[15] = Math.floor(temp10 / 100) % 10;

    // Sign.
    n[16] = temperature < 0 ? 0x8 : 0x0;

    // Humidity BCD.
    n[17] = humidity % 10;
    n[18] = Math.floor(humidity / 10);

    // THGR122NX status / trend nibble.
    n[19] = unknownNibble;

    /*
     * Simple checksum over payload nibbles 5..19.
     */
    const checksum = checksumNibbles(n.slice(5, 20));

    // Low nibble first.
    n[20] = checksum & 0xf;
    n[21] = (checksum >> 4) & 0xf;

    /*
     * CRC excludes rolling ID nibbles 10 and 11.
     *
     * Included:
     *   5..9
     *   12..19
     */
    const crcInput = [...n.slice(5, 10), ...n.slice(12, 20)];

    const crc = crc8Nibbles(crcInput, 0x42);

    // Low nibble first.
    n[22] = crc & 0xf;
    n[23] = (crc >> 4) & 0xf;

    return {
        nibbles: n,
        checksum,
        crc,
        channel,
        rollingId,
        temperature,
        humidity,
        batteryLow,
    };
}

export function encodeThgr122nx(options = {}) {
    const frame = buildThgr122nxNibbles(options);

    /*
     * Oregon sends every nibble LSB-first.
     */
    let logicalBits = "";

    for (const nibble of frame.nibbles) {
        logicalBits += nibbleBitsLsbFirst(nibble);
    }

    /*
     * Oregon v2.1 transmits every logical bit twice:
     *
     * logical 0 -> 10
     * logical 1 -> 01
     *
     * Our generic Manchester encoder supports
     * selecting this polarity explicitly.
     */
    const encoded = encodeManchester(logicalBits, {
        zero: "10",
        one: "01",
    });

    return {
        ...frame,

        logicalBits,

        bytes: encoded.bytes,
        waveform: encoded.waveform,
        symbols: encoded.symbols,
        padding: encoded.padding,
    };
}
const oregonThgr122nx = {
    id: "oregon-thgr122nx",
    name: "Oregon Scientific THGR122NX",

    description: "Oregon Scientific v2.1 temperature/humidity sensor.",

    fields: [
        {
            id: "channel",
            label: "Channel",
            type: "select",
            value: "1",
            options: [
                { value: "1", label: "1" },
                { value: "2", label: "2" },
                { value: "3", label: "3" },
            ],
        },
        {
            id: "rollingId",
            label: "Rolling ID",
            type: "number",
            min: 0,
            max: 255,
            value: 107, // 0x6B
        },
        {
            id: "temperature",
            label: "Temperature (°C)",
            type: "number",
            min: -99.9,
            max: 99.9,
            step: 0.1,
            value: 19.0,
        },
        {
            id: "humidity",
            label: "Humidity (%)",
            type: "number",
            min: 0,
            max: 99,
            step: 1,
            value: 37,
        },
        {
            id: "batteryLow",
            label: "Battery Low",
            type: "checkbox",
            value: false,
        },
    ],

    encode(values) {
        const result = encodeThgr122nx({
            channel: Number(values.channel),
            rollingId: Number(values.rollingId),
            temperature: Number(values.temperature),
            humidity: Number(values.humidity),
            batteryLow: Boolean(values.batteryLow),
        });

        return {
            ...result,

            summary:
                `THGR122NX TX: ` +
                `CH${result.channel} · ` +
                `${result.temperature.toFixed(1)} °C · ` +
                `${result.humidity}% RH · ` +
                `ID 0x${result.rollingId
                    .toString(16)
                    .toUpperCase()
                    .padStart(2, "0")} · ` +
                `${result.logicalBits.length} bits · ` +
                `${result.bytes.length} bytes`,
        };
    },

    async configure(device) {
        await device.mode(0x04);

        await device.setFrequency(433_920_000);

        /*
         * We're generating Manchester ourselves.
         *
         * Oregon logical rate = 1024 bit/s.
         * Each logical bit becomes two RF symbols.
         */
        await device.setModulation(0x30);
        await device.setDataRate(2048);

        await device.setSync(0x0000, 0);
        await device.setManchester(false);

        await device.configureAskOokPa();
    },

    async transmit(device, encoded) {
        await device.setAmpMode(true);

        try {
            /*
             * First OTA test: ONE generated frame.
             *
             * Don't use RFCat repeat yet because
             * we eventually need Oregon-specific
             * inter-frame timing.
             */
            await device.transmit(encoded.bytes, 0, 0);
        } finally {
            await device.mode(0x04);
            await device.setAmpMode(false);
        }
    },
};

export default oregonThgr122nx;
