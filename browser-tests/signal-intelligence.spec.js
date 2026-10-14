import {test,expect} from "@playwright/test";
test("offline intelligence panel renders without radio and refuses empty selection",async({page})=>{
 await page.goto("/");
 await page.locator('[data-workspace-tab="analyze"]').click();
 const panel=page.locator("#signal-intelligence");
 await expect(panel).toBeVisible();
 await panel.locator("summary").click();
 await expect(page.locator("#intelligence-analyze")).toBeVisible();
 await expect(page.locator("#intelligence-export")).toBeDisabled();
 await page.locator("#intelligence-analyze").click();
 await expect(page.locator("#intelligence-status")).toContainText("Select a capture session");
});
test("offline intelligence loads and saves a capture session report",async({page})=>{
 await page.goto("/");
 await page.evaluate(async()=>{
  const {saveCaptureSession}=await import("./js/storage/capture-session-store.js");
  await saveCaptureSession({id:"intelligence-fixture",name:"Intelligence fixture",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),captures:[{hex:"AA01",protocol:"Test"},{hex:"AA02",protocol:"Test"},{hex:"AA01",protocol:"Test"}]});
 });
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator("#signal-intelligence summary").click();
 await page.locator("#intelligence-refresh").click();
 await page.locator("#intelligence-session").selectOption("intelligence-fixture");
 await page.locator("#intelligence-analyze").click();
 await expect(page.locator("#intelligence-results")).toContainText("3 valid / 3 captures");
 await expect(page.locator("#intelligence-results")).toContainText("variable offsets 1");
 await page.locator("#intelligence-save").click();
 await expect(page.locator("#intelligence-status")).toContainText("attached");
 const report=await page.evaluate(async()=>{
  const {getCaptureSession}=await import("./js/storage/capture-session-store.js");
  return (await getCaptureSession("intelligence-fixture")).intelligence;
 });
 expect(report.validCaptures).toBe(3);
 expect(report.modulation.classification).toBe("unknown");
});
