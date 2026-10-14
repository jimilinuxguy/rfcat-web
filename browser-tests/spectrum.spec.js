import {test,expect} from "@playwright/test";
test("Spectrum Explorer renders in Analyze and requires hardware",async({page})=>{
 await page.goto("/");
 await page.locator('[data-workspace-tab="analyze"]').click();
 const panel=page.locator("#spectrum-explorer");
 await expect(panel).toBeVisible();
 await panel.locator("summary").click();
 await expect(page.locator("#spectrum-start-button")).toBeVisible();
 await page.locator("#spectrum-start-button").click();
 await expect(page.locator("#spectrum-status")).toContainText("Connect YARD Stick One");
 await expect(page.locator("#spectrum-start-button")).toBeEnabled();
});

test("Spectrum dashboard has waterfall, metrics and switchable delta view",async({page})=>{
 await page.goto("/");
 await page.locator('[data-workspace-tab="analyze"]').click();
 const panel=page.locator("#spectrum-explorer");
 await panel.locator("summary").click();
 await expect(page.locator("#spectrum-waterfall")).toBeVisible();
 await expect(page.locator("#spectrum-metric-delta")).toHaveText("—");
 await page.locator("#spectrum-view-delta").click();
 await expect(page.locator("#spectrum-view-delta")).toHaveAttribute("aria-pressed","true");
 await page.locator("#spectrum-baseline").click();
 await expect(page.locator("#spectrum-status")).toContainText("Connect YARD Stick One");
});

test("RF dashboard shows target marker control, legend and hover hint",async({page})=>{
 await page.goto("/");await page.locator('[data-workspace-tab="analyze"]').click();
 const panel=page.locator("#spectrum-explorer");await panel.locator("summary").click();
 await expect(page.locator("#spectrum-target")).toHaveValue("433.920");
 await expect(page.locator("#spectrum-hover")).toContainText("Hover over a cell");
 await expect(panel).toContainText("−105 to −90");
 await expect(page.locator("#spectrum-metrics > div")).toHaveCount(6);
 const plot=page.locator("#spectrum-plot"),delta=page.locator("#spectrum-view-delta");
 const a=await plot.boundingBox(),d=await delta.boundingBox();
 expect(d.y).toBeLessThan(a.y);
});

test("RSSI scale selector and chart hover diagnostics render",async({page})=>{
 await page.goto("/");await page.locator('[data-workspace-tab="analyze"]').click();
 const panel=page.locator("#spectrum-explorer");await panel.locator("summary").click();
 const scale=page.locator("#spectrum-scale");
 await expect(scale).toHaveValue("auto");
 await scale.selectOption("fixed");
 await expect(scale).toHaveValue("fixed");
 await expect(page.locator("#spectrum-chart-hover")).toContainText("Hover over");
 await expect(page.locator("#spectrum-plot")).toBeVisible();
});

test("investigation controls are available without automatically starting RF",async({page})=>{
 await page.goto("/");
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator("#spectrum-explorer summary").click();
 await expect(page.locator("#spectrum-investigate")).toBeDisabled();
 await expect(page.locator("#spectrum-investigation")).toBeHidden();
 await expect(page.locator("#spectrum-investigate-save")).toHaveCount(1);
});
test("investigation save persists a separate capture-library session",async({page})=>{
 await page.goto("/");
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent("rfcat:investigation-start",{detail:{frequencyHz:433920000}})));
 const saved=page.evaluate(()=>new Promise(resolve=>document.addEventListener("rfcat:investigation-saved",event=>resolve(event.detail),{once:true})));
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent("rfcat:investigation-save",{detail:{frequencyHz:433920000,selectedAt:new Date().toISOString(),samples:[],summary:[],baseline:[]}})));
 const result=await saved;
 expect(result.error).toBeUndefined();
 expect(result.captureCount).toBe(0);
 await expect(page.locator("#session-select option")).toContainText(["RF investigation 433.920 MHz"]);
});

test("invalid investigation cannot persist a session",async({page})=>{
 await page.goto("/");
 const saved=page.evaluate(()=>new Promise(resolve=>document.addEventListener("rfcat:investigation-saved",e=>resolve(e.detail),{once:true})));
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent("rfcat:investigation-save",{detail:{frequencyHz:NaN}})));
 const result=await saved;
 expect(result.error).toContain("No selected investigation");
});
test("investigation starts a new capture boundary without radio actions",async({page})=>{
 await page.goto("/");
 const result=await page.evaluate(async()=>{
  let usbCommands=0;
  navigator.usb?.addEventListener?.("connect",()=>usbCommands++);
  document.dispatchEvent(new CustomEvent("rfcat:investigation-start",{detail:{frequencyHz:433920000}}));
  const saved=new Promise(resolve=>document.addEventListener("rfcat:investigation-saved",e=>resolve(e.detail),{once:true}));
  document.dispatchEvent(new CustomEvent("rfcat:investigation-save",{detail:{frequencyHz:433920000,summary:[],samples:[],baseline:[]}}));
  return {result:await saved,usbCommands};
 });
 expect(result.result.error).toBeUndefined();
 expect(result.result.captureCount).toBe(0);
 expect(result.usbCommands).toBe(0);
});
