import {placeHelpCard} from "./tour-position.js";
import {diagnoseReceiver} from "./diagnostics.js";
import {TOURS,HELP_TOPICS,findTour} from "./tours.js";
import {readHelpState,writeHelpState} from "../storage/help-store.js";
import {createTourEngine} from "./tour-engine.js";
import {initContextHelp} from "./context-help.js";
import {onboardingCopy} from "./onboarding.js";
export async function initHelpCenter(){
 const button=document.getElementById("help-open");
 const dialog=document.getElementById("help-dialog");
 const title=document.getElementById("help-title");
 const body=document.getElementById("help-body");
 const actions=document.getElementById("help-actions");
 if(!button||!dialog)return;
 let state={onboarded:false,completed:[]},wizard=0,goal="receive",tourTarget=null;
 const dock=()=>{dialog.classList.remove("help-anchored");for(const key of ["left","top","right","bottom"])dialog.style[key]="";};
 const position=()=>{if(!tourTarget||!dialog.open)return;const p=placeHelpCard(tourTarget.getBoundingClientRect(),dialog.offsetWidth,dialog.offsetHeight,innerWidth,innerHeight);dialog.classList.add("help-anchored");dialog.style.left=p.left+"px";dialog.style.top=p.top+"px";dialog.style.right="auto";dialog.style.bottom="auto";};
 addEventListener("resize",position);addEventListener("scroll",position,true);
 try{state=await readHelpState();}catch(error){console.warn("Help persistence unavailable",error);}
 const persist=async()=>{try{await writeHelpState(state);}catch(error){console.warn("Could not save help progress",error);}};
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const action=(label,callback)=>{const b=node("button",label);b.type="button";b.addEventListener("click",callback);actions.append(b);return b;};
 const reset=(heading)=>{title.textContent=heading;body.replaceChildren();actions.replaceChildren();if(!dialog.open)dialog.show();};
 const engine=createTourEngine({
  onChange:detail=>{
   if(!detail){tourTarget=null;dock();if(dialog.open)dialog.close();return;}
   tourTarget=detail.target;
   reset(detail.tour.title+" · "+(detail.index+1)+"/"+detail.tour.steps.length);
   body.append(node("h3",detail.step.title),node("p",detail.step.text));
   if(!detail.found)body.append(node("p","This control is not available in the current workspace. You can continue or exit."));
   action("Back",()=>engine.back()).disabled=detail.index===0;
   action(detail.index===detail.tour.steps.length-1?"Finish":"Next",()=>engine.next());
   action("Exit tour",()=>engine.stop());
   requestAnimationFrame(position);
  },
  onFinish:tour=>{state.completed=[...new Set([...state.completed,tour.id])];persist();showHome();}
 });
 function startTour(id){const tour=findTour(id);if(tour)engine.start(tour);}
 function showTopic(topic){
  tourTarget=null;dock();
  reset(topic.title);body.append(node("p",topic.text));
  const link=node("a","Read full guide ↗");link.href=topic.doc;link.target="_blank";link.rel="noopener noreferrer";body.append(link);
  action("All help",showHome);action("Close",()=>dialog.close());
 }
 function showHome(){
  tourTarget=null;dock();
  reset("Help & guided tutorials");
  const search=node("input");search.type="search";search.placeholder="Search tutorials and help";search.setAttribute("aria-label","Search help");
  const list=node("div");list.className="help-list";body.append(search,list);
  const render=()=>{
   list.replaceChildren();
   const query=search.value.trim().toLowerCase();
   for(const tour of TOURS.filter(t=>(t.title+" "+t.steps.map(s=>s.text).join(" ")).toLowerCase().includes(query))){
    const b=node("button",tour.title+(state.completed.includes(tour.id)?" ✓":""));b.type="button";b.addEventListener("click",()=>startTour(tour.id));list.append(b);
   }
   for(const topic of HELP_TOPICS.filter(t=>(t.title+" "+t.text).toLowerCase().includes(query))){
    const b=node("button","? "+topic.title);b.type="button";b.addEventListener("click",()=>showTopic(topic));list.append(b);
   }
  };
  search.addEventListener("input",render);render();
  action("Troubleshoot receiver",showDiagnostics);
  action("Restart welcome wizard",()=>showWizard(0));action("Close",()=>dialog.close());
 }
 function showDiagnostics(){
  tourTarget=null;dock();reset("Receiver troubleshooting");
  const connected=document.body.classList.contains("connected");
  const frequencyMHz=Number(document.getElementById("freq")?.value);
  const receiving=/receiv|listening|rx active/i.test(document.getElementById("status")?.textContent??"");
  body.append(node("p","Read-only guidance. No radio settings are changed."));
  const ul=node("ul");for(const finding of diagnoseReceiver({connected,frequencyMHz,receiving}))ul.append(node("li",finding));body.append(ul);
  action("Receive tutorial",()=>startTour("receive"));action("Back",showHome);
 }
 function showWizard(step){
  tourTarget=null;dock();
  wizard=step;const info=onboardingCopy(step);reset(info.title);
  body.append(node("p",info.body));
  if(step===1){
   const select=node("select");select.setAttribute("aria-label","Choose your goal");
   for(const tour of TOURS){const opt=node("option",tour.title);opt.value=tour.id;select.append(opt);}
   select.value=goal;select.addEventListener("change",()=>{goal=select.value;});body.append(select);
  }
  if(step>0)action("Back",()=>showWizard(step-1));
  action(step===3?"Start tutorial":"Continue",()=>{
   if(step===3){state.onboarded=true;persist();startTour(goal);}else showWizard(step+1);
  });
  action("Skip",()=>{state.onboarded=true;persist();dialog.close();});
 }
 button.addEventListener("click",showHome);
 initContextHelp(showTopic);
 if(!state.onboarded){
  let existing=false;
  try{
   const {getAllStoredValues,getStoredValue}=await import("../storage/db.js");
   existing=(await getAllStoredValues("capture-sessions")).length>0||!!(await getStoredValue("workspace","layout"));
  }catch{}
  if(existing){
   reset("New: Guided Help");
   body.append(node("p","Guided tutorials and contextual help are now available. Existing captures and workspace settings are preserved."));
   action("Explore Help",async()=>{state.onboarded=true;await persist();showHome();});
   action("Welcome wizard",()=>showWizard(0));
   action("Dismiss",async()=>{state.onboarded=true;await persist();dialog.close();});
  }else showWizard(0);
 }
}
initHelpCenter().catch(error=>console.error("Help center failed",error));
