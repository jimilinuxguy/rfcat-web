import {test,expect} from "@playwright/test";
test("M25/M26 discover, correlate, save, promote and resume offline",async({page})=>{
 await page.goto("/");await page.evaluate(async()=>{const {saveCaptureSession}=await import("./js/storage/capture-session-store.js");for(const [id,byte] of [["m25a","01"],["m25b","02"]])await saveCaptureSession({id,name:id,captures:[{hex:"AA"+byte+"01"},{hex:"AA"+byte+"02"},{hex:"AA"+byte+"03"}]});});
 await page.locator('[data-workspace-tab="analyze"]').click();await page.locator("#protocol-definition-builder summary").click();await page.locator("#pd-inv-refresh").click();await expect(page.locator("#pd-inv-session option[value=m25a]")).toHaveCount(1);
 await page.locator("#pd-inv-name").fill("M25 M26 investigation");await page.locator("#pd-inv-session").selectOption("m25a");await page.locator("#pd-inv-stages [data-stage=discovery]").click();await page.locator("#pd-inv-save").click();await expect(page.locator("#pd-inv-status")).toContainText("saved locally");
 await page.locator("#pd-disc-refresh").click();await page.locator('#pd-disc-sessions input[value=m25a]').check();await page.locator('#pd-disc-sessions input[value=m25b]').check();
 await page.locator("#pd-disc-run").click();await expect(page.locator("#pd-disc-status")).toContainText("candidates inferred");await expect(page.locator("#pd-disc-candidate option")).toHaveCount(1);await expect(page.locator("#pd-disc-visual")).toContainText("session-identifier");
 await page.locator("#pd-corr-run").click();await expect(page.locator("#pd-disc-results")).toContainText('"coverage": 2');
 await page.locator("#pd-disc-compare").click();await expect(page.locator("#pd-disc-results")).toContainText('"fields"');
 await page.locator("#pd-disc-save").click();await expect(page.locator("#pd-disc-status")).toContainText("review saved");
 await page.locator("#pd-disc-promote").click();await expect(page.locator("#pd-id")).toHaveValue(/candidate_3/);
 await page.reload();await page.locator('[data-workspace-tab="analyze"]').click();await page.locator("#protocol-definition-builder summary").click();await page.locator("#pd-inv-refresh").click();await page.locator("#pd-inv-library").selectOption({label:"M25 M26 investigation"});await page.locator("#pd-inv-load").click();await expect(page.locator("#pd-inv-status")).toContainText("resumed");await expect(page.locator("#pd-disc-results")).toContainText('"selectedId": "length-3"');
});
