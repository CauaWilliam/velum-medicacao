import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { SheetDialog } from "@/components/SheetDialog";
import { FormField, PrimaryButton, inputCls } from "@/components/FormField";

export const MedicationFormDialog = ({ open, onOpenChange, patientId, medication }) => {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState(["08:00"]);

  useEffect(() => {
    if (!open) return;
    setName(medication?.name || "");
    setDosage(medication?.dosage || "");
    setTimes(medication?.times?.length ? medication.times : ["08:00"]);
  }, [open, medication]);

  const save = useMutation({
    mutationFn: (body) => (medication ? api.put(`/medications/${medication.id}`, body) : api.post(`/patients/${patientId}/medications`, body)),
    onSuccess: () => {
      toast.success(medication ? "Medicação atualizada" : "Medicação cadastrada");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  const setTime = (i, v) => setTimes((t) => t.map((x, j) => (j === i ? v : x)));
  const submit = (e) => {
    e.preventDefault();
    save.mutate({ name, dosage, times: times.filter(Boolean) });
  };

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={medication ? "Editar medicação" : "Nova medicação"} description="As doses se repetem todos os dias nos horários abaixo." testId="medication-form-dialog">
      <form onSubmit={submit} className="space-y-5 mt-2">
        <FormField label="Nome do remédio" htmlFor="m-name">
          <input id="m-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ex.: Losartana" data-testid="medication-name-input" />
        </FormField>
        <FormField label="Dosagem" htmlFor="m-dosage">
          <input id="m-dosage" required value={dosage} onChange={(e) => setDosage(e.target.value)} className={inputCls} placeholder="Ex.: 50 mg — 1 comprimido" data-testid="medication-dosage-input" />
        </FormField>
        <FormField label="Horários das doses">
          <div className="space-y-3">
            {times.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input type="time" required value={t} onChange={(e) => setTime(i, e.target.value)} className={inputCls} data-testid={`medication-time-input-${i}`} />
                {times.length > 1 && (
                  <button type="button" onClick={() => setTimes((x) => x.filter((_, j) => j !== i))} className="shrink-0 w-14 h-14 rounded-2xl bg-clay-light text-clay flex items-center justify-center active:scale-95 transition-transform" data-testid={`medication-time-remove-${i}`} aria-label="Remover horário">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setTimes((x) => [...x, ""])} className="w-full h-12 rounded-2xl border-2 border-dashed border-sand-line text-sage-dark font-bold flex items-center justify-center gap-2 hover:bg-sage-light transition-colors" data-testid="medication-add-time-button">
              <Plus className="w-5 h-5" /> Adicionar horário
            </button>
          </div>
        </FormField>
        <PrimaryButton type="submit" disabled={save.isPending} data-testid="medication-save-button">
          {save.isPending ? "Salvando..." : "Salvar medicação"}
        </PrimaryButton>
      </form>
    </SheetDialog>
  );
};
