const PREAMBLE = "aaaaaa";
const SYNC_WORD = "fc2d";
const STATION_ID = "0";

function hex(value, width) {
    return Number(value)
        .toString(16)
        .padStart(width, "0")
        .toLowerCase();
}

function checksum(hexString) {
    if (hexString.length % 2 !== 0) {
        throw new Error("LRS checksum input must contain complete bytes");
    }

    let sum = 0;

    for (let i = 0; i < hexString.length; i += 2) {
        sum += parseInt(hexString.slice(i, i + 2), 16);
    }

    return sum % 255;
}

export function encodeLrsPager({
    restaurantId,
    pagerId,
    alertType,
}) {
    restaurantId = Number(restaurantId);
    pagerId = Number(pagerId);
    alertType = Number(alertType);

    if (!Number.isInteger(restaurantId) ||
        restaurantId < 0 ||
        restaurantId > 255) {
        throw new Error("Restaurant ID must be 0–255");
    }

    if (!Number.isInteger(pagerId) ||
        pagerId < 0 ||
        pagerId > 0xfff) {
        throw new Error("Pager ID must be 0–4095");
    }

    if (!Number.isInteger(alertType) ||
        alertType < 0 ||
        alertType > 255) {
        throw new Error("Alert type must be 0–255");
    }

    const restaurant = hex(restaurantId, 2);
    const pager = hex(pagerId, 3);
    const alert = hex(alertType, 2);

    /*
     * Matches the normal-page packet construction in lrs-ys1.py:
     *
     * pre
     * sync word
     * restaurant ID
     * station ID
     * pager ID
     * 0000000000
     * alert
     * checksum
     */

    const body =
        PREAMBLE +
        SYNC_WORD +
        restaurant +
        STATION_ID +
        pager +
        "0000000000" +
        alert;

    const crc = hex(checksum(body), 2);
    const packet = body + crc;

    const bytes = new Uint8Array(packet.length / 2);

    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(packet.slice(i * 2, i * 2 + 2), 16);
    }

    return {
        bytes,
        hex: packet,
        restaurantId,
        pagerId,
        alertType,
        checksum: crc,
    };
}