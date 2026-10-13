import {parseIntelHex,encodeRecord,USER_START,FLASH_END} from "./intel-hex.js";
export class MockBootloaderTransport{
 constructor(){this.flash=new Uint8Array(FLASH_END).fill(255);this.queue=[];this.fail=false;this.disconnected=false;}
 async write(bytes){
  if(this.disconnected)throw Error("Disconnected");if(this.fail)throw Error("Injected transfer failure");
  const line=new TextDecoder().decode(bytes).trim();const recordType=parseInt(line.slice(7,9),16);
  if(recordType===0){const r=parseIntelHex(line+"\n:00000001FF").records[0];if(r.address<USER_START||r.address+r.data.length>FLASH_END)throw Error("Protected");this.flash.set(r.data,r.address);this.queue.push(48);}
  else if(recordType===0x23){this.flash.fill(255,USER_START);this.queue.push(48);}
  else if(recordType===0x22){this.queue.push(48);}
  else if(recordType===0x25){const address=parseInt(line.slice(3,7),16),len=parseInt(line.slice(9,13),16);for(let i=0;i<len;i+=16)this.queue.push(encodeRecord(0,address+i,Array.from(this.flash.slice(address+i,address+Math.min(len,i+16)))));this.queue.push(":00000001FF");}
  else if(recordType!==1)throw Error("Unsupported mock command");
 }
 async readByte(){const v=this.queue.shift();if(typeof v!=="number")throw Error("Missing status");return v;}
 async readLine(){const v=this.queue.shift();if(typeof v!=="string")throw Error("Missing line");return v;}
}
