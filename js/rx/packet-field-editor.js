// Byte-range annotations are evidence notes, not verified protocol fields.
export const FIELD_KINDS=["unknown","device-id","counter","command","payload","checksum"];
export function parsePacketRows(captures){
 return (Array.isArray(captures)?captures:[]).flatMap((capture,index)=>{
  const hex=typeof capture?.hex==="string"?capture.hex.replace(/\s+/g,"").toUpperCase():"";
  return /^(?:[0-9A-F]{2})+$/.test(hex)?[{index,hex,bytes:hex.match(/../g)}]:[];
 });
}
export function validateFieldAnnotation(annotation,packetLength,existing=[]){
 const start=Number(annotation.start),width=Number(annotation.width);
 if(!Number.isInteger(start)||start<0||!Number.isInteger(width)||width<1||start+width>packetLength)throw Error("Field range must fit the selected packet length.");
 if(!FIELD_KINDS.includes(annotation.kind))throw Error("Unknown field type.");
 const name=String(annotation.name||"").trim();
 if(!name||name.length>40)throw Error("Field name must contain 1–40 characters.");
 if(existing.some(field=>field.start<start+width&&start<field.start+field.width))throw Error("Field ranges cannot overlap.");
 return {start,width,kind:annotation.kind,name};
}
export function fieldValues(rows,field){
 return rows.filter(row=>row.bytes.length>=field.start+field.width).map(row=>({index:row.index,value:row.bytes.slice(field.start,field.start+field.width).join("")}));
}
