import fs from "node:fs";
import path from "node:path";
import { buildSchraderSmd3ma4LogicalFrame, encodeSchraderSmd3ma4Waveform, SCHRADER_SMD3MA4_SYMBOL_US } from "../js/protocols/schrader-smd3ma4.js";
const SAMPLE_RATE=1_000_000, DIR="tmp/schrader-smd3ma4";
function cu8(w){const n=Math.round(SCHRADER_SMD3MA4_SYMBOL_US*SAMPLE_RATE/1e6),sil=5000,b=Buffer.alloc((sil*2+w.length*n)*2);let o=0;const put=(i,q)=>{b[o++]=i;b[o++]=q};for(let i=0;i<sil;i++)put(127,127);for(const x of w)for(let i=0;i<n;i++)put(x==="1"?255:127,127);for(let i=0;i<sil;i++)put(127,127);return b;}
fs.mkdirSync(DIR,{recursive:true});
const f=buildSchraderSmd3ma4LogicalFrame({id:0x98e08e,flags:6,pressureRaw:180});
const rf=encodeSchraderSmd3ma4Waveform(f.bits);
const file=path.join(DIR,"schrader-smd3ma4_1Msps.cu8");fs.writeFileSync(file,cu8(rf.waveform));
console.log(`Logical: ${f.bits}`);console.log(`RF symbols: ${rf.symbols}`);console.log(`File: ${file}`);
