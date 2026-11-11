import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, HeartHandshake, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { FormField, PrimaryButton, inputCls } from "@/components/FormField";

export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accountType, setAccountType] = useState("caregiver");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password, accountType);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-sand text-ink sm:border-x sm:border-sand-line sm:shadow-2xl">
      <div className="relative h-64 overflow-hidden rounded-b-[2.5rem]">
        <img src="/images/hero.jpg" alt="Mãos de cuidadora segurando as mãos de uma idosa" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2C3531]/75 via-[#2C3531]/20 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex items-end gap-3">
          <img src="/icon-192.png" alt="" className="w-14 h-14 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-heading text-4xl font-bold text-white tracking-tight">Velum</h1>
            <p className="text-white/90 text-base">Cuidar com calma, no horário certo.</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="px-6 pt-8 pb-10 space-y-5 fade-up" data-testid={isLogin ? "login-form" : "register-form"}>
        <div>
          <h2 className="font-heading text-2xl font-semibold">{isLogin ? "Bem-vindo de volta" : "Crie sua conta"}</h2>
          <p className="text-ink-soft text-base mt-1">
            {isLogin ? "Entre para continuar no Velum." : "Seus dados ficam visíveis só para você."}
          </p>
        </div>
        {!isLogin && (
          <div className="grid grid-cols-2 gap-3" role="radiogroup" data-testid="account-type-group">
            {[["caregiver", "Sou cuidador(a)", "Organizo pacientes e me anuncio", HeartHandshake], ["family", "Procuro um cuidador", "Para minha família", Search]].map(([k, title, sub, Icon]) => (
              <button key={k} type="button" role="radio" aria-checked={accountType === k} onClick={() => setAccountType(k)} data-testid={`account-type-${k}`}
                className={`p-4 rounded-3xl border-2 text-left transition-[background-color,border-color,transform] active:scale-[0.98] ${accountType === k ? "border-sage bg-sage-light" : "border-sand-line bg-white"}`}>
                <Icon className={`w-7 h-7 ${accountType === k ? "text-sage-dark" : "text-ink-soft"}`} />
                <div className="font-bold text-base mt-2 leading-tight">{title}</div>
                <div className="text-sm text-ink-soft leading-snug mt-1">{sub}</div>
              </button>
            ))}
          </div>
        )}
        {!isLogin && (
          <FormField label="Seu nome" htmlFor="name">
            <input id="name" required value={form.name} onChange={set("name")} className={inputCls} placeholder="Ex.: Ana Souza" data-testid="register-name-input" autoComplete="name" />
          </FormField>
        )}
        <FormField label="E-mail" htmlFor="email">
          <input id="email" type="email" required value={form.email} onChange={set("email")} className={inputCls} placeholder="voce@email.com" data-testid={`${mode}-email-input`} autoComplete="email" />
        </FormField>
        <FormField label="Senha" htmlFor="password" hint={!isLogin ? "Mínimo de 6 caracteres." : undefined}>
          <input id="password" type="password" required minLength={isLogin ? undefined : 6} value={form.password} onChange={set("password")} className={inputCls} placeholder="••••••••" data-testid={`${mode}-password-input`} autoComplete={isLogin ? "current-password" : "new-password"} />
        </FormField>
        {error && (
          <p className="bg-alert-light text-alert border border-[#FCA5A5] rounded-2xl px-4 py-3 text-base font-semibold" data-testid="auth-error">{error}</p>
        )}
        <PrimaryButton type="submit" disabled={busy} data-testid={`${mode}-submit-button`}>
          {busy ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"} {!busy && <ArrowRight className="w-5 h-5" />}
        </PrimaryButton>
        <p className="text-center text-base text-ink-soft">
          {isLogin ? "Ainda não tem conta? " : "Já tem conta? "}
          <Link to={isLogin ? "/cadastro" : "/entrar"} className="font-bold text-sage-dark underline underline-offset-4" data-testid="auth-switch-link">
            {isLogin ? "Cadastre-se" : "Entrar"}
          </Link>
        </p>
      </form>
    </div>
  );
}
