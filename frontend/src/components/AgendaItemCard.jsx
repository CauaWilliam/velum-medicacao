import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Pill, CalendarClock, Clock, RotateCcw } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { fmtDate, fmtTime, formatDelay, formatUntil, isToday } from "@/lib/time";
import { useNow } from "@/hooks/useNow";

const DelayCounter = ({ due, tid }) => {
  const now = useNow(1000);
  if (now <= due) return <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft"><Clock className="w-4 h-4" />{formatUntil(due - now)}</span>;
  return (
    <span data-testid={`delay-counter-${tid}`} className="bg-alert-light text-alert border border-[#FCA5A5] px-3 py-1 rounded-full text-sm font-bold inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-alert animate-pulse" />
      {formatDelay(now - due)}
    </span>
  );
};

const StatusBadge = ({ item, tid, onChange }) => {
  const done = item.status === "done";
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span data-testid={`status-badge-${tid}`} className={`px-3 py-1.5 rounded-full text-sm font-bold inline-flex items-center gap-1.5 border ${done ? "bg-leaf-light text-leaf border-[#A7D7B0]" : "bg-clay-light text-clay border-[#F0C4B6]"}`}>
        {done ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
        {done ? "Concluído" : "Não concluído"} · {fmtTime(item.marked_at)}
      </span>
      <button onClick={onChange} data-testid={`change-status-${tid}`} className="text-sm text-ink-soft inline-flex items-center gap-1 hover:text-ink transition-colors">
        <RotateCcw className="w-4 h-4" /> Alterar
      </button>
    </div>
  );
};

export const AgendaItemCard = ({ item, showPatient = true }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const due = new Date(item.scheduled_at).getTime();
  const tid = item.occurrence_key.replace(/:/g, "-");
  const isMed = item.kind === "medication";
  const pending = !item.status || editing;
  const late = !item.status && Date.now() > due;

  const mark = useMutation({
    mutationFn: (status) => api.post("/actions", { kind: item.kind, ref_id: item.ref_id, occurrence_key: item.occurrence_key, status }),
    onSuccess: (_, status) => {
      toast.success(status === "done" ? "Marcado como concluído" : "Marcado como não concluído");
      setEditing(false);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  return (
    <article data-testid={`agenda-item-${tid}`} className={`fade-up p-5 rounded-3xl bg-white border shadow-sm transition-shadow duration-200 hover:shadow-md ${late ? "border-[#F3B8AC]" : "border-sand-line"}`}>
      <div className="flex gap-4">
        <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${isMed ? "bg-sage-light text-sage" : "bg-clay-light text-clay"}`}>
          {isMed ? <Pill className="w-6 h-6" /> : <CalendarClock className="w-6 h-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-heading text-2xl font-semibold" data-testid={`item-time-${tid}`}>{fmtTime(item.scheduled_at)}</span>
            {!isToday(item.scheduled_at) && <span className="text-sm text-ink-soft">{fmtDate(item.scheduled_at)}</span>}
          </div>
          <h3 className="text-lg font-bold leading-snug break-words" data-testid={`item-title-${tid}`}>{item.title}</h3>
          {item.detail && <p className="text-base text-ink-soft break-words">{item.detail}</p>}
          {showPatient && (
            <Link to={`/pacientes/${item.patient_id}`} className="inline-block mt-1 text-sm font-semibold text-sage-dark underline-offset-4 hover:underline">{item.patient_name}</Link>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {pending ? (
          <>
            {!item.status && <DelayCounter due={due} tid={tid} />}
            <div className="grid grid-cols-2 gap-3">
              <button disabled={mark.isPending} onClick={() => mark.mutate("done")} data-testid={`complete-button-${tid}`} className="bg-leaf hover:bg-[#33583B] text-white h-14 rounded-2xl text-base font-bold transition-[background-color,transform] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
                <Check className="w-5 h-5" /> Concluído
              </button>
              <button disabled={mark.isPending} onClick={() => mark.mutate("missed")} data-testid={`incomplete-button-${tid}`} className="bg-clay-light hover:bg-[#F5E2DA] text-clay border border-[#F0C4B6] h-14 rounded-2xl text-base font-bold transition-[background-color,transform] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
                <X className="w-5 h-5" /> Não Concluído
              </button>
            </div>
          </>
        ) : (
          <StatusBadge item={item} tid={tid} onChange={() => setEditing(true)} />
        )}
      </div>
    </article>
  );
};
