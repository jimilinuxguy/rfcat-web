import test from "node:test";
import assert from "node:assert/strict";
import { encodePlaintextChat, decodePlaintextChat } from "../js/chat/momentum-plaintext.js";

test("plaintext messages use UTF-8 and CRLF as in Enhanced Sub-GHz Chat", () => {
    const data = encodePlaintextChat("Hello Flipper");
    assert.deepEqual([...data.slice(-2)], [13, 10]);
    assert.equal(decodePlaintextChat(data), "Hello Flipper");
});
test("Unicode round trip", () => {
    assert.equal(decodePlaintextChat(encodePlaintextChat("café 📻")), "café 📻");
});
test("receive trims terminal LF and optional CR", () => {
    assert.equal(decodePlaintextChat(new TextEncoder().encode("Hi\n")), "Hi");
    assert.equal(decodePlaintextChat(new TextEncoder().encode("Hi\r\n")), "Hi");
});
test("rejects multiline and oversized messages", () => {
    assert.throws(() => encodePlaintextChat("a\nb"));
    assert.throws(() => encodePlaintextChat("x".repeat(254)));
});
