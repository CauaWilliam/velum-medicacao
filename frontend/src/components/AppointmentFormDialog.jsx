import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { toInputParts } from "@/lib/time";
import { SheetDialog } from "@/components/SheetDialog";
import { FormField, PrimaryButton, inputCls } from "@/components/FormField";

export const AppointmentFormDialog = ({ open, onOpenChange, patientId, appointment }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ description: "", location: "", date: "", time: "" });

  useEffect(() => {
    if (!open) return;
    const parts = appointment ? toInputParts(appointment.scheduled_at) : { date: "", time: "" };
    setForm({ description: appointment?.title || "", location: appointment?.detail || "", ...parts });
  }, [open, appointment]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: (body) => (appointment ? api.put(`/appointments/${appointment.ref_id}`, body) : api.post(`/patients/${patientId}/appointments`, body)),
    onSuccess: () => {
      toast.success(appointment ? "Compromisso atualizado" : "Compromisso agendado");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  const submit = (e) => {
    e.preventDefault();
    const scheduled_at = new Date(`${form.date}T${form.time}`).toISOString();
    save.mutate({ description: form.description, location: form.location, scheduled_at });
  };

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={appointment ? "Editar compromisso" : "Novo compromisso"} description="Você será lembrado 1 dia e 2 horas antes." testId="appointment-form-dialog">
      <form onSubmit={submit} className="space-y-5 mt-2">
        <FormField label="Descrição" htmlFor="a-desc">
          <textarea id="a-desc" required rows={2} value={form.description} onChange={set("description")} className={`${inputCls} h-auto py-3 resize-none`} placeholder="Ex.: Consulta com cardiologista" data-testid="appointment-description-input" />
        </FormField>
        <FormField label="Local (opcional)" htmlFor="a-loc">
          <input id="a-loc" value={form.location} onChange={set("location")} className={inputCls} placeholder="Ex.: Clínica São Lucas" data-testid="appointment-location-input" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Data" htmlFor="a-date">
            <input id="a-date" type="date" required value={form.date} onChange={set("date")} className={`${inputCls} px-3`} data-testid="appointment-date-input" />
          </FormField>
          <FormField label="Hora" htmlFor="a-time">
            <input id="a-time" type="time" required value={form.time} onChange={set("time")} className={`${inputCls} px-3`} data-testid="appointment-time-input" />
          </FormField>
        </div>
        <PrimaryButton type="submit" disabled={save.isPending} data-testid="appointment-save-button">
          {save.isPending ? "Salvando..." : "Salvar compromisso"}
        </PrimaryButton>
      </form>
    </SheetDialog>
  );
};
