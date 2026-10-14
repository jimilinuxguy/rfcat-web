# README screenshot automation

Run from the repository root:

```bash
npm install
npx playwright install chromium
npm run screenshots:readme
```

The command starts a temporary localhost HTTP server on port 8765, launches headless Chromium, and captures the Receive, Transmit, and Tools workspaces at a fixed 1440×1000 viewport. It also captures the expanded Firmware Manager. No YARD Stick One or USB permissions are required.

Output files:

- `docs/images/receiver-transmitter.png`
- `docs/images/waveform-preview.png`
- `docs/images/radio-configuration.png`
- `docs/images/firmware-manager.png`

The first three are embedded in the main README. The fourth can be embedded after the first successful run commits the generated PNG. Generated screenshots should be reviewed for welcome dialogs, clipped panels, stale UI text, and sensitive content before committing. This script does not fake connected-device status or RF captures. A locally occupied port 8765 will prevent the server from starting cleanly; stop the conflicting service and rerun.

**Automated regression:** `browser-tests/readme-screenshots.spec.js` runs under `npm run test:browser` and `npm run verify`. It visits the three workspace tabs, opens Firmware Manager, checks for JavaScript errors, and captures screenshots **in memory** to verify the browser can render them. It does not modify tracked PNG files. Actual documentation image regeneration remains an explicit `npm run screenshots:readme` command; images are not updated automatically by GitHub Actions.
