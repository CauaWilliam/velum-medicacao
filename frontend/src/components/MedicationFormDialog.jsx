import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toInputParts } from "@/lib/time";
import { INTERVALS, fmtDose, isoToLocalInput, nextDoses, nextHourLocal } from "@/lib/doses";
import { Switch } from "@/components/ui/switch";
import { SheetDialog } from "@/components/SheetDialog";
import { FormField, PrimaryButton, inputCls } from "@/components/FormField";

export const MedicationFormDialog = ({ open, onOpenChange, patientId, medication }) => {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState(["08:00"]);
  const [recurring, setRecurring] = useState(true);
  const [date, setDate] = useState("");
  const [interval, setIntervalHours] = useState(8);
  const [start, setStart] = useState("");
  const preview = recurring && start ? nextDoses(new Date(start).toISOString(), interval) : [];

  useEffect(() => {
    if (!open) return;
    setName(medication?.name || "");
    setDosage(medication?.dosage || "");
    setTimes(medication?.times?.length ? medication.times : ["08:00"]);
    setRecurring(medication ? medication.recurring !== false : true);
    setDate(medication?.date || toInputParts(new Date()).date);
    setIntervalHours(medication?.interval_hours || 8);
    setStart(medication?.start_at ? isoToLocalInput(medication.start_at) : nextHourLocal());
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
    const schedule = recurring
      ? { recurring, interval_hours: interval, start_at: new Date(start).toISOString() }
      : { recurring, date, times: times.filter(Boolean) };
    save.mutate({ name, dosage, ...schedule });
  };

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={medication ? "Editar medicação" : "Nova medicação"} testId="medication-form-dialog">
      <form onSubmit={submit} className="space-y-5 mt-2">
        <FormField label="Nome do remédio" htmlFor="m-name">
          <input id="m-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ex.: Losartana" data-testid="medication-name-input" />
        </FormField>
        <FormField label="Dosagem" htmlFor="m-dosage">
          <input id="m-dosage" required value={dosage} onChange={(e) => setDosage(e.target.value)} className={inputCls} placeholder="Ex.: 50 mg — 1 comprimido" data-testid="medication-dosage-input" />
        </FormField>
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-sage-light border border-[#B3CBC0]" data-testid="medication-recurring-row">
          <div className="flex-1">
            <label htmlFor="m-recurring" className="text-base font-bold text-ink">Recorrente</label>
            <p className="text-sm text-ink-soft" data-testid="medication-recurring-hint">
              {recurring ? "Repete automaticamente no intervalo escolhido." : "Registrada apenas uma vez, na data escolhida."}
            </p>
          </div>
          <Switch id="m-recurring" checked={recurring} onCheckedChange={setRecurring} data-testid="medication-recurring-toggle" className="scale-125" />
        </div>
        {recurring && (
          <>
            <FormField label="Intervalo entre doses">
              <div className="grid grid-cols-4 gap-2" role="radiogroup" data-testid="medication-interval-group">
                {INTERVALS.map((h) => (
                  <button key={h} type="button" role="radio" aria-checked={interval === h} onClick={() => setIntervalHours(h)} data-testid={`medication-interval-${h}h`}
                    className={`h-12 rounded-2xl text-base font-bold border transition-[background-color,color,transform] active:scale-95 ${interval === h ? "bg-sage text-white border-sage" : "bg-sand text-ink border-sand-line hover:bg-sage-light"}`}>
                    {h}h
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Primeira dose" htmlFor="m-start">
              <input id="m-start" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} block min-w-0 appearance-none`} data-testid="medication-start-input" />
            </FormField>
            {preview.length > 0 && (
              <div className="p-4 rounded-2xl bg-sand-deep" data-testid="medication-next-doses">
                <p className="text-sm font-bold text-ink-soft">Próximas doses (a cada {interval}h)</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {preview.map((d) => <span key={d.getTime()} className="px-3 py-1 rounded-full bg-white text-sm font-bold">{fmtDose(d)}</span>)}
                </div>
              </div>
            )}
          </>
        )}
        {!recurring && (
          <FormField label="Data da dose" htmlFor="m-date">
            <input id="m-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} block min-w-0 appearance-none`} data-testid="medication-date-input" />
          </FormField>
        )}
        {!recurring && <FormField label="Horários das doses">
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
        </FormField>}
        <PrimaryButton type="submit" disabled={save.isPending} data-testid="medication-save-button">
          {save.isPending ? "Salvando..." : "Salvar medicação"}
        </PrimaryButton>
      </form>
    </SheetDialog>
  );
};
