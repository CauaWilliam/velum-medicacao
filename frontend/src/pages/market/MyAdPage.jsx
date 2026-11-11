import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Clock3, CheckCircle2, AlertCircle, Trash2, Phone, MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { api, formatApiError } from "@/lib/api";
import { fmtDateTime } from "@/lib/time";
import { phoneDigits } from "@/lib/phone";
import { AdForm } from "@/components/market/AdForm";
import { CaregiverAvatar } from "@/components/market/MarketUI";
import { ConfirmDelete } from "@/components/ConfirmDelete";

const STATUS = {
  pending: { icon: Clock3, cls: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]", title: "Em análise", text: "A equipe Velum está revisando seu anúncio." },
  approved: { icon: CheckCircle2, cls: "bg-leaf-light text-leaf border-[#A7D7B0]", title: "Publicado", text: "Famílias já podem ver seu anúncio." },
  rejected: { icon: AlertCircle, cls: "bg-clay-light text-clay border-[#F0C4B6]", title: "Precisa de ajustes", text: "" },
};

const StatusCard = ({ ad }) => {
  const qc = useQueryClient();
  const s = STATUS[ad.status];
  const pause = useMutation({ mutationFn: (paused) => api.patch("/my-ad/pause", { paused }), onSuccess: () => qc.invalidateQueries(), onError: (e) => toast.error(formatApiError(e)) });
  return (
    <div className={`p-4 rounded-3xl border ${s.cls} space-y-3`} data-testid="ad-status-card">
      <div className="flex gap-3"><s.icon className="w-6 h-6 shrink-0" /><div><b className="text-lg" data-testid="ad-status-title">{s.title}</b><p>{ad.status === "rejected" ? ad.rejection_reason || "Revise e envie novamente." : s.text}</p></div></div>
      <label className="flex items-center justify-between gap-3 bg-white/70 rounded-2xl p-3">
        <span className="font-semibold">{ad.paused ? "Anúncio pausado (oculto)" : "Anúncio ativo"}</span>
        <Switch checked={!ad.paused} onCheckedChange={(on) => pause.mutate(!on)} data-testid="ad-active-toggle" />
      </label>
    </div>
  );
};

const PhotoPicker = ({ ad }) => {
  const qc = useQueryClient();
  const input = useRef(null);
  const upload = useMutation({
    mutationFn: (file) => { const fd = new FormData(); fd.append("file", file); return api.post("/my-ad/photo", fd); },
    onSuccess: () => { toast.success("Foto enviada para aprovação"); qc.invalidateQueries(); },
    onError: (e) => toast.error(formatApiError(e)),
  });
  return (
    <div className="flex items-center gap-4">
      <CaregiverAvatar ad={ad} size="w-20 h-20" text="text-3xl" />
      <button type="button" onClick={() => input.current?.click()} disabled={upload.isPending} data-testid="ad-photo-button" className="h-12 px-5 rounded-full bg-white border border-sand-line font-bold inline-flex items-center gap-2 disabled:opacity-60">
        <Camera className="w-5 h-5" /> {upload.isPending ? "Enviando..." : ad.has_photo ? "Trocar foto" : "Adicionar foto"}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid="ad-photo-input" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
    </div>
  );
};

const Received = () => {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["received-interests"], queryFn: () => api.get("/my-ad/interests").then((r) => r.data) });
  const seen = useMutation({ mutationFn: (id) => api.patch(`/my-ad/interests/${id}/seen`), onSuccess: () => qc.invalidateQueries({ queryKey: ["received-interests"] }) });
  if (!data.length) return <p className="text-ink-soft" data-testid="received-empty">Nenhum pedido ainda. Quando uma família tiver interesse, aparece aqui.</p>;
  return (
    <div className="space-y-4" data-testid="received-list">
      {data.map((i) => {
        const d = phoneDigits(i.contact_phone);
        return (
          <div key={i.id} className={`p-5 rounded-3xl bg-white border ${i.seen ? "border-sand-line" : "border-clay"}`} data-testid={`received-${i.id}`}>
            <div className="flex items-center justify-between gap-2"><b className="text-lg break-words">{i.contact_name}</b>{!i.seen && <span className="px-2 py-0.5 rounded-full bg-clay text-white text-xs font-bold">Novo</span>}</div>
            {i.message && <p className="mt-1 break-words whitespace-pre-line">{i.message}</p>}
            <p className="text-sm text-ink-soft mt-1">{fmtDateTime(i.created_at)}</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <a href={`tel:+55${d}`} onClick={() => seen.mutate(i.id)} className="h-12 rounded-2xl bg-sage text-white font-bold inline-flex items-center justify-center gap-2" data-testid={`received-call-${i.id}`}><Phone className="w-5 h-5" /> {i.contact_phone}</a>
              <a href={`https://wa.me/55${d}`} target="_blank" rel="noreferrer" onClick={() => seen.mutate(i.id)} className="h-12 rounded-2xl bg-leaf-light text-leaf font-bold inline-flex items-center justify-center gap-2" data-testid={`received-whatsapp-${i.id}`}><MessageCircle className="w-5 h-5" /> WhatsApp</a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function MyAdPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("anuncio");
  const { data, isLoading } = useQuery({ queryKey: ["my-ad"], queryFn: () => api.get("/my-ad").then((r) => r.data) });
  const { data: received = [] } = useQuery({ queryKey: ["received-interests"], queryFn: () => api.get("/my-ad/interests").then((r) => r.data) });
  const del = useMutation({ mutationFn: () => api.delete("/my-ad"), onSuccess: () => { toast.success("Anúncio removido"); qc.invalidateQueries(); } });
  const ad = data?.ad;
  const unseen = received.filter((i) => !i.seen).length;

  return (
    <div className="px-5 pt-8 space-y-6">
      <header className="fade-up">
        <h1 className="font-heading text-4xl font-bold tracking-tight">Meu anúncio</h1>
        <p className="text-ink-soft text-base mt-1">Apresente-se para famílias que procuram cuidadores</p>
      </header>
      {isLoading ? <div className="h-40 rounded-3xl bg-sand-deep animate-pulse" /> : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full h-14 p-1.5 rounded-2xl bg-sand-deep grid grid-cols-2">
            <TabsTrigger value="anuncio" data-testid="tab-my-ad" className="h-full rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:text-sage-dark">Anúncio</TabsTrigger>
            <TabsTrigger value="pedidos" data-testid="tab-received" className="h-full rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:text-sage-dark">Pedidos{unseen ? ` (${unseen})` : ""}</TabsTrigger>
          </TabsList>
          <TabsContent value="anuncio" className="mt-5 space-y-6">
            {ad && <StatusCard ad={ad} />}
            {ad ? <PhotoPicker ad={ad} /> : <p className="text-ink-soft">Preencha seu anúncio. Depois de salvo, você poderá adicionar uma foto.</p>}
            <AdForm ad={ad} />
            {ad && (
              <ConfirmDelete testId="ad-delete" title="Excluir anúncio?" description="Seu anúncio, pedidos e avaliações recebidas serão apagados." onConfirm={() => del.mutate()}
                trigger={<button className="w-full h-12 rounded-2xl text-clay font-bold inline-flex items-center justify-center gap-2 hover:bg-clay-light transition-colors" data-testid="ad-delete-button"><Trash2 className="w-5 h-5" /> Excluir anúncio</button>} />
            )}
          </TabsContent>
          <TabsContent value="pedidos" className="mt-5"><Received /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
