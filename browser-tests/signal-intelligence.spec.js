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

test("candidate counter appears in UI and persists",async({page})=>{
 await page.goto("/");
 await page.evaluate(async()=>{
  const {saveCaptureSession}=await import("./js/storage/capture-session-store.js");
  const now=new Date().toISOString();
  await saveCaptureSession({id:"counter-fixture",name:"Counter fixture",createdAt:now,updatedAt:now,
   captures:[0,1,2,3,4].map(n=>({hex:"AA"+n.toString(16).padStart(2,"0")+"FF"}))});
 });
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator("#signal-intelligence summary").click();
 await page.locator("#intelligence-refresh").click();
 await page.locator("#intelligence-session").selectOption("counter-fixture");
 await page.locator("#intelligence-analyze").click();
 await expect(page.locator("#intelligence-results")).toContainText("Byte 1");
 await expect(page.locator("#intelligence-results")).toContainText("candidate counter");
 await page.locator("#intelligence-save").click();
 await expect(page.locator("#intelligence-status")).toContainText("attached");
 const saved=await page.evaluate(async()=>{
  const {getCaptureSession}=await import("./js/storage/capture-session-store.js");
  return (await getCaptureSession("counter-fixture")).intelligence;
 });
 expect(saved.schemaVersion).toBe(2);
 expect(saved.fields[0].candidates[0].label).toBe("candidate counter");
});
