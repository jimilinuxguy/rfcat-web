import {test,expect} from "@playwright/test";

const captures=[
 {hex:"AA BB",timestamp:"2026-01-01T00:00:00.000Z"},
 {hex:"AA BB",timestamp:"2026-01-01T00:00:00.200Z"},
 {hex:"01 02 03",timestamp:"2026-01-01T00:00:00.400Z"}
];
async function setup(page){
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto("/");
 await page.locator('[data-workspace-tab="receive"]').click();
 await expect(page.locator("#replay-load")).toBeVisible();
 await page.locator("#rx-import-file").setInputFiles({name:"m11-captures.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(captures))});
 await expect(page.locator("#packetList .packet")).toHaveCount(3);
 return errors;
}
async function prepare(page){
 await page.locator("#replay-load").click();
 await expect(page.locator("#replay-summary")).toContainText("3 captures");
 await expect(page.locator("#replay-summary")).toContainText("2 unique payloads");
}
test("M11 offline replay: timeline, stepping and bounds",async({page})=>{
 const errors=await setup(page);
 await prepare(page);
 await expect(page.locator("#replay-frame")).toContainText("AABB");
 await expect(page.locator("#replay-prev")).toBeDisabled();
 await expect(page.locator("#replay-timeline .replay-marker")).toHaveCount(3);
 await page.locator("#replay-next").click();
 await expect(page.locator("#replay-frame")).toContainText("Capture 2/3");
 await page.locator("#replay-timeline .replay-marker").nth(2).click();
 await expect(page.locator("#replay-frame")).toContainText("010203");
 await expect(page.locator("#replay-next")).toBeDisabled();
 await page.locator("#session-new").click();
 await expect(page.locator("#replay-frame")).toBeEmpty();
 await expect(page.locator("#replay-play")).toBeDisabled();
 expect(errors).toEqual([]);
});
test("M11 offline playback: speed, pause and finish",async({page})=>{
 const errors=await setup(page);
 await prepare(page);
 await page.locator("#replay-speed").selectOption("4");
 await page.locator("#replay-play").click();
 await expect(page.locator("#replay-frame")).toContainText("Capture 3/3",{timeout:4000});
 await expect(page.locator("#replay-play")).toBeDisabled();
 await page.locator("#replay-timeline .replay-marker").first().click();
 await page.locator("#replay-speed").selectOption("0.5");
 await page.locator("#replay-play").click();
 await expect(page.locator("#replay-pause")).toBeEnabled();
 await page.locator("#replay-pause").click();
 const frame=await page.locator("#replay-frame").textContent();
 await page.waitForTimeout(1100);
 await expect(page.locator("#replay-frame")).toHaveText(frame);
 expect(errors).toEqual([]);
});
test("M11 saved session comparison reads persisted hex and leaves captures intact",async({page})=>{
 const errors=await setup(page);
 await prepare(page);
 page.on("dialog",dialog=>dialog.accept("M11 reference"));
 await page.locator("#session-save").click();
 await expect(page.locator("#session-select option")).toHaveCount(1);
 await page.locator("#replay-load").click();
 await expect(page.locator("#replay-compare-session option")).toHaveCount(1);
 await page.locator("#replay-compare").click();
 await expect(page.locator("#replay-comparison")).toContainText("AABB: current 2 · selected 2 · Δ +0");
 await expect(page.locator("#packetList .packet")).toHaveCount(3);
 expect(errors).toEqual([]);
});
test("M11 Help walkthrough targets every replay control and can exit",async({page})=>{
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto("/");
 const report=await page.evaluate(async()=>{
  const [{findTour},{createTourEngine}]=await Promise.all([import("./js/help/tours.js"),import("./js/help/tour-engine.js")]);
  const tour=findTour("session-replay"),steps=[];
  const engine=createTourEngine({onChange:detail=>{
   if(!detail)return;
   steps.push({selector:detail.step.target,found:detail.found,visible:!!detail.target?.getClientRects().length,highlighted:!!detail.target?.classList.contains("help-target"),workspace:document.querySelector('[data-workspace-tab][aria-selected="true"]')?.dataset.workspaceTab});
  }});
  engine.start(tour);
  for(let i=1;i<tour.steps.length;i++)engine.next();
  engine.stop();
  return steps;
 });
 expect(report).toHaveLength(8);
 expect(report.filter(x=>!x.found||!x.visible||!x.highlighted||x.workspace!=="receive")).toEqual([]);
 await page.locator("#help-open").click();
 await page.locator("#help-open").click();
 await page.getByRole("searchbox",{name:"Search help"}).fill("Offline capture replay");
 await page.locator(".help-tour-tile").filter({hasText:"Offline capture replay"}).click();
 await expect(page.getByRole("button",{name:"Exit tour"})).toBeVisible();
 await page.getByRole("button",{name:"Exit tour"}).click();
 await expect(page.locator("#help-dialog")).not.toBeVisible();
 expect(errors).toEqual([]);
});
