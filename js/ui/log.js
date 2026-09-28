export const $ = (id) => document.getElementById(id);

export function log(message) {
  const target = $("log");
  if (!target) return;
  target.textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`;
  target.scrollTop = target.scrollHeight;
}
