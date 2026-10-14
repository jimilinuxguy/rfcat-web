import {validateProtocolDefinition} from "../rx/protocol-definitions.js";
export function parseFieldDraft(text){const value=JSON.parse(text);if(!Array.isArray(value))throw Error("Fields JSON must be an array");return value;}
export function addFieldDraft(fields,field,packetLength){
 const candidate=[...fields,field];validateProtocolDefinition({schemaVersion:1,id:"draft",name:"Draft",packetLength,fields:candidate});return candidate;
}
export function replaceFieldDraft(fields,index,field,packetLength){
 if(!Number.isInteger(index)||index<0||index>=fields.length)throw Error("Select a field");
 const candidate=fields.map((existing,i)=>i===index?field:existing);
 validateProtocolDefinition({schemaVersion:1,id:"draft",name:"Draft",packetLength,fields:candidate});return candidate;
}
export function removeFieldDraft(fields,index){if(!Number.isInteger(index)||index<0||index>=fields.length)throw Error("Select a field");return fields.filter((_,i)=>i!==index);}
export function frameByteMap(fields,packetLength){
 if(!Number.isInteger(packetLength)||packetLength<1||packetLength>255)throw Error("Invalid packet length");
 const map=Array.from({length:packetLength},(_,offset)=>({offset,field:null}));
 for(const field of fields){for(let i=field.start;i<field.start+field.width;i++){if(!map[i]||map[i].field)throw Error("Invalid or overlapping field ranges");map[i].field=field.name;}}
 return map;
}
export function initVisualFieldEditor(panel,{readFields,writeFields,readPacketLength,setStatus}){
 const host=panel.querySelector("#pd-fields");
 const section=document.createElement("section");section.id="pd-visual";
 section.innerHTML=`<h4>Visual field editor</h4><p>Select bytes in the frame map or enter an offset and width. Add and edit fields without writing JSON. Advanced field properties remain editable in the JSON editor below.</p>
 <div id="pd-byte-map" role="group" aria-label="Packet byte offsets" style="display:flex;flex-wrap:wrap;gap:4px"></div>
 <div class="actions"><label>Field <select id="pd-field-select"><option value="">New field</option></select></label><label>Name <input id="pd-field-name" placeholder="device_id"></label><label>Start byte <input id="pd-field-start" type="number" min="0" value="0"></label><label>Width <input id="pd-field-width" type="number" min="1" value="1"></label><label>Type <select id="pd-field-type"><option value="hex">Hex</option><option value="uint">Unsigned integer</option><option value="bits">Bits</option><option value="enum">Enum</option><option value="checksum">Checksum</option></select></label></div>
 <div class="actions"><label>Byte order <select id="pd-field-endian"><option value="big">Big endian</option><option value="little">Little endian</option></select></label><label>Bit offset <input id="pd-bit-offset" type="number" min="0" value="0"></label><label>Bit width <input id="pd-bit-width" type="number" min="1" value="1"></label><label>Enum labels (JSON object) <input id="pd-enum-values" value="{}"></label><label>Checksum algorithm <select id="pd-checksum-algorithm"><option value="xor8">XOR-8</option><option value="sum8">Sum-8</option><option value="sum8-twos-complement">Sum-8 two's complement</option></select></label><label>Checksum from <input id="pd-checksum-start" type="number" min="0" value="0"></label><label>Checksum through <input id="pd-checksum-end" type="number" min="0" value="0"></label></div>
 <div class="actions"><button type="button" id="pd-field-apply">Add field</button><button type="button" id="pd-field-remove" disabled>Remove selected field</button></div><p id="pd-field-help" role="status"></p>`;
 host.before(section);
 const el=id=>section.querySelector("#"+id);
 const selection=el("pd-field-select");
 function selectedIndex(){return selection.value===""?-1:Number(selection.value);}
 function fieldFromForm(){
  const type=el("pd-field-type").value,start=Number(el("pd-field-start").value),width=Number(el("pd-field-width").value);
  const field={name:el("pd-field-name").value,start,width,type,endian:el("pd-field-endian").value};
  if(type==="bits"){field.bitOffset=Number(el("pd-bit-offset").value);field.bitWidth=Number(el("pd-bit-width").value);}
  if(type==="enum")field.values=JSON.parse(el("pd-enum-values").value);
  if(type==="checksum"){field.algorithm=el("pd-checksum-algorithm").value;field.checksumStart=Number(el("pd-checksum-start").value);field.checksumEnd=Number(el("pd-checksum-end").value);}
  return field;
 }
 function fill(field){el("pd-field-name").value=field?.name??"";el("pd-field-start").value=String(field?.start??0);el("pd-field-width").value=String(field?.width??1);el("pd-field-type").value=field?.type??"hex";el("pd-field-endian").value=field?.endian??"big";el("pd-bit-offset").value=String(field?.bitOffset??0);el("pd-bit-width").value=String(field?.bitWidth??1);el("pd-enum-values").value=JSON.stringify(field?.values??{});el("pd-checksum-algorithm").value=field?.algorithm??"xor8";el("pd-checksum-start").value=String(field?.checksumStart??0);el("pd-checksum-end").value=String(field?.checksumEnd??0);toggle();}
 function toggle(){const type=el("pd-field-type").value;for(const id of ["pd-bit-offset","pd-bit-width"])el(id).disabled=type!=="bits";el("pd-enum-values").disabled=type!=="enum";for(const id of ["pd-checksum-algorithm","pd-checksum-start","pd-checksum-end"])el(id).disabled=type!=="checksum";}
 function render(){
  try{
   const fields=readFields(),length=readPacketLength(),current=selection.value;
   selection.replaceChildren(new Option("New field",""),...fields.map((f,i)=>new Option(f.name+" · "+f.start+"–"+(f.start+f.width-1),String(i))));
   if(current!==""&&fields[Number(current)])selection.value=current;
   const index=selectedIndex();el("pd-field-apply").textContent=index<0?"Add field":"Update field";el("pd-field-remove").disabled=index<0;
   const map=frameByteMap(fields,length),buttons=map.map(({offset,field})=>{
    const button=document.createElement("button");button.type="button";button.className="pd-byte";button.textContent=offset.toString(16).toUpperCase().padStart(2,"0");button.title="Byte "+offset+(field?" · "+field:" · unassigned");button.setAttribute("aria-label",button.title);button.dataset.offset=String(offset);
    if(field){button.style.fontWeight="bold";button.style.textDecoration="underline";}
    button.addEventListener("click",()=>{const i=fields.findIndex(f=>offset>=f.start&&offset<f.start+f.width);selection.value=i<0?"":String(i);if(i>=0)fill(fields[i]);else{fill(null);el("pd-field-start").value=String(offset);}render();});
    return button;
   });el("pd-byte-map").replaceChildren(...buttons);el("pd-field-help").textContent=fields.length+" fields across "+length+" bytes. Underlined offsets are assigned.";
  }catch(error){el("pd-field-help").textContent=error.message;}
 }
 selection.addEventListener("change",()=>{const fields=readFields(),index=selectedIndex();fill(index<0?null:fields[index]);render();});
 el("pd-field-type").addEventListener("change",toggle);
 el("pd-field-apply").addEventListener("click",()=>{try{const fields=readFields(),index=selectedIndex(),field=fieldFromForm(),length=readPacketLength();const updated=index<0?addFieldDraft(fields,field,length):replaceFieldDraft(fields,index,field,length);writeFields(updated);selection.value="";fill(null);render();setStatus("Field "+(index<0?"added":"updated")+". Review and save the definition to persist.");}catch(error){setStatus(error.message);}});
 el("pd-field-remove").addEventListener("click",()=>{try{const updated=removeFieldDraft(readFields(),selectedIndex());writeFields(updated);selection.value="";fill(null);render();setStatus("Field removed from draft. Save to persist.");}catch(error){setStatus(error.message);}});
 host.addEventListener("input",render);
 panel.querySelector("#pd-length").addEventListener("input",render);
 toggle();render();
 return {render};
}
