const MSG_WIND_TEMP_HUMIDITY = 0x38;

/*
 * Acurite 5n1 channel encoding in byte 0:
 *
 * A = 11
 * B = 10
 * C = 00
 */
function channelBits(channel) {
    switch (String(channel).toUpperCase()) {
        case "A":
            return 0xc0;

        case "B":
            return 0x80;

        case "C":
            return 0x00;

        default:
            throw new Error("Channel must be A, B, or C");
    }
}

/*
 * Set bit 7 so that the complete byte has
 * even parity.
 *
 * Acurite uses bit 7 as parity on bytes 2..6.
 */
function withEvenParity(value) {
    value &= 0x7f;

    let ones = 0;

    for (let bit = 0; bit < 7; bit++) {
        ones += (value >> bit) & 1;
    }

    if (ones & 1) {
        value |= 0x80;
    }

    return value;
}

function checksum(bytes) {
    let sum = 0;

    for (const byte of bytes) {
        sum = (sum + byte) & 0xff;
    }

    return sum;
}

export function buildAcurite5n1TempHumidity({
    channel = "A",
    sequence = 0,
    sensorId = 0x123,
    batteryLow = false,
    windRaw = 10,
    temperatureF = 72.5,
    humidity = 50,
} = {}) {
    sequence = Number(sequence);
    sensorId = Number(sensorId);
    windRaw = Number(windRaw);
    temperatureF = Number(temperatureF);
    humidity = Number(humidity);

    if (!Number.isInteger(sequence) || sequence < 0 || sequence > 2) {
        throw new Error("Sequence must be 0, 1, or 2");
    }

    if (!Number.isInteger(sensorId) || sensorId < 0 || sensorId > 0xfff) {
        throw new Error("Sensor ID must be 0–4095");
    }

    if (!Number.isInteger(windRaw) || windRaw < 0 || windRaw > 255) {
        throw new Error("Raw wind speed must be 0–255");
    }

    if (
        !Number.isFinite(temperatureF) ||
        temperatureF < -40 ||
        temperatureF > 158
    ) {
        throw new Error("Temperature must be -40 to 158 °F");
    }

    if (!Number.isInteger(humidity) || humidity < 0 || humidity > 100) {
        throw new Error("Humidity must be 0–100");
    }

    const bytes = new Uint8Array(8);

    /*
     * Byte 0:
     *
     * cc ss IIII
     *
     * channel:  bits 7..6
     * sequence: bits 5..4
     * ID MSB:   bits 3..0
     */
    bytes[0] =
        channelBits(channel) |
        ((sequence & 0x03) << 4) |
        ((sensorId >> 8) & 0x0f);

    /*
     * Byte 1:
     *
     * ID low byte.
     */
    bytes[1] = sensorId & 0xff;

    /*
     * Byte 2:
     *
     * p B 111000
     *
     * bit 6 = battery OK
     * lower 6 bits = message type 0x38
     */
    bytes[2] = withEvenParity(
        (batteryLow ? 0x00 : 0x40) | MSG_WIND_TEMP_HUMIDITY,
    );

    /*
     * Wind speed is split across bytes 3 and 4:
     *
     * byte 3: low 5 bits = wind[7:3]
     * byte 4: bits 6..4 = wind[2:0]
     */
    bytes[3] = withEvenParity((windRaw >> 3) & 0x1f);

    /*
     * Temperature encoding:
     *
     * raw = F * 10 + 400
     *
     * Decoder:
     *
     * F = (raw - 400) / 10
     */
    const tempRaw = Math.round(temperatureF * 10 + 400);

    bytes[4] = withEvenParity(
        ((windRaw & 0x07) << 4) | ((tempRaw >> 7) & 0x0f),
    );

    bytes[5] = withEvenParity(tempRaw & 0x7f);

    bytes[6] = withEvenParity(humidity & 0x7f);

    /*
     * Byte 7:
     *
     * ordinary 8-bit additive checksum.
     * No parity bit.
     */
    bytes[7] = checksum(bytes.subarray(0, 7));

    return {
        bytes,

        channel,
        sequence,
        sensorId,
        batteryLow,
        windRaw,
        temperatureF,
        humidity,
        tempRaw,
    };
}
function bytesToBitsMsbFirst(bytes) {
    let bits = "";

    for (const byte of bytes) {
        for (let bit = 7; bit >= 0; bit--) {
            bits += (byte >> bit) & 1;
        }
    }

    return bits;
}

/*
 * Acurite 5n1 OOK pulse-width encoding.
 *
 * We represent time using a 100 us RF quantum:
 *
 * short HIGH ~= 300 us -> 3T
 * long  HIGH ~= 500 us -> 5T
 *
 * Each pulse is followed by a LOW period so that
 * the complete bit cell is approximately constant.
 *
 * 0 -> HIGH 3T, LOW 5T
 * 1 -> HIGH 5T, LOW 3T
 *
 * T = 100 us
 * RF symbol rate = 10,000 symbols/sec
 */
