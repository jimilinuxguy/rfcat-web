export function createTourEngine({onChange=()=>{},onFinish=()=>{}}={}){
 let tour=null,index=0,highlight=null,unsubscribe=()=>{};
 function clear(){unsubscribe();unsubscribe=()=>{};highlight?.classList.remove("help-target");highlight=null;}
 function locate(step){
  const node=document.querySelector(step.target);
  if(!node)return null;
  const panel=node.closest("details");
  if(panel)panel.open=true;
  node.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
  node.classList.add("help-target");highlight=node;return node;
 }
 function show(){
  clear();if(!tour)return;
  const step=tour.steps[index],node=locate(step);
  onChange({tour,index,step,found:!!node,target:node});
  // Only advance on an observable, successful user action; never trigger TX or radio changes.
  if(node&&step.advanceOn==="change"){
   const handler=()=>{if(node.value||node.files?.length)next();};
   node.addEventListener("change",handler,{once:true});
   unsubscribe=()=>node.removeEventListener("change",handler);
  }
  if(step.advanceOn==="connected"){
   const check=()=>{if(document.body.classList.contains("connected"))next();};
   const observer=new MutationObserver(check);
   observer.observe(document.body,{attributes:true,attributeFilter:["class"]});
   unsubscribe=()=>observer.disconnect();
   if(document.body.classList.contains("connected"))queueMicrotask(()=>{if(tour&&tour.steps[index]===step)next();});
  }
 }
 function start(next){tour=next;index=0;show();}
 function next(){if(!tour)return;if(index+1>=tour.steps.length){const done=tour;stop();onFinish(done);return;}index++;show();}
 function back(){if(tour&&index>0){index--;show();}}
 function stop(){clear();tour=null;onChange(null);}
 return {start,next,back,stop,get active(){return tour;},get index(){return index;}};
}
