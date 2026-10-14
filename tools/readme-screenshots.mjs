// Reproducible README screenshots, generated without connected RF hardware.
// Usage: npm run screenshots:readme (requires Playwright Chromium).
import {chromium} from "@playwright/test";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";

const url="http://127.0.0.1:8765";
const server=spawn("python3",["-m","http.server","8765","--bind","127.0.0.1"],{stdio:"ignore"});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(){
 for(let i=0;i<40;i++){
  if(server.exitCode!==null)throw Error("Screenshot HTTP server exited (port 8765 may be in use)");
  try{const response=await fetch(url);if(response.ok)return;}catch{}
  await delay(250);
 }
 throw Error("Screenshot HTTP server failed to start");
}
let browser;
try{
 await ready();
 await mkdir("docs/images",{recursive:true});
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:"reduce"});
 await page.goto(url,{waitUntil:"networkidle"});
 // Dismiss any first-run onboarding without altering application behavior.
 await page.evaluate(()=>{
  for(const selector of ["#welcome-dialog","#onboarding-dialog"]){
   const dialog=document.querySelector(selector);
   if(dialog?.open)dialog.close();
  }
 });
 const capture=async(tab,file)=>{
  await page.locator('[data-workspace-tab="'+tab+'"]').click();
  await page.waitForTimeout(200);
  await page.screenshot({path:"docs/images/"+file,fullPage:true,animations:"disabled"});
  console.log("Wrote docs/images/"+file);
 };
 await capture("receive","receiver-transmitter.png");
 await capture("transmit","waveform-preview.png");
 await capture("tools","radio-configuration.png");

 // Deterministic offline field-inference screenshot.
 await page.evaluate(async()=>{
  const {saveCaptureSession}=await import("./js/storage/capture-session-store.js");
  const now=new Date().toISOString();
  await saveCaptureSession({id:"screenshot-inference",name:"Synthetic field inference",
   createdAt:now,updatedAt:now,
   captures:[0,1,2,3,4].map(n=>({hex:"AA"+n.toString(16).padStart(2,"0")+"FF"}))});
 });
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator("#signal-intelligence summary").click();
 await page.locator("#intelligence-refresh").click();
 await page.locator("#intelligence-session").selectOption("screenshot-inference");
 await page.locator("#intelligence-analyze").click();
 await page.locator("#intelligence-results").getByText("candidate counter",{exact:false}).waitFor();
 await page.locator("#signal-intelligence").screenshot({path:"docs/images/signal-intelligence.png",animations:"disabled"});
 console.log("Wrote docs/images/signal-intelligence.png");
 // Demonstrate tentative packet field annotations on the same synthetic session.
 await page.locator("#field-cohort").selectOption("3");
 await page.locator("#field-packet-grid").getByRole("button",{name:"Capture 0 byte 1: 00"}).click();
 await page.locator("#field-name").fill("sequence");
 await page.locator("#field-kind").selectOption("counter");
 await page.locator("#field-add").click();
 await page.locator("#packet-field-editor").screenshot({path:"docs/images/packet-field-editor.png",animations:"disabled"});
 console.log("Wrote docs/images/packet-field-editor.png");
 await page.locator('[data-workspace-tab="tools"]').click();
 const details=page.locator("#firmware-manager");
 if(!(await details.getAttribute("open")))await details.locator("summary").click();
 await page.locator("#firmware-manager").screenshot({path:"docs/images/firmware-manager.png",animations:"disabled"});
 console.log("Wrote docs/images/firmware-manager.png");
}finally{
 await browser?.close();
 server.kill();
}
