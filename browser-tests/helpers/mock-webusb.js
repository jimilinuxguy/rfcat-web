// Browser-only simulated CC1111 WebUSB transport. Never available in production.
export async function installMockWebUSB(page,{permissionDenied=false,pingTimeout=false,failWrites=0,dropPings=0}={}){
 await page.addInitScript(({permissionDenied,pingTimeout,failWrites,dropPings})=>{
  const registers=new Uint8Array(65536);
  const base=0xdf00; // CC1111 radio register addresses
  const freq=Math.floor(433920000*(65536/24000000));
  registers[base+0x09]=(freq>>16)&255;
  registers[base+0x0a]=(freq>>8)&255;
  registers[base+0x0b]=freq&255;
  registers[base+0x0c]=0x74;
  registers[base+0x0d]=0xa3;
  registers[base+0x0e]=0x30;
  registers[base+0x02]=0xff;
  registers[base+0x03]=0x04;
  registers[base+0x3b]=0x01;
  registers[base+0x04]=0x05;
  registers[base+0x00]=0xd3;registers[base+0x01]=0x91;
  let device;
  const listeners=new Map();
  const usb={
   addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
   removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
   async requestDevice({filters}){
    if(permissionDenied)throw new DOMException("User cancelled device selection","NotFoundError");
    if(!filters.some(f=>f.vendorId===0x1d50&&f.productId===0x6047))throw new Error("Missing RFCat USB filter");
    return device;
   }
  };
  let remainingWriteFailures=failWrites,remainingDroppedPings=dropPings;
  let pending=[];
  let waiter=null;
  function enqueue(bytes){if(waiter){const next=waiter;waiter=null;next(bytes);}else pending.push(bytes);}
  function response(app,cmd,payload){
   const frame=new Uint8Array(5+payload.length);
   frame.set([0x40,app,cmd,payload.length&255,payload.length>>8]);
   frame.set(payload,5);enqueue(frame);
  }
  device={
   vendorId:0x1d50,productId:0x6047,productName:"Mock YARD Stick One",
   opened:false,configuration:null,
   async open(){this.opened=true;},
   async reset(){pending=[];},
   async selectConfiguration(n){this.configuration={configurationValue:n};},
   async claimInterface(n){if(n!==0)throw new Error("Wrong interface");},
   async releaseInterface(){},
   async close(){this.opened=false;if(waiter){const done=waiter;waiter=null;done(null);}},
   async transferIn(endpoint){
    if(endpoint!==5)throw new Error("Wrong IN endpoint");
    const chunk=pending.length?pending.shift():await new Promise(resolve=>waiter=resolve);
    if(!chunk)return {status:"ok",data:new DataView(new ArrayBuffer(0))};
    return {status:"ok",data:new DataView(chunk.buffer,chunk.byteOffset,chunk.byteLength)};
   },
   async transferOut(endpoint,chunk){
    if(endpoint!==5)throw new Error("Wrong OUT endpoint");
    const b=new Uint8Array(chunk);
    const app=b[0],cmd=b[1],len=b[2]|(b[3]<<8),payload=b.slice(4,4+len);
    if(remainingWriteFailures>0){remainingWriteFailures--;throw new DOMException("Simulated USB write failure","NetworkError");}
    if(app===0xff&&cmd===0x82&&remainingDroppedPings>0){remainingDroppedPings--;return {status:"ok",bytesWritten:b.length};}
    if(app===0xff&&cmd===0x82&&pingTimeout)return {status:"ok",bytesWritten:b.length};
    if(app===0xff&&cmd===0x80){
     const count=payload[0]|(payload[1]<<8),addr=payload[2]|(payload[3]<<8);
     response(app,cmd,registers.slice(addr,addr+count));
    }else if(app===0xff&&cmd===0x81){
     const addr=payload[0]|(payload[1]<<8);
     registers.set(payload.slice(2),addr);response(app,cmd,new Uint8Array());
    }else response(app,cmd,new Uint8Array());
    return {status:"ok",bytesWritten:b.length};
   }
  };
  Object.defineProperty(navigator,"usb",{configurable:true,value:usb});
  window.__mockWebUSB={
   disconnect(){for(const fn of listeners.get("disconnect")||[])fn({device});device.opened=false;if(waiter){const done=waiter;waiter=null;done(null);}},
   setWriteFailures(n){remainingWriteFailures=n;},
   setDroppedPings(n){remainingDroppedPings=n;},
   get opened(){return device.opened;}
  };
 },{permissionDenied,pingTimeout,failWrites,dropPings});
}
