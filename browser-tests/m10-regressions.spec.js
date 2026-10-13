import {test,expect} from "@playwright/test";

// Keep every browser regression test sensitive to unexpected application errors.
test.beforeEach(async({page})=>{
 const failures=[];
 page.on("pageerror",error=>failures.push("JavaScript: "+error.message));
 page.on("response",response=>{
  if(response.status()>=400&&new URL(response.url()).origin===new URL(page.url()||"http://127.0.0.1:8080").origin)
   failures.push("HTTP "+response.status()+": "+response.url());
 });
 page.on("requestfailed",request=>{
  if(request.url().startsWith("http://127.0.0.1:8080/"))failures.push("Request: "+request.url()+" "+request.failure()?.errorText);
 });
 // A test may also assert its own behavior; unexpected runtime errors fail at teardown.
 page.__rfcatBrowserFailures=failures;
});
test.afterEach(async({page})=>{
 expect(page.__rfcatBrowserFailures||[],"Unexpected browser application errors").toEqual([]);
});

test("workspace tab selection persists after reload",async({page})=>{
 await page.goto("/");
 await expect(page.locator('[data-workspace-panel="radio"]')).toHaveCount(1);
 await page.locator('[data-workspace-tab="protocols"]').click();
 await expect(page.locator('[data-workspace-tab="protocols"]')).toHaveAttribute("aria-selected","true");
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem("rfcat.workspace.active.v1"))).toBe("protocols");
 await page.reload();
 await expect(page.locator('[data-workspace-tab="protocols"]')).toHaveAttribute("aria-selected","true");
 await expect(page.locator('[data-workspace-panel="momentum-chat"]')).toBeVisible();
 await expect(page.locator('[data-workspace-panel="radio"]')).toBeHidden();
});

test("radio form values survive tab changes without accidental RF actions",async({page})=>{
 await page.goto("/");
 await page.locator('[data-workspace-tab="tools"]').click();
 await page.locator("#freq").fill("915.125");
 await page.locator("#drate").fill("9600");
 await page.locator('[data-workspace-tab="analyze"]').click();
 await page.locator('[data-workspace-tab="tools"]').click();
 await expect(page.locator("#freq")).toHaveValue("915.125");
 await expect(page.locator("#drate")).toHaveValue("9600");
 await expect(page.locator("#radio-status-shortcut")).toContainText("915.125 MHz");
});

test("panel open state persists in IndexedDB across reload",async({page})=>{
 await page.goto("/");
 const panel=page.locator('[data-workspace-panel="radio"]');
 await expect(panel).toHaveCount(1);
 await page.locator('[data-workspace-tab="tools"]').click();
 await panel.evaluate(el=>{el.open=false;el.dispatchEvent(new Event("toggle"));});
 await expect.poll(()=>page.evaluate(async()=>{
  const dbs=await indexedDB.databases();return dbs.some(db=>db.name?.includes("rfcat"));
 })).toBe(true);
 // Debounced save occurs after the panel toggle.
 await page.waitForTimeout(500);
 await page.reload();
 await page.locator('[data-workspace-tab="tools"]').click();
 await expect(page.locator('[data-workspace-panel="radio"]')).not.toHaveAttribute("open","");
});

test("every guided tour step resolves to a visible target in the correct workspace",async({page})=>{
 await page.goto("/");
 await expect(page.locator('[data-workspace-panel="radio"]')).toHaveCount(1);
 const report=await page.evaluate(async()=>{
  const [{TOURS},{createTourEngine}]=await Promise.all([
   import("./js/help/tours.js"),import("./js/help/tour-engine.js")
  ]);
  const outcomes=[];
  const engine=createTourEngine({onChange:detail=>{
   if(!detail)return;
   const target=detail.target;
   const panel=target?.closest("[data-workspace-panel]");
   const owner=panel?.dataset.workspacePanel||null;
   const selected=document.querySelector('[data-workspace-tab][aria-selected="true"]')?.dataset.workspaceTab;
   const expected=detail.step.workspace||({
    radio:"tools",receiver:"receive","capture-library":"receive",
    "pulse-analyzer":"analyze","signal-analyzer":"analyze",
    transmitter:"transmit","test-bench":"transmit",waveform:"transmit",
    cw:"protocols","momentum-chat":"protocols"
   })[owner]||null;
   outcomes.push({tour:detail.tour.id,index:detail.index,target:detail.step.target,
    found:detail.found,visible:!!target?.getClientRects().length,
    selected,expected,highlighted:!!target?.classList.contains("help-target")});
  }});
  for(const tour of TOURS){
   engine.start(tour);
   for(let i=1;i<tour.steps.length;i++)engine.next();
   engine.stop();
  }
  return {tourCount:TOURS.length,stepCount:TOURS.reduce((n,t)=>n+t.steps.length,0),outcomes};
 });
 expect(report.tourCount).toBeGreaterThanOrEqual(19);
 expect(report.outcomes).toHaveLength(report.stepCount);
 const bad=report.outcomes.filter(x=>!x.found||!x.visible||!x.highlighted||(x.expected&&x.selected!==x.expected));
 expect(bad,"Tour steps missing, hidden or in the wrong workspace: "+JSON.stringify(bad,null,2)).toEqual([]);
});

test("Help can open and exit a guided tutorial without trapping navigation",async({page})=>{
 await page.goto("/");
 await page.locator("#help-open").click();
 // First-run onboarding is allowed; explicitly return to Help home through the button.
 await page.locator("#help-open").click();
 await expect(page.locator(".help-tour-tile").first()).toBeVisible();
 await page.locator(".help-tour-tile").first().click();
 await expect(page.getByRole("button",{name:"Exit tour"})).toBeVisible();
 await page.getByRole("button",{name:"Exit tour"}).click();
 await expect(page.locator("#help-dialog")).not.toBeVisible();
 await page.locator('[data-workspace-tab="transmit"]').click();
 await expect(page.locator('[data-workspace-tab="transmit"]')).toHaveAttribute("aria-selected","true");
});
