import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, ArrowLeft, MapPin } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, formatApiError } from "@/lib/api";
import { fmtDateTime } from "@/lib/time";
import { DAY_LABELS, SHIFT_LABELS, fmtPrice, yearsLabel } from "@/lib/marketplace";
import { CaregiverAvatar, Tag } from "@/components/market/MarketUI";
import { inputCls } from "@/components/FormField";

const AdReview = ({ ad }) => {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const act = useMutation({
    mutationFn: (action) => api.post(`/admin/ads/${ad.id}/${action}`, action === "reject" ? { reason } : {}),
    onSuccess: (_, action) => { toast.success(action === "approve" ? "Anúncio aprovado" : "Anúncio recusado"); qc.invalidateQueries(); },
    onError: (e) => toast.error(formatApiError(e)),
  });
  return (
    <article className="p-5 rounded-3xl bg-white border border-sand-line space-y-3 fade-up" data-testid={`admin-ad-${ad.id}`}>
      <div className="flex gap-4">
        <CaregiverAvatar ad={ad} />
        <div className="min-w-0">
          <h3 className="text-lg font-bold break-words">{ad.display_name}</h3>
          <p className="text-sm text-ink-soft break-all">{ad.owner_email}</p>
          <p className="text-sm text-ink-soft inline-flex items-center gap-1"><MapPin className="w-4 h-4" />{ad.city}/{ad.state} · {yearsLabel(ad.experience_years)}</p>
        </div>
      </div>
      {ad.headline && <p className="font-semibold break-words">{ad.headline}</p>}
      {ad.bio && <p className="text-base whitespace-pre-line break-words">{ad.bio}</p>}
      <p className="font-bold text-sage-dark">{fmtPrice(ad.price_value, ad.price_unit)}</p>
      <div className="flex flex-wrap gap-1.5">{ad.specialties.map((s) => <Tag key={s}>{s}</Tag>)}</div>
      <p className="text-sm text-ink-soft">{ad.days.map((d) => DAY_LABELS[d]).join(", ") || "Sem dias"} · {ad.shifts.map((s) => SHIFT_LABELS[s]).join(", ") || "Sem turnos"}</p>
      <p className="text-sm text-ink-soft">Enviado em {fmtDateTime(ad.submitted_at)}{ad.paused ? " · pausado pelo cuidador" : ""}</p>
      {ad.status === "rejected" && ad.rejection_reason && <p className="text-sm text-clay">Motivo: {ad.rejection_reason}</p>}
      {rejecting && <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo para o cuidador ajustar (opcional)" className={`${inputCls} h-auto py-3 resize-none`} data-testid={`admin-reject-reason-${ad.id}`} />}
      <div className="grid grid-cols-2 gap-2">
        {ad.status !== "approved" && <button onClick={() => act.mutate("approve")} disabled={act.isPending} className="h-12 rounded-2xl bg-leaf text-white font-bold inline-flex items-center justify-center gap-2" data-testid={`admin-approve-${ad.id}`}><Check className="w-5 h-5" /> Aprovar</button>}
        {ad.status !== "rejected" && <button onClick={() => (rejecting ? act.mutate("reject") : setRejecting(true))} disabled={act.isPending} className="h-12 rounded-2xl bg-clay-light text-clay border border-[#F0C4B6] font-bold inline-flex items-center justify-center gap-2" data-testid={`admin-reject-${ad.id}`}><X className="w-5 h-5" /> {rejecting ? "Confirmar recusa" : "Recusar"}</button>}
      </div>
    </article>
  );
};

const LABELS = { pending: "Pendentes", approved: "Aprovados", rejected: "Recusados" };

export default function AdminAdsPage() {
  const [status, setStatus] = useState("pending");
  const { data: counts } = useQuery({ queryKey: ["admin-counts"], queryFn: () => api.get("/admin/ads/counts").then((r) => r.data) });
  const { data: ads = [], isLoading } = useQuery({ queryKey: ["admin-ads", status], queryFn: () => api.get("/admin/ads", { params: { status } }).then((r) => r.data) });
  return (
    <div className="px-5 pt-6 space-y-6">
      <Link to="/perfil" className="w-12 h-12 rounded-full bg-white border border-sand-line flex items-center justify-center" data-testid="admin-back-button" aria-label="Voltar"><ArrowLeft className="w-5 h-5" /></Link>
      <header><h1 className="font-heading text-4xl font-bold tracking-tight">Aprovar anúncios</h1></header>
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList className="w-full h-14 p-1.5 rounded-2xl bg-sand-deep grid grid-cols-3">
          {Object.entries(LABELS).map(([k, l]) => <TabsTrigger key={k} value={k} data-testid={`admin-tab-${k}`} className="h-full rounded-xl text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-sage-dark">{l} ({counts?.[k] ?? 0})</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {isLoading && <div className="h-40 rounded-3xl bg-sand-deep animate-pulse" />}
      {!isLoading && !ads.length && <p className="text-ink-soft" data-testid="admin-empty">Nenhum anúncio nesta lista.</p>}
      <div className="space-y-4">{ads.map((ad) => <AdReview key={ad.id} ad={ad} />)}</div>
    </div>
  );
}
