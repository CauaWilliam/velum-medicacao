import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Award, MessageCircleHeart, Star } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/time";
import { DAY_LABELS, SHIFT_LABELS, fmtPrice, yearsLabel } from "@/lib/marketplace";
import { useAuth } from "@/context/AuthContext";
import { CaregiverAvatar, RatingLine, Stars, Tag } from "@/components/market/MarketUI";
import { InterestDialog, ReviewDialog } from "@/components/market/FamilyDialogs";

const Block = ({ title, children, testId }) => (
  <section className="p-5 rounded-3xl bg-white border border-sand-line space-y-3" data-testid={testId}>
    <h2 className="font-heading text-xl font-semibold">{title}</h2>
    {children}
  </section>
);

const Reviews = ({ reviews }) => (
  <Block title={`Avaliações (${reviews.length})`} testId="ad-reviews">
    {!reviews.length && <p className="text-ink-soft">Ainda não há avaliações.</p>}
    {reviews.map((r) => (
      <div key={r.id} className="border-t border-sand-line pt-3 first:border-0 first:pt-0" data-testid={`review-${r.id}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap"><b>{r.family_name}</b><Stars value={r.rating} /></div>
        {r.comment && <p className="text-base mt-1 break-words">{r.comment}</p>}
        <p className="text-sm text-ink-soft mt-1">{fmtDateTime(r.updated_at)}</p>
      </div>
    ))}
  </Block>
);

export default function CaregiverAdPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [interestOpen, setInterestOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const { data: ad, isLoading, isError } = useQuery({ queryKey: ["market-ad", id], queryFn: () => api.get(`/marketplace/ads/${id}`).then((r) => r.data) });
  const isFamily = user?.role === "family";

  if (isLoading) return <div className="p-5"><div className="h-60 rounded-3xl bg-sand-deep animate-pulse" /></div>;
  if (isError || !ad) return <div className="p-8 text-center text-ink-soft" data-testid="ad-not-found">Anúncio não encontrado. <Link to="/" className="underline">Voltar</Link></div>;

  return (
    <div className="px-5 pt-6 space-y-5">
      <Link to={isFamily ? "/" : "/buscar"} className="w-12 h-12 rounded-full bg-white border border-sand-line flex items-center justify-center" data-testid="ad-back-button" aria-label="Voltar"><ArrowLeft className="w-5 h-5" /></Link>
      <header className="fade-up text-center space-y-2">
        <div className="flex justify-center"><CaregiverAvatar ad={ad} size="w-28 h-28" text="text-5xl" /></div>
        <h1 className="font-heading text-3xl font-bold tracking-tight break-words" data-testid="ad-name">{ad.display_name}</h1>
        {ad.headline && <p className="text-ink-soft text-lg break-words">{ad.headline}</p>}
        <div className="flex flex-col items-center gap-1 text-ink-soft">
          <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" />{ad.city}/{ad.state}</span>
          <span className="inline-flex items-center gap-1"><Award className="w-4 h-4" />{yearsLabel(ad.experience_years)}</span>
          <RatingLine ad={ad} />
        </div>
        <p className="font-heading text-2xl font-bold text-sage-dark" data-testid="ad-price">{fmtPrice(ad.price_value, ad.price_unit)}</p>
      </header>
      {ad.bio && <Block title="Sobre" testId="ad-bio"><p className="text-base leading-relaxed whitespace-pre-line break-words">{ad.bio}</p></Block>}
      <Block title="Especialidades" testId="ad-specialties"><div className="flex flex-wrap gap-2">{ad.specialties.length ? ad.specialties.map((s) => <Tag key={s}>{s}</Tag>) : <span className="text-ink-soft">Não informado</span>}</div></Block>
      <Block title="Disponibilidade" testId="ad-availability">
        <div className="flex flex-wrap gap-2">{Object.entries(DAY_LABELS).map(([k, l]) => <span key={k} className={`w-12 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${ad.days.includes(k) ? "bg-sage text-white" : "bg-sand-deep text-ink-soft line-through"}`}>{l}</span>)}</div>
        <div className="flex flex-wrap gap-2">{ad.shifts.map((s) => <Tag key={s}>{SHIFT_LABELS[s]}</Tag>)}</div>
      </Block>
      <Reviews reviews={ad.reviews} />
      {isFamily && (
        <div className="sticky bottom-24 z-20 space-y-2 pt-2">
          {ad.my_interest && <p className="text-center text-sm bg-leaf-light text-leaf rounded-2xl py-2 font-semibold" data-testid="interest-sent-note">Pedido enviado em {fmtDateTime(ad.my_interest.created_at)}</p>}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button onClick={() => setInterestOpen(true)} data-testid="open-interest-button" className="h-14 rounded-2xl bg-clay hover:bg-[#b25e44] text-white text-lg font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-[background-color,transform]">
              <MessageCircleHeart className="w-5 h-5" /> {ad.my_interest ? "Atualizar pedido" : "Tenho interesse"}
            </button>
            {ad.can_review && (
              <button onClick={() => setReviewOpen(true)} data-testid="open-review-button" className="h-14 px-5 rounded-2xl bg-white border border-sand-line text-ink font-bold flex items-center gap-2 shadow-lg">
                <Star className="w-5 h-5" /> {ad.my_review ? "Editar" : "Avaliar"}
              </button>
            )}
          </div>
        </div>
      )}
      {isFamily && <InterestDialog open={interestOpen} onOpenChange={setInterestOpen} ad={ad} existing={ad.my_interest} />}
      {isFamily && <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} ad={ad} existing={ad.my_review} />}
    </div>
  );
}
