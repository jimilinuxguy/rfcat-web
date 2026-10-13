// Sequential CC1111 receive preset exploration. Packet bytes are not RF edge timings.
import { C } from "../rfcat/constants.js";
import { R } from "../radio/registers.js";
export const DEFAULT_SCAN_PRESETS = Object.freeze([
  { name:"ASK/OOK 4.8k", modulation:0x30, rate:4800, bandwidth:101562.5 },
  { name:"ASK/OOK 9.6k", modulation:0x30, rate:9600, bandwidth:203125 },
  { name:"2-FSK 4.8k", modulation:0x00, rate:4800, bandwidth:101562.5 },
  { name:"2-FSK 9.6k", modulation:0x00, rate:9600, bandwidth:203125 },
  { name:"GFSK 9.6k", modulation:0x10, rate:9600, bandwidth:203125 }
]);
const wait = (ms, signal) => new Promise(resolve=>{if(signal?.aborted)return resolve();const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal?.removeEventListener("abort",done);resolve();}signal?.addEventListener("abort",done,{once:true});});
export async function scanReceiverPresets(device, { frequencyHz, dwellMs=1200, presets=DEFAULT_SCAN_PRESETS, signal, onStep=()=>{} }={}) {
  if (!device?.device?.opened) throw Error("Connect YARD Stick One before scanning");
  if (!Number.isFinite(frequencyHz)||!((frequencyHz>=300e6&&frequencyHz<=348e6)||(frequencyHz>=387e6&&frequencyHz<=464e6)||(frequencyHz>=779e6&&frequencyHz<=928e6)))throw Error("Frequency outside supported CC1111 bands");
  if (!Number.isInteger(dwellMs)||dwellMs<100||dwellMs>10000)throw Error("Dwell must be 100–10000 ms");
  if (!Array.isArray(presets)||presets.length<1||presets.length>20)throw Error("Invalid preset list");
  const original=await device.config();
  const captured=[];
  const onPacket=event=>{const bytes=event.detail;if(bytes instanceof Uint8Array&&captured.length<200)captured.push(Array.from(bytes));};
  const results=[];
  try {
    await device.mode(C.RF_IDLE);
    await device.setFrequency(frequencyHz);
    for(const preset of presets){
      if(signal?.aborted)break;
      captured.length=0;
      await device.mode(C.RF_IDLE);
      await device.setModulation(preset.modulation);
      await device.setDataRate(preset.rate);
      await device.setBandwidth(preset.bandwidth);
      // Explicitly disable packet sync and CRC gating for discovery.
      await device.lowball();
      device.addEventListener("packet",onPacket);
      try{
        await device.mode(C.RF_RX);
        await wait(dwellMs,signal);
      }finally{
        device.removeEventListener("packet",onPacket);
        await device.mode(C.RF_IDLE);
      }
      const entry={preset:{...preset},frequencyHz,packetCount:captured.length,packetHex:captured.map(bytes=>bytes.map(v=>v.toString(16).padStart(2,"0")).join("")),evidenceType:"cc1111-packet-bytes",pulseTimingsAvailable:false,modulationVerified:false};
      results.push(entry);onStep(entry);
    }
  }finally{
    // Restore the complete modem/packet register block, including calibration.
    // RF is left IDLE deliberately: previous RX/TX state cannot safely be inferred.
    try{
      await device.mode(C.RF_IDLE);
      const regs=original.raw;
      // CC1111 writable configuration offsets, excluding reserved/read-only registers.
      const writable=[0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0a,0x0b,0x0c,0x0d,0x0e,0x0f,0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,0x1a,0x1b,0x1c,0x1d,0x1e,0x1f,0x20,0x21,0x23,0x24,0x25,0x26,0x27,0x28,0x29,0x2a,0x2b,0x2c];
      for(const i of writable)await device.poke(R.SYNC1+i,new Uint8Array([regs[i]]));
      // PATABLE is a separate burst register; restore only its first entry.
      await device.poke(R.PA_TABLE0,new Uint8Array([regs[0x2e]]));
    }catch(error){throw new Error("Receiver configuration restore failed: "+error.message);}
  }
  return {results,cancelled:!!signal?.aborted,restored:true,originalState:"left idle"};
}
