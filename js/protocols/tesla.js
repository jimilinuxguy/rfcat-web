const TESLA_CHARGE_PORT_PACKET = new Uint8Array([
    0x15, 0x55, 0x55, 0x51, 0x59, 0x4c, 0xb5, 0x55,
    0x52, 0xd5, 0x4b, 0x4a, 0xd3, 0x4c, 0xab, 0x4b,
    0x15, 0x94, 0xcb, 0x33, 0x33, 0x2d, 0x54, 0xb4,
    0x56, 0x9a, 0x65, 0x5a, 0x48, 0xac, 0xc6, 0x59,
    0x99, 0x99, 0x69, 0xa5, 0xb2, 0xb4, 0xd4, 0x2a,
    0xd2, 0x80,
]);

export function encodeTeslaChargePort({
    repeats = 5,
} = {}) {
    repeats = Number(repeats);

    if (!Number.isInteger(repeats) || repeats < 1 || repeats > 6) {
        throw new Error("Tesla repeats must be between 1 and 6");
    }

    const bytes = new Uint8Array(
        TESLA_CHARGE_PORT_PACKET.length * repeats
    );

    for (let i = 0; i < repeats; i++) {
        bytes.set(
            TESLA_CHARGE_PORT_PACKET,
            i * TESLA_CHARGE_PORT_PACKET.length
        );
    }

    return {
        bytes,
        repeats,
        frameLength: TESLA_CHARGE_PORT_PACKET.length,
        totalLength: bytes.length,
    };
}