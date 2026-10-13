import {test,expect} from "@playwright/test";
import {installMockWebUSB} from "./helpers/mock-webusb.js";

test("dropped initial ping is retried and connection succeeds",async({page})=>{
 await installMockWebUSB(page,{dropPings:1});
 await page.goto("/");
 await page.locator("#connect").click();
 await expect(page.locator("body")).toHaveClass(/connected/,{timeout:8000});
 await expect(page.locator("#status")).toContainText("Mock YARD Stick One");
 await page.locator("#connect").click();
 await expect(page.locator("body")).not.toHaveClass(/connected/);
});

test("USB write failure cleans up and a subsequent connection succeeds",async({page})=>{
 await installMockWebUSB(page,{failWrites:1});
 page.on("dialog",dialog=>dialog.accept());
 await page.goto("/");
 await page.locator("#connect").click();
 await expect(page.locator("#log")).toContainText("Simulated USB write failure");
 await expect(page.locator("body")).not.toHaveClass(/connected/);
 await expect(page.locator("#connect")).toHaveText("Connect YS1");
 await page.locator("#connect").click();
 await expect(page.locator("body")).toHaveClass(/connected/);
 await page.locator("#connect").click();
 await expect(page.locator("body")).not.toHaveClass(/connected/);
});

test("handshake timeout releases device and reconnect works",async({page})=>{
 test.setTimeout(30000);
 await installMockWebUSB(page,{pingTimeout:true});
 page.on("dialog",dialog=>dialog.accept());
 await page.goto("/");
 await page.locator("#connect").click();
 await expect(page.locator("#log")).toContainText("Timeout waiting for",{timeout:14000});
 await expect(page.locator("#connect")).toHaveText("Connect YS1",{timeout:14000});
 await expect(page.locator("body")).not.toHaveClass(/connected/);
 // This mock's permanent timeout remains active; verify transport cleanup rather than pretending it recovered.
 expect(await page.evaluate(()=>window.__mockWebUSB.opened)).toBe(false);
});

test("unplug during a pending command cancels the waiter and reconnects",async({page})=>{
 await installMockWebUSB(page);
 await page.goto("/");
 await page.locator("#connect").click();
 await expect(page.locator("body")).toHaveClass(/connected/);
 await page.evaluate(()=>window.__mockWebUSB.setDroppedPings(1));
 // Exercise an in-flight system command without emitting any RF transmission.
 const pending=page.evaluate(async()=>{
  const {RFCatUSB}=await import("./js/rfcat/device.js");
  // The application instance is private; use a dedicated device to verify transport cancellation.
  const usb=new RFCatUSB();
  await usb.connect();
  window.__pendingTestDevice=usb;
  window.__pendingResult=usb.ping().then(()=> "resolved",e=>e.message);
 });
 await pending;
 await page.evaluate(async()=>{
  const p=window.__pendingResult;
  await window.__pendingTestDevice.disconnect();
  window.__pendingOutcome=await p;
 });
 expect(await page.evaluate(()=>window.__pendingOutcome)).toContain("disconnected");
 await page.evaluate(()=>window.__mockWebUSB.disconnect());
 await expect(page.locator("body")).not.toHaveClass(/connected/);
});
