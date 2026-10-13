import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readRadioSummary,formatRadioSummary,initRadioStatus} from "../js/ui/radio-status.js";
const fakeDoc=()=>{
 const values={freq:"433.92",drate:"4800"};
 const events=new Map(),dispatched=[];
 const button={attrs:{},handlers:new Map(),setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.handlers.set(k,fn);},removeEventListener(k){this.handlers.delete(k);},click(){this.handlers.get("click")?.();}};
 const detail={textContent:""},connection={textContent:""};
 const doc={body:{classList:{contains:()=>false}},dispatched,addEventListener(k,fn){events.set(k,fn);},removeEventListener(k){events.delete(k);},dispatchEvent(event){dispatched.push(event);},getElementById(id){if(id==="radio-status-shortcut")return button;if(id==="radio-status-details")return detail;if(id==="radio-status-connection")return connection;if(id==="mod")return {selectedOptions:[{textContent:"ASK / OOK"}]};if(id in values)return {value:values[id]};return null;}};
 return {doc,values,events,button,detail,connection};
};
test("radio summary is explicitly form-derived, not claimed hardware state",()=>{
 const {doc}=fakeDoc();
 const result=readRadioSummary(doc);
 assert.deepEqual(result,{connected:false,frequency:"433.920 MHz",modulation:"ASK / OOK",dataRate:"4,800 baud"});
 assert.match(formatRadioSummary(result),/433.920 MHz/);
});
test("status shortcut navigates to Tools without changing RF values",()=>{
 const f=fakeDoc();const cleanup=initRadioStatus(f.doc);
 assert.equal(f.connection.textContent,"Disconnected");
 assert.match(f.detail.textContent,/ASK \/ OOK/);
 f.button.click();
 assert.equal(f.doc.dispatched.length,1);
 assert.equal(f.doc.dispatched[0].detail.workspace,"tools");
 assert.equal(f.values.freq,"433.92");
 f.values.freq="915.000";f.events.get("input")({target:{id:"freq"}});
 assert.match(f.detail.textContent,/915.000 MHz/);
 cleanup();
});
test("M10 status is loaded and navigation remains reachable on every workspace",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.match(html,/id="radio-status-shortcut"/);
 assert.match(html,/src="\.\/js\/ui\/radio-status\.js"/);
 for(const name of ["receive","transmit","analyze","protocols","tools"])assert.ok(html.includes('data-workspace-tab="'+name+'"'));
});
