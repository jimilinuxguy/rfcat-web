import binary from "./binary.js";
import came12 from "./came12.js";
import lrs from "./lrs.js";
import tesla from "./tesla.js";
import pwm from "./pwm.js";
import oregonThgr122nx from "./oregon-thgr122nx.js";
import acurite5n1 from "./acurite-5n1.js";
import schraderMrxgg4 from "./schrader-mrxgg4.js";
import schraderEg53ma4 from "./schrader-eg53ma4.js";
import { schraderSmd3ma4, schraderNis315g3 } from "./schrader-smd3ma4.js";
import schraderMrxbc5a4 from "./schrader-mrxbc5a4.js";
import touchtunes from "./touchtunes.js";

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
    acurite5n1,
    schraderMrxgg4,
    schraderEg53ma4,
    schraderSmd3ma4,
    schraderNis315g3,
    schraderMrxbc5a4,
    touchtunes
]);

export function getProtocol(id) {
    return protocols.find((protocol) => protocol.id === id) ?? null;
}