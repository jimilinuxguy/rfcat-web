import {test,expect} from "@playwright/test";
import {installMockWebUSB} from "./helpers/mock-webusb.js";

test("mock YARD Stick One connects, reads radio registers and disconnects",async({page})=>{
 await installMockWebUSB(page);
 await page.goto("/");
 await page.locator("#connect").click();
 await expect(page.locator("body")).toHaveClass(/connected/);
 await expect(page.locator("#status")).toContainText("Mock YARD Stick One connected");
 await expect(page.locator("#configSummary")).toContainText("MHz");
 await expect(page.locator("#radio-status-connection")).toContainText("Connected");
 await page.locator("#connect").click();
 await expect(page.locator("body")).not.toHaveClass(/connected/);
 await expect(page.locator("#status")).toHaveText("Disconnected");
 await expect(page.locator("#connect")).toHaveText("Connect YS1");
});

test("WebUSB device chooser cancellation does not mark radio connected",async({page})=>{
 await installMockWebUSB(page,{permissionDenied:true});
 page.on("dialog",dialog=>dialog.accept());
 await page.goto("/");
 await page.locator("#connect").click();
 await expect(page.locator("#log")).toContainText("User cancelled device selection");
 await expect(page.locator("body")).not.toHaveClass(/connected/);
 await expect(page.locator("#connect")).toHaveText("Connect YS1");
});

test("unexpected USB removal returns UI to disconnected state",async({page})=>{
 await installMockWebUSB(page);
 await page.goto("/");
 await page.locator("#connect").click();
 await expect(page.locator("body")).toHaveClass(/connected/);
 await page.evaluate(()=>window.__mockWebUSB.disconnect());
 await expect(page.locator("body")).not.toHaveClass(/connected/);
 await expect(page.locator("#status")).toHaveText("Disconnected");
 await expect(page.locator("#connect")).toHaveText("Connect YS1");
});
