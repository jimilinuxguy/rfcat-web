import {panelWorkspace} from "../ui/workspace-navigation.js";

// Select the tab containing a tour target without mutating radio or TX state.
export function workspaceForTarget(target,doc=document){
 const node=typeof target==="string"?doc.querySelector(target):target;
 if(!node)return null;
 const panel=node.closest("[data-workspace-panel]");
 return panel?panelWorkspace(panel.dataset.workspacePanel):null;
}
// Results are hidden until the user provides captures. Never fabricate analysis.
export const HELP_TARGET_FALLBACKS=Object.freeze({
 "#rx-compare-body":"#rx-compare",
 "#rx-infer-body":"#rx-infer",
 "#preset-capture-roles":"#preset-build",
 "#preset-preview":"#preset-build",
 "#preset-save":"#preset-build"
});
export function revealHelpTarget(target,doc=document){
 const node=typeof target==="string"?doc.querySelector(target):target;
 if(!node)return null;
 const workspace=workspaceForTarget(node,doc);
 if(workspace&&workspace!=="shared"){
  doc.dispatchEvent(new CustomEvent("rfcat:workspace-activate",{detail:{workspace}}));
 }
 // Opening an ancestor details panel is necessary for nested help controls.
 let parent=node.closest("details");
 while(parent){parent.open=true;parent=parent.parentElement?.closest("details");}
 if(node.getClientRects().length)return node;
 const fallback=typeof target==="string"?HELP_TARGET_FALLBACKS[target]:null;
 if(fallback)return revealHelpTarget(fallback,doc);
 return null;
}
