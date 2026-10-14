import {test,expect} from "@playwright/test";
test("protocol workflow guides open Help, navigate to Analyze, and highlight dynamic controls",async({page})=>{
 await page.goto("/");
 const welcome=page.locator("#help-dialog");if(await welcome.isVisible())await page.locator('#help-dialog button:has-text("Skip")').first().click().catch(()=>page.evaluate(()=>document.querySelector("#help-dialog")?.close()));
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator("#protocol-definition-builder summary").click();
 await page.locator('[data-help-tour="protocol-builder"]').click();
 await expect(page.locator("#help-title")).toContainText("Build a reusable protocol definition");
 await expect(page.locator("#pd-id")).toHaveClass(/help-target/);
 await page.getByRole("button",{name:"Next",exact:true}).click();
 await expect(page.locator("#pd-fields")).toHaveClass(/help-target/);
 await page.getByRole("button",{name:"Exit tour"}).click();
 await page.locator("#pd-state-machine .pd-guide").click();
 await expect(page.locator("#help-title")).toContainText("Infer candidate protocol states");
 await expect(page.locator("#pd-sm-session")).toHaveClass(/help-target/);
 await page.getByRole("button",{name:"Exit tour"}).click();
});
