export function encodeRecord(type,address,data=[]){
 if(!Number.isInteger(address)||address<0||address>65535||data.length>255)throw Error("Invalid Intel HEX record");
 const bytes=[data.length,address>>8,address&255,type,...data];
 const checksum=(-bytes.reduce((a,b)=>a+b,0))&255;
 return ":"+[...bytes,checksum].map(b=>b.toString(16).padStart(2,"0").toUpperCase()).join("");
}
export function parseIntelHex(source){
 const lines=source.trim().split(/\r?\n/);if(!lines.length||lines.length>10000)throw Error("Invalid HEX file size");
 let base=0,eof=false;const records=[],memory=new Map();
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!/^:[0-9a-fA-F]+$/.test(line)||line.length<11||(line.length-1)%2)throw Error("Invalid HEX line "+(i+1));
  const raw=Uint8Array.from(line.slice(1).match(/../g),x=>parseInt(x,16));const [count,hi,lo,type]=raw;
  if(raw.length!==count+5||raw.reduce((a,b)=>a+b,0)%256!==0)throw Error("HEX length/checksum at line "+(i+1));
  if(eof)throw Error("Records after EOF");
  const address=(hi<<8)|lo,data=raw.slice(4,-1);
  if(type===0){const absolute=base+address;if(absolute+count>65536)throw Error("Address outside CC1111 64 KiB space");for(let j=0;j<count;j++){const at=absolute+j;if(memory.has(at)&&memory.get(at)!==data[j])throw Error("Conflicting overlapping HEX data");memory.set(at,data[j]);}records.push({address:absolute,data});}
  else if(type===1){if(count||address)throw Error("Invalid EOF");eof=true;}
  else if(type===2){if(count!==2||address)throw Error("Invalid segment record");base=((data[0]<<8)|data[1])*16;}
  else if(type===4){if(count!==2||address)throw Error("Invalid linear record");base=((data[0]<<8)|data[1])*65536;}
  else if(type===3||type===5){if(count!==4)throw Error("Invalid start address record");}
  else throw Error("Unsupported HEX record type "+type);
 }
 if(!eof||!memory.size)throw Error("Missing EOF or firmware data");
 return {records,memory,bytes:memory.size,min:Math.min(...memory.keys()),max:Math.max(...memory.keys())};
}
export const USER_START=0x1400,FLASH_END=0x8000,PAGE_SIZE=1024;
export function validateFirmware(image){
 if(image.min<USER_START||image.max>=FLASH_END)throw Error("Firmware touches bootloader or exceeds 32 KiB CC1111 flash");
 if(image.bytes<16)throw Error("Firmware image is unexpectedly small");
 // Do not allow a page to be erased after another page has already been written.
 const pages=new Map();
 for(const [addr,value] of image.memory){const page=addr>>>10;if(!pages.has(page))pages.set(page,new Map());pages.get(page).set(addr,value);}
 const records=[];
 for(const [page,bytes] of [...pages].sort((a,b)=>a[0]-b[0])){
  const addresses=[...bytes.keys()].sort((a,b)=>a-b);
  for(let offset=0;offset<1024;offset+=16){const addr=page*1024+offset;const data=Array.from({length:16},(_,i)=>bytes.get(addr+i)??255);if(data.every(x=>x===255))continue;records.push({address:addr,data,hex:encodeRecord(0,addr,data)});}
 }
 if(!records.length)throw Error("Image contains no programmable bytes");
 return {records,bytes:image.bytes,min:image.min,max:image.max,pages:pages.size};
}
