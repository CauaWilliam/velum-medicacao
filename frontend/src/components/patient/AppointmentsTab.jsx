import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { AgendaItemCard } from "@/components/AgendaItemCard";
import { AppointmentFormDialog } from "@/components/AppointmentFormDialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";

const ApptActions = ({ item, onEdit }) => {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api.delete(`/appointments/${item.ref_id}`),
    onSuccess: () => { toast.success("Compromisso removido"); qc.invalidateQueries(); },
    onError: (e) => toast.error(formatApiError(e)),
  });
  return (
    <div className="flex justify-end gap-1 -mt-2">
      <button onClick={() => onEdit(item)} className="h-10 px-3 rounded-full text-sm font-semibold text-ink-soft hover:bg-sand-deep inline-flex items-center gap-1.5 transition-colors" data-testid={`appointment-edit-${item.ref_id}`}>
        <Pencil className="w-4 h-4" /> Editar
      </button>
      <ConfirmDelete
        testId={`appointment-delete-${item.ref_id}`}
        title="Excluir compromisso?"
        description={item.title}
        onConfirm={() => del.mutate()}
        trigger={<button className="h-10 px-3 rounded-full text-sm font-semibold text-clay hover:bg-clay-light inline-flex items-center gap-1.5 transition-colors" data-testid={`appointment-delete-${item.ref_id}`}><Trash2 className="w-4 h-4" /> Excluir</button>}
      />
    </div>
  );
};

export const AppointmentsTab = ({ patientId }) => {
  const [dialog, setDialog] = useState({ open: false, appt: null });
  const { data: items = [] } = useQuery({ queryKey: ["appointments", patientId], queryFn: () => api.get(`/patients/${patientId}/appointments`).then((r) => r.data) });
  const now = Date.now();
  const upcoming = items.filter((i) => new Date(i.scheduled_at).getTime() >= now || !i.status);
  const past = items.filter((i) => new Date(i.scheduled_at).getTime() < now && i.status).reverse();

  const renderList = (list) => list.map((i) => (
    <div key={i.occurrence_key} className="space-y-1">
      <AgendaItemCard item={i} showPatient={false} />
      <ApptActions item={i} onEdit={(appt) => setDialog({ open: true, appt })} />
    </div>
  ));

  return (
    <div className="space-y-6">
      <button onClick={() => setDialog({ open: true, appt: null })} data-testid="add-appointment-button" className="w-full h-14 rounded-2xl bg-clay hover:bg-[#b25e44] text-white text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-[background-color,transform]">
        <Plus className="w-5 h-5" /> Novo compromisso
      </button>
      {items.length === 0 && <p className="text-ink-soft" data-testid="appointments-empty">Nenhum compromisso cadastrado.</p>}
      {upcoming.length > 0 && <section className="space-y-3" data-testid="appointments-upcoming"><h3 className="font-heading text-xl font-semibold">Pendentes e próximos</h3>{renderList(upcoming)}</section>}
      {past.length > 0 && <section className="space-y-3" data-testid="appointments-past"><h3 className="font-heading text-xl font-semibold text-ink-soft">Anteriores</h3>{renderList(past)}</section>}
      <AppointmentFormDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} patientId={patientId} appointment={dialog.appt} />
    </div>
  );
};
