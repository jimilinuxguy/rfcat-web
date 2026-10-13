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

Playwright launches a local Python HTTP server. Hardware/WebUSB integration and full tutorial walkthroughs still require manual verification; the browser smoke suite does not claim to validate RF behavior.
