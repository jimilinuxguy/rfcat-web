import binary from "./binary.js";
import came12 from "./came12.js";
import lrs from "./lrs.js";
import tesla from "./tesla.js";

// During the migration we'll add these one at a time:
// import lrs from "./lrs.js";
// import tesla from "./tesla.js";

export const protocols = Object.freeze([
    binary,
    came12,
    lrs,
    tesla,
]);

export function getProtocol(id) {
    return protocols.find((protocol) => protocol.id === id) ?? null;
}