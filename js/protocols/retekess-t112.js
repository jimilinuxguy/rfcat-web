import { bitsOf, packWaveform, pulseEncode, makeOokAnalysis, configureOok, transmitOok, repeatFields } from "./retekess-common.js";

export function encodeRetekessT112({ systemId, pagerId, cancel = false, frames = 12 }) {
    systemId = Number(systemId); pagerId = Number(pagerId); frames = Number(frames);
    if (!Number.isInteger(systemId) || systemId < 0 || systemId > 8191) throw new Error("System ID must be 0–8191");
    if (!Number.isInteger(pagerId) || pagerId < 0 || pagerId > 1023) throw new Error("Pager ID must be 0–1023");
    const payload = bitsOf(systemId, 13, { lsb: true }) + bitsOf(pagerId, 10, { lsb: true }) + (cancel ? "1" : "0");
    const frame = pulseEncode(payload, { prefix: "11" + "0".repeat(59) });
    const waveform = frame.repeat(frames);
    const { bytes, padding } = packWaveform(waveform);
    return { bytes, waveform, padding, payload, systemId, pagerId, cancel: !!cancel, frames };
}

const protocol = {
 id:"retekess-t112", name:"Retekess T112", menuGroup:"Restaurant Pagers",
 description:"Retekess T112 24-bit OOK: 13-bit system ID, 10-bit pager ID, cancel flag.",
 fields:[
  {id:"systemId",label:"System ID",type:"number",min:0,max:8191,value:0},
  {id:"pagerId",label:"Pager ID",type:"number",min:0,max:1023,value:69},
  {id:"cancel",label:"Cancel alert",type:"checkbox",value:false},
  {id:"frames",label:"Frames",type:"number",min:1,max:30,value:12},
  ...repeatFields(0)
 ],
 encode(v){const e=encodeRetekessT112(v);return {...e,bits:e.payload,analysis:makeOokAnalysis(e.waveform,9090.909,"Retekess T112 OOK",[{name:"Base timing",symbols:1,requestedUs:110},{name:"Data bit",symbols:12,requestedUs:1320}]),modulation:"ASK/OOK",summary:`Retekess T112 TX: system ${e.systemId} · pager ${e.pagerId} · ${e.cancel?"cancel":"page"} · ${e.frames} frames`};},
 async configure(d){await configureOok(d,433_920_000,9090.909);},
 async transmit(d,e,v){await transmitOok(d,e.bytes,v);}
};
export default protocol;
