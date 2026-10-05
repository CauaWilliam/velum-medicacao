export function formatDelay(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Menos de 1 minuto de atraso";
  if (min < 60) return `${min} ${min === 1 ? "minuto" : "minutos"} de atraso`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `${h}h${m ? ` ${m}min` : ""} de atraso`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "dia" : "dias"} de atraso`;
}

export function formatUntil(ms) {
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `em ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `em ${h}h${min % 60 ? ` ${min % 60}min` : ""}`;
  const d = Math.floor(h / 24);
  return `em ${d} ${d === 1 ? "dia" : "dias"}`;
}

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

export const todayLong = () =>
  new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

export const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";

export function toInputParts(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
