import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { FormField, PrimaryButton, inputCls } from "@/components/FormField";

export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
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
          <h2 className="font-heading text-2xl font-semibold">{isLogin ? "Bem-vindo de volta" : "Crie sua conta de cuidador"}</h2>
          <p className="text-ink-soft text-base mt-1">
            {isLogin ? "Entre para ver a agenda dos seus pacientes." : "Seus pacientes e registros ficam visíveis só para você."}
          </p>
        </div>
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
