import { bitsOf, packWaveform, pulseEncode, makeOokAnalysis, configureOok, transmitOok, repeatFields, bitsFromBytes, decodePulseBits, valueFromBits } from "./retekess-common.js";

export function encodeRetekessT112({ systemId, pagerId, cancel = false, frames = 12 }) {
    systemId = Number(systemId); pagerId = Number(pagerId); frames = Number(frames);
    if (!Number.isInteger(systemId) || systemId < 0 || systemId > 8191) throw new Error("System ID must be 0–8191");
    if (!Number.isInteger(pagerId) || pagerId < 0 || pagerId > 1023) throw new Error("Pager ID must be 0–1023");
    const payload = bitsOf(systemId, 13, { lsb: true }) + bitsOf(pagerId, 10, { lsb: true }) + (cancel ? "1" : "0");
    const frame = pulseEncode(payload, { zero: [3, 9], one: [9, 3], prefix: "11" + "0".repeat(59) });
    const waveform = frame;
    const { bytes, padding } = packWaveform(waveform);
    return { bytes, waveform, padding, payload, systemId, pagerId, cancel: !!cancel, frames, frameSymbols: frame.length };
}

export function decodeRetekessT112(bytes) {
    const bits = bitsFromBytes(bytes);
    const runs = [];
    for (let i = 0; i < bits.length;) {
        const level = bits[i];
        let end = i + 1;
        while (end < bits.length && bits[end] === level) end++;
        runs.push({ level, start: i, length: end - i });
        i = end;
    }

    // Suppress one-sample slicer glitches seen in real CC1111 raw OOK captures.
    // A glitch between equal-level runs is absorbed into the surrounding run.
    for (let i = 1; i + 1 < runs.length;) {
        if (runs[i].length <= 1 && runs[i - 1].level === runs[i + 1].level) {
            runs[i - 1].length += runs[i].length + runs[i + 1].length;
            runs.splice(i, 2);
            continue;
        }
        i++;
    }

    // OTA captures are asynchronously sampled. Accept timing around the
    // nominal 2/59 sync and 3/9 or 9/3 data runs rather than exact bit strings.
    for (let r = 0; r + 49 < runs.length; r++) {
        const syncHigh = runs[r], syncLow = runs[r + 1];
        if (syncHigh.level !== "1" || syncLow.level !== "0") continue;
        if (syncHigh.length < 1 || syncHigh.length > 5 || syncLow.length < 48) continue;

        let at = r + 2, payload = "", timingError = 0;
        for (let n = 0; n < 24 && at + 1 < runs.length; n++, at += 2) {
            const high = runs[at], low = runs[at + 1];
            if (high.level !== "1" || low.level !== "0") break;
            const total = high.length + low.length;
            // The last symbol's LOW tail can merge with radio idle time because
            // T112 frames are transmitted as separate host-side packets.
            if (n === 23 && low.length > 15) {
                if (high.length >= 1 && high.length <= 6) {
                    payload += "0";
                    timingError += Math.abs(high.length - 3);
                    continue;
                }
                if (high.length >= 7 && high.length <= 12) {
                    payload += "1";
                    timingError += Math.abs(high.length - 9);
                    continue;
                }
                break;
            }
            if (total < 8 || total > 16) break;
            const zeroError = Math.abs(high.length - 3) + Math.abs(low.length - 9);
            const oneError = Math.abs(high.length - 9) + Math.abs(low.length - 3);
            const best = Math.min(zeroError, oneError);
            if (best > 5) break;
            payload += zeroError <= oneError ? "0" : "1";
            timingError += best;
        }
        if (payload.length !== 24) continue;

        const systemId = valueFromBits(payload.slice(0, 13), { lsb: true });
        const pagerId = valueFromBits(payload.slice(13, 23), { lsb: true });
        const cancel = payload[23] === "1";
        const payloadHex = parseInt(payload, 2).toString(16).padStart(6, "0").toUpperCase();
        return {
            fields: { systemId, pagerId, cancel, payloadBits: payload, payloadHex },
            summary: `T112 system ${systemId} · pager ${pagerId} · ${cancel ? "cancel" : "page"} · bits ${payload} · hex ${payloadHex}`,
            bitOffset: syncHigh.start,
            timingError,
        };
    }
    return null;
}

const protocol = {
 id:"retekess-t112", name:"Retekess T112", menuGroup:"Restaurant Pagers", decoderGroup:"Retekess",
 description:"Retekess T112 24-bit OOK: 13-bit system ID, 10-bit pager ID, cancel flag.",
 rxPreset:{frequency:433_920_000,dataRate:9090.909,bandwidth:93_750,modulation:0x30,syncWord:0x0000,syncMode:0,manchester:false,lengthMode:"fixed",packetLength:255,crc:false,whitening:false,appendStatus:false,addressCheck:0,deviceAddress:0,lowball:true},
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
 async transmit(d,e,v){
  const start=Number(v.pagerId),end=Math.max(start,Number(v.sequenceEnd??start));
  const frames=Math.max(1,Math.trunc(Number(v.frames??12)));
  for(let pagerId=start;pagerId<=end;pagerId++){
   const next=encodeRetekessT112({...v,pagerId,frames:1});
   for(let frame=0;frame<frames;frame++) await transmitOok(d,next.bytes,{...v,repeat:0});
  }
 }
};
export default protocol;
