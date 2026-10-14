const STORAGE_KEY="rfcat.receiver.disclosure.v1";
const SELECTORS=[".rx-specialized",".rx-diagnostics",".capture-library"];
export function initReceiverDisclosure(doc=document,storage=globalThis.localStorage){
 const panels=SELECTORS.map(selector=>doc.querySelector(".receiver-card "+selector)).filter(Boolean);
 let saved={};
 try{const value=JSON.parse(storage?.getItem(STORAGE_KEY)||"{}");if(value&&typeof value==="object"&&!Array.isArray(value))saved=value;}catch{}
 for(const panel of panels){
  const key=SELECTORS.find(selector=>panel.matches(selector));
  if(typeof saved[key]==="boolean")panel.open=saved[key];
  panel.addEventListener("toggle",()=>{
   try{
    const state=Object.fromEntries(panels.map(item=>[SELECTORS.find(selector=>item.matches(selector)),item.open]));
    storage?.setItem(STORAGE_KEY,JSON.stringify(state));
   }catch{}
  });
 }
 return panels;
}
