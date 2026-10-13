import {revealHelpTarget} from "./workspace-target.js";
import {EXERCISES,checkExercise} from "./exercises.js";
import {placeHelpCard} from "./tour-position.js";
import {analyzeRadioState,readRadioDiagnostics} from "./diagnostics.js";
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
 const exerciseResults=new Map();
 const dock=()=>{dialog.classList.remove("help-anchored");for(const key of ["left","top","right","bottom"])dialog.style[key]="";};
 const position=()=>{if(!tourTarget||!dialog.open)return;const p=placeHelpCard(tourTarget.getBoundingClientRect(),dialog.offsetWidth,dialog.offsetHeight,innerWidth,innerHeight);dialog.classList.add("help-anchored");dialog.style.left=p.left+"px";dialog.style.top=p.top+"px";dialog.style.right="auto";dialog.style.bottom="auto";};
 addEventListener("resize",position);addEventListener("scroll",position,true);
 try{state=await readHelpState();}catch(error){console.warn("Help persistence unavailable",error);}
 const persist=async()=>{try{await writeHelpState(state);}catch(error){console.warn("Could not save help progress",error);}};
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const action=(label,callback)=>{const b=node("button",label);b.type="button";b.addEventListener("click",callback);actions.append(b);return b;};
 const reset=(heading)=>{title.textContent=heading;body.replaceChildren();actions.replaceChildren();if(!dialog.open)dialog.show();};
 function renderExercise(id){
  const exercise=EXERCISES[id];if(!exercise)return;
  const card=node("section");card.className="help-exercise";card.setAttribute("aria-label","Practice exercise");
  card.append(node("span","INTERACTIVE PRACTICE"),node("h4",exercise.label));
  const samples=node("div");samples.className="help-samples";
  for(const sample of exercise.samples)samples.append(node("code",sample));
  card.append(samples,node("p",exercise.prompt));
  const choices=node("div");choices.className="help-choices";
  const feedback=node("p");feedback.className="help-feedback";feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
  exercise.options.forEach((option,i)=>{
   const b=node("button",option);b.type="button";b.className="help-choice";
   b.addEventListener("click",()=>{
    const result=checkExercise(id,i);
    exerciseResults.set(id,result.correct);
    for(const other of choices.children)other.classList.remove("selected");
    b.classList.add("selected");
    feedback.textContent=(result.correct?"Correct. ":"Not quite. ")+result.explanation;
    feedback.dataset.correct=String(result.correct);
   });
   choices.append(b);
  });
  card.append(choices,feedback);body.append(card);
 }
 const engine=createTourEngine({
  onChange:detail=>{
   if(!detail){tourTarget=null;dock();if(dialog.open)dialog.close();return;}
   tourTarget=detail.target;
   reset(detail.tour.title+" · "+(detail.index+1)+"/"+detail.tour.steps.length);
   const progress=node("div");progress.className="help-progress";progress.setAttribute("role","progressbar");progress.setAttribute("aria-valuemin","0");progress.setAttribute("aria-valuemax",String(detail.tour.steps.length));progress.setAttribute("aria-valuenow",String(detail.index+1));
   const fill=node("span");fill.style.width=((detail.index+1)/detail.tour.steps.length*100)+"%";progress.append(fill);
   body.append(progress,node("h3",detail.step.title),node("p",detail.step.text));
   if(detail.step.exercise)renderExercise(detail.step.exercise);
   if(!detail.found)body.append(node("p","This control is not available in the current workspace. You can continue or exit."));
   action("Back",()=>engine.back()).disabled=detail.index===0;
   action(detail.index===detail.tour.steps.length-1?"Finish":"Next",()=>engine.next());
   action("Exit tour",()=>engine.stop());
   requestAnimationFrame(position);
  },
  onFinish:tour=>{state.completed=[...new Set([...state.completed,tour.id])];persist();showHome();}
 });
 function startTour(id){const tour=findTour(id);if(tour){exerciseResults.clear();engine.start(tour);}}
 function showTopic(topic){
  tourTarget=null;dock();
  reset(topic.title);body.append(node("p",topic.text));
  const link=node("a","Read full guide ↗");link.href=topic.doc;link.target="_blank";link.rel="noopener noreferrer";body.append(link);
  action("All help",showHome);action("Close",()=>dialog.close());
 }
 const topicCategory=topic=>{
  const t=(topic.title+" "+topic.target).toLowerCase();
  if(/waveform|cursor|pulse|zoom|pan|scan|signal|analysis/.test(t))return "Signal analysis";
  if(/chat|secret|encrypt|security|message/.test(t))return "Secure chat";
  if(/transmit|protocol|ipython|export/.test(t))return "Transmission & tools";
  if(/receive|decoder|capture|filter|infer|preset|session|compare/.test(t))return "Capture & decoding";
  return "Radio configuration";
 };
 const topicIcon=category=>{
  const paths={
   "Signal analysis":["M2 12h3l3-8 4 16 3-8h7"],
   "Secure chat":["M5 11V8a7 7 0 0 1 14 0v3","M5 11h14v10H5z","M12 15v2"],
   "Transmission & tools":["M3 11.5 21 3l-8.5 18-2.4-7.1L3 11.5z","M10.1 13.9 21 3"],
   "Capture & decoding":["M4 5h16v14H4z","M8 9h8","M8 13h8","M8 17h5"],
   "Radio configuration":["M2 8a15 15 0 0 1 20 0","M5 11a10 10 0 0 1 14 0","M8 14a5 5 0 0 1 8 0","M12 18v2"]
  };
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","1.8");svg.setAttribute("stroke-linecap","round");svg.setAttribute("stroke-linejoin","round");svg.setAttribute("aria-hidden","true");svg.classList.add("help-topic-icon");
  for(const d of paths[category]){const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",d);svg.append(path);}
  return svg;
 };
 function showHome(){
  tourTarget=null;dock();
  reset("Help & guided tutorials");
  const search=node("input");search.type="search";search.placeholder="Search tutorials and help";search.setAttribute("aria-label","Search help");
  const list=node("div");list.className="help-list";body.append(search,list);
  const render=()=>{
   list.replaceChildren();
   const query=search.value.trim().toLowerCase();
   const matches=TOURS.filter(t=>(t.title+" "+(t.category??"")+" "+t.steps.map(s=>s.text).join(" ")).toLowerCase().includes(query));
   for(const category of [...new Set(matches.map(t=>t.category??"Getting started"))]){
    const section=node("section");section.className="help-tour-group";
    section.append(node("h3",category));
    for(const tour of matches.filter(t=>(t.category??"Getting started")===category)){
     const b=node("button");b.type="button";b.className="help-tour-tile";
     const heading=node("strong",tour.title),meta=node("small",tour.steps.length+" steps"+(state.completed.includes(tour.id)?" · Completed":""));
     b.append(heading,meta);b.addEventListener("click",()=>startTour(tour.id));section.append(b);
    }
    list.append(section);
   }
   const topics=HELP_TOPICS.filter(t=>(t.title+" "+t.text).toLowerCase().includes(query));
   for(const category of [...new Set(topics.map(topicCategory))]){
    const section=node("section");section.className="help-topic-group";
    section.append(node("h3",category));
    for(const topic of topics.filter(t=>topicCategory(t)===category)){
     const b=node("button");b.type="button";b.className="help-topic-tile";
     const icon=node("span");icon.className="help-topic-icon-wrap";icon.append(topicIcon(category));
     const content=node("span");content.className="help-topic-content";
     content.append(node("strong",topic.title),node("small",topic.text));
     const arrow=node("span","›");arrow.className="help-topic-arrow";arrow.setAttribute("aria-hidden","true");
     b.append(icon,content,arrow);b.addEventListener("click",()=>showTopic(topic));section.append(b);
    }
    list.append(section);
   }
  };
  search.addEventListener("input",render);render();
  action("Troubleshoot receiver",showDiagnostics);
  action("Restart welcome wizard",()=>showWizard(0));action("Close",()=>dialog.close());
 }
 function showDiagnostics(){
  tourTarget=null;dock();reset("RF diagnostics");
  const heading=node("p","Live, read-only checks based on the current page state. These are suggestions, not measurements of RF activity.");
  const summary=node("div");summary.className="help-diagnostic-summary";
  const findings=node("div");findings.className="help-diagnostic-list";
  body.append(heading,summary,findings);
  const render=()=>{
   const snapshot=readRadioDiagnostics(document);
   summary.textContent=(snapshot.connected?"Connected":"Disconnected")+" · "+(snapshot.receiving?"Receiving":"Not receiving")+" · "+snapshot.packets+" RX events · "+snapshot.decoded+" decoded";
   findings.replaceChildren();
   for(const issue of analyzeRadioState(snapshot)){
    const card=node("section");card.className="help-diagnostic-card";card.dataset.severity=issue.severity;
    const head=node("strong",issue.title),description=node("p",issue.detail);
    const inspect=node("button",issue.action);inspect.type="button";
    inspect.addEventListener("click",()=>{
     const target=revealHelpTarget(issue.target);
     if(!target)return;
     dialog.close();target.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
     target.focus?.({preventScroll:true});
     target.classList.add("help-target");
     setTimeout(()=>target.classList.remove("help-target"),3500);
    });
    card.append(head,description,inspect);findings.append(card);
   }
  };
  render();
  action("Refresh checks",render);
  action("Receive tutorial",()=>startTour("receive"));
  action("Back",showHome);
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
  action("Skip",async()=>{state.onboarded=true;await persist();dialog.close();});
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
