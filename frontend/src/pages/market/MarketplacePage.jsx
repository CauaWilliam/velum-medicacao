import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, SearchX } from "lucide-react";
import { api } from "@/lib/api";
import { SHIFT_LABELS, fmtPrice, yearsLabel } from "@/lib/marketplace";
import { CaregiverAvatar, Chip, RatingLine, Tag } from "@/components/market/MarketUI";
import { inputCls } from "@/components/FormField";

const AdCard = ({ ad }) => (
  <Link to={`/cuidadores/${ad.id}`} data-testid={`ad-card-${ad.id}`} className="fade-up block p-5 rounded-3xl bg-white border border-sand-line shadow-sm hover:shadow-md transition-shadow duration-200">
    <div className="flex gap-4">
      <CaregiverAvatar ad={ad} />
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-bold break-words">{ad.display_name}</h3>
        {ad.headline && <p className="text-ink-soft leading-snug break-words">{ad.headline}</p>}
        <p className="text-sm text-ink-soft inline-flex items-center gap-1 mt-1"><MapPin className="w-4 h-4" />{ad.city}/{ad.state} · {yearsLabel(ad.experience_years)}</p>
        <div className="mt-1"><RatingLine ad={ad} /></div>
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5 mt-4">
      {ad.specialties.slice(0, 3).map((s) => <Tag key={s}>{s}</Tag>)}
      {ad.specialties.length > 3 && <Tag>+{ad.specialties.length - 3}</Tag>}
    </div>
    <div className="flex items-center justify-between mt-4 gap-2 flex-wrap">
      <span className="font-heading text-xl font-bold text-sage-dark" data-testid={`ad-price-${ad.id}`}>{fmtPrice(ad.price_value, ad.price_unit)}</span>
      <span className="text-sm text-ink-soft">{ad.shifts.map((s) => SHIFT_LABELS[s]).join(" · ")}</span>
    </div>
  </Link>
);

export default function MarketplacePage() {
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [shift, setShift] = useState("");
  const { data: options } = useQuery({ queryKey: ["market-options"], queryFn: () => api.get("/marketplace/options").then((r) => r.data) });
  const { data: ads = [], isLoading } = useQuery({
    queryKey: ["market-ads", city, specialty, shift],
    queryFn: () => api.get("/marketplace/ads", { params: { city, specialty, shift } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="px-5 pt-8 space-y-6">
      <header className="fade-up">
        <h1 className="font-heading text-4xl font-bold tracking-tight">Encontre um cuidador</h1>
        <p className="text-ink-soft text-base mt-1">Profissionais aprovados pela equipe Velum</p>
      </header>
      <div className="space-y-3 fade-up">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Buscar por cidade" className={`${inputCls} pl-12 bg-white`} data-testid="market-city-filter" />
        </div>
        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={`${inputCls} bg-white`} data-testid="market-specialty-filter">
          <option value="">Todas as especialidades</option>
          {(options?.specialties || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
          <Chip active={!shift} onClick={() => setShift("")} testId="market-shift-all">Todos</Chip>
          {Object.entries(SHIFT_LABELS).map(([k, l]) => <Chip key={k} active={shift === k} onClick={() => setShift(k)} testId={`market-shift-${k}`}>{l}</Chip>)}
        </div>
      </div>
      {isLoading && <div className="h-40 rounded-3xl bg-sand-deep animate-pulse" />}
      {!isLoading && ads.length === 0 && (
        <div className="text-center py-12 px-6 rounded-3xl bg-white border border-sand-line" data-testid="market-empty">
          <SearchX className="w-12 h-12 mx-auto text-clay" />
          <h2 className="font-heading text-xl font-semibold mt-3">Nenhum cuidador encontrado</h2>
          <p className="text-ink-soft mt-1">Tente outra cidade ou remova os filtros.</p>
        </div>
      )}
      <div className="space-y-4" data-testid="market-list">{ads.map((ad) => <AdCard key={ad.id} ad={ad} />)}</div>
    </div>
  );
}
