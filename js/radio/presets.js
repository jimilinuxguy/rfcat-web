export const RADIO_PRESETS = {
    lrs: {
        name: "LRS Pager",
        frequency: 467_750_000,
        modulation: 0,       // 2-FSK
        dataRate: 625,
        deviation: 15_000,
        syncWord: 0x0000,
        syncMode: 0,
        manchester: true,
        lowball: false,
    },

    came12: {
        name: "CAME 12-bit",
        frequency: 433_920_000,
        modulation: 0x30,    // ASK/OOK
        dataRate: 3125,
        bandwidth: 53_571,
        syncWord: 0x0000,
        syncMode: 0,
        manchester: false,
        lowball: false,
    },
};