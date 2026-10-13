import {HELP_TOPICS} from "./tours.js";
export function initContextHelp(openTopic){
 for(const topic of HELP_TOPICS){
  const target=document.querySelector(topic.target);
  if(!target)continue;
  const label=target.closest("label");
  const button=document.createElement("button");
  button.type="button";button.className="help-question";button.textContent="?";
  button.setAttribute("aria-label","Help: "+topic.title);
  button.title="Help: "+topic.title;
  button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();openTopic(topic);});
  if(label)label.append(button);else target.insertAdjacentElement("afterend",button);
 }
}
