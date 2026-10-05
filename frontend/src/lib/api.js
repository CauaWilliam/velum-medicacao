import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });

const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const skip = NO_REFRESH.some((p) => original?.url?.includes(p));
    if (error.response?.status === 401 && original && !original._retry && !skip) {
      original._retry = true;
      refreshing = refreshing || api.post("/auth/refresh").finally(() => (refreshing = null));
      try {
        await refreshing;
        return api(original);
      } catch (e) {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err?.message ? "Não foi possível concluir. Tente novamente." : "Erro inesperado.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => (typeof e?.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (typeof detail?.msg === "string") return detail.msg;
  return String(detail);
}
