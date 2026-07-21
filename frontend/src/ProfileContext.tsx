import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { Profile } from "./types";

const KEY = "bonusradar_profile";

type Ctx = {
  profile: Profile | null;
  loading: boolean;
  saveProfile: (p: Profile) => Promise<void>;
  clearProfile: () => Promise<void>;
};

const ProfileContext = createContext<Ctx>({
  profile: null,
  loading: true,
  saveProfile: async () => {},
  clearProfile: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<Profile | null>(KEY, null);
      setProfile(stored as Profile | null);
      setLoading(false);
    })();
  }, []);

  const saveProfile = async (p: Profile) => {
    await storage.setItem(KEY, p as any);
    setProfile(p);
  };

  const clearProfile = async () => {
    await storage.removeItem(KEY);
    setProfile(null);
  };

  return (
    <ProfileContext.Provider value={{ profile, loading, saveProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
