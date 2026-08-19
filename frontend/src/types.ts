export type Profile = {
  age_range: string;
  region: string;
  employment: string;
  household_size: number;
  children: number;
  children_under_3: number;
  isee_range: string;
  home_owner: boolean;
  renting: boolean;
  disability: boolean;
  has_filed: boolean;
};

export type Bonus = {
  id: string;
  name: string;
  category: string;
  icon: string;
  short: string;
  description: string;
  amount: string;
  deadline: string;
  deadline_note: string;
  how: string;
  source: string;
  why: string;
  declaration?: string;
  apply_url?: string;
  region_scope?: string;
  eligible?: boolean;
};

export type Deadline = {
  id: string;
  name: string;
  category: string;
  icon: string;
  deadline: string;
  deadline_note: string;
  amount: string;
};

export const AGE_RANGES = ["18-25", "26-35", "36-50", "51-67", "67+"];
export const EMPLOYMENTS = [
  { key: "dipendente", label: "Lavoratore dipendente" },
  { key: "autonomo", label: "Lavoratore autonomo" },
  { key: "disoccupato", label: "Disoccupato" },
  { key: "studente", label: "Studente" },
  { key: "pensionato", label: "Pensionato" },
  { key: "mai_dichiarato", label: "Mai dichiarato / in nero" },
];
export const ISEE_RANGES = [
  { key: "0-10", label: "Fino a 10.000 €" },
  { key: "10-25", label: "10.000 - 25.000 €" },
  { key: "25-40", label: "25.000 - 40.000 €" },
  { key: "40+", label: "Oltre 40.000 €" },
  { key: "unknown", label: "Non lo so" },
];
export const REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana",
  "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

export const DEFAULT_PROFILE: Profile = {
  age_range: "26-35",
  region: "Lazio",
  employment: "dipendente",
  household_size: 1,
  children: 0,
  children_under_3: 0,
  isee_range: "10-25",
  home_owner: false,
  renting: false,
  disability: false,
  has_filed: true,
};
