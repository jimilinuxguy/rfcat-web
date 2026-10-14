import {test,expect} from "@playwright/test";
test("M21/M22 contextual guides highlight real controls and support Back/Next/Exit",async({page})=>{
 await page.goto("/");
 const welcome=page.locator("#help-dialog");if(await welcome.isVisible())await page.locator('#help-dialog button:has-text("Skip")').first().click().catch(()=>page.evaluate(()=>document.querySelector("#help-dialog")?.close()));
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator("#protocol-definition-builder summary").click();
 await page.locator("#help-open").click();await page.getByRole("button",{name:"Investigate a protocol end to end",exact:false}).first().click();
 await expect(page.locator("#help-title")).toContainText("Investigate a protocol end to end");
 await expect(page.locator("#pd-inv-session")).toHaveClass(/help-target/);
 await page.getByRole("button",{name:"Next",exact:true}).click();
 await expect(page.locator("#pd-inv-protocol")).toHaveClass(/help-target/);
 await page.getByRole("button",{name:"Back",exact:true}).click();
 await expect(page.locator("#pd-inv-session")).toHaveClass(/help-target/);
 await page.getByRole("button",{name:"Exit tour"}).click();
 for(const [id,title,target] of [
  ["investigation-resume","Save and resume an investigation","#pd-inv-name"],
  ["investigation-field-diagram","Understand packet field diagrams","#pd-inv-protocol"],
  ["investigation-timeline-chart","Explore field timeline charts","#pd-inv-session"],
  ["investigation-state-graph","Inspect state transition graphs","#pd-inv-session"]
 ]){
  await page.locator("#help-open").click();await page.getByRole("button",{name:title,exact:false}).first().click();
  await expect(page.locator("#help-title")).toContainText(title);
  await expect(page.locator(target)).toHaveClass(/help-target/);
  await page.getByRole("button",{name:"Exit tour"}).click();
 }
});
