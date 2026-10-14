import {inspectBytes,inspectRows,inspectBits,inspectSelection,inspectFields,inspectComparison,inspectAnnotation,inspectReport,inspectBitRange,overlappingFields} from "../rx/packet-inspector.js";
import {hex} from "../core/bytes.js";

export function initPacketInspector(host,{getSession,getDefinition,setStatus=()=>{}}) {
 const panel=document.createElement("details");panel.id="packet-inspector";panel.className="pd-tool-panel";
 panel.innerHTML=`<summary>Packet Inspector</summary><div class="pd-inspector-body">
 <p>Inspect saved packets without changing capture data.</p>
 <div class="actions"><label>Packet index <input data-pi="index" type="number" min="0" value="0"></label><button type="button" data-pi="load">Inspect packet</button><label>Bytes per row <select data-pi="width"><option>8</option><option selected>16</option><option>32</option></select></label><label>Bit display <select data-pi="order"><option value="msb">MSB first</option><option value="lsb">LSB first</option></select></label></div>
 <p data-pi="context" role="status">Select a saved capture session and packet.</p><div data-pi="bytes" class="pd-inspector-bytes" role="group" aria-label="Packet bytes"></div>
 <p data-pi="selected" aria-live="polite"></p><div class="actions"><label>Start bit <input data-pi="bitstart" type="number" min="0" value="0"></label><label>Bit length <input data-pi="bitlength" type="number" min="1" value="1"></label><button type="button" data-pi="bitselect">Select bit range</button></div><div data-pi="bits" class="pd-inspector-bits"></div>
 <details><summary>Decoded fields</summary><div data-pi="fields"></div></details>
 <details><summary>Compare another packet</summary><label>Second packet index <input data-pi="other" type="number" min="0" value="1"></label><button type="button" data-pi="compare">Compare</button><div data-pi="differences"></div></details>
 <details><summary>Annotate selection</summary><label>Label <input data-pi="label" maxlength="80"></label><label>Notes <input data-pi="notes" maxlength="2000"></label><button type="button" data-pi="annotate">Add annotation</button><div data-pi="annotations"></div></details>
 <div class="actions"><button type="button" data-pi="copy">Copy selected hex</button><button type="button" data-pi="copyall">Copy full hex</button><button type="button" data-pi="export">Export report JSON</button></div>
 </div>`;
 host.append(panel);
 const el=name=>panel.querySelector('[data-pi="'+name+'"]');
 let packet=null,bytes=null,selected=0,selectedBit=null,bitLength=1,annotations=[],sourceContext="";
 const guard=fn=>async()=>{try{await fn();}catch(e){el("context").textContent=e.message;setStatus(e.message);}};
 function render(){
  const target=el("bytes");target.replaceChildren();
  const width=Number(el("width").value);
  for(const row of inspectRows(bytes,width)){
   const line=document.createElement("div");line.className="pd-inspector-row";
   const offset=document.createElement("span");offset.textContent=row.offset.toString(16).padStart(4,"0")+"  ";line.append(offset);
   for(let i=row.offset;i<Math.min(bytes.length,row.offset+width);i++){
    const button=document.createElement("button");button.type="button";button.className="pd-inspector-byte";button.textContent=bytes[i].toString(16).padStart(2,"0").toUpperCase();button.title="Offset "+i+" · "+(bytes[i]>=32&&bytes[i]<=126?String.fromCharCode(bytes[i]):".");button.setAttribute("aria-pressed",String(i===selected || (selectedBit!==null&&i>=Math.floor(selectedBit/8)&&i<=Math.floor((selectedBit+bitLength-1)/8))));button.addEventListener("click",()=>{selected=i;selectedBit=null;render();});line.append(button);
   }
   const ascii=document.createElement("span");ascii.className="pd-inspector-ascii";ascii.textContent="  "+row.ascii;line.append(ascii);target.append(line);
  }
  if(bytes.length){
   const s=inspectSelection(bytes,selected);
   el("selected").textContent=selectedBit===null?"Offset "+selected+" / "+bytes.length+" bytes · "+s.hex+" · "+s.ascii:("Bit range "+selectedBit+" + "+bitLength+" · "+inspectBitRange(bytes,selectedBit,bitLength).binary+" · "+inspectBitRange(bytes,selectedBit,bitLength).hex);
   el("bits").textContent="Bit positions "+(el("order").value==="msb"?"7 → 0":"0 → 7")+": "+inspectBits(bytes.slice(selected,selected+1),el("order").value)[0];
  }else{el("selected").textContent="Empty packet";el("bits").textContent="";}
  const fields=el("fields");fields.replaceChildren();
  try{
   const result=inspectFields(bytes,getDefinition());
   if(!result.matched){fields.textContent="Definition does not match packet ("+result.reason+").";return;}
   for(const field of result.fields){
    const button=document.createElement("button");button.type="button";button.textContent=field.name+" · bits "+field.startBit+"–"+(field.startBit+field.widthBits-1)+" · "+String(field.value);button.addEventListener("click",()=>{selected=field.start;selectedBit=field.startBit;bitLength=field.widthBits;el("bitstart").value=selectedBit;el("bitlength").value=bitLength;render();});fields.append(button);
   }
   if(selectedBit!==null){const matches=overlappingFields(result.fields,selectedBit,bitLength);if(matches.length){const info=document.createElement("p");info.textContent="Overlapping fields: "+matches.map(f=>f.name).join(", ");fields.prepend(info);}}
  if(!result.fields.length)fields.textContent="Definition contains no fields.";
  }catch(e){fields.textContent="No compatible definition: "+e.message;}
 }
 function showPacket(value,context){packet=value;bytes=inspectBytes(value);selected=0;selectedBit=null;bitLength=1;annotations=[];sourceContext=context;panel.open=true;el("context").textContent=context+" · "+bytes.length+" bytes";render();panel.scrollIntoView({block:"nearest"});}
 document.addEventListener("rfcat:inspect-packet",event=>{try{showPacket(event.detail.packet,event.detail.context??"Receiver capture");}catch(error){el("context").textContent=error.message;}});
 el("bitselect").addEventListener("click",guard(async()=>{if(!bytes)throw Error("Inspect a packet first");const start=Number(el("bitstart").value),length=Number(el("bitlength").value);const range=inspectBitRange(bytes,start,length);selected=range.startByte;selectedBit=start;bitLength=length;render();}));
 el("load").addEventListener("click",guard(async()=>{
  const session=await getSession(),index=Number(el("index").value);
  if(!Number.isInteger(index)||index<0||index>=session.captures.length)throw Error("Choose a valid packet index");
  showPacket(session.captures[index],session.name+" · packet "+index);
 }));
 for(const name of ["width","order"])el(name).addEventListener("change",()=>{if(bytes)render();});
 el("compare").addEventListener("click",guard(async()=>{
  if(!bytes)throw Error("Inspect a packet first");
  const session=await getSession(),index=Number(el("other").value);
  if(!Number.isInteger(index)||index<0||index>=session.captures.length)throw Error("Choose a valid comparison index");
  const report=inspectComparison(packet,session.captures[index]);
  el("differences").textContent=report.pairs[0].changedBytes.length+" changed byte offsets: "+report.pairs[0].changedBytes.join(", ");
 }));
 el("annotate").addEventListener("click",guard(async()=>{
  if(!bytes)throw Error("Inspect a packet first");
  const start=selectedBit===null?selected:Math.floor(selectedBit/8),width=selectedBit===null?1:Math.ceil((selectedBit+bitLength)/8)-start;
  annotations.push(inspectAnnotation(bytes,{start,width,label:el("label").value,notes:el("notes").value}));
  el("annotations").textContent=annotations.map(a=>a.start+": "+a.label).join(" · ");
 }));
 for(const [name,all] of [["copy",false],["copyall",true]])el(name).addEventListener("click",guard(async()=>{
  if(!bytes)throw Error("Inspect a packet first");
  await navigator.clipboard.writeText(all?hex(bytes):selectedBit===null?inspectSelection(bytes,selected).hex:inspectBitRange(bytes,selectedBit,bitLength).binary);
  setStatus("Packet hex copied.");
 }));
 el("export").addEventListener("click",guard(async()=>{
  if(!packet)throw Error("Inspect a packet first");
  const url=URL.createObjectURL(new Blob([JSON.stringify({...inspectReport(packet,annotations),sourceContext},null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download="packet-inspection.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }));
 return {open:()=>{panel.open=true;panel.scrollIntoView({block:"nearest"});}};
}
