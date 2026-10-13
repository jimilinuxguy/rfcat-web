import {test,expect} from "@playwright/test";

test("radio summary follows form values and opens Tools",async({page})=>{
 await page.goto("/");
 const summary=page.locator("#radio-status-shortcut");
 await expect(summary).toBeVisible();
 await expect(summary).toContainText("433.920 MHz");
 await summary.click();
 await expect(page.locator('[data-workspace-tab="tools"]')).toHaveAttribute("aria-selected","true");
 await page.locator("#freq").fill("915.000");
 await page.locator("#mod").selectOption("16");
 await page.locator("#drate").fill("9600");
 await expect(summary).toContainText("915.000 MHz");
 await expect(summary).toContainText("GFSK");
 await expect(summary).toContainText("9,600 baud");
 for(const name of ["receive","transmit","analyze","protocols","tools"]){
  await page.locator('[data-workspace-tab="'+name+'"]').click();
  await expect(summary).toBeVisible();
 }
 await summary.click();
 await expect(page.locator('[data-workspace-tab="tools"]')).toHaveAttribute("aria-selected","true");
});

test("Help tutorial switches tabs without hiding workspace navigation",async({page})=>{
 await page.goto("/");
 await page.locator("#help-open").click();
 await expect(page.locator("#help-dialog")).toBeVisible();
 await expect(page.locator('[data-workspace-tab="receive"]')).toBeVisible();
 await page.locator('[data-workspace-tab="transmit"]').click();
 await expect(page.locator('[data-workspace-tab="transmit"]')).toHaveAttribute("aria-selected","true");
});

test("status remains accessible on narrow viewports",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/");
 await expect(page.locator("#radio-status-shortcut")).toBeVisible();
 await page.locator("#radio-status-shortcut").click();
 await expect(page.locator('[data-workspace-tab="tools"]')).toHaveAttribute("aria-selected","true");
});
