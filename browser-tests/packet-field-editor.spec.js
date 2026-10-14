import {test,expect} from "@playwright/test";

test("annotate, compare, persist and restore packet field hypotheses offline",async({page})=>{
 await page.goto("/");
 await page.evaluate(async()=>{
  const {saveCaptureSession}=await import("./js/storage/capture-session-store.js");
  const now=new Date().toISOString();
  await saveCaptureSession({id:"field-editor-fixture",name:"Field editor fixture",createdAt:now,updatedAt:now,
   captures:[{hex:"AA00FF"},{hex:"AA01FF"},{hex:"AA02FF"},{hex:"AA03FF"},{hex:"BB00"}]});
 });
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator("#signal-intelligence summary").click();
 await page.locator("#intelligence-refresh").click();
 await page.locator("#intelligence-session").selectOption("field-editor-fixture");
 await page.locator("#intelligence-analyze").click();
 await expect(page.locator("#packet-field-editor")).toBeVisible();
 await page.locator("#field-cohort").selectOption("3");
 await expect(page.locator("#field-packet-grid table tr")).toHaveCount(5);
 await page.getByRole("button",{name:"Capture 0 byte 1: 00"}).click();
 await expect(page.locator("#field-start")).toHaveValue("1");
 await page.locator("#field-name").fill("sequence");
 await page.locator("#field-kind").selectOption("counter");
 await page.locator("#field-add").click();
 await expect(page.locator("#field-annotations")).toContainText("sequence");
 await expect(page.locator("#field-annotations")).toContainText("00, 01, 02, 03");
 await page.locator("#field-add").click();
 await expect(page.locator("#field-status")).toContainText("overlap");
 await page.locator("#field-cohort").selectOption("2");
 await expect(page.locator("#field-packet-grid table tr")).toHaveCount(2);
 await expect(page.locator("#field-annotations")).not.toContainText("sequence");
 await page.locator("#field-cohort").selectOption("3");
 await page.locator("#intelligence-save").click();
 await expect(page.locator("#intelligence-status")).toContainText("attached");
 const saved=await page.evaluate(async()=>{
  const {getCaptureSession}=await import("./js/storage/capture-session-store.js");
  return getCaptureSession("field-editor-fixture");
 });
 expect(saved.fieldAnnotations["3"][0]).toEqual({start:1,width:1,kind:"counter",name:"sequence"});
 expect(saved.captures).toHaveLength(5);
 await page.locator("#intelligence-analyze").click();
 await expect(page.locator("#field-annotations")).toContainText("sequence");
});

test("switching sessions resets the editor and protects capture isolation",async({page})=>{
 await page.goto("/");
 await page.evaluate(async()=>{
  const {saveCaptureSession}=await import("./js/storage/capture-session-store.js");
  for(const id of ["editor-a","editor-b"])await saveCaptureSession({id,name:id,captures:[{hex:"AA01"},{hex:"AA02"}]});
 });
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator("#signal-intelligence summary").click();
 await page.locator("#intelligence-refresh").click();
 await page.locator("#intelligence-session").selectOption("editor-a");
 await page.locator("#intelligence-analyze").click();
 await expect(page.locator("#packet-field-editor")).toBeVisible();
 await page.locator("#intelligence-session").selectOption("editor-b");
 await expect(page.locator("#packet-field-editor")).toBeHidden();
 await page.locator("#intelligence-analyze").click();
 await expect(page.locator("#field-annotations")).not.toContainText("sequence");
});
