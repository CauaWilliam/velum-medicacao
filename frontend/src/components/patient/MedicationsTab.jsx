import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Pill, Repeat, CalendarDays } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { fmtDose, nextDoses } from "@/lib/doses";
import { AgendaItemCard } from "@/components/AgendaItemCard";
import { MedicationFormDialog } from "@/components/MedicationFormDialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";

const MedRow = ({ med, onEdit }) => {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api.delete(`/medications/${med.id}`),
    onSuccess: () => { toast.success("Medicação removida"); qc.invalidateQueries(); },
    onError: (e) => toast.error(formatApiError(e)),
  });
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-sand-line" data-testid={`medication-row-${med.id}`}>
      <div className="w-11 h-11 rounded-2xl bg-sage-light text-sage flex items-center justify-center shrink-0"><Pill className="w-5 h-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-bold break-words">{med.name}</div>
        <div className="text-ink-soft break-words">{med.dosage}</div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-sage-light text-sage-dark text-sm font-bold inline-flex items-center gap-1" data-testid={`medication-recurrence-${med.id}`}>
            {med.recurring !== false ? <><Repeat className="w-3.5 h-3.5" /> A cada {med.interval_hours}h</> : <><CalendarDays className="w-3.5 h-3.5" /> Dose única · {med.date.split("-").reverse().join("/")}</>}
          </span>
          {med.recurring !== false && nextDoses(med.start_at, med.interval_hours, 3).map((d) => <span key={d.getTime()} className="px-2.5 py-0.5 rounded-full bg-sand-deep text-sm font-bold">{fmtDose(d)}</span>)}
          {med.times.map((t) => <span key={t} className="px-2.5 py-0.5 rounded-full bg-sand-deep text-sm font-bold">{t}</span>)}
        </div>
      </div>
      <button onClick={() => onEdit(med)} className="w-11 h-11 rounded-full hover:bg-sand-deep flex items-center justify-center transition-colors" data-testid={`medication-edit-${med.id}`} aria-label="Editar"><Pencil className="w-5 h-5" /></button>
      <ConfirmDelete
        testId={`medication-delete-${med.id}`}
        title="Excluir medicação?"
        description={`${med.name} deixará de aparecer na agenda.`}
        onConfirm={() => del.mutate()}
        trigger={<button className="w-11 h-11 rounded-full hover:bg-clay-light text-clay flex items-center justify-center transition-colors" data-testid={`medication-delete-${med.id}`} aria-label="Excluir"><Trash2 className="w-5 h-5" /></button>}
      />
    </div>
  );
};

export const MedicationsTab = ({ patientId }) => {
  const [dialog, setDialog] = useState({ open: false, med: null });
  const { data: meds = [] } = useQuery({ queryKey: ["medications", patientId], queryFn: () => api.get(`/patients/${patientId}/medications`).then((r) => r.data) });
  const { data: agenda } = useQuery({ queryKey: ["patient-agenda", patientId], queryFn: () => api.get(`/patients/${patientId}/agenda`).then((r) => r.data), refetchInterval: 60000 });
  const doses = (agenda?.items || []).filter((i) => i.kind === "medication");

  return (
    <div className="space-y-6">
      <button onClick={() => setDialog({ open: true, med: null })} data-testid="add-medication-button" className="w-full h-14 rounded-2xl bg-sage hover:bg-sage-dark text-white text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-[background-color,transform]">
        <Plus className="w-5 h-5" /> Nova medicação
      </button>
      {doses.length > 0 && (
        <section className="space-y-3" data-testid="today-doses">
          <h3 className="font-heading text-xl font-semibold">Doses de hoje</h3>
          {doses.map((i) => <AgendaItemCard key={i.occurrence_key} item={i} showPatient={false} />)}
        </section>
      )}
      <section className="space-y-3">
        <h3 className="font-heading text-xl font-semibold">Medicações cadastradas</h3>
        {meds.length === 0 && <p className="text-ink-soft" data-testid="medications-empty">Nenhuma medicação cadastrada.</p>}
        {meds.map((m) => <MedRow key={m.id} med={m} onEdit={(med) => setDialog({ open: true, med })} />)}
      </section>
      <MedicationFormDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} patientId={patientId} medication={dialog.med} />
    </div>
  );
};
