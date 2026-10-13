# Polish and reliability

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

Playwright launches a local Python HTTP server. The extended suite exercises every registered guided-tour step, verifies targets and workspace selection, checks tab and panel persistence across reloads, and fails on unexpected JavaScript exceptions or failed local requests. The 15 Playwright tests include browser UI checks and a simulated YARD Stick One WebUSB command transport. The mock is not physical hardware and does not validate RF transmission, reception, or over-the-air interoperability. Physical WebUSB integration and full hardware tutorial walkthroughs still require manual verification.


## Mock WebUSB browser coverage

`browser-tests/helpers/mock-webusb.js` installs a test-only WebUSB device before application scripts load. `browser-tests/m10-webusb.spec.js` exercises successful CC1111 handshake/configuration readback/disconnect, cancelled device selection, and unexpected device removal. The simulator responds to RFCat system ping/peek/poke commands and keeps a local register array; it does not transmit RF or establish real-device compatibility. Run with `npm run test:browser`. Hardware acceptance testing remains separate.


## USB failure and recovery tests

`browser-tests/m10-webusb-recovery.spec.js` injects a dropped ping, repeated USB write errors, a full handshake timeout, and disconnection with an in-flight command. Production transport cleanup now runs on failed connection attempts; unexpected unplug rejects pending USB waiters. The write-failure test exhausts three handshake attempts and then reconnects; the interrupted-command test uses an isolated RFCatUSB instance to avoid competing USB readers. The permanent-timeout test verifies cleanup, not successful reconnect while the fault remains active. These tests do not establish real-device or RF compatibility.

**Reported validation:** The developer ran the full browser suite after the final fixes and reported **15/15 passing**. This is a local report, not an assertion about the current GitHub Actions result.
