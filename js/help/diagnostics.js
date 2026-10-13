// Read-only diagnostics. These are hypotheses from UI state, never measurements of RF energy.
export function analyzeRadioState(s={}){
 const issues=[];
 const add=(id,severity,title,detail,target,action)=>issues.push({id,severity,title,detail,target,action});
 const validBand=Number.isFinite(s.frequencyMHz)&&[[300,348],[387,464],[779,928]].some(([lo,hi])=>s.frequencyMHz>=lo&&s.frequencyMHz<=hi);
 if(!s.connected)add("connection","error","Radio not connected","Connect a YARD Stick One via WebUSB; browser permissions and a compatible USB connection are required.","#connect","Open connection control");
 if(!validBand)add("frequency","error","Frequency outside supported bands","The CC1111 supports 300–348, 387–464 and 779–928 MHz. Verify the intended receive frequency.","#freq","Inspect frequency");
 if(s.connected&&!s.receiving)add("receiver","warning","Receiver is not listening","Start listening to collect packets. This diagnostic never starts RX automatically.","#listen","Inspect receiver");
 if(s.connected&&s.receiving&&s.packets===0)add("no-packets","warning","No packets observed","Check transmitter activity and RF framing: modulation, data rate, channel bandwidth, sync and packet length. Packet-mode RX is not a raw spectrum monitor.","#rx-protocol","Inspect decoding settings");
 if(s.packets>0&&s.decoded===0)add("decode","warning","Packets present but none decoded","Captured bytes exist. Check decoder selection, RF framing, CRC, whitening and whether the protocol is supported.","#rx-protocol","Inspect decoder");
 if(s.packets>0&&s.rejected>0)add("rejected","info","Some captures were rejected","Inspect decoder rejection details and compare raw frames. A rejected frame does not by itself prove bad RF reception.","#rx-filter","Inspect filters");
 if(s.packets>0&&s.duplicates>0)add("duplicates","info","Repeated captures detected","Duplicate counts can reflect repeated transmissions; inspect timestamps and raw bytes before drawing conclusions.","#packetList","Inspect captures");
 if(s.packets>0&&s.filter==="decoded"&&s.decoded===0)add("hidden","info","Filter hides undecoded captures","Switch the Show filter to All captures to inspect raw evidence.","#rx-filter","Inspect filter");
 if(!issues.length)add("healthy","ok","No obvious UI-state issue","No issue was detected from the available counters. This does not verify antenna, signal strength or RF configuration.","#packetList","Inspect captures");
 const order={error:0,warning:1,info:2,ok:3};
 return issues.sort((a,b)=>order[a.severity]-order[b.severity]);
}
export function readRadioDiagnostics(doc=document){
 const value=id=>doc.getElementById(id)?.value;
 const count=id=>{const n=Number(doc.getElementById(id)?.textContent?.trim());return Number.isFinite(n)&&n>=0?n:0;};
 const status=doc.getElementById("status")?.textContent??"";
 const rxstate=doc.getElementById("rxstate")?.textContent??"";
 const connected=doc.body?.classList.contains("connected")||(/connected/i.test(status)&&!/disconnected|not connected/i.test(status));
 const receiving=/\b(rx|receiving|listening|active)\b/i.test(rxstate)||/\b(receiving|listening|rx active)\b/i.test(status);
 return {connected:!!connected,receiving,frequencyMHz:Number(value("freq")),packets:count("packets"),decoded:count("rx-decoded"),rejected:count("rx-rejected"),duplicates:count("rx-duplicates"),filter:value("rx-filter")??"all"};
}
// Backwards-compatible text-only interface.
export function diagnoseReceiver(s){
 const findings=analyzeRadioState(s);
 return findings.map(f=>f.detail);
}
