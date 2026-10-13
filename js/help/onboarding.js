export const ONBOARDING_GOALS=["receive","intelligent-receiver","transmit","analyze","signal-workbench","protocol-reverse-engineering","configure","scan","save"];
export function onboardingCopy(step){
 return [
 {title:"Welcome to RFCat Web",body:"Your browser-based RF workspace. Explore offline or connect a YARD Stick One for live radio work."},
 {title:"What would you like to do?",body:"Choose a guided workflow, including Intelligent Receiver & Burst Grouping for live packet diagnostics. You can restart any tutorial from Help."},
 {title:"Before you begin",body:"Use Chrome or Edge with WebUSB for hardware. Offline .sub imports, timing histograms, decode hypothesis exploration and frame comparison work without a radio. Burst grouping uses live CC1111 packet events and does not transmit; it is not raw RF-frame reconstruction. Only transmit where authorized."},
 {title:"Ready to explore",body:"Start your chosen tutorial, or close this wizard and explore independently."}
 ][step]??null;
}
