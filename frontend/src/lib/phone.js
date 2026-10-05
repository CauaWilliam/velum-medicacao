export const phoneDigits = (value = "") => value.replace(/\D/g, "").slice(0, 11);

export function maskPhone(value = "") {
  const d = phoneDigits(value);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const split = d.length === 11 ? 5 : 4;
  if (rest.length <= split) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}
