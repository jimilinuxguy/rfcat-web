import test from "node:test";
import assert from "node:assert/strict";
import {WORKSPACES,WORKSPACE_PANELS,normalizeWorkspace} from "../js/ui/workspace-navigation.js";
import {readFileSync} from "node:fs";
test("workspace identifiers are stable and invalid persisted values fall back to Receive",()=>{
 assert.deepEqual(WORKSPACES,["receive","transmit","analyze","protocols","tools"]);
 for(const value of WORKSPACES)assert.equal(normalizeWorkspace(value),value);
 for(const value of ["",null,"unknown","__proto__"])assert.equal(normalizeWorkspace(value),"receive");
});
test("all mapped workbench panels exist in the HTML",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 for(const selector of Object.keys(WORKSPACE_PANELS)){
  const leaf=selector.split(" ").at(-1);
  if(leaf.startsWith("#"))assert.ok(html.includes('id="'+leaf.slice(1)+'"'),selector);
  else assert.ok(html.includes(leaf.slice(1)),selector);
 }
 assert.match(html,/data-workspace-tab="receive"/);
 assert.match(html,/workspace-navigation\.js/);
});
test("shared activity and radio connection are never assigned to hidden workspaces",()=>{
 assert.equal(Object.keys(WORKSPACE_PANELS).some(key=>key.includes(".console")),false);
 assert.equal(Object.keys(WORKSPACE_PANELS).some(key=>key.includes(".status")),false);
});
