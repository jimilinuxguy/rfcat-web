export function createTourEngine({onChange=()=>{},onFinish=()=>{}}={}){
 let tour=null,index=0,highlight=null;
 function clear(){highlight?.classList.remove("help-target");highlight=null;}
 function locate(step){
  const node=document.querySelector(step.target);
  if(!node)return null;
  const panel=node.closest("details");
  if(panel)panel.open=true;
  node.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"center"});
  node.classList.add("help-target");highlight=node;return node;
 }
 function show(){clear();if(!tour)return;const step=tour.steps[index];const node=locate(step);onChange({tour,index,step,found:!!node});}
 function start(next){tour=next;index=0;show();}
 function next(){if(!tour)return;if(index+1>=tour.steps.length){const done=tour;stop();onFinish(done);return;}index++;show();}
 function back(){if(tour&&index>0){index--;show();}}
 function stop(){clear();tour=null;onChange(null);}
 return {start,next,back,stop,get active(){return tour;}};
}
