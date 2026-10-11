import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { MomentumCrypto, momentumKeyFromHex, momentumKeyFromPassword } from "../js/chat/momentum-crypto.js";

const previous = globalThis.crypto;
globalThis.crypto ??= webcrypto;
test("password SHA-256 matches known vector", async () => {
    const key = await momentumKeyFromPassword("abc");
    assert.equal(Buffer.from(key).toString("hex"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
test("hex key parses 32 bytes and rejects malformed input", () => {
    assert.equal(momentumKeyFromHex("ab".repeat(32)).length, 32);
    assert.throws(() => momentumKeyFromHex("aa"), /64 hexadecimal/);
});
test("AES-GCM packet layout authenticates header and round-trips", async () => {
    const tx = new MomentumCrypto(), rx = new MomentumCrypto();
    const key = new Uint8Array(32);
    await tx.setKey(key);
    await rx.setKey(key);
    const packet = await tx.encrypt("RFCat: Hi");
    assert.equal(packet.length, 49);
    assert.equal(new DataView(packet.buffer).getUint32(8, false), 1);
    assert.equal(await rx.decrypt(packet), "RFCat: Hi");
    await assert.rejects(rx.decrypt(packet), /Replay/);
    const tampered = packet.slice();
    tampered[0] ^= 1;
    await assert.rejects(rx.decrypt(tampered));
    const tamperedCounter = packet.slice();
    tamperedCounter[11] ^= 1;
    await assert.rejects(rx.decrypt(tamperedCounter));
});
test("encrypted TX enforces 20-byte plaintext maximum", async () => {
    const ctx = new MomentumCrypto();
    await ctx.setKey(new Uint8Array(32));
    assert.equal((await ctx.encrypt("a".repeat(20))).length, 60);
    await assert.rejects(ctx.encrypt("a".repeat(21)), /1–20/);
    ctx.clear();
    await assert.rejects(ctx.encrypt("hi"), /not configured/);
});
