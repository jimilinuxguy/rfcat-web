function pyBytes(bytes) {
    return "b\"" + Array.from(bytes, (b) => `\\x${b.toString(16).padStart(2, "0")}`).join("") + "\"";
}

function modulationName(value) {
    return ({
        0x00: "MOD_2FSK",
        0x10: "MOD_GFSK",
        0x30: "MOD_ASK_OOK",
        0x40: "MOD_4FSK",
        0x70: "MOD_MSK",
    })[value] ?? `0x${Number(value).toString(16)}`;
}

export function createIPythonRecorder() {
    const lines = [];
    const add = (line) => lines.push(line);

    const device = {
        async mode(mode) {
            if (mode === 0x04) add("d.setModeIDLE()");
            else add(`# RFCat Web radio mode 0x${Number(mode).toString(16).padStart(2, "0")}`);
        },
        async setFrequency(hz) { add(`d.setFreq(${Math.round(Number(hz))})`); },
        async setDataRate(rate) { add(`d.setMdmDRate(${Number(rate)})`); },
        async setBandwidth(hz) { add(`d.setMdmChanBW(${Number(hz)})`); },
        async setModulation(mod) { add(`d.setMdmModulation(${modulationName(Number(mod))})`); },
        async setDeviation(hz) { add(`d.setMdmDeviatn(${Number(hz)})`); },
        async setManchester(enabled) { add(`d.setEnableMdmManchester(${enabled ? "True" : "False"})`); },
        async setSync(word, mode) {
            add(`d.setMdmSyncWord(0x${Number(word).toString(16).padStart(4, "0").toUpperCase()})`);
            add(`d.setMdmSyncMode(${Number(mode)})`);
        },
        async setMaxPower() { add("d.setMaxPower()"); },
        async setAmpMode(enabled) { add(`d.setAmpMode(${enabled ? "True" : "False"})`); },
        async configureAskOokPa() {
            add("# RFCat Web known-good ASK/OOK PA setup");
            add(`d.poke(0xDF2D, ${pyBytes(new Uint8Array([0xc0, 0, 0, 0, 0, 0, 0, 0]))})`);
            add("_frend0 = d.peek(0xDF1B, 1)[0]");
            add("d.poke(0xDF1B, bytes([(_frend0 & 0xF8) | 0x01]))");
        },
        async transmit(data, repeat = 0, offset = 0) {
            add(`data = ${pyBytes(data)}`);
            add(`d.RFxmit(data, repeat=${Number(repeat)}, offset=${Number(offset)})`);
        },
    };

    return { device, lines };
}

export async function exportProtocolToIPython(protocol, values, encoded) {
    const { device, lines } = createIPythonRecorder();

    if (protocol.configure) await protocol.configure(device, values);
    await protocol.transmit(device, encoded, values);

    const imports = new Set();
    for (const line of lines) {
        const match = line.match(/d\.setMdmModulation\((MOD_[A-Z0-9_]+)\)/);
        if (match) imports.add(match[1]);
    }

    const importLine = imports.size
        ? `from rflib import RfCat, ${Array.from(imports).join(", ")}`
        : "from rflib import RfCat";

    return [
        `# RFCat Web IPython export: ${protocol.name}`,
        "# Generated from the currently selected TX protocol and field values.",
        importLine,
        "",
        "d = RfCat()",
        "",
        ...lines,
        "",
    ].join("\n");
}
