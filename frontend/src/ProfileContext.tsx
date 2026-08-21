import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { Profile } from "./types";

const KEY = "bonusradar_profile";
const PREMIUM_KEY = "bonusradar_premium";

type Ctx = {
  profile: Profile | null;
  loading: boolean;
  premium: boolean;
  setPremium: (v: boolean) => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  clearProfile: () => Promise<void>;
};

const ProfileContext = createContext<Ctx>({
  profile: null,
  loading: true,
  premium: false,
  setPremium: async () => {},
  saveProfile: async () => {},
  clearProfile: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [premium, setPremiumState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<Profile | null>(KEY, null);
      const prem = await storage.getItem<boolean>(PREMIUM_KEY, false);
      setProfile(stored as Profile | null);
      setPremiumState(!!prem);
      setLoading(false);
    })();
  }, []);

  const setPremium = async (v: boolean) => {
    await storage.setItem(PREMIUM_KEY, v as any);
    setPremiumState(v);
  };

  const saveProfile = async (p: Profile) => {
    await storage.setItem(KEY, p as any);
    setProfile(p);
  };

  const clearProfile = async () => {
    await storage.removeItem(KEY);
    setProfile(null);
  };

  return (
    <ProfileContext.Provider value={{ profile, loading, premium, setPremium, saveProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
