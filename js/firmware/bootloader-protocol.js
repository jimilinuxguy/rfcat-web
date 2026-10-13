import {encodeRecord,parseIntelHex} from "./intel-hex.js";
export const BOOTLOADER_USB={vendorId:0x1d50,productId:0x605c};
export const ERROR_CODES=["OK","Invalid HEX","Bad checksum","Bad address","Bad record type","Record too long"];
export const COMMANDS=Object.freeze({reset:encodeRecord(0x22,0),eraseAll:encodeRecord(0x23,0),run:encodeRecord(1,0)});
export function readCommand(address,length){
 if(!Number.isInteger(address)||!Number.isInteger(length)||address<0||length<1||address+length>0x8000||length>0xffff)throw Error("Invalid read range");
 return encodeRecord(0x25,address,[length>>8,length&255]);
}
export function pageEraseCommand(page){if(!Number.isInteger(page)||page<5||page>=32)throw Error("Protected page");return encodeRecord(0x24,0,[page]);}
export class BootloaderProtocol{
 constructor(transport){this.transport=transport;}
 async command(line,{read=false}={}){
  await this.transport.write(new TextEncoder().encode(line+"\n"));
  if(read){let text="";for(let i=0;i<128;i++){const next=await this.transport.readLine();if(!next.trim())continue;text+=next+"\n";if(next.trim().toUpperCase()===":00000001FF")return parseIntelHex(text).memory;}throw Error("Bootloader read exceeded response limit");}
  const code=await this.transport.readByte();
  if(code<48||code>53)throw Error("Unexpected bootloader status");
  if(code!==48)throw Error("Bootloader: "+ERROR_CODES[code-48]);
 }
 async erase(){return this.command(COMMANDS.eraseAll);}
 async write(record){return this.command(record.hex);}
 async read(address,length){return this.command(readCommand(address,length),{read:true});}
 async verify(plan,onProgress=()=>{}){
  for(let i=0;i<plan.records.length;i++){const r=plan.records[i],got=await this.read(r.address,r.data.length);for(let j=0;j<r.data.length;j++)if(got.get(r.address+j)!==r.data[j])throw Error("Readback mismatch at 0x"+(r.address+j).toString(16));onProgress((i+1)/plan.records.length);}
 }
 async flash(plan,onProgress=()=>{}){
  await this.erase();onProgress({phase:"erased",fraction:0});
  for(let i=0;i<plan.records.length;i++){await this.write(plan.records[i]);onProgress({phase:"writing",fraction:(i+1)/plan.records.length});}
  await this.verify(plan,fraction=>onProgress({phase:"verifying",fraction}));
  onProgress({phase:"verified",fraction:1});
 }
 async run(){await this.transport.write(new TextEncoder().encode(COMMANDS.run+"\n"));}
}
