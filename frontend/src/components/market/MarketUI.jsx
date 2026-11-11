import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import { photoSrc } from "@/lib/marketplace";

export const AuthImage = ({ src, alt, className, fallback = null, testId }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!src) {
      setUrl(null);
      return undefined;
    }
    let alive = true;
    let objectUrl;
    api.get(src, { responseType: "blob" })
      .then((r) => {
        objectUrl = URL.createObjectURL(r.data);
        if (alive) setUrl(objectUrl);
      })
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  if (!url) return fallback;
  return <img src={url} alt={alt} className={className} data-testid={testId} />;
};

export const CaregiverAvatar = ({ ad, size = "w-16 h-16", text = "text-2xl" }) => (
  <AuthImage
    src={photoSrc(ad)}
    alt={`Foto de ${ad?.display_name || "cuidador"}`}
    className={`${size} rounded-full object-cover shrink-0 border-2 border-white shadow`}
    testId="caregiver-photo"
    fallback={
      <div className={`${size} ${text} rounded-full bg-sage-light text-sage-dark flex items-center justify-center font-heading font-bold shrink-0`}>
        {(ad?.display_name || "?").charAt(0).toUpperCase()}
      </div>
    }
  />
);

export const Stars = ({ value = 0, size = "w-4 h-4", onChange, testId }) => (
  <div className="inline-flex items-center gap-0.5" data-testid={testId}>
    {[1, 2, 3, 4, 5].map((n) => {
      const icon = <Star className={`${size} ${n <= Math.round(value) ? "fill-[#E0A23B] text-[#E0A23B]" : "text-sand-line"}`} />;
      return onChange ? (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} estrelas`} data-testid={`${testId}-${n}`} className="p-1 active:scale-90 transition-transform">{icon}</button>
      ) : <span key={n}>{icon}</span>;
    })}
  </div>
);

export const RatingLine = ({ ad }) =>
  ad.rating_count ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft" data-testid={`rating-${ad.id}`}>
      <Stars value={ad.rating_avg} /> <b className="text-ink">{ad.rating_avg.toFixed(1)}</b> ({ad.rating_count})
    </span>
  ) : <span className="text-sm text-ink-soft">Sem avaliações ainda</span>;

export const Chip = ({ active, onClick, children, testId }) => (
  <button type="button" onClick={onClick} data-testid={testId} aria-pressed={active}
    className={`px-4 h-11 rounded-full text-base font-semibold border transition-[background-color,color,transform] active:scale-95 ${active ? "bg-sage text-white border-sage" : "bg-sand text-ink border-sand-line hover:bg-sage-light"}`}>
    {children}
  </button>
);

export const Tag = ({ children }) => <span className="px-3 py-1 rounded-full bg-sand-deep text-sm font-semibold">{children}</span>;
