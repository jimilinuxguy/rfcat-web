import {encodeRecord,USER_START,FLASH_END} from "./intel-hex.js";

// Read in short records to keep responses bounded and compatible with CC-Bootloader.
export const BACKUP_BYTES=FLASH_END-USER_START;
export const READ_SIZE=16;
export async function readApplication(protocol,onProgress=()=>{}){
 const bytes=new Uint8Array(BACKUP_BYTES);
 for(let address=USER_START;address<FLASH_END;address+=READ_SIZE){
  const length=Math.min(READ_SIZE,FLASH_END-address);
  const memory=await protocol.read(address,length);
  for(let i=0;i<length;i++){
   const value=memory.get(address+i);
   if(!Number.isInteger(value)||value<0||value>255)throw Error("Incomplete readback at 0x"+(address+i).toString(16));
   bytes[address-USER_START+i]=value;
  }
  onProgress((address-USER_START+length)/BACKUP_BYTES);
 }
 return bytes;
}
export function compareApplication(first,second){
 if(first.length!==BACKUP_BYTES||second.length!==BACKUP_BYTES)throw Error("Invalid backup size");
 for(let i=0;i<BACKUP_BYTES;i++)if(first[i]!==second[i])throw Error("Backup verification mismatch at 0x"+(USER_START+i).toString(16));
 return true;
}
export function exportApplicationHex(bytes){
 if(bytes.length!==BACKUP_BYTES)throw Error("Invalid backup size");
 const lines=[];
 for(let offset=0;offset<bytes.length;offset+=16)lines.push(encodeRecord(0,USER_START+offset,Array.from(bytes.subarray(offset,offset+16))));
 lines.push(encodeRecord(1,0));
 return lines.join("\n")+"\n";
}
