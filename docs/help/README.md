# Guided onboarding and contextual help

RFCat Web offers a first-run wizard and an always-available **? Help** button in the header. The wizard is optional and can be restarted from the Help panel. It introduces browser/hardware prerequisites and lets you select a task.

## Guided tutorials

The Help panel has searchable, restartable walkthroughs for receiving a signal, transmitting a test signal, analyzing Flipper RAW captures, configuring the radio, investigating an unknown signal, and saving captures. A tour opens collapsed sections, scrolls to the relevant control, highlights it, and provides **Back**, **Next**, and **Exit tour**. When a target is absent, the tour explains that and allows you to continue. The tutorial never connects hardware, modifies radio settings, or transmits on its own.

Contextual **?** controls beside selected radio and analyzer fields provide short explanations and links to the full guides. Help can be opened at any time, including after onboarding.

The wizard completion flag and completed-tour identifiers are stored in the browser's IndexedDB `help` object store. This is local to the browser origin. The schema version is 4 and upgrades existing stores without clearing saved capture sessions or workspace layouts. If IndexedDB is unavailable, help still works for the current page, but progress does not persist.

## Manual browser validation

1. Open a fresh browser profile at the served RFCat Web origin. Verify the welcome wizard appears and can be skipped.
2. Reload: it should not reopen after completion or skipping. Open **? Help** and choose **Restart welcome wizard**.
3. Choose **Analyze a Flipper RAW capture**. Verify the analyzer expands and the highlighted controls follow the tutorial.
4. Test Back, Next, Exit tour, and completion. Verify the completed tutorial displays a check mark in Help.
5. Search for `frequency` and `waveform`, open a contextual topic, and follow its documentation link.
6. Test the Help panel with a rearranged workspace, keyboard navigation, and a narrow/mobile viewport.
7. Confirm preexisting IndexedDB capture sessions and workspace layouts survive the schema upgrade.

## Limitations

Tutorial targets depend on current DOM selectors. Missing or unavailable controls are skipped manually using Next; no workflow is executed automatically. Guided steps are educational, not a substitute for correct RF configuration, authorized spectrum use, or hardware verification. Automated tests cover tour definitions and storage schema declarations; browser interaction must be checked manually.

## Enhanced guided experience

Tour cards position next to their highlighted controls where viewport space allows, falling back within the viewport edges. Scrolling, resizing and responsive layouts reposition the card. Connection steps can advance when the application enters its connected state; the RAW import step advances on file selection. All other steps remain manual and never initiate transmission, radio configuration, or receive operations.

The Help panel includes a **Troubleshoot receiver** action with read-only checks for WebUSB connection, supported frequency, and possible receive-state or framing issues. These are advisory checks, not definitive hardware diagnostics. Protocol-specific walkthroughs cover POCSAG, Momentum Sub-GHz Chat, and Retekess/LRS/JTECH.

For existing users with a recognized saved workspace or capture session, the first launch offers a smaller introduction to the new Help system instead of requiring the full welcome wizard. Both flows are dismissible. Test the existing-user detection against a populated local browser profile before release.

## contextual help coverage

The inline (?) help covers major radio controls (data rate, bandwidth, sync, packet length, address filtering, CRC, whitening, status bytes, lowball RX and radio actions), receiver capture/decoder workflows, transmission/protocol selection, Flipper RAW waveform and guided scanning, and Momentum chat security. Each topic links to an existing technical guide. Search in Help to find these topics without opening their associated panel.

The selector-coverage test checks that every tour target and contextual help selector exists in `index.html`. This guards against UI refactors silently orphaning help controls; it does not replace browser accessibility and placement checks.

## advanced interactive tutorials

Open **? Help** to find the **Advanced analysis** and **Secure interoperability** groups. The new tutorials cover **Compare RF captures**, **Infer unknown protocol fields**, **Build and validate a preset**, **Waveform timing lab**, and **Encrypted Momentum Chat lab**. Each walks through real UI controls and includes an optional, deterministic practice question using clearly labeled synthetic examples. The answer explains why the result is plausible and where additional validation is required.

The Help interface now includes grouped tutorial tiles, a step-progress indicator, example bytes/timing chips, selectable practice answers, and accessible feedback. Practice is read-only: it never sends RF, writes presets, changes encryption settings, or modifies saved captures. Users must deliberately operate the actual application controls. A tutorial can be completed even without answering a practice question; completion indicates the tour was visited, **not** that the user passed a competency test.

### Browser acceptance checks

1. Open Help and verify the two advanced categories and five new tutorials appear and can be found by search.
2. Start **Compare RF captures**; verify the compare panel is highlighted, the practice answer explains the changed byte, and Back/Next work.
3. Complete **Waveform timing lab** offline with a Flipper RAW import; confirm cursor and hypothesis steps highlight correctly.
4. Open the encrypted chat lab without a radio; confirm that nothing is transmitted and no secrets are displayed by the tutorial.
5. Test the tutorial UI at narrow widths, zoomed browser text, keyboard-only input, and reduced-motion settings.
6. Run `npm test` to check definitions, exercises and DOM selectors.

