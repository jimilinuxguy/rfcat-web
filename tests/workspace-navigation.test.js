import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WORKSPACES,WORKSPACE_PANELS,normalizeWorkspace,panelWorkspace} from "../js/ui/workspace-navigation.js";
test("workspace selection validates saved identifiers",()=>{
 assert.deepEqual(WORKSPACES,["receive","transmit","analyze","protocols","tools"]);
 for(const value of WORKSPACES)assert.equal(normalizeWorkspace(value),value);
 for(const value of ["",null,"unknown"])assert.equal(normalizeWorkspace(value),"receive");
});
test("all layout-managed panels have one workspace owner",()=>{
 const source=readFileSync(new URL("../js/ui/workspace.js",import.meta.url),"utf8");
 const defs=[...source.matchAll(/\["([^"]+)",\s*"[^"]+"\]/g)].map(m=>m[1]);
 assert.equal(defs.length,12);
 for(const id of defs)assert.ok(panelWorkspace(id),id);
 assert.equal(panelWorkspace("activity"),"shared");
 assert.equal(panelWorkspace("capture-library"),"receive");
 assert.equal(panelWorkspace("pulse-analyzer"),"analyze");
 assert.equal(panelWorkspace("spectrum-explorer"),"analyze");
 assert.equal(panelWorkspace("transmitter"),"transmit");
 assert.equal(panelWorkspace("cw"),"protocols");
 assert.equal(panelWorkspace("momentum-chat"),"protocols");
});
test("navigation waits for async layout restore and preserves controls",()=>{
 const source=readFileSync(new URL("../js/ui/workspace-navigation.js",import.meta.url),"utf8");
 const layout=readFileSync(new URL("../js/ui/workspace.js",import.meta.url),"utf8");
 assert.match(source,/rfcat:workspace-ready/);
 assert.match(layout,/rfcat:workspace-ready/);
 assert.match(source,/panel.hidden=owner!==current/);
 assert.doesNotMatch(source,/\.remove\(|innerHTML\s*=/);
});
