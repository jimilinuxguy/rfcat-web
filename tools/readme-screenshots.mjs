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
 const details=page.locator("#firmware-manager");
 if(!(await details.getAttribute("open")))await details.locator("summary").click();
 await page.locator("#firmware-manager").screenshot({path:"docs/images/firmware-manager.png",animations:"disabled"});
 console.log("Wrote docs/images/firmware-manager.png");
}finally{
 await browser?.close();
 server.kill();
}
