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

test("destructive flashing requires a verified backup even after selecting a valid HEX",async({page})=>{
 await page.goto("/");
 await page.locator('[data-workspace-tab="tools"]').click();
 const manager=page.locator("#firmware-manager");
 await manager.locator("summary").click();
 const bytes=Array.from({length:16},(_,i)=>i);
 const checksum=(-([16,0x14,0,...bytes].reduce((a,b)=>a+b,0)))&255;
 const hex=":10140000"+bytes.map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase()+checksum.toString(16).padStart(2,"0").toUpperCase()+"\n:00000001FF\n";
 await page.locator("#fw-file").setInputFiles({name:"application.hex",mimeType:"text/plain",buffer:Buffer.from(hex)});
 await expect(page.locator("#fw-info")).toContainText("application.hex");
 await page.locator("#fw-confirm").check();
 await expect(page.locator("#fw-flash")).toBeDisabled();
 await expect(page.locator("#fw-verify-device")).toBeDisabled();
});
