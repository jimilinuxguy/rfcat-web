import {defineConfig} from "@playwright/test";
export default defineConfig({
 testDir:"./browser-tests",
 use:{baseURL:"http://127.0.0.1:8080",browserName:"chromium",headless:true},
 webServer:{command:"python3 -m http.server 8080 --bind 127.0.0.1",url:"http://127.0.0.1:8080",reuseExistingServer:!process.env.CI,timeout:15000},
});
