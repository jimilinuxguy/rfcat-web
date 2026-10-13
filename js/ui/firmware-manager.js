import {parseIntelHex,validateFirmware} from "../firmware/intel-hex.js";
import {BootloaderProtocol,BOOTLOADER_USB} from "../firmware/bootloader-protocol.js";
import {readApplication,compareApplication,exportApplicationHex} from "../firmware/backup.js";
import {SerialBootloaderTransport} from "../firmware/serial-transport.js";
export function initFirmwareManager({radio}){
 const $=id=>document.getElementById(id),host=document.createElement("details");host.id="firmware-manager";host.className="section";
 host.innerHTML='<summary>Firmware Manager — YARD Stick One</summary><div class="section-body"><p>CC1111 bootloader uses USB CDC ACM (Web Serial), not normal RFCat WebUSB. Flashing requires a bootloader already installed. Use only YARD Stick One application firmware built for the 0x1400 bootloader offset.</p><p id="fw-device">Checking USB devices…</p><button type="button" id="fw-refresh">Refresh device detection</button> <button type="button" id="fw-enter">Enter bootloader from normal RFCat</button><button type="button" id="fw-connect">Connect bootloader (Web Serial)</button> <button type="button" id="fw-disconnect">Disconnect</button> <button type="button" id="fw-readback" disabled>Test readback (16 bytes, no writes)</button> <button type="button" id="fw-backup" disabled>Backup and verify application flash (Intel HEX)</button><p>Firmware source: <a href="https://github.com/atlas0fd00m/rfcat/releases" target="_blank" rel="noopener">Official RFCat releases</a>. Download a YARD Stick One bootloader-compatible Intel HEX file and select it below.</p><label>Firmware Intel HEX <input id="fw-file" type="file" accept=".hex,.ihx,.txt"></label><p id="fw-info">No firmware selected</p><label><input id="fw-confirm" type="checkbox"> I have confirmed this is a YARD Stick One with the CC bootloader and this firmware targets 0x1400–0x7FFF. I understand the user flash will be erased.</label><p><button type="button" id="fw-flash" disabled>Erase, flash and verify</button> <button type="button" id="fw-run" disabled>Run verified firmware</button></p><progress id="fw-progress" max="100" value="0"></progress><pre id="fw-status" aria-live="polite"></pre><p>If interrupted, reconnect in bootloader mode and retry a complete verified flash. If the bootloader itself is absent or corrupted, browser flashing cannot recover it; use a CC1111-compatible hardware debugger.</p></div>';
 const toolsPanel=$("freq")?.closest("details.card")||document.querySelector("main");
 toolsPanel.append(host);
 let transport=null,plan=null,busy=false,verified=false;
 async function refreshDevices(){
  const found=[];
  if(radio.device?.opened)found.push("Normal RFCat connected via WebUSB ("+radio.device.vendorId.toString(16)+":"+radio.device.productId.toString(16)+")");
  try{
   const devices=await navigator.usb?.getDevices?.()||[];
   for(const device of devices)if(device.vendorId===0x1d50&&[0x605b,0x605c].includes(device.productId)&&!found.some(x=>x.includes("("+device.vendorId.toString(16)+":"+device.productId.toString(16)+")")))found.push(device.productId===0x605c?"Bootloader visible via WebUSB (use Web Serial to connect)":"Normal YARD Stick One visible via WebUSB");
  }catch{}
  try{
   const ports=await navigator.serial?.getPorts?.()||[];
   for(const port of ports){const info=port.getInfo();if(info.usbVendorId===0x1d50&&info.usbProductId===0x605c)found.push("Bootloader serial port authorized (1D50:605C)");}
  }catch{}
  if(transport)found.push("Bootloader connected through Web Serial");
  $("fw-device").textContent=found.join(" · ")||"No authorized YARD Stick One detected. Connect normally via WebUSB, or enter bootloader mode and select its serial port.";
 }
 $("fw-enter").onclick=async()=>{
  if(busy||transport||!radio.device?.opened)return;
  if(!confirm("Switch the connected RFCat device into CC1111 bootloader mode? This interrupts the current RF session but does not erase flash."))return;
  busy=true;buttons();
  try{
   status("Requesting bootloader transition (RFCat system command 0x87)…");
   // The firmware acknowledges this command, then resets USB. Some builds disconnect
   // before the acknowledgment is read; that timeout is not proof of failure.
   try{await radio.enterBootloader();}catch(error){status("Transition response uncertain: "+error.message);}
   await radio.disconnect();
   document.body.classList.remove("connected");
   const normalStatus=document.getElementById("status");
   if(normalStatus)normalStatus.textContent="Disconnected — bootloader requested";
   const connect=document.getElementById("connect");
   if(connect)connect.textContent="Connect YS1";
   status("Normal WebUSB closed. Wait for device re-enumeration, then use Connect bootloader (Web Serial). If the serial chooser is empty, verify the bootloader is installed and the OS exposed its CDC port.");
  }catch(error){status("Bootloader transition failed: "+error.message);}
  finally{busy=false;await refreshDevices();buttons();}
 };
 $("fw-refresh").onclick=async()=>{await refreshDevices();buttons();};
 navigator.usb?.addEventListener?.("connect",()=>{refreshDevices();buttons();});
 navigator.usb?.addEventListener?.("disconnect",()=>{refreshDevices();buttons();});
 navigator.serial?.addEventListener?.("connect",()=>{refreshDevices();buttons();});
 navigator.serial?.addEventListener?.("disconnect",()=>{refreshDevices();buttons();});
 document.getElementById("connect")?.addEventListener("click",()=>{setTimeout(refreshDevices,500);setTimeout(()=>{refreshDevices();buttons();},1800);});
 document.getElementById("disconnect")?.addEventListener("click",()=>{setTimeout(refreshDevices,500);setTimeout(()=>{refreshDevices();buttons();},1800);});
 refreshDevices();
 const status=message=>{$("fw-status").textContent+=message+"\n";};
 function buttons(){$("fw-backup").disabled=busy||!transport;$("fw-readback").disabled=busy||!transport;$("fw-enter").disabled=busy||!!transport||!radio.device?.opened;$("fw-connect").disabled=busy||!!transport;$("fw-disconnect").disabled=busy||!transport;$("fw-flash").disabled=busy||!transport||!plan||!$("fw-confirm").checked;$("fw-run").disabled=busy||!transport||!verified;}
 $("fw-confirm").onchange=buttons;
 $("fw-file").onchange=async()=>{
  plan=null;verified=false;$("fw-progress").value=0;
  try{const file=$("fw-file").files[0];if(!file)return; if(file.size>512*1024)throw Error("HEX file too large");const image=parseIntelHex(await file.text());plan=validateFirmware(image);$("fw-info").textContent=`${file.name}: ${plan.bytes} bytes, ${plan.records.length} records, ${plan.pages} pages, addresses 0x${plan.min.toString(16)}–0x${plan.max.toString(16)}. File contents cannot prove board identity or firmware authenticity.`;status("Firmware validated structurally. Verify its provenance and target manually.");}catch(e){$("fw-info").textContent="Rejected: "+e.message;}buttons();
 };
 $("fw-connect").onclick=async()=>{try{if(radio.device?.opened)throw Error("Disconnect normal RFCat WebUSB before connecting the bootloader");transport=new SerialBootloaderTransport();await transport.connect();await refreshDevices();status("Bootloader connected. No writes performed.");}catch(e){await transport?.close();transport=null;status("Connection failed: "+e.message);}buttons();};
 $("fw-disconnect").onclick=async()=>{await transport?.close();transport=null;verified=false;await refreshDevices();buttons();};
 $("fw-readback").onclick=async()=>{
  if(busy||!transport)return;
  busy=true;buttons();
  try{
   const address=0x1400,length=16;
   status("Reading 16 application bytes at 0x1400 (read-only bootloader command 0x25)…");
   const memory=await new BootloaderProtocol(transport).read(address,length);
   const bytes=Array.from({length},(_,i)=>{
    const value=memory.get(address+i);
    if(!Number.isInteger(value)||value<0||value>255)throw Error("Incomplete readback at 0x"+(address+i).toString(16));
    return value;
   });
   status("Readback OK — 0x1400–0x140F: "+bytes.map(x=>x.toString(16).padStart(2,"0")).join(" ").toUpperCase());
   status("Read-only test passed. No erase, write, or run command sent.");
  }catch(e){status("Readback FAILED: "+e.message+" — no flash operation attempted.");}
  finally{busy=false;buttons();}
 };
 $("fw-backup").onclick=async()=>{
  if(busy||!transport)return;
  busy=true;buttons();$("fw-progress").value=0;
  try{
   const protocol=new BootloaderProtocol(transport);
   status("Reading full application flash (0x1400–0x7FFF); no write commands…");
   const first=await readApplication(protocol,fraction=>{$("fw-progress").value=Math.round(fraction*50);});
   status("First pass complete. Reading again to verify backup…");
   const second=await readApplication(protocol,fraction=>{$("fw-progress").value=50+Math.round(fraction*50);});
   compareApplication(first,second);
   const hex=exportApplicationHex(first);
   const blob=new Blob([hex],{type:"text/plain"});
   const url=URL.createObjectURL(blob);
   const a=document.createElement("a");
   a.href=url;a.download="yard-stick-one-application-backup-"+new Date().toISOString().replace(/[:.]/g,"-")+".hex";
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   status("Backup verified: two identical full reads of 0x1400–0x7FFF (27648 bytes). Intel HEX download started. Keep this file safe.");
   status("To restore, select the saved HEX in Firmware Intel HEX, inspect its range and use the existing confirmed erase/flash/verify workflow.");
  }catch(e){status("BACKUP FAILED — no file exported: "+e.message+". No flash write attempted.");}
  finally{busy=false;buttons();}
 };
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
