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
