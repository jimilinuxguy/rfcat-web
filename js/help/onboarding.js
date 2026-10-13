export const ONBOARDING_GOALS=["receive","transmit","analyze","signal-workbench","configure","scan","save"];
export function onboardingCopy(step){
 return [
 {title:"Welcome to RFCat Web",body:"Your browser-based RF workspace. Explore offline or connect a YARD Stick One for live radio work."},
 {title:"What would you like to do?",body:"Choose a guided workflow. You can start any tutorial again from Help."},
 {title:"Before you begin",body:"Use Chrome or Edge with WebUSB for hardware. Offline .sub imports, timing histograms, decode hypothesis exploration and frame comparison work without a radio. Only transmit where authorized."},
 {title:"Ready to explore",body:"Start your chosen tutorial, or close this wizard and explore independently."}
 ][step]??null;
}
