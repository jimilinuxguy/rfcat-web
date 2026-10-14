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
