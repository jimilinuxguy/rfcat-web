import test from "node:test";
import assert from "node:assert/strict";
import { parseFlipperRaw, normalizePulseCapture, analyzePulses, comparePulseCaptures } from "../js/rx/signal-fingerprint.js";
const sample = (preset="FuriHalSubGhzPresetOok650Async") => `Filetype: Flipper SubGhz RAW File
Version: 1
Frequency: 433920000
Preset: ${preset}
Protocol: RAW
RAW_Data: 500 -500 1000 -1000 500 -8000
RAW_Data: 500 -500 1000 -1000
`;
test("parses multiline RAW preserving metadata and source",()=>{
  const c=parseFlipperRaw(sample());
  assert.equal(c.frequencyHz,433920000);
  assert.equal(c.durationsUs.length,10);
  assert.equal(c.metadata.Version,"1");
  assert.equal(c.verifiedModulation,null);
  assert.equal(c.originalText,sample());
});
test("FSK preset remains configured, not verified",()=>{
  const c=parseFlipperRaw(sample("FuriHalSubGhzPreset2FSKDev238Async"));
  assert.equal(c.configuredModulation,"FSK");
  assert.equal(analyzePulses(c).verifiedModulation,null);
});
test("malformed and unsafe RAW values rejected",()=>{
  for (const s of [sample().replace("RAW_Data: 500","RAW_Data: bad"),sample().replace("Protocol: RAW","Protocol: Princeton"),sample().replace("500 -500","0 -500"),sample().replace("433920000","NaN")]) assert.throws(()=>parseFlipperRaw(s));
});
test("ambiguous OOK/FSK pulse timings cannot prove modulation",()=>{
  const durationsUs=[500,-500,1000,-500,500,-9000,500,-500];
  const a=analyzePulses(normalizePulseCapture({durationsUs,configuredModulation:"ASK/OOK"}));
  const b=analyzePulses(normalizePulseCapture({durationsUs,configuredModulation:"FSK"}));
  assert.equal(a.verifiedModulation,null);
  assert.equal(b.verifiedModulation,null);
  assert.deepEqual(a.candidates,b.candidates);
  assert.equal(comparePulseCaptures([normalizePulseCapture({durationsUs}),normalizePulseCapture({durationsUs})]).modulationVerified,false);
});
