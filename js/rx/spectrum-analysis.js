export function summarizeSpectrum(samples){
 const bins=new Map();
 for(const sample of samples){
  if(!Number.isFinite(sample.frequencyHz)||!Number.isFinite(sample.rssiDbm))continue;
  const values=bins.get(sample.frequencyHz)||[];values.push(sample.rssiDbm);bins.set(sample.frequencyHz,values);
 }
 return [...bins].sort(([a],[b])=>a-b).map(([frequencyHz,values])=>({
  frequencyHz,count:values.length,averageDbm:values.reduce((a,b)=>a+b,0)/values.length,
  peakDbm:Math.max(...values),minimumDbm:Math.min(...values)
 }));
}
export function compareSpectrum(summary,baseline){
 const base=new Map(baseline.map(row=>[row.frequencyHz,row]));
 return summary.map(row=>({...row,baselineDbm:base.get(row.frequencyHz)?.averageDbm??null,
  deltaDb:base.has(row.frequencyHz)?row.averageDbm-base.get(row.frequencyHz).averageDbm:null}));
}
export function spectrumCsv(samples,settings={},baseline=[]){
 const summary=compareSpectrum(summarizeSpectrum(samples),baseline);
 const rows=["# RFCat Web Spectrum Explorer",...Object.entries(settings).map(([key,value])=>"# "+key+": "+value),
  "frequency_hz,samples,average_dbm,peak_dbm,minimum_dbm,baseline_dbm,delta_db",
  ...summary.map(row=>[row.frequencyHz,row.count,row.averageDbm,row.peakDbm,row.minimumDbm,row.baselineDbm??"",row.deltaDb??""].join(",")),
  "", "frequency_hz,rssi_dbm,timestamp",...samples.map(s=>[s.frequencyHz,s.rssiDbm,s.timestamp].join(","))];
 return rows.join("\n")+"\n";
}
