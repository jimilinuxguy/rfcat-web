import {test,expect} from "@playwright/test";
test("M23/M24 contextual wizards highlight real evidence and SDK controls",async({page})=>{
 await page.goto("/");await page.locator('[data-workspace-tab="analyze"]').click();await page.locator("#protocol-definition-builder > summary").click();
 for(const [id,title,target] of [["investigation-hypothesis","Build an evidence-backed protocol hypothesis","#pd-hyp-field"],["investigation-hypothesis-validation","Validate a hypothesis across sessions","#pd-hyp-library"],["protocol-decoder-sdk","Use the Protocol Decoder SDK","#pd-sdk-adapter"]]){
  await page.locator("#help-open").click();await page.getByRole("button",{name:title,exact:false}).first().click();
  await expect(page.locator("#help-title")).toContainText(title);
  await expect(page.locator(target)).toHaveClass(/help-target/);
  await page.getByRole("button",{name:"Next",exact:true}).click();
  await page.getByRole("button",{name:"Back",exact:true}).click();
  await expect(page.locator(target)).toHaveClass(/help-target/);
  await page.getByRole("button",{name:"Exit tour"}).click();
 }
});
