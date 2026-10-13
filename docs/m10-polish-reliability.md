# M10 — Polish and reliability

M10 focuses on clarity and regression prevention rather than adding RF transmission capabilities.

## Shared radio status

The workspace navigation shows **Disconnected/Connected**, frequency, modulation and data rate, derived from the visible Radio form. Click the summary to switch to **Tools**. It is available across Receive, Transmit, Analyze, Protocols and Tools.

**Important:** Values are the current *UI configuration inputs*, not confirmed CC1111 register readbacks. Selecting a tab or clicking the status does not send USB commands, start reception or transmit. The connection indicator reflects the application's connected CSS state.

## Validation

Run `npm test` for radio-summary and navigation unit tests, plus existing regression suites.

Browser acceptance checklist (Chrome/Edge):

1. Load disconnected: confirm the strip shows Disconnected and the initial form values.
2. Change frequency, modulation and data rate in Tools; verify the strip updates immediately.
3. Visit all five tabs; the summary remains visible and clicking it opens Tools.
4. Connect and disconnect YARD Stick One; verify connection state follows the application.
5. Start each Help tutorial and confirm the correct tab is selected and tabs remain clickable.
6. Narrow the viewport; confirm the status strip wraps without obscuring workspace tabs.

Hardware-free browser smoke tests use Playwright:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

Playwright launches a local Python HTTP server. The extended suite exercises every registered guided-tour step, verifies targets and workspace selection, checks tab and panel persistence across reloads, and fails on unexpected JavaScript exceptions or failed local requests. These are hardware-free browser checks; they do not simulate a YARD Stick One or validate over-the-air RF. Hardware/WebUSB integration and full tutorial walkthroughs still require manual verification; the browser smoke suite does not claim to validate RF behavior.


## Mock WebUSB browser coverage

`browser-tests/helpers/mock-webusb.js` installs a test-only WebUSB device before application scripts load. `browser-tests/m10-webusb.spec.js` exercises successful CC1111 handshake/configuration readback/disconnect, cancelled device selection, and unexpected device removal. The simulator responds to RFCat system ping/peek/poke commands and keeps a local register array; it does not transmit RF or establish real-device compatibility. Run with `npm run test:browser`. Hardware acceptance testing remains separate.
