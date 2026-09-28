export const PRESETS = Object.freeze({
  came433: {
    name: "CAME 433.92 MHz test",
    frequencyMHz: 433.920,
    modulation: 0x30,
    dataRate: 3125,
    bandwidthKHz: 53.571,
    syncWord: "0000",
    syncMode: 0,
    lowball: false,
  },
  ook433Rx: {
    name: "433.92 MHz OOK RX",
    frequencyMHz: 433.920,
    modulation: 0x30,
    dataRate: 4800,
    bandwidthKHz: 53.571,
    syncWord: "0000",
    syncMode: 0,
    lowball: true,
  },
});
