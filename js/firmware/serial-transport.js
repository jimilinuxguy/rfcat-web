import {BOOTLOADER_USB} from "./bootloader-protocol.js";
export class SerialBootloaderTransport{
 constructor(){this.port=null;this.reader=null;this.writer=null;this.pending=[];}
 async connect(){
  if(!navigator.serial)throw Error("Web Serial unavailable: use desktop Chrome/Edge on HTTPS or localhost");
  const port=await navigator.serial.requestPort({filters:[{usbVendorId:BOOTLOADER_USB.vendorId,usbProductId:BOOTLOADER_USB.productId}]});
  const info=port.getInfo();
  if(info.usbVendorId!==BOOTLOADER_USB.vendorId||info.usbProductId!==BOOTLOADER_USB.productId)throw Error("Not a YARD Stick One bootloader serial device");
  await port.open({baudRate:115200});this.port=port;this.reader=port.readable.getReader();this.writer=port.writable.getWriter();return info;
 }
 async write(bytes){if(!this.writer)throw Error("Bootloader disconnected");await this.writer.write(bytes);}
 async nextByte(){
  if(this.pending.length)return this.pending.shift();
  if(!this.reader)throw Error("Bootloader disconnected");
  const result=await Promise.race([this.reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error("Bootloader read timeout; reconnect the device")),5000))]);
  if(result.done||!result.value?.length)throw Error("Bootloader disconnected");
  this.pending.push(...result.value);return this.pending.shift();
 }
 async readByte(){return this.nextByte();}
 async readLine(){let s="";for(let i=0;i<100;i++){const b=await this.nextByte();if(b===10)return s.replace(/\r$/,"");s+=String.fromCharCode(b);}throw Error("Bootloader line too long");}
 async close(){try{await this.reader?.cancel();}catch{}try{this.reader?.releaseLock();}catch{}try{this.writer?.releaseLock();}catch{}try{await this.port?.close();}catch{}this.port=null;this.reader=null;this.writer=null;this.pending=[];}
}
