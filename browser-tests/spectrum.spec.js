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