export function encodeAcurite5n1Rf(bytes) {
    if (!(bytes instanceof Uint8Array)) {
        throw new TypeError("Acurite packet must be a Uint8Array");
    }

    if (bytes.length !== 8) {
        throw new Error("Acurite 5n1 packet must contain 8 bytes");
    }

    const bits = bytesToBitsMsbFirst(bytes);

    /*
     * Acurite sync:
     *
     * ~620 us HIGH + ~596 us LOW
     *
     * At our ~102 us quantum:
     * 6T HIGH + 6T LOW
     */
    const SYNC = "111111000000";
    const INTER_PACKET_GAP = "0".repeat(20);

    let dataWaveform = "";

    for (const bit of bits) {
        dataWaveform += bit === "0" ? "110000" : "111100";
    }

    const frame = SYNC + dataWaveform;

    const waveform =
        frame + INTER_PACKET_GAP + frame + INTER_PACKET_GAP + frame;

    const padding = (8 - (waveform.length % 8)) % 8;

    const padded = waveform + "0".repeat(padding);

    const rfBytes = new Uint8Array(padded.length / 8);

    for (let i = 0; i < padded.length; i += 8) {
        rfBytes[i / 8] = parseInt(padded.slice(i, i + 8), 2);
    }

    return {
        bytes: rfBytes,
        packetBytes: bytes,
        bits,
        waveform,
        symbols: waveform.length,
        padding,
    };
}
const acurite5n1 = {
    id: "acurite-5n1",
    name: "Acurite 5n1",

    description:
        "Acurite 5n1 weather sensor temperature/humidity test transmitter.",

    fields: [
        {
            id: "channel",
            label: "Channel",
            type: "select",
            value: "A",
            options: [
                { value: "A", label: "A" },
                { value: "B", label: "B" },
                { value: "C", label: "C" },
            ],
        },
        {
            id: "sequence",
            label: "Sequence",
            type: "number",
            min: 0,
            max: 2,
            step: 1,
            value: 0,
        },
        {
            id: "sensorId",
            label: "Sensor ID",
            type: "number",
            min: 0,
            max: 4095,
            step: 1,
            value: 291, // 0x123
        },
        {
            id: "temperatureF",
            label: "Temperature (°F)",
            type: "number",
            min: -40,
            max: 158,
            step: 0.1,
            value: 72.5,
        },
        {
            id: "humidity",
            label: "Humidity (%)",
            type: "number",
            min: 0,
            max: 100,
            step: 1,
            value: 50,
        },
        {
            id: "windRaw",
            label: "Raw Wind Speed",
            type: "number",
            min: 0,
            max: 255,
            step: 1,
            value: 10,
        },
        {
            id: "batteryLow",
            label: "Battery Low",
            type: "checkbox",
            value: false,
        },
    ],

    encode(values) {
        const packet = buildAcurite5n1TempHumidity({
            channel: values.channel,
            sequence: Number(values.sequence),
            sensorId: Number(values.sensorId),
            temperatureF: Number(values.temperatureF),
            humidity: Number(values.humidity),
            windRaw: Number(values.windRaw),
            batteryLow: Boolean(values.batteryLow),
        });

        const rf = encodeAcurite5n1Rf(packet.bytes);

        return {
            ...packet,

            bytes: rf.bytes,
            packetBytes: packet.bytes,
            bits: rf.bits,
            waveform: rf.waveform,
            symbols: rf.symbols,

            summary:
                `Acurite 5n1 TX: ` +
                `CH${packet.channel} · ` +
                `ID 0x${packet.sensorId
                    .toString(16)
                    .toUpperCase()
                    .padStart(3, "0")} · ` +
                `${packet.temperatureF.toFixed(1)} °F · ` +
                `${packet.humidity}% RH · ` +
                `packet ${[...packet.bytes]
                    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
                    .join(" ")} · ` +
                `${rf.symbols} RF symbols`,
        };
    },

    async configure(device) {
        await device.mode(0x04);

        await device.setFrequency(433_920_000);

        await device.setModulation(0x30);

        /*
         * Our current RF representation uses
         * T = 100 us.
         */
        await device.setDataRate(9_800);

        await device.setSync(0x0000, 0);

        await device.setManchester(false);

        await device.configureAskOokPa();
    },

    async transmit(device, encoded) {
        await device.setAmpMode(true);

        try {
            await device.transmit(encoded.bytes, 0, 0);
        } finally {
            await device.mode(0x04);
            await device.setAmpMode(false);
        }
    },
};

export default acurite5n1;
