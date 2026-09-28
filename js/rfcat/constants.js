export const C = Object.freeze({
  APP_SYSTEM: 0xff,
  APP_NIC: 0x42,
  SYS_PEEK: 0x80,
  SYS_POKE: 0x81,
  SYS_PING: 0x82,
  SYS_RFMODE: 0x88,
  SYS_PARTNUM: 0x8e,
  NIC_RECV: 0x01,
  NIC_XMIT: 0x02,
  RF_RX: 0x02,
  RF_TX: 0x03,
  RF_IDLE: 0x04,
});

export const SUPPORTED_DEVICES = Object.freeze([
  { vendorId: 0x1d50, productId: 0x6047 },
  { vendorId: 0x1d50, productId: 0x6048 },
  { vendorId: 0x1d50, productId: 0x605b },
  { vendorId: 0x1d50, productId: 0xecc1 },
  { vendorId: 0x0451, productId: 0x4715 },
]);
