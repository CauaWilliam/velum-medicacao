import { Label } from "@/components/ui/label";

export const inputCls =
  "w-full h-14 px-4 rounded-2xl bg-sand border border-sand-line text-lg text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-sage focus:border-sage transition-[box-shadow,border-color]";

export const FormField = ({ label, htmlFor, children, hint }) => (
  <div className="space-y-2">
    <Label htmlFor={htmlFor} className="text-base font-bold text-ink">{label}</Label>
    {children}
    {hint && <p className="text-sm text-ink-soft">{hint}</p>}
  </div>
);

export const PrimaryButton = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`w-full h-14 rounded-2xl bg-sage hover:bg-sage-dark text-white text-lg font-bold transition-[background-color,transform] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 ${className}`}
  >
    {children}
  </button>
);
