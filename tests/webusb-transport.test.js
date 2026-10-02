import test from "node:test";
import assert from "node:assert/strict";

globalThis.document = {\n    getElementById() { return null; },\n};\n\nconst { RFCatUSB } = await import("../js/rfcat/device.js");

function responseFrame(app, cmd, payload = []) {
    return new Uint8Array([0x40, app, cmd, payload.length & 0xff, payload.length >> 8, ...payload]);
}

test("USB parser accepts a response split across multiple transfers", async () => {
    const d = new RFCatUSB();
    const pending = d.wait(0xff, 0x82, 100);
    const frame = responseFrame(0xff, 0x82, [1, 2, 3]);

    d.feed(frame.slice(0, 3));
    d.feed(frame.slice(3, 6));
    d.feed(frame.slice(6));

    assert.deepEqual([...(await pending)], [1, 2, 3]);
    assert.equal(d.waiters.length, 0);
});

test("USB parser discards garbage before the RFCat frame marker", async () => {
    const d = new RFCatUSB();
    const pending = d.wait(0xff, 0x82, 100);
    d.feed(new Uint8Array([0x00, 0x99, 0x13, ...responseFrame(0xff, 0x82, [0xaa])]));
    assert.deepEqual([...(await pending)], [0xaa]);
});

test("USB parser handles multiple responses in one transfer", async () => {
    const d = new RFCatUSB();
    const first = d.wait(0xff, 0x80, 100);
    const second = d.wait(0xff, 0x82, 100);
    const a = responseFrame(0xff, 0x80, [0x11]);
    const b = responseFrame(0xff, 0x82, [0x22]);
    d.feed(new Uint8Array([...a, ...b]));
    assert.deepEqual([...(await first)], [0x11]);
    assert.deepEqual([...(await second)], [0x22]);
});

test("USB response matching uses both application and command", async () => {
    const d = new RFCatUSB();
    const system = d.wait(0xff, 0x01, 100);
    const nic = d.wait(0x42, 0x01, 100);
    d.feed(responseFrame(0x42, 0x01, [0x42]));
    d.feed(responseFrame(0xff, 0x01, [0xff]));
    assert.deepEqual([...(await nic)], [0x42]);
    assert.deepEqual([...(await system)], [0xff]);
});

test("send chunks RFCat commands at 64-byte USB boundaries", async () => {
    const d = new RFCatUSB();
    const chunks = [];
    d.device = {
        opened: true,
        async transferOut(endpoint, chunk) {
            assert.equal(endpoint, 5);
            chunks.push([...chunk]);
            if (chunks.length === 2) {
                queueMicrotask(() => d.feed(responseFrame(0x42, 0x02, [0x99])));
            }
            return { status: "ok" };
        },
    };

    const result = await d.send(0x42, 0x02, new Uint8Array(100).fill(0x5a), 100);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].length, 64);
    assert.equal(chunks[1].length, 40);
    assert.deepEqual(chunks[0].slice(0, 4), [0x42, 0x02, 100, 0]);
    assert.deepEqual([...result], [0x99]);
});

test("failed transferOut removes and rejects its pending waiter", async () => {
    const d = new RFCatUSB();
    d.device = {
        opened: true,
        async transferOut() {
            return { status: "stall" };
        },
    };

    await assert.rejects(() => d.send(0xff, 0x82, new Uint8Array(), 100), /USB write stall/);
    assert.equal(d.waiters.length, 0);
});

test("disconnect rejects all pending commands and clears device state", async () => {
    const d = new RFCatUSB();
    let released = false;
    let closed = false;
    d.device = {
        opened: true,
        async releaseInterface(index) {
            assert.equal(index, 0);
            released = true;
        },
        async close() {
            closed = true;
        },
    };

    const a = d.wait(0xff, 0x80, 1_000);
    const b = d.wait(0xff, 0x82, 1_000);
    const results = Promise.allSettled([a, b]);

    await d.disconnect();

    const settled = await results;
    assert.equal(d.device, null);
    assert.equal(d.running, false);
    assert.equal(d.waiters.length, 0);
    assert.equal(released, true);
    assert.equal(closed, true);
    assert.ok(settled.every((r) => r.status === "rejected" && /disconnected/.test(r.reason.message)));
});

test("wait timeout removes stale waiter state", async () => {
    const d = new RFCatUSB();
    await assert.rejects(() => d.wait(0xff, 0x82, 5), /Timeout waiting for ff:82/);
    assert.equal(d.waiters.length, 0);
});

test("transmit rejects empty, oversized, and non-byte payloads before USB", () => {
    const d = new RFCatUSB();
    assert.throws(() => d.transmit([]), /Uint8Array/);
    assert.throws(() => d.transmit(new Uint8Array()), /cannot be empty/);
    assert.throws(() => d.transmit(new Uint8Array(256)), /255 bytes/);
});

test("transmit encodes length repeat and offset as RFCat little-endian u16 fields", async () => {
    const d = new RFCatUSB();
    let captured;
    d.send = async (app, cmd, payload, timeout) => {
        captured = { app, cmd, payload: [...payload], timeout };
        return new Uint8Array();
    };
    await d.transmit(new Uint8Array([0xaa, 0xbb]), 3, 4);
    assert.equal(captured.app, 0x42);
    assert.equal(captured.cmd, 0x02);
    assert.deepEqual(captured.payload, [
        0x02, 0x00,
        0x03, 0x00,
        0x04, 0x00,
        0xaa, 0xbb,
    ]);
    assert.equal(captured.timeout, 10_000);
});
