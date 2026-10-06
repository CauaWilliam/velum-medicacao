import { toInputParts } from "@/lib/time";

export const INTERVALS = [1, 2, 4, 6, 8, 12, 24];

export function nextDoses(startISO, hours, count = 4, from = Date.now()) {
  const start = new Date(startISO).getTime();
  if (!hours || Number.isNaN(start)) return [];
  const step = hours * 3600000;
  const k = Math.max(0, Math.ceil((from - start) / step));
  return Array.from({ length: count }, (_, i) => new Date(start + (k + i) * step));
}

export function fmtDose(d) {
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === new Date().toDateString()) return time;
  if (d.toDateString() === tomorrow.toDateString()) return `${time} (amanhã)`;
  return `${time} (${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })})`;
}

export function nextHourLocal() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  const p = toInputParts(d);
  return `${p.date}T${p.time}`;
}

export function isoToLocalInput(iso) {
  const p = toInputParts(iso);
  return `${p.date}T${p.time}`;
}
