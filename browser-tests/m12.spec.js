import {test,expect} from "@playwright/test";
test("M12 exports prepared replay as JSON and CSV without hardware",async({page})=>{
 await page.goto("/");
 await page.locator('[data-workspace-tab="receive"]').click();
 await page.locator("#rx-import-file").setInputFiles({name:"sample.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify([{hex:"AA BB",timestamp:"2026-01-01T00:00:00Z"},{hex:"01 02",timestamp:"2026-01-01T00:00:01Z"}]))});
 await page.locator("#replay-load").click();
 await expect(page.locator("#replay-summary")).toContainText("2 captures");
 const [jsonDownload]=await Promise.all([page.waitForEvent("download"),page.locator("#replay-export-json").click()]);
 expect(jsonDownload.suggestedFilename()).toBe("rfcat-replay-report.json");
 const [csvDownload]=await Promise.all([page.waitForEvent("download"),page.locator("#replay-export-csv").click()]);
 expect(csvDownload.suggestedFilename()).toBe("rfcat-replay-report.csv");
});
