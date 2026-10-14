// Evidence is collected from live receiver packets only, not from the mutable UI list.
// A new investigation starts a fresh, independent capture boundary.
export function createInvestigationEvidence({limit=2000}={}){
 if(!Number.isInteger(limit)||limit<1)throw new RangeError("Invalid evidence limit");
 let active=false,captures=[],dropped=0;
 return {
  start(){active=true;captures=[];dropped=0;},
  stop(){active=false;},
  add(capture){
   if(!active)return false;
   if(!capture||!(capture.bytes instanceof Uint8Array))throw new TypeError("Live capture bytes required");
   if(captures.length>=limit){dropped++;return false;}
   const {bytes,...metadata}=capture;
   captures.push({...structuredClone(metadata),hex:Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")});
   return true;
  },
  snapshot(){return {captures:structuredClone(captures),dropped};},
  get active(){return active;}
 };
}
