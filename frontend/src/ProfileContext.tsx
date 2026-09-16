import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { Profile } from "./types";
import { PaywallModal } from "@/src/components/PaywallModal";

const KEY = "bonusradar_profile";
const PREMIUM_KEY = "bonusradar_premium";

type Ctx = {
  profile: Profile | null;
  loading: boolean;
  premium: boolean;
  setPremium: (v: boolean) => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  clearProfile: () => Promise<void>;
  showPaywall: () => void;
  hidePaywall: () => void;
};

const ProfileContext = createContext<Ctx>({
  profile: null,
  loading: true,
  premium: false,
  setPremium: async () => {},
  saveProfile: async () => {},
  clearProfile: async () => {},
  showPaywall: () => {},
  hidePaywall: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [premium, setPremiumState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paywall, setPaywall] = useState(false);

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

  const showPaywall = () => setPaywall(true);
  const hidePaywall = () => setPaywall(false);

  const purchase = async () => {
    await setPremium(true);
    setPaywall(false);
  };

  return (
    <ProfileContext.Provider
      value={{ profile, loading, premium, setPremium, saveProfile, clearProfile, showPaywall, hidePaywall }}
    >
      {children}
      <PaywallModal visible={paywall} onClose={hidePaywall} onPurchase={purchase} />
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