## context-aware RF diagnostics

Open **? Help → Troubleshoot receiver**. The diagnostic studio reads the current UI connection indicator, receiver state, configured frequency, RX event count, decoded/rejected/duplicate counters and capture filter. It prioritizes connection and unsupported-frequency problems, then idle RX, no packets, decode failures, rejected or repeated frames, and filters that hide undecoded traffic.

Each finding includes a severity cue and an **Inspect** button that opens and scrolls to the relevant control. **Refresh checks** reads current state again; it does not poll hardware or send commands. The results are hypotheses based on displayed values, **not** hardware measurements or proof that a signal is absent. No RF configuration, receive state, stored capture or encryption secret is changed by running diagnostics.

### Manual validation

1. With no hardware connected, verify the connection finding and its Inspect button.
2. Enter an out-of-band frequency and verify the frequency finding (do not apply it to hardware).
3. Connect and start receiving: with zero RX events, verify the no-packets guidance.
4. Load or capture undecoded frames, choose **Decoded only**, and verify decode/filter findings.
5. Verify the Refresh button updates counts and that Inspect opens the relevant workspace panel.
6. Check keyboard focus, narrow viewports and browser console. Run `npm test`.

## Illustrated help library

The searchable Help index groups contextual topics into **Radio configuration**, **Signal analysis**, **Capture & decoding**, **Transmission & tools**, and **Secure chat**. Instead of repeated question-mark rows, each topic uses a compact, self-contained SVG category illustration, a title, a short preview and a disclosure chevron. Icons are decorative (hidden from screen readers); the entire tile remains a keyboard-accessible button. No external icon library or network asset is required. Search filters the grouped topics and their descriptions.

## Radio panel contextual-help layout

Radio field explanations are accessed using compact help buttons aligned to the right of the corresponding field labels. Checkbox settings (CRC, data whitening, RSSI/LQI status and lowball/raw OOK receive) display the checkbox, its label and contextual-help button together in a bordered row. This layout is CSS-only: it does not change the configuration values or hardware behavior. Verify the alignment at wide and narrow workspace sizes and after resizing the Radio panel. The Help Center's illustrated topic cards are separate from these inline field help buttons.

## wizard and guided analyzer workbench

The welcome wizard now offers **Advanced Signal Analysis workbench** as a dedicated offline goal alongside the original **Analyze a Flipper RAW capture** workflow. The existing analyzer tour has been expanded to cover timing histogram selection, decode hypotheses, repeated-frame comparison, JSON export and saving. A separate seven-step advanced tour covers high/low pulse selection, clickable histogram bins, display-only bit inversion, frame stability and export. All steps target actual controls, require explicit user interaction, and do not operate radio hardware.

To test, open **? Help → Restart welcome wizard**, select **Advanced Signal Analysis workbench**, and follow the highlighted controls after importing a RAW `.sub` file. Verify Back/Next/Exit, collapsed-panel expansion, and that the tour remains available from the searchable Help library. Browser interaction must be verified separately from the selector tests.


## Protocol Reverse-Engineering wizard

The welcome wizard offers **Protocol Reverse-Engineering Workbench**. The searchable Help Center includes a seven-step advanced tutorial covering RAW import, candidate decoding, selecting bit positions, naming fields, inference and JSON export. The tour is educational, read-only and never transmits. See [Protocol Workbench](../protocol-workbench.md).

## Intelligent Receiver & Burst Grouping wizard

The welcome wizard now includes **Intelligent Receiver & Burst Grouping**, and the searchable Help Center includes an eight-step guided workflow under **Capture & decoding**. The tour covers connecting the YARD Stick One, matching authorized RF settings, enabling tracking, choosing the duplicate window, starting reception, interpreting burst counts and RSSI, and exporting JSON. It does not operate radio hardware or send test packets on your behalf.

Contextual Help topics cover burst tracking, the duplicate window, and JSON export, all linking to the [Capture Pipeline guide](../capture-pipeline.md). Burst groups represent consecutive matching **CC1111 packet events**, not verified over-the-air frames. The original receiver and protocol-specific filtering remain independent.

### Wizard acceptance

1. Open **? Help → Restart welcome wizard**, choose **Intelligent Receiver & Burst Grouping**, and start the tutorial.
2. Verify all eight steps highlight existing controls; Back, Next, Exit and Finish behave as expected.
3. Set the window to 300 ms, receive repeated packets, and confirm the tutorial explains packet-level grouping without claiming RF frame identity.
4. Search Help for `burst` and `duplicate`; confirm contextual topics open the Capture Pipeline guide.
5. Confirm no tutorial action starts reception, changes the radio configuration, transmits, or exports without an explicit user action.
6. Check narrow viewport, keyboard navigation, and `npm test`.

## RF Test Bench tutorial

The wizard and searchable Help Center now include a seven-step **RF Test Bench** tour. It highlights packet input, repeat limits, offline preview, authorization, explicit TX confirmation, result interpretation and JSON export. Tour steps do not operate radio hardware or initiate transmission. See [RF Test Bench](../rf-test-bench.md) for safety limits and manual acceptance.

