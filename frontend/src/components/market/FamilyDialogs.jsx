import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { maskPhone } from "@/lib/phone";
import { useAuth } from "@/context/AuthContext";
import { SheetDialog } from "@/components/SheetDialog";
import { FormField, PrimaryButton, inputCls } from "@/components/FormField";
import { Stars } from "@/components/market/MarketUI";

export const InterestDialog = ({ open, onOpenChange, ad, existing }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ contact_name: "", contact_phone: "", message: "" });
  useEffect(() => {
    if (open) setForm(existing ? { contact_name: existing.contact_name, contact_phone: existing.contact_phone, message: existing.message } : { contact_name: user?.name || "", contact_phone: "", message: "" });
  }, [open, existing, user]);
  const save = useMutation({
    mutationFn: () => api.post(`/marketplace/ads/${ad.id}/interest`, form),
    onSuccess: () => { toast.success("Pedido enviado! O cuidador vai entrar em contato."); qc.invalidateQueries(); onOpenChange(false); },
    onError: (e) => toast.error(formatApiError(e)),
  });
  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title="Tenho interesse" description={`${ad.display_name} recebe seu nome, telefone e mensagem para retornar o contato.`} testId="interest-dialog">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5 mt-2">
        <FormField label="Seu nome" htmlFor="i-name">
          <input id="i-name" required minLength={2} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={inputCls} data-testid="interest-name-input" />
        </FormField>
        <FormField label="Telefone para contato" htmlFor="i-phone">
          <input id="i-phone" required type="tel" inputMode="numeric" maxLength={15} value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: maskPhone(e.target.value) })} placeholder="(31) 97306-1826" className={inputCls} data-testid="interest-phone-input" />
        </FormField>
        <FormField label="Mensagem" htmlFor="i-msg">
          <textarea id="i-msg" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Conte um pouco sobre quem precisa de cuidado, dias e horários." className={`${inputCls} h-auto py-3 resize-none`} data-testid="interest-message-input" />
        </FormField>
        <PrimaryButton type="submit" disabled={save.isPending} data-testid="interest-submit-button">{save.isPending ? "Enviando..." : "Enviar pedido"}</PrimaryButton>
      </form>
    </SheetDialog>
  );
};

export const ReviewDialog = ({ open, onOpenChange, ad, existing }) => {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (open) { setRating(existing?.rating || 0); setComment(existing?.comment || ""); }
  }, [open, existing]);
  const save = useMutation({
    mutationFn: () => api.post(`/marketplace/ads/${ad.id}/reviews`, { rating, comment }),
    onSuccess: () => { toast.success("Avaliação publicada"); qc.invalidateQueries(); onOpenChange(false); },
    onError: (e) => toast.error(formatApiError(e)),
  });
  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={`Avaliar ${ad.display_name}`} description="Sua avaliação fica visível para outras famílias." testId="review-dialog">
      <form onSubmit={(e) => { e.preventDefault(); if (rating) save.mutate(); else toast.error("Escolha de 1 a 5 estrelas"); }} className="space-y-5 mt-2">
        <div className="flex justify-center"><Stars value={rating} onChange={setRating} size="w-9 h-9" testId="review-stars" /></div>
        <FormField label="Comentário (opcional)" htmlFor="r-comment">
          <textarea id="r-comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} className={`${inputCls} h-auto py-3 resize-none`} data-testid="review-comment-input" />
        </FormField>
        <PrimaryButton type="submit" disabled={save.isPending} data-testid="review-submit-button">{save.isPending ? "Publicando..." : "Publicar avaliação"}</PrimaryButton>
      </form>
    </SheetDialog>
  );
};
