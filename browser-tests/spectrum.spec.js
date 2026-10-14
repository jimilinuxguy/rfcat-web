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
