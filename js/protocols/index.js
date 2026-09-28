import binary from "./binary.js";
import came12 from "./came12.js";
import lrs from "./lrs.js";
import tesla from "./tesla.js";
import pwm from "./pwm.js";
import oregonThgr122nx from "./oregon-thgr122nx.js";
import acurite5n1 from "./acurite-5n1.js";

// During the migration we'll add these one at a time:
// import lrs from "./lrs.js";
// import tesla from "./tesla.js";

export const protocols = Object.freeze([
    binary,
    came12,
    lrs,
    tesla,
    pwm,
    oregonThgr122nx,
    acurite5n1
]);

export function getProtocol(id) {
    return protocols.find((protocol) => protocol.id === id) ?? null;
}