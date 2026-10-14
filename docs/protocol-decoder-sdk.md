# M24 — Protocol Decoder Plugin SDK (v1)

The decoder SDK is a **trusted JavaScript module extension point**, not an arbitrary third-party code loader. It does not install packages or execute imported JSON. Built-in **declarative** decoding is registered automatically.

```js
import {registerProtocolDecoder,decodeWithProtocolDecoder,listProtocolDecoders}
  from "./js/rx/protocol-decoder-sdk.js";

const unregister = registerProtocolDecoder({
  apiVersion: 1,
  id: "example-adapter",
  name: "Example adapter",
  description: "An offline sample decoder",
  decode(definition, hex) {
    // definition is normalized and hex contains complete uppercase bytes.
    return {matched: hex.startsWith("AA"), fields: [
      {name: "payload", value: hex.slice(2)}
    ], reason: ""};
  }
});
console.log(listProtocolDecoders());
console.log(decodeWithProtocolDecoder("example-adapter", definition, "AA0102"));
unregister();
```

## Contract and lifecycle

- **Registration:** `registerProtocolDecoder({apiVersion:1,id,name,description?,decode})` validates adapter metadata and rejects duplicate IDs. It returns an unregister callback.
- **Execution:** `decodeWithProtocolDecoder(id,definition,hex)` validates the declarative protocol definition and hex bytes, calls the trusted adapter synchronously, validates the response and returns `{decoderId,protocolId,matched,fields,reason}`.
- **Discovery:** `listProtocolDecoders()` returns metadata, not executable functions. The Investigation Workspace exposes these adapters in **Decoder SDK test bench**.
- **Response:** `{matched:boolean,fields:[{name:string,value:string|number|boolean}],reason?:string}`. Output is normalized for safe text-only presentation. Invalid adapter results throw.
- **Security:** Registration is only for code deliberately bundled/imported by the application developer. Do **not** register arbitrary user-provided JavaScript, use `eval`, or import executable code from untrusted URLs. A malicious trusted adapter can still execute arbitrary JS in the page; the SDK is **not a sandbox**. Decoder operations are offline; they do not require or operate WebUSB.
- **Compatibility:** SDK API version 1; max 255 packet bytes, 128 output fields. Changes to the contract require a new version.

To add a decoder to the app, commit a reviewed JavaScript module, import it from an application entry point and register its adapter. A user-imported protocol JSON file remains declarative data and cannot register executable adapters.

## Guided walkthrough

Open **Analyze → Protocol Definition Builder → Investigation Workspace → Decoder SDK test bench**, or launch **Decoder SDK wizard** from the guide bar / Help Center. Select a registered adapter, enter packet hex, click **Decode with adapter**, then inspect the returned fields and matched status.

Tests: `tests/protocol-decoder-sdk.test.js` and `browser-tests/m23-m24.spec.js`.
