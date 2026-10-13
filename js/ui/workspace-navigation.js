// Navigation is presentation-only: retain every existing DOM node, listener and radio state.
export const WORKSPACES=["receive","transmit","analyze","protocols","tools"];
export const WORKSPACE_PANELS={
 "signal-analyzer-panel":"analyze",
 ".radio":"tools",
 ".receiver-card":"receive",
 ".rx-tx-tools .pulse-analyzer-card":"analyze",
 ".rx-tx-tools .transmitter-card":"transmit",
 ".rx-tx-tools .test-bench-card":"transmit",
 ".rx-tx-tools .cw-card":"protocols",
 ".rx-tx-tools .momentum-chat-card":"protocols",
 ".waveform-card":"transmit"
};
export function normalizeWorkspace(value){return WORKSPACES.includes(value)?value:"receive";}
export function initWorkspaceNavigation(doc=document,storage=globalThis.localStorage){
 const root=doc.getElementById("workspace-main");
 if(!root)return()=>{};
 const tabs=[...doc.querySelectorAll("[data-workspace-tab]")];
 const panels=Object.entries(WORKSPACE_PANELS).map(([selector,workspace])=>[doc.getElementById(selector)||root.querySelector(selector),workspace]).filter(([node])=>node);
 const activity=root.querySelector(".console");
 if(activity){activity.classList.add("workspace-activity");activity.open=false;}
 // Hide the entire old mixed RX/TX column only if none of its children belongs here.
 const toolColumn=root.querySelector(".rx-tx-tools");
 let current="receive";
 function activate(value,{persist=true}={}){
  current=normalizeWorkspace(value);
  for(const [panel,workspace] of panels)panel.hidden=workspace!==current;
  if(toolColumn)toolColumn.hidden=![...toolColumn.children].some(child=>!child.hidden&&child.matches(".card"));
  for(const tab of tabs){const selected=tab.dataset.workspaceTab===current;tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;}
  root.dataset.workspace=current;
  if(persist){try{storage?.setItem("rfcat.workspace.active.v1",current);}catch{}}
 }
 for(const tab of tabs){
  tab.addEventListener("click",()=>activate(tab.dataset.workspaceTab));
  tab.addEventListener("keydown",event=>{
   if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;
   event.preventDefault();
   const index=WORKSPACES.indexOf(current);
   const next=event.key==="Home"?0:event.key==="End"?WORKSPACES.length-1:(index+(event.key==="ArrowRight"?1:-1)+WORKSPACES.length)%WORKSPACES.length;
   activate(WORKSPACES[next]);tabs[next]?.focus();
  });
 }
 let saved="receive";
 try{saved=storage?.getItem("rfcat.workspace.active.v1")||saved;}catch{}
 activate(saved,{persist:false});
 return activate;
}
if(typeof document!=="undefined")initWorkspaceNavigation();
