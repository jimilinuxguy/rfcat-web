import {test,expect} from "@playwright/test";
test("M15 compares independent sessions and displays evidence",async({page})=>{
 await page.goto("/");
 await page.evaluate(async()=>{
  const {saveCaptureSession}=await import("./js/storage/capture-session-store.js");
  await saveCaptureSession({id:"m15-a",name:"M15 A",captures:[{hex:"AA01AB"},{hex:"AA02A8"}]});
  await saveCaptureSession({id:"m15-b",name:"M15 B",captures:[{hex:"AA03A9"},{hex:"BB01BA"}]});
 });
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator("#protocol-definition-builder > summary").click();
 await page.locator("#pd-id").fill("m15_demo");
 await page.locator("#pd-name").fill("M15 Demo");
 await page.locator("#pd-length").fill("3");
 await page.locator("#pd-sync").fill("AA");
 await page.locator("#pd-fields").fill(JSON.stringify([{name:"check",start:2,width:1,type:"checksum",algorithm:"xor8",checksumStart:0,checksumEnd:1}]));
 await page.locator("#pd-refresh").click();
 await expect(page.locator('#pd-evidence-sessions input[value="m15-a"]')).toHaveCount(1);
 await page.locator('#pd-evidence-sessions input[value="m15-a"]').check();
 await page.locator('#pd-evidence-sessions input[value="m15-b"]').check();
 await page.locator("#pd-evidence-run").click();
 await expect(page.locator("#pd-evidence-output")).toContainText('"matched": 3');
 await expect(page.locator("#pd-evidence-output")).toContainText('"coveredSessions": 2');
 await expect(page.locator("#pd-status")).toContainText("Evidence:");
});
