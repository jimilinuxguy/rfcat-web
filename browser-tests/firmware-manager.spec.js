import {test,expect} from "@playwright/test";
test("Firmware Manager appears in Tools and rejects unsafe HEX without hardware",async({page})=>{
 await page.goto("/");
 await page.locator('[data-workspace-tab="tools"]').click();
 const manager=page.locator("#firmware-manager");
 await expect(manager).toBeVisible();
 await manager.locator("summary").click();
 await expect(page.locator("#fw-flash")).toBeDisabled();
 await page.locator("#fw-file").setInputFiles({name:"bootloader.hex",mimeType:"text/plain",buffer:Buffer.from(":10100000000102030405060708090A0B0C0D0E0F68\n:00000001FF\n")});
 await expect(page.locator("#fw-info")).toContainText("Rejected:");
 await expect(page.locator("#fw-flash")).toBeDisabled();
});
