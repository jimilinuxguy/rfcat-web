export const ONBOARDING_GOALS=["receive","intelligent-receiver","rf-test-bench","cw-workbench","transmit","analyze","signal-workbench","protocol-reverse-engineering","configure","scan","save","session-replay","protocol-builder","protocol-evidence","protocol-regression","protocol-decoder","protocol-timeline","protocol-state-machine","investigation-workflow","investigation-resume","investigation-field-diagram","investigation-timeline-chart","investigation-state-graph"];
export function onboardingCopy(step){
 return [
 {title:"Welcome to RFCat Web",body:"Your browser-based RF workspace. Use Receive, Transmit, Analyze, Protocols, and Tools tabs to focus on one workflow; tours switch tabs for you. Explore offline or connect a YARD Stick One for live radio work."},
 {title:"What would you like to do?",body:"Choose a guided workflow, including Offline Capture Replay, Protocol Definition Builder, protocol evidence, regression testing, decoder comparisons, timeline, state inference, persistent investigations and visual diagrams. Tutorials navigate to the correct workspace automatically. You can restart any tutorial from Help."},
 {title:"Before you begin",body:"Use Chrome or Edge with WebUSB for hardware. Offline .sub imports, timing histograms, decode hypothesis exploration and frame comparison and saved-session replay work without a radio. Burst grouping uses live CC1111 packet events and does not transmit; it is not raw RF-frame reconstruction. Only transmit where authorized."},
 {title:"Ready to explore",body:"Start your chosen tutorial, or close this wizard and explore independently."}
 ][step]??null;
}
