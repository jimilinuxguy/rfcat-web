// Pure coordinate transforms for waveform measurement cursors.
export function waveformWindow(totalUs,zoom,pan){
 if(!Number.isFinite(totalUs)||totalUs<=0)throw Error("Invalid waveform duration");
 const scale=Number.isFinite(zoom)?Math.max(1,zoom):1;
 const visible=totalUs/scale;
 const offset=Math.min(1,Math.max(0,Number.isFinite(pan)?pan:0))*Math.max(0,totalUs-visible);
 return {visible,offset};
}
export function cursorTimeFromX(x,width,totalUs,zoom,pan){
 if(!Number.isFinite(width)||width<=0)throw Error("Invalid canvas width");
 const {visible,offset}=waveformWindow(totalUs,zoom,pan);
 return Math.round(Math.max(0,Math.min(totalUs,offset+Math.max(0,Math.min(width,x))/width*visible)));
}
export function cursorXFromTime(time,width,totalUs,zoom,pan){
 const {visible,offset}=waveformWindow(totalUs,zoom,pan);
 return (time-offset)/visible*width;
}
