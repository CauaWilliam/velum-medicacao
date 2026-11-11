import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { DAY_LABELS, SHIFT_LABELS, UFS } from "@/lib/marketplace";
import { useAuth } from "@/context/AuthContext";
import { FormField, PrimaryButton, inputCls } from "@/components/FormField";
import { Chip } from "@/components/market/MarketUI";

const EMPTY = { display_name: "", headline: "", bio: "", city: "", state: "MG", experience_years: "", specialties: [], days: [], shifts: [], price_value: "", price_unit: "hora" };
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

const ChipSet = ({ label, options, value, onChange, prefix }) => (
  <FormField label={label}>
    <div className="flex flex-wrap gap-2">
      {options.map(([k, l]) => <Chip key={k} active={value.includes(k)} onClick={() => onChange(toggle(value, k))} testId={`${prefix}-${k}`}>{l}</Chip>)}
    </div>
  </FormField>
);

export const AdForm = ({ ad }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const { data: options } = useQuery({ queryKey: ["market-options"], queryFn: () => api.get("/marketplace/options").then((r) => r.data) });
  useEffect(() => { setF(ad ? { ...EMPTY, ...ad } : { ...EMPTY, display_name: user?.name || "" }); }, [ad, user]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => api.put("/my-ad", {
      display_name: f.display_name, headline: f.headline, bio: f.bio, city: f.city, state: f.state,
      experience_years: Number(f.experience_years), specialties: f.specialties, days: f.days, shifts: f.shifts,
      price_value: Number(String(f.price_value).replace(",", ".")), price_unit: f.price_unit,
    }),
    onSuccess: () => { toast.success("Anúncio enviado para aprovação"); qc.invalidateQueries(); },
    onError: (e) => toast.error(formatApiError(e)),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5" data-testid="ad-form">
      <FormField label="Nome no anúncio" htmlFor="ad-name"><input id="ad-name" required minLength={2} value={f.display_name} onChange={set("display_name")} className={inputCls} data-testid="ad-name-input" /></FormField>
      <FormField label="Frase de apresentação" htmlFor="ad-headline"><input id="ad-headline" maxLength={120} value={f.headline} onChange={set("headline")} placeholder="Ex.: Técnica de enfermagem com carinho e paciência" className={inputCls} data-testid="ad-headline-input" /></FormField>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <FormField label="Cidade" htmlFor="ad-city"><input id="ad-city" required minLength={2} value={f.city} onChange={set("city")} placeholder="Belo Horizonte" className={inputCls} data-testid="ad-city-input" /></FormField>
        <FormField label="UF" htmlFor="ad-state">
          <select id="ad-state" value={f.state} onChange={set("state")} className={`${inputCls} px-3`} data-testid="ad-state-select">{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        </FormField>
      </div>
      <FormField label="Anos de experiência" htmlFor="ad-exp"><input id="ad-exp" required type="number" min="0" max="70" inputMode="numeric" value={f.experience_years} onChange={set("experience_years")} className={inputCls} data-testid="ad-experience-input" /></FormField>
      <FormField label="Valor" htmlFor="ad-price">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input id="ad-price" required inputMode="decimal" value={f.price_value} onChange={set("price_value")} placeholder="R$ 35,00" className={inputCls} data-testid="ad-price-input" />
          <div className="flex gap-1 p-1 rounded-2xl bg-sand-deep">
            {[["hora", "por hora"], ["diaria", "diária"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setF((x) => ({ ...x, price_unit: k }))} data-testid={`ad-price-unit-${k}`} className={`px-3 rounded-xl text-sm font-bold transition-colors ${f.price_unit === k ? "bg-white text-sage-dark shadow-sm" : "text-ink-soft"}`}>{l}</button>
            ))}
          </div>
        </div>
      </FormField>
      <ChipSet label="Especialidades" prefix="ad-specialty" options={(options?.specialties || []).map((s, i) => [s, s, i])} value={f.specialties} onChange={(v) => setF((x) => ({ ...x, specialties: v }))} />
      <ChipSet label="Dias disponíveis" prefix="ad-day" options={Object.entries(DAY_LABELS)} value={f.days} onChange={(v) => setF((x) => ({ ...x, days: v }))} />
      <ChipSet label="Turnos" prefix="ad-shift" options={Object.entries(SHIFT_LABELS)} value={f.shifts} onChange={(v) => setF((x) => ({ ...x, shifts: v }))} />
      <FormField label="Sobre você" htmlFor="ad-bio"><textarea id="ad-bio" rows={5} maxLength={1500} value={f.bio} onChange={set("bio")} placeholder="Formação, experiências, como você trabalha..." className={`${inputCls} h-auto py-3 resize-none`} data-testid="ad-bio-input" /></FormField>
      <PrimaryButton type="submit" disabled={save.isPending} data-testid="ad-submit-button"><Send className="w-5 h-5" /> {save.isPending ? "Enviando..." : "Enviar para aprovação"}</PrimaryButton>
      <p className="text-sm text-ink-soft text-center">Toda alteração passa por nova aprovação antes de aparecer para as famílias.</p>
    </form>
  );
};
