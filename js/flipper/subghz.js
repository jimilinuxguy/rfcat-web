const RAW_FILETYPE = "Flipper SubGhz RAW File";
export const DEFAULT_FLIPPER_RAW_PRESET = "FuriHalSubGhzPresetOok650Async";

function fieldsFromText(text) {
    const fields = new Map();
    for (const rawLine of String(text ?? "").replace(/\r/g, "").split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const split = line.indexOf(":");
        if (split < 1) continue;
        const key = line.slice(0, split).trim();
        const value = line.slice(split + 1).trim();
        if (!fields.has(key)) fields.set(key, []);
        fields.get(key).push(value);
    }
    return fields;
}

export function parseFlipperRawSub(text) {
    const fields = fieldsFromText(text);
    const filetype = fields.get("Filetype")?.[0];
    const version = Number(fields.get("Version")?.[0]);
    const frequency = Number(fields.get("Frequency")?.[0]);
    const preset = fields.get("Preset")?.[0];
    const protocol = fields.get("Protocol")?.[0];
    if (filetype !== RAW_FILETYPE) throw new Error("Not a Flipper SubGhz RAW file");
    if (version !== 1) throw new Error(`Unsupported Flipper SubGhz version: ${fields.get("Version")?.[0] ?? "missing"}`);
    if (!Number.isInteger(frequency) || frequency <= 0) throw new Error("RAW file has an invalid frequency");
    if (!preset) throw new Error("RAW file is missing Preset");
    if (preset === "FuriHalSubGhzPresetCustom") throw new Error("Custom Flipper radio presets are not supported yet");
    if (protocol !== "RAW") throw new Error("Only Flipper Protocol: RAW is supported");
    const timings = (fields.get("RAW_Data") ?? [])
        .flatMap((line) => line.split(/\s+/).filter(Boolean).map(Number));
    validateRawTimings(timings);
    return { filetype, version, frequency, preset, protocol, timings };
}

export function validateRawTimings(timings) {
    if (!Array.isArray(timings) || timings.length === 0) throw new Error("RAW file contains no timing data");
    for (let i = 0; i < timings.length; i++) {
        const value = timings[i];
        if (!Number.isInteger(value) || value === 0) throw new Error(`Invalid RAW timing at index ${i}`);
        if (i === 0 && value < 0) throw new Error("RAW timings must start positive");
        if (i > 0 && Math.sign(value) === Math.sign(timings[i - 1])) throw new Error(`RAW timings must alternate sign at index ${i}`);
    }
    return timings;
}

export function serializeFlipperRawSub({ frequency, preset = DEFAULT_FLIPPER_RAW_PRESET, timings }) {
    const hz = Math.round(Number(frequency));
    if (!Number.isInteger(hz) || hz <= 0) throw new Error("Frequency must be positive");
    validateRawTimings(timings);
    const lines = [
        `Filetype: ${RAW_FILETYPE}`,
        "Version: 1",
        `Frequency: ${hz}`,
        `Preset: ${preset}`,
        "Protocol: RAW",
    ];
    for (let i = 0; i < timings.length; i += 512) {
        lines.push(`RAW_Data: ${timings.slice(i, i + 512).join(" ")}`);
    }
    return lines.join("\n") + "\n";
}

export function pulseRunsToFlipperTimings(runs) {
    if (!Array.isArray(runs) || runs.length === 0) throw new Error("No pulse runs to export");
    const timings = runs.map((run, index) => {
        const level = Number(run.level);
        const duration = Math.round(Number(run.durationUs));
        if ((level !== 0 && level !== 1) || !Number.isFinite(duration) || duration <= 0) {
            throw new Error(`Invalid pulse run at index ${index}`);
        }
        return level === 1 ? duration : -duration;
    });
    if (timings[0] < 0) throw new Error("Flipper RAW export requires a leading HIGH pulse");
    return validateRawTimings(timings);
}
