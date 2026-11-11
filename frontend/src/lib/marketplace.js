export const DAY_LABELS = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };
export const SHIFT_LABELS = { manha: "Manhã", tarde: "Tarde", noite: "Noite", pernoite: "Pernoite" };
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export const fmtPrice = (value, unit) =>
  `${Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} / ${unit === "hora" ? "hora" : "diária"}`;

export const photoSrc = (ad) => (ad?.has_photo ? `/marketplace/ads/${ad.id}/photo?v=${encodeURIComponent(ad.updated_at)}` : null);

export const yearsLabel = (n) => (n === 0 ? "Menos de 1 ano de experiência" : `${n} ${n === 1 ? "ano" : "anos"} de experiência`);
