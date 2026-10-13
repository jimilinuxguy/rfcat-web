// Bounded, hardware-agnostic receiver event grouping. No radio side effects.
export function createCapturePipeline({windowMs=300,maxEvents=1000}={}){
 if(!Number.isFinite(windowMs)||windowMs<0||windowMs>60000||!Number.isInteger(maxEvents)||maxEvents<1||maxEvents>100000)throw Error("Invalid pipeline limits");
 let events=[],groups=[],nextId=1;
 let activeWindowMs=windowMs;
 const bytesOf=value=>{
  if(value instanceof Uint8Array)return [...value];
  if(Array.isArray(value)&&value.every(v=>Number.isInteger(v)&&v>=0&&v<=255))return [...value];
  throw Error("Expected byte array");
 };
 function ingest({bytes,timestampMs,frequencyHz=null,rssi=null,source="rx"}){
  const data=bytesOf(bytes);
  if(!data.length||data.length>4096)throw Error("Invalid packet size");
  if(!Number.isFinite(timestampMs)||timestampMs<0)throw Error("Invalid timestamp");
  if(frequencyHz!==null&&(!Number.isFinite(frequencyHz)||frequencyHz<=0))throw Error("Invalid frequency");
  if(rssi!==null&&!Number.isFinite(rssi))throw Error("Invalid RSSI");
  const hex=data.map(b=>b.toString(16).padStart(2,"0")).join("");
  const previous=events.at(-1);
  if(previous&&timestampMs<previous.timestampMs)throw Error("Events must be timestamp ordered");
  const last=groups.at(-1);
  const same=last&&last.hex===hex&&last.frequencyHz===frequencyHz&&timestampMs-last.lastSeenMs<=activeWindowMs;
  const group=same?last:{id:nextId++,hex,frequencyHz,count:0,firstSeenMs:timestampMs,lastSeenMs:timestampMs,rssiMin:null,rssiMax:null};
  if(!same)groups.push(group);
  group.count++;group.lastSeenMs=timestampMs;
  if(rssi!==null){group.rssiMin=group.rssiMin===null?rssi:Math.min(group.rssiMin,rssi);group.rssiMax=group.rssiMax===null?rssi:Math.max(group.rssiMax,rssi);}
  const event={timestampMs,frequencyHz,rssi,source:String(source).slice(0,40),hex,groupId:group.id,duplicate:same};
  events.push(event);
  if(events.length>maxEvents){events.shift();const ids=new Set(events.map(e=>e.groupId));groups=groups.filter(g=>ids.has(g.id));}
  return {...event};
 }
 return {
 ingest,
 snapshot:()=>({
  events:events.map(e=>({...e})),
  groups:groups.map(g=>{
   const retained=events.filter(e=>e.groupId===g.id);
   return {...g,count:retained.length,firstSeenMs:retained[0].timestampMs,lastSeenMs:retained.at(-1).timestampMs,
    rssiMin:retained.reduce((v,e)=>e.rssi===null?v:v===null?e.rssi:Math.min(v,e.rssi),null),
    rssiMax:retained.reduce((v,e)=>e.rssi===null?v:v===null?e.rssi:Math.max(v,e.rssi),null),
    truncated:retained.length!==g.count};
  }),
  totalEvents:events.length,
  duplicateEvents:events.filter(e=>e.duplicate).length,
  windowMs:activeWindowMs
 }),
 setWindowMs(ms){
  if(!Number.isInteger(ms)||ms<0||ms>60000)throw Error("Invalid duplicate window");
  activeWindowMs=ms;events=[];groups=[];nextId=1;
 },
 clear:()=>{events=[];groups=[];nextId=1;}
};
}
