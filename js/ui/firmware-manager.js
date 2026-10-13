import {parseIntelHex,validateFirmware} from "../firmware/intel-hex.js";
import {BootloaderProtocol,BOOTLOADER_USB} from "../firmware/bootloader-protocol.js";
import {SerialBootloaderTransport} from "../firmware/serial-transport.js";
export function initFirmwareManager({radio}){
 const $=id=>document.getElementById(id),host=document.createElement("details");host.id="firmware-manager";host.className="section";
 host.innerHTML='<summary>Firmware Manager — YARD Stick One</summary><div class="section-body"><p>CC1111 bootloader uses USB CDC ACM (Web Serial), not normal RFCat WebUSB. Flashing requires a bootloader already installed. Use only YARD Stick One application firmware built for the 0x1400 bootloader offset.</p><p id="fw-device">Bootloader: disconnected</p><button type="button" id="fw-connect">Connect bootloader (Web Serial)</button> <button type="button" id="fw-disconnect">Disconnect</button><p>Firmware source: <a href="https://github.com/atlas0fd00m/rfcat/releases" target="_blank" rel="noopener">Official RFCat releases</a>. Download a YARD Stick One bootloader-compatible Intel HEX file and select it below.</p><label>Firmware Intel HEX <input id="fw-file" type="file" accept=".hex,.ihx,.txt"></label><p id="fw-info">No firmware selected</p><label><input id="fw-confirm" type="checkbox"> I have confirmed this is a YARD Stick One with the CC bootloader and this firmware targets 0x1400–0x7FFF. I understand the user flash will be erased.</label><p><button type="button" id="fw-flash" disabled>Erase, flash and verify</button> <button type="button" id="fw-run" disabled>Run verified firmware</button></p><progress id="fw-progress" max="100" value="0"></progress><pre id="fw-status" aria-live="polite"></pre><p>If interrupted, reconnect in bootloader mode and retry a complete verified flash. If the bootloader itself is absent or corrupted, browser flashing cannot recover it; use a CC1111-compatible hardware debugger.</p></div>';
 const toolsPanel=document.querySelector('[data-workspace-panel="tools"]')||$("radio")?.closest("details")||document.querySelector("main");
 toolsPanel.append(host);
 let transport=null,plan=null,busy=false,verified=false;
 const status=message=>{$("fw-status").textContent+=message+"\n";};
 function buttons(){$("fw-connect").disabled=busy||!!transport;$("fw-disconnect").disabled=busy||!transport;$("fw-flash").disabled=busy||!transport||!plan||!$("fw-confirm").checked;$("fw-run").disabled=busy||!transport||!verified;}
 $("fw-confirm").onchange=buttons;
 $("fw-file").onchange=async()=>{
  plan=null;verified=false;$("fw-progress").value=0;
  try{const file=$("fw-file").files[0];if(!file)return; if(file.size>512*1024)throw Error("HEX file too large");const image=parseIntelHex(await file.text());plan=validateFirmware(image);$("fw-info").textContent=`${file.name}: ${plan.bytes} bytes, ${plan.records.length} records, ${plan.pages} pages, addresses 0x${plan.min.toString(16)}–0x${plan.max.toString(16)}. File contents cannot prove board identity or firmware authenticity.`;status("Firmware validated structurally. Verify its provenance and target manually.");}catch(e){$("fw-info").textContent="Rejected: "+e.message;}buttons();
 };
 $("fw-connect").onclick=async()=>{try{if(radio.device?.opened)throw Error("Disconnect normal RFCat WebUSB before connecting the bootloader");transport=new SerialBootloaderTransport();await transport.connect();$("fw-device").textContent="Bootloader: connected (USB 1D50:605C, CDC ACM). Firmware version not exposed by this bootloader.";status("Bootloader connected. No writes performed.");}catch(e){await transport?.close();transport=null;status("Connection failed: "+e.message);}buttons();};
 $("fw-disconnect").onclick=async()=>{await transport?.close();transport=null;verified=false;$("fw-device").textContent="Bootloader: disconnected";buttons();};
 $("fw-flash").onclick=async()=>{
  if(busy||!transport||!plan||!$("fw-confirm").checked)return;
  if(radio.device?.opened)return status("Disconnect RFCat WebUSB first.");
  if(!confirm("ERASE ALL USER FLASH on the connected YARD Stick One, then program and verify every written byte?"))return;
  busy=true;verified=false;buttons();
  try{const protocol=new BootloaderProtocol(transport);status("Erasing user flash…");await protocol.flash(plan,({phase,fraction})=>{$("fw-progress").value=Math.round(fraction*100);if(phase==="erased"||phase==="verified")status(phase);});verified=true;status("Readback verified for all programmed records. Firmware not yet rebooted.");}
  catch(e){verified=false;status("FLASH FAILED / NOT VERIFIED: "+e.message+" — reconnect bootloader and retry full image.");}
  finally{busy=false;buttons();}
 };
 $("fw-run").onclick=async()=>{if(!verified||busy||!transport)return;busy=true;buttons();try{await new BootloaderProtocol(transport).run();status("Run command sent. Reconnect in normal RFCat mode to check firmware.");}catch(e){status("Run command failed: "+e.message);}finally{await transport.close();transport=null;verified=false;busy=false;buttons();}};
 buttons();
}
