import {test,expect} from "@playwright/test";
test("M31-M34 pipeline, bit analysis, CRC, clustering, save and resume without hardware",async({page})=>{
 await page.goto("/");await page.evaluate(async()=>{const {saveCaptureSession}=await import("./js/storage/capture-session-store.js");for(const [id,v] of [["m31one",1],["m31two",2]])await saveCaptureSession({id,name:id,captures:[0,1,2].map(n=>({hex:[0xAA,v,n,0xAA^v^n].map(x=>x.toString(16).padStart(2,"0")).join("")}))});});
 await page.locator('[data-workspace-tab="analyze"]').click();await page.locator("#protocol-definition-builder > summary").click();await page.locator("#pd-inv-refresh").click();await expect(page.locator("#pd-inv-session option[value=m31one]")).toHaveCount(1);
 await page.locator("#pd-inv-name").fill("Intelligence investigation");await page.locator("#pd-inv-session").selectOption("m31one");await page.locator("#pd-inv-advanced").evaluate(el=>el.open=true);await page.locator("#pd-inv-stages [data-stage=pipeline]").click();await page.locator("#pd-inv-save").click();await expect(page.locator("#pd-inv-status")).toContainText("saved locally");
 await page.locator("#pd-int-refresh").click();await page.locator('#pd-int-sessions input[value=m31one]').check();await page.locator('#pd-int-sessions input[value=m31two]').check();
 await page.locator("#pd-int-pipeline").click();await expect(page.locator("#pd-int-results")).toContainText('"packetCount": 6');await expect(page.locator("#pd-int-visual")).toContainText("Packet length");
 await page.locator("#pd-int-bits").click();await expect(page.locator("#pd-int-visual")).toContainText("Classification");
 await page.locator("#pd-int-crc").click();await expect(page.locator("#pd-int-results")).toContainText('"algorithm": "XOR-8"');
 await page.locator("#pd-int-cluster").click();await expect(page.locator("#pd-int-visual")).toContainText("Representative");
 await page.locator("#pd-int-pipeline").click();await page.locator("#pd-int-save").click();await expect(page.locator("#pd-int-status")).toContainText("snapshot saved");
 await page.reload();await page.locator('[data-workspace-tab="analyze"]').click();await page.locator("#protocol-definition-builder > summary").click();await page.locator("#pd-inv-refresh").click();await page.locator("#pd-inv-library").selectOption({label:"Intelligence investigation"});await page.locator("#pd-inv-load").click();await expect(page.locator("#pd-inv-status")).toContainText("resumed");await expect(page.locator("#pd-int-results")).toContainText('"packetCount": 6');
});