## — Morse Code / CW Workbench

The welcome wizard and Help Center include a nine-step **Morse Code / CW Workbench** tour covering message input, WPM, offline waveform preview, local sidetone, RF authorization, TX, live raw OOK RX, offline decoding and JSON export. The wizard does not initiate transmissions. [CW guide](../cw-workbench.md).

## Workspace-aware guided tours

The **Help** wizard and guided tours automatically select the workspace containing the highlighted control. Radio configuration is under **Tools**; RX capture and burst grouping under **Receive**; protocol transmission and RF Test Bench under **Transmit**; Flipper RAW and signal analysis under **Analyze**; and Morse/CW and Momentum Chat under **Protocols**. A tour can move between tabs without clearing controls, starting reception, or transmitting. Diagnostic suggestions use the same navigation behavior.

If a tutorial step is missing, ensure the feature is present in the current build. Help will report unavailable targets instead of transmitting or changing radio settings. The current tab is saved locally as usual.

## Offline capture replay tutorial

The welcome wizard offers **Offline capture replay & session comparison**. The Help Center provides an eight-step guided tour for opening a saved session, preparing replay, reviewing summary statistics, using timeline markers, choosing speed, playing/pausing, selecting another session and comparing payload counts. Contextual topics link to the [capture replay guide](../capture-replay.md). Tours only highlight controls; they do not operate the replay or transmit RF. Prepare replay after opening a session to populate its controls. The first 300 timeline markers are shown, while Previous/Next can inspect all prepared captures.

To validate, restart the welcome wizard, select the replay workflow, check that each step highlights its control in Receive, then use Help search for `replay` and `compare`. Verify that no hardware is required. Run `npm test` and `npm run test:browser`.

## Spectrum Explorer guided walkthrough

Open **? Help → Advanced analysis → Spectrum Explorer walkthrough**. The tour navigates to the dynamically created Analyze panel and explains baseline capture, a transmitter-on scan, automatic versus fixed RSSI chart scaling, chart crosshair readings, waterfall interpretation, and CSV export. Tour steps do not start scans, retune the radio, or transmit. The selector-coverage test includes dynamically rendered Spectrum Explorer controls.

## RF signal discovery wizard

The **RF signal discovery: spectrum to capture** tutorial in **? Help → Advanced analysis** highlights the investigation launcher, receiver preset scan, receiver capture handoff, session saving and JSON export. It never starts scanning, receiving or transmitting. A completed tutorial does not certify that modulation or protocol identification succeeded.

## Offline Signal Intelligence wizard

Select **? Help → Advanced analysis → Offline signal fingerprinting**, or restart the welcome wizard and choose the same goal. The five-step tour opens the Analyze workspace, selects a saved Capture Library session, explains packet comparison, attaches the report and exports JSON. Each step highlights a real control without clicking it, changing capture bytes, or operating the radio.

For a hardware-free acceptance check, save a Capture Library session containing `AA0100FF`, `AA0101FF`, `AA0102FF`, and a repeated `AA0100FF`. Refresh the Signal Intelligence session list, select the session, and click **Analyze packets**. Expect four valid captures, three unique payloads, a four-byte length group, and variable offset 2 (zero-based). Attach the report and verify it persists in IndexedDB, then export JSON. Run `npx playwright test browser-tests/signal-intelligence.spec.js` and the full `npm run verify` suite. See [Signal Intelligence](../signal-intelligence.md) for limitations and interpretation.

## Protocol field inference walkthrough

The **Offline signal fingerprinting** tutorial now includes **Interpret field candidates**, between packet comparison and report attachment. It points to the rendered intelligence results, explaining why a changing byte is not proof of a counter, command, identifier or checksum. No RF operations are performed. Follow the [Signal Intelligence guide](../signal-intelligence.md) for deterministic offline samples and limitations.

## Guided protocol analysis workflows (M13–M19)

The welcome wizard and **? Help → Protocol analysis** now include six guided workflows: **Build a reusable protocol definition**, **Cross-session protocol evidence**, **Build protocol regression fixtures**, **Compare decoded packets**, **Analyze protocol field timelines**, and **Infer candidate protocol states**. Each walkthrough highlights real controls in **Analyze → Protocol Definition Builder**, supports Back/Next/Exit and completion tracking, and navigates to Analyze automatically. The builder also has direct guide buttons for definition creation, evidence and regression; Decoder Workbench, Timeline and State Machine panels each have a **Guided walkthrough** button. Searchable contextual topics link to the protocol builder guide. No tutorial runs analysis, saves data, modifies radio configuration, or transmits automatically. Open the relevant panel and manually operate its controls. Offline workflows require existing captures, not hardware. Confirm any protocol interpretation with independent evidence.

For browser acceptance, open each tour from Help and from its panel button; check that dynamically created controls are highlighted and the parent details panel expands. Use Back, Next and Exit; test with no saved sessions, keyboard navigation, narrow screens, and after a workspace layout change. Run `npm run verify` to check selector coverage and browser tour integration.
