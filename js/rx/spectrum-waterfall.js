export function spectrumSweeps(samples,frequencies){
 const index=new Map(frequencies.map((hz,i)=>[hz,i]));
 const sweeps=[];let current=Array(frequencies.length).fill(null),seen=new Set();
 for(const sample of samples){
  const i=index.get(sample.frequencyHz);
  if(i===undefined)continue;
  if(seen.has(i)){sweeps.push(current);current=Array(frequencies.length).fill(null);seen=new Set();}
  current[i]=sample.rssiDbm;seen.add(i);
  if(seen.size===frequencies.length){sweeps.push(current);current=Array(frequencies.length).fill(null);seen=new Set();}
 }
 if(seen.size)sweeps.push(current);
 return sweeps;
}
export function spectrumDetections(summary,minimumRise=6){
 return summary.filter(r=>r.deltaDb!==null&&r.deltaDb>=minimumRise).sort((a,b)=>b.deltaDb-a.deltaDb);
}
export function spectrumGrid(startMHz,stopMHz,stepKHz){
 if(!Number.isFinite(startMHz)||!Number.isFinite(stopMHz)||!Number.isFinite(stepKHz)||stepKHz<=0||stopMHz<startMHz)return [];
 const count=Math.floor((stopMHz-startMHz)*1000/stepKHz+1e-7)+1;
 if(count>600)return [];
 return Array.from({length:count},(_,i)=>Math.round((startMHz+i*stepKHz/1000)*1e6));
}
