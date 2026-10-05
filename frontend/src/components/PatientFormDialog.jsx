import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { maskPhone } from "@/lib/phone";
import { SheetDialog } from "@/components/SheetDialog";
import { FormField, PrimaryButton, inputCls } from "@/components/FormField";

const EMPTY = { name: "", age: "", conditions: "", allergies: "", emergency_contact_name: "", emergency_contact_phone: "", notes: "" };
const FIELDS = [
  ["conditions", "Condições de saúde", "Ex.: hipertensão, diabetes tipo 2"],
  ["allergies", "Alergias", "Ex.: dipirona, frutos do mar"],
  ["emergency_contact_name", "Contato de emergência", "Nome do familiar ou responsável"],
  ["emergency_contact_phone", "Telefone de emergência", "(31) 97306-1826"],
  ["notes", "Observações", "Rotina, preferências, cuidados especiais"],
];

export const PatientFormDialog = ({ open, onOpenChange, patient, onSaved }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  useEffect(() => { if (open) setForm(patient ? { ...EMPTY, ...patient } : EMPTY); }, [open, patient]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === "emergency_contact_phone" ? maskPhone(e.target.value) : e.target.value }));

  const save = useMutation({
    mutationFn: (body) => (patient ? api.put(`/patients/${patient.id}`, body) : api.post("/patients", body)),
    onSuccess: ({ data }) => {
      toast.success(patient ? "Paciente atualizado" : "Paciente cadastrado");
      qc.invalidateQueries();
      onOpenChange(false);
      onSaved?.(data);
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  const submit = (e) => {
    e.preventDefault();
    const { id, owner_id, created_at, medication_count, upcoming_appointments, ...rest } = form;
    save.mutate({ ...rest, age: Number(form.age) });
  };

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={patient ? "Editar paciente" : "Novo paciente"} testId="patient-form-dialog">
      <form onSubmit={submit} className="space-y-5 mt-2">
        <FormField label="Nome completo" htmlFor="p-name">
          <input id="p-name" required value={form.name} onChange={set("name")} className={inputCls} data-testid="patient-name-input" placeholder="Ex.: Maria Aparecida" />
        </FormField>
        <FormField label="Idade" htmlFor="p-age">
          <input id="p-age" required type="number" min="0" max="130" inputMode="numeric" value={form.age} onChange={set("age")} className={inputCls} data-testid="patient-age-input" placeholder="Ex.: 82" />
        </FormField>
        {FIELDS.map(([key, label, ph]) => (
          <FormField key={key} label={label} htmlFor={`p-${key}`}>
            {key === "notes" || key === "conditions" ? (
              <textarea id={`p-${key}`} rows={3} value={form[key]} onChange={set(key)} placeholder={ph} data-testid={`patient-${key}-input`} className={`${inputCls} h-auto py-3 resize-none`} />
            ) : (
              <input id={`p-${key}`} value={form[key]} onChange={set(key)} placeholder={ph} data-testid={`patient-${key}-input`} className={inputCls} {...(key.endsWith("phone") ? { type: "tel", inputMode: "numeric", maxLength: 15, autoComplete: "tel-national" } : { type: "text" })} />
            )}
          </FormField>
        ))}
        <PrimaryButton type="submit" disabled={save.isPending} data-testid="patient-save-button">
          {save.isPending ? "Salvando..." : "Salvar paciente"}
        </PrimaryButton>
      </form>
    </SheetDialog>
  );
};
