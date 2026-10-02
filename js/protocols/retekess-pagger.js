import { bitsOf, packWaveform, pulseEncode, makeOokAnalysis, configureOok, transmitOok, repeatFields } from "./retekess-common.js";
function range(n,min,max,label){n=Number(n);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${label} must be ${min}–${max}`);return n;}
function encodePrinceton({station,pager,action=0,stationBits=13,pagerBits=10,actionBits=1,reverseFields=true,te=271,frames=10,trailingBit=""}){
 station=range(station,0,2**stationBits-1,"Station");pager=range(pager,0,2**pagerBits-1,"Pager");action=range(action,0,2**actionBits-1,"Action");
 const opt={lsb:reverseFields}; const logical=bitsOf(station,stationBits,opt)+bitsOf(pager,pagerBits,opt)+bitsOf(action,actionBits,opt)+trailingBit;
 const frame=pulseEncode(logical,{zero:[1,3],one:[3,1],suffix:"0".repeat(22)});
 const waveform=frame.repeat(Number(frames)); const {bytes,padding}=packWaveform(waveform);
 return {bytes,waveform,padding,logical,station,pager,action,te,frames:Number(frames)};
}
function makeProtocol({id,name,frequency=433920000,stationBits=13,pagerBits=10,actionBits=1,reverseFields=true,te=271,trailingBit="",pagerMax=999,fixedAction=null,broadcastPager=null,broadcastAction=null}){
 return {id,name,menuGroup:"Restaurant Pagers",description:`${name} documented OOK single-pager framing.`,
 fields:[{id:"station",label:"Station",type:"number",min:0,max:2**stationBits-1,value:0},{id:"pager",label:"Pager",type:"number",min:0,max:pagerMax,value:1},...(fixedAction===null?[{id:"action",label:"Action",type:"number",min:0,max:2**actionBits-1,value:0}]:[]),{id:"sequenceEnd",label:"Sequence through pager",type:"number",min:0,max:pagerMax,value:1},...(broadcastPager===null?[]:[{id:"broadcast",label:"All pagers",type:"checkbox",value:false}]),{id:"frames",label:"Frames",type:"number",min:1,max:20,value:10},...repeatFields(0)],
 encode(v){const e=encodePrinceton({...v,action:fixedAction??v.action,stationBits,pagerBits,actionBits,reverseFields,te,trailingBit});return {...e,bits:e.logical,analysis:makeOokAnalysis(e.waveform,1e6/te,`${name} OOK`,[{name:"TE",symbols:1,requestedUs:te}]),modulation:"ASK/OOK",summary:`${name} TX: station ${e.station} · pager ${e.pager} · action ${e.action}`};},
 async configure(d){await configureOok(d,frequency,1e6/te);},async transmit(d,e,v){const start=Number(v.pager),end=Math.max(start,Number(v.sequenceEnd??start));const targets=v.broadcast&&broadcastPager!==null?[broadcastPager]:Array.from({length:end-start+1},(_,i)=>start+i);for(const pager of targets){const next=encodePrinceton({...v,pager,action:v.broadcast&&broadcastAction!==null?broadcastAction:(fixedAction??v.action),stationBits,pagerBits,actionBits,reverseFields,te,trailingBit});await transmitOok(d,next.bytes,v);}}};
}
export const retekessT119=makeProtocol({id:"retekess-t119",name:"Retekess T119",broadcastPager:1005,broadcastAction:0});
export const retekessTd165=makeProtocol({id:"retekess-td165",name:"Retekess TD165",broadcastPager:1005,broadcastAction:0});
export const retekessTd157=makeProtocol({id:"retekess-td157",name:"Retekess TD157",stationBits:10,pagerBits:10,actionBits:4,reverseFields:false,te:212,fixedAction:2,broadcastPager:999,broadcastAction:15});
export const retekessTd174=makeProtocol({id:"retekess-td174",name:"Retekess TD174",frequency:433889000,stationBits:13,pagerBits:8,actionBits:2,reverseFields:true,te:326,trailingBit:"0",pagerMax:255,fixedAction:0});
export { encodePrinceton as encodeRetekessPrinceton };
