import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Minus, Pill, CalendarClock, History } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime, fmtTime } from "@/lib/time";

const STATUS = {
  done: { label: "Concluído", icon: Check, dot: "bg-leaf", text: "text-leaf" },
  missed: { label: "Não concluído", icon: X, dot: "bg-clay", text: "text-clay" },
  none: { label: "Sem registro", icon: Minus, dot: "bg-ink-soft", text: "text-ink-soft" },
};

const delayText = (m) => (m == null ? "" : m <= 0 ? " (no horário ou antes)" : ` (${m} min após o horário)`);

const Entry = ({ item }) => {
  const s = STATUS[item.status || "none"];
  const Icon = item.kind === "medication" ? Pill : CalendarClock;
  const tid = item.occurrence_key.replace(/:/g, "-");
  return (
    <li className="relative pl-10 pb-4" data-testid={`history-entry-${tid}`}>
      <span className={`absolute left-0 top-0 w-7 h-7 rounded-full flex items-center justify-center text-white ${s.dot}`}><s.icon className="w-4 h-4" /></span>
      <div className="p-4 rounded-2xl bg-white border border-sand-line">
        <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-ink-soft shrink-0" /><span className="font-bold text-lg break-words">{item.title}</span></div>
        {item.detail && <p className="text-ink-soft break-words">{item.detail}</p>}
        <p className={`mt-1 font-bold ${s.text}`} data-testid={`history-status-${tid}`}>{s.label}</p>
        <dl className="mt-1 text-sm text-ink-soft space-y-0.5">
          <div data-testid={`history-scheduled-${tid}`}>Programado: {fmtTime(item.scheduled_at)}</div>
          {item.marked_at && <div data-testid={`history-marked-${tid}`}>Marcado: {fmtDateTime(item.marked_at)}{delayText(item.marked_delay_minutes)} por {item.caregiver_name}</div>}
        </dl>
        {item.changes.length > 1 && (
          <details className="mt-2 text-sm" data-testid={`history-changes-${tid}`}>
            <summary className="cursor-pointer font-semibold text-sage-dark">{item.changes.length} registros (alterações)</summary>
            <ul className="mt-1 space-y-0.5 text-ink-soft">
              {item.changes.map((c) => <li key={c.id}>{fmtDateTime(c.marked_at)} · {STATUS[c.status].label} · {c.caregiver_name}</li>)}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
};

const dayLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const Day = ({ day }) => {
  const count = (st) => day.items.filter((i) => (i.status || "none") === st).length;
  return (
    <section className="space-y-3" data-testid={`history-day-${day.date}`}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="font-heading text-lg font-semibold first-letter:uppercase">{dayLabel(day.date)}</h3>
        <span className="text-sm text-ink-soft">{count("done")} concluídos · {count("missed")} não · {count("none")} sem registro</span>
      </div>
      <ul className="relative before:absolute before:left-[13px] before:top-2 before:bottom-6 before:w-0.5 before:bg-sand-line">
        {day.items.map((i) => <Entry key={i.occurrence_key} item={i} />)}
      </ul>
    </section>
  );
};

export const HistoryTab = ({ patientId }) => {
  const [days, setDays] = useState(30);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["history", patientId, days],
    queryFn: () => api.get(`/patients/${patientId}/history`, { params: { days } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });
  if (isLoading) return <div className="h-24 rounded-3xl bg-sand-deep animate-pulse" />;
  const list = data?.days || [];
  return (
    <div className="space-y-6" data-testid="history-list">
      {!list.length && <p className="text-ink-soft" data-testid="history-empty">Nenhuma dose ou compromisso passou do horário ainda. O histórico dia a dia aparece aqui.</p>}
      {list.map((d) => <Day key={d.date} day={d} />)}
      <button onClick={() => setDays((n) => n + 30)} disabled={isFetching || days >= 365} data-testid="history-load-more" className="w-full h-12 rounded-2xl border-2 border-sand-line text-sage-dark font-bold flex items-center justify-center gap-2 hover:bg-sage-light transition-colors disabled:opacity-60">
        <History className="w-5 h-5" /> {isFetching ? "Carregando..." : `Ver mais 30 dias (mostrando ${days})`}
      </button>
    </div>
  );
};
