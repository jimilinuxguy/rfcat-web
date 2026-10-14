const NS="http://www.w3.org/2000/svg";
function node(name,attrs={},text=null){const el=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==null)el.textContent=String(text);return el;}
function svgBase(width,height){return node("svg",{viewBox:`0 0 ${width} ${height}`,width:"100%",height,role:"img"});}
export function renderFieldDiagram(container,definition){
 container.replaceChildren();const fields=definition.fields??[],length=definition.packetLength;
 const svg=svgBase(800,Math.max(125,75+fields.length*26));svg.setAttribute("aria-label","Packet byte layout and decoded field offsets");
 const w=760/length;
 for(let i=0;i<length;i++){svg.append(node("rect",{x:20+i*w,y:30,width:w,height:28,fill:i%2?"#dbeafe":"#e2e8f0",stroke:"#64748b"}));if(length<=48)svg.append(node("text",{x:20+(i+.5)*w,y:48,"text-anchor":"middle","font-size":Math.min(12,w*.65),fill:"#0f172a"},i));}
 fields.forEach((f,i)=>{const x=20+f.start*w,y=70+i*26,width=Math.max(1,f.width*w);svg.append(node("rect",{x,y,width,height:19,rx:3,fill:"#c7d2fe",stroke:"#4338ca"}));svg.append(node("text",{x:Math.min(780,x+3),y:y+14,"font-size":12,fill:"#1e1b4b"},`${f.name} (${f.type}) · bytes ${f.start}–${f.start+f.width-1}`));});
 container.append(svg);return svg;
}
export function renderTimelineChart(container,report,{fieldName=null}={}){
 container.replaceChildren();const field=report.fields.find(f=>f.name===fieldName)??report.fields.find(f=>f.observations.length>1);if(!field)return null;
 const numeric=field.observations.every(o=>typeof o.value==="number"&&Number.isFinite(o.value));
 const values=field.observations.map(o=>numeric?o.value:String(o.label??o.value));const unique=[...new Set(values)];const min=numeric?Math.min(...values):0,max=numeric?Math.max(...values):Math.max(1,unique.length-1);
 const svg=svgBase(800,260);svg.setAttribute("aria-label",`Timeline for ${field.name}; ${field.observations.length} observations`);
 svg.append(node("line",{x1:50,y1:220,x2:780,y2:220,stroke:"currentColor"}),node("line",{x1:50,y1:20,x2:50,y2:220,stroke:"currentColor"}));
 const pts=field.observations.map((o,i)=>{const x=50+730*(report.total<=1?0:o.index/(report.total-1));const val=numeric?o.value:unique.indexOf(String(o.label??o.value));const y=210-180*(max===min?.5:(val-min)/(max-min));return {x,y,o};});
 if(pts.length>1)svg.append(node("polyline",{points:pts.map(p=>`${p.x},${p.y}`).join(" "),fill:"none",stroke:"#6366f1","stroke-width":2}));
 pts.forEach(p=>{const dot=node("circle",{cx:p.x,cy:p.y,r:4,fill:"#4338ca",tabindex:0});dot.append(node("title",{},`Capture ${p.o.index}: ${p.o.label??p.o.value}`));svg.append(dot);});
 svg.append(node("text",{x:50,y:15,"font-size":14,fill:"currentColor"},`${field.name} · ${numeric?"numeric":"categorical"} · capture order`));container.append(svg);return svg;
}
export function renderStateGraph(container,report,{onSelect}={}){
 container.replaceChildren();const states=report.states.slice(0,32);if(!states.length)return null;
 const svg=svgBase(800,Math.max(300,Math.ceil(states.length/5)*145));svg.setAttribute("aria-label",`State transition graph for ${report.fieldName}; ${states.length} nodes`);
 const positions=new Map(states.map((s,i)=>[s.id,{x:85+(i%5)*155,y:75+Math.floor(i/5)*145}]));
 for(const edge of report.transitions){const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)continue;
  if(a===b){svg.append(node("circle",{cx:a.x,cy:a.y-28,r:15,fill:"none",stroke:"#64748b","stroke-width":Math.min(6,1+edge.count)}));continue;}
  const line=node("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"#64748b","stroke-width":Math.min(6,1+edge.count),opacity:.65});line.append(node("title",{},`${edge.from} → ${edge.to}: ${edge.count} observations`));svg.append(line);
 }
 for(const state of states){const p=positions.get(state.id),circle=node("circle",{cx:p.x,cy:p.y,r:29,fill:"#dbeafe",stroke:"#1d4ed8","stroke-width":2,tabindex:0,role:"button","aria-label":`State ${state.label}, ${state.count} observations`});circle.append(node("title",{},`${state.label}: ${state.count} observations`));const activate=()=>onSelect?.(state);circle.addEventListener("click",activate);circle.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();activate();}});svg.append(circle,node("text",{x:p.x,y:p.y+4,"text-anchor":"middle","font-size":12,fill:"#1e3a8a","pointer-events":"none"},state.label.slice(0,12)));}
 container.append(svg);return svg;
}
