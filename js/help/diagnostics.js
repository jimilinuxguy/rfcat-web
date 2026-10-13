export function diagnoseReceiver({connected,frequencyMHz,receiving,packets=0}){
 const findings=[];
 if(!connected)findings.push("Connect a YARD Stick One using WebUSB before attempting live reception.");
 if(!Number.isFinite(frequencyMHz)||!((frequencyMHz>=300&&frequencyMHz<=348)||(frequencyMHz>=387&&frequencyMHz<=464)||(frequencyMHz>=779&&frequencyMHz<=928)))findings.push("Check that the configured frequency is within a supported CC1111 band.");
 if(connected&&!receiving)findings.push("Start the receiver before expecting packets.");
 if(connected&&receiving&&packets===0)findings.push("No packet bytes observed. Check transmitter activity, modulation, bitrate, sync/packet framing and bandwidth. Packet-mode RX may not decode RAW OOK edges.");
 return findings.length?findings:["No obvious connection or receiver-state issue detected. Packet reception still depends on matching RF framing."];
}
