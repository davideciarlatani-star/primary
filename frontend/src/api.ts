import { Profile } from "./types";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function post(path: string, body: any) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Errore ${res.status}`);
  return res.json();
}

async function get(path: string) {
  const res = await fetch(`${BASE}/api${path}`);
  if (!res.ok) throw new Error(`Errore ${res.status}`);
  return res.json();
}

export const api = {
  match: (profile: Profile) => post("/match", profile),
  calendar: (profile: Profile) => post("/calendar", profile),
  suggest: (profile: Profile) => post("/ai/suggest", profile),
  simulate: (profile: Profile, annual_income: number) =>
    post("/simulate", { profile, annual_income }),
  bonus: (id: string) => get(`/bonus/${id}`),
  bonusDetail: (id: string, profile: Profile) => post(`/bonus/${id}/detail`, profile),
  guide: (id: string) => get(`/bonus/${id}/guide`),
};
