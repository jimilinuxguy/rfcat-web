import { bitsOf, packWaveform, pulseEncode, makeOokAnalysis, configureOok, transmitOok, repeatFields, bitsFromBytes, decodePulseBits, valueFromBits } from "./retekess-common.js";

export function encodeRetekessT112({ systemId, pagerId, cancel = false, frames = 12 }) {
    systemId = Number(systemId); pagerId = Number(pagerId); frames = Number(frames);
    if (!Number.isInteger(systemId) || systemId < 0 || systemId > 8191) throw new Error("System ID must be 0–8191");
    if (!Number.isInteger(pagerId) || pagerId < 0 || pagerId > 1023) throw new Error("Pager ID must be 0–1023");
    const payload = bitsOf(systemId, 13, { lsb: true }) + bitsOf(pagerId, 10, { lsb: true }) + (cancel ? "1" : "0");
    const frame = pulseEncode(payload, { zero: [3, 9], one: [9, 3], prefix: "11" + "0".repeat(59) });
    const waveform = frame.repeat(frames);
    const { bytes, padding } = packWaveform(waveform);
    return { bytes, waveform, padding, payload, systemId, pagerId, cancel: !!cancel, frames };
}

export function decodeRetekessT112(bytes) {
    const bits = bitsFromBytes(bytes);
    for (let start = 0; start + 349 <= bits.length; start++) {
        const sync = bits.slice(start, start + 61);
        if (sync !== "11" + "0".repeat(59)) continue;
        const payload = decodePulseBits(bits.slice(start + 61, start + 349));
        if (!payload || payload.length !== 24) continue;
        const systemId = valueFromBits(payload.slice(0, 13), { lsb: true });
        const pagerId = valueFromBits(payload.slice(13, 23), { lsb: true });
        const cancel = payload[23] === "1";
        return { fields: { systemId, pagerId, cancel }, summary: `T112 system ${systemId} · pager ${pagerId} · ${cancel ? "cancel" : "page"}`, bitOffset: start };
    }
    return null;
}

const protocol = {
 id:"retekess-t112", name:"Retekess T112", menuGroup:"Restaurant Pagers",
 description:"Retekess T112 24-bit OOK: 13-bit system ID, 10-bit pager ID, cancel flag.",
 decode(bytes){return decodeRetekessT112(bytes);},
 fields:[
  {id:"systemId",label:"System ID",type:"number",min:0,max:8191,value:0},
  {id:"pagerId",label:"Pager ID",type:"number",min:0,max:1023,value:69},{id:"sequenceEnd",label:"Sequence through pager",type:"number",min:0,max:1023,value:69},
  {id:"cancel",label:"Cancel alert",type:"checkbox",value:false},
  {id:"frames",label:"Frames",type:"number",min:1,max:30,value:12},
  ...repeatFields(0)
 ],
 encode(v){const e=encodeRetekessT112(v);return {...e,bits:e.payload,analysis:makeOokAnalysis(e.waveform,9090.909,"Retekess T112 OOK",[{name:"Base timing",symbols:1,requestedUs:110},{name:"Data bit",symbols:12,requestedUs:1320}]),modulation:"ASK/OOK",summary:`Retekess T112 TX: system ${e.systemId} · pager ${e.pagerId} · ${e.cancel?"cancel":"page"} · ${e.frames} frames`};},
 async configure(d){await configureOok(d,433_920_000,9090.909);},
 async transmit(d,e,v){const start=Number(v.pagerId),end=Math.max(start,Number(v.sequenceEnd??start));for(let pagerId=start;pagerId<=end;pagerId++){const next=encodeRetekessT112({...v,pagerId});await transmitOok(d,next.bytes,v);}}
};
export default protocol;
