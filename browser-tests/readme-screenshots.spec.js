import {test,expect} from "@playwright/test";

test("README screenshot workspaces render and capture without writing PNGs",async({page})=>{
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto("/");
 for(const tab of ["receive","transmit","tools"]){
  const button=page.locator('[data-workspace-tab="'+tab+'"]');
  await button.click();
  await expect(button).toHaveAttribute("aria-selected","true");
  await expect(page.locator("#workspace-main")).toBeVisible();
  const image=await page.screenshot({fullPage:true,animations:"disabled"});
  expect(image.byteLength).toBeGreaterThan(1000);
 }
 const manager=page.locator("#firmware-manager");
 await expect(manager).toBeVisible();
 if(!(await manager.getAttribute("open")))await manager.locator("summary").click();
 await expect(page.locator("#fw-flash")).toBeVisible();
 const image=await manager.screenshot({animations:"disabled"});
 expect(image.byteLength).toBeGreaterThan(1000);
 expect(errors).toEqual([]);
});
