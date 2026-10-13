// Workspace selection shares panel ownership with the draggable layout manager.
export const WORKSPACES=["receive","transmit","analyze","protocols","tools"];
export const WORKSPACE_PANELS={
 "radio":"tools","receiver":"receive","capture-library":"receive",
 "pulse-analyzer":"analyze","signal-analyzer":"analyze",
 "transmitter":"transmit","test-bench":"transmit","waveform":"transmit",
 "cw":"protocols","momentum-chat":"protocols","activity":"shared"
};
export function normalizeWorkspace(value){return WORKSPACES.includes(value)?value:"receive";}
export function panelWorkspace(id){return WORKSPACE_PANELS[id]||null;}
export function initWorkspaceNavigation(doc=document,storage=globalThis.localStorage){
 const root=doc.getElementById("workspace-main");
 if(!root)return()=>{};
 const tabs=[...doc.querySelectorAll("[data-workspace-tab]")];
 let current="receive";
 function activate(value,{persist=true}={}){
  current=normalizeWorkspace(value);
  const panels=[...root.querySelectorAll("[data-workspace-panel]")];
  for(const panel of panels){
   const owner=panelWorkspace(panel.dataset.workspacePanel);
   panel.hidden=owner!==current&&owner!=="shared";
  }
  // The old mixed column is emptied by the layout manager; never show duplicates.
  const oldColumn=root.querySelector(".rx-tx-tools");
  if(oldColumn)oldColumn.hidden=true;
  for(const tab of tabs){
   const selected=tab.dataset.workspaceTab===current;
   tab.setAttribute("aria-selected",String(selected));
   tab.tabIndex=selected?0:-1;
  }
  root.dataset.workspace=current;
  doc.dispatchEvent(new CustomEvent("rfcat:workspace-changed",{detail:{workspace:current}}));
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
 // initWorkspace() restores IndexedDB asynchronously, then signals that all
 // panels have been moved into the shared layout. Reapply selection afterwards.
 doc.addEventListener("rfcat:workspace-ready",()=>{
  const activity=root.querySelector('[data-workspace-panel="activity"]');
  if(activity)activity.classList.add("workspace-activity");
  activate(current,{persist:false});
 });
 // Help tours and diagnostics use the same navigation path as the tabs.
 doc.addEventListener("rfcat:workspace-activate",event=>{
  const requested=event.detail?.workspace;
  if(WORKSPACES.includes(requested))activate(requested);
 });
 return activate;
}
if(typeof document!=="undefined")initWorkspaceNavigation();
