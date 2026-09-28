import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useProfile } from "@/src/ProfileContext";
import { storage } from "@/src/utils/storage";
import { colors } from "@/src/theme";

const INTRO_SEEN_KEY = "bonusradar_intro_seen";

export default function Index() {
  const { profile, loading } = useProfile();
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const seen = await storage.getItem<boolean>(INTRO_SEEN_KEY, false);
      setIntroSeen(!!seen);
    })();
  }, []);

  if (loading || introSeen === null) {
    return (
      <View style={styles.center} testID="app-loading">
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (!introSeen) {
    return <Redirect href="/intro" />;
  }

  return <Redirect href={profile ? "/(tabs)" : "/onboarding"} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
});
