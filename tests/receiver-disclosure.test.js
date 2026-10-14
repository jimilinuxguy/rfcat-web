import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../js/ui/receiver-disclosure.js",import.meta.url),"utf8");
test("secondary receiver sections are collapsed by default",()=>{
 assert.match(html,/<details class="rx-specialized collapsible">/);
 assert.match(html,/<details class="rx-diagnostics collapsible">/);
 assert.match(html,/<details class="card rx-sessions capture-library collapsible">/);
 assert.doesNotMatch(html,/<details class="rx-burst-panel" open>/);
});
test("capture list precedes library and retains all existing action ids",()=>{
 assert.ok(html.indexOf('id="packetList"')<html.indexOf('class="card rx-sessions capture-library'));
 for(const id of ["listen","clear","rx-protocol","rx-filter","rx-compare","rx-infer","preset-build","rx-import","rx-export","session-select","pocsag-rx-start","rx-burst-window"])assert.ok(html.includes('id="'+id+'"'),id);
});
test("disclosure preferences use dedicated storage key",()=>{
 assert.match(js,/rfcat\.receiver\.disclosure\.v1/);
 assert.match(js,/addEventListener\("toggle"/);
});

test("offline replay mounts beside, not inside, the collapsed library",()=>{
 const source=readFileSync(new URL("../js/ui/replay-controller.js",import.meta.url),"utf8");
 assert.match(source,/library\.before\(replayHost\)/);
 assert.doesNotMatch(source,/\$\("session-save"\)\.parentElement\?\.append\(replayHost\);\s*let replayFrames/);
});
