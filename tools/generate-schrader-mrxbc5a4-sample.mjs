import fs from "node:fs";
import path from "node:path";
import { buildSchraderMrxbc5a4LogicalFrame, encodeSchraderMrxbc5a4Manchester, SCHRADER_MRXBC5A4_HALF_BIT_US } from "../js/protocols/schrader-mrxbc5a4.js";
const SAMPLE_RATE=1_000_000, DIR="tmp/schrader-mrxbc5a4";
function cu8(w){const n=Math.round(SCHRADER_MRXBC5A4_HALF_BIT_US*SAMPLE_RATE/1e6),sil=5000,b=Buffer.alloc((sil*2+w.length*n)*2);let o=0;const put=(i,q)=>{b[o++]=i;b[o++]=q};for(let i=0;i<sil;i++)put(127,127);for(const x of w)for(let i=0;i<n;i++)put(x==="1"?255:127,127);for(let i=0;i<sil;i++)put(127,127);return b;}
fs.mkdirSync(DIR,{recursive:true});
const f=buildSchraderMrxbc5a4LogicalFrame({flags:2,id:0x224015,pressureKPa:249,temperatureC:20});const rf=encodeSchraderMrxbc5a4Manchester(f.bits);
const file=path.join(DIR,"schrader-mrxbc5a4_1Msps.cu8");fs.writeFileSync(file,cu8(rf.waveform));console.log(`Logical: ${f.bits}`);console.log(`Integrity: ${f.integrity.toString(2).padStart(2,"0")}`);console.log(`File: ${file}`);
