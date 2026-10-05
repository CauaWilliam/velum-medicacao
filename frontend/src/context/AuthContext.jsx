import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { browserTz } from "@/lib/time";
import { disablePush } from "@/lib/push";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const qc = useQueryClient();

  const syncTz = useCallback(async (u) => {
    const tz = browserTz();
    if (u && u.timezone !== tz) {
      const { data } = await api.patch("/auth/me", { timezone: tz }).catch(() => ({ data: u }));
      return data;
    }
    return u;
  }, []);

  useEffect(() => {
    api.get("/auth/me")
      .then(async ({ data }) => setUser(await syncTz(data)))
      .catch(() => setUser(false));
  }, [syncTz]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    qc.clear();
    setUser(await syncTz(data));
  };

  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password, timezone: browserTz() });
    qc.clear();
    setUser(data);
  };

  const logout = async () => {
    await disablePush().catch(() => null);
    await api.post("/auth/logout").catch(() => null);
    qc.clear();
    setUser(false);
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
