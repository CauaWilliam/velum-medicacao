import { useQuery } from "@tanstack/react-query";
import { Check, X, Pill, CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/time";

const Entry = ({ log }) => {
  const done = log.status === "done";
  const Icon = log.kind === "medication" ? Pill : CalendarClock;
  return (
    <li className="relative pl-10 pb-5" data-testid={`history-entry-${log.id}`}>
      <span className={`absolute left-0 top-0 w-7 h-7 rounded-full flex items-center justify-center ${done ? "bg-leaf text-white" : "bg-clay text-white"}`}>
        {done ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      </span>
      <div className="p-4 rounded-2xl bg-white border border-sand-line">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className="w-4 h-4 text-ink-soft" />
          <span className="font-bold text-lg break-words">{log.item_title}</span>
        </div>
        {log.item_detail && <p className="text-ink-soft break-words">{log.item_detail}</p>}
        <p className={`mt-1 font-bold ${done ? "text-leaf" : "text-clay"}`}>{done ? "Concluído" : "Não concluído"}</p>
        <dl className="mt-1 text-sm text-ink-soft space-y-0.5">
          <div>Previsto: {fmtDateTime(log.scheduled_at)}</div>
          <div>Registrado: {fmtDateTime(log.marked_at)} por {log.caregiver_name}</div>
        </dl>
      </div>
    </li>
  );
};

export const HistoryTab = ({ patientId }) => {
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["history", patientId], queryFn: () => api.get(`/patients/${patientId}/history`).then((r) => r.data) });
  if (isLoading) return <div className="h-24 rounded-3xl bg-sand-deep animate-pulse" />;
  if (!logs.length) return <p className="text-ink-soft" data-testid="history-empty">Nenhuma ação registrada ainda. Ao marcar Concluído ou Não Concluído, o registro aparece aqui.</p>;
  return (
    <ul className="relative before:absolute before:left-[13px] before:top-2 before:bottom-6 before:w-0.5 before:bg-sand-line" data-testid="history-list">
      {logs.map((l) => <Entry key={l.id} log={l} />)}
    </ul>
  );
};
