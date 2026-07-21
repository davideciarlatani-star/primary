import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useProfile } from "@/src/ProfileContext";
import { api } from "@/src/api";
import { colors, spacing, radius, categoryColors } from "@/src/theme";
import { Deadline } from "@/src/types";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default function Calendario() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const [items, setItems] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(false);
    try {
      const data = await api.calendar(profile);
      setItems(data.deadlines);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.headerTitle}>Calendario Scadenze</Text>
      <Text style={styles.headerSub}>Le date da rispettare per non perdere i tuoi bonus.</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center} testID="cal-loading"><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center} testID="cal-error">
          <Text style={styles.errorText}>Errore di caricamento.</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); load(); }} testID="cal-retry">
            <Text style={styles.retryText}>Riprova</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="calendar-screen">
      {header}
      {items.length === 0 ? (
        <View style={styles.center} testID="cal-empty">
          <Ionicons name="calendar-outline" size={48} color={colors.onSurfaceTertiary} />
          <Text style={styles.emptyText}>Nessuna scadenza in arrivo.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brandPrimary} />}
          showsVerticalScrollIndicator={false}
        >
          {items.map((it) => {
            const days = daysUntil(it.deadline);
            const urgent = days <= 30;
            const d = new Date(it.deadline + "T00:00:00");
            const cat = categoryColors[it.category] || colors.brandPrimary;
            return (
              <Pressable key={it.id} style={styles.row} onPress={() => router.push(`/bonus/${it.id}`)} testID={`deadline-${it.id}`}>
                <View style={[styles.dateBox, urgent && styles.dateBoxUrgent]}>
                  <Text style={[styles.dateDay, urgent && styles.dateTextUrgent]}>{d.getDate()}</Text>
                  <Text style={[styles.dateMonth, urgent && styles.dateTextUrgent]}>{MONTHS[d.getMonth()]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.catTag, { color: cat }]}>{it.category}</Text>
                  <Text style={styles.rowTitle}>{it.name}</Text>
                  <Text style={styles.rowNote} numberOfLines={2}>{it.deadline_note}</Text>
                  <View style={[styles.chip, urgent ? styles.chipUrgent : styles.chipOk]}>
                    <Ionicons name={urgent ? "alert-circle" : "time-outline"} size={13} color={urgent ? colors.onWarning : colors.brandPrimary} />
                    <Text style={[styles.chipText, { color: urgent ? colors.onWarning : colors.brandPrimary }]}>
                      {days < 0 ? "Scaduta" : days === 0 ? "Oggi" : `tra ${days} giorni`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  headerSub: { fontSize: 14, color: colors.onSurfaceTertiary, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  errorText: { color: colors.onSurfaceSecondary, fontSize: 16 },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: 15 },
  retryBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  retryText: { color: colors.onBrandPrimary, fontWeight: "700" },
  row: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  dateBox: { width: 58, height: 58, borderRadius: radius.md, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  dateBoxUrgent: { backgroundColor: colors.accentOrangeLight },
  dateDay: { fontSize: 22, fontWeight: "800", color: colors.brand },
  dateMonth: { fontSize: 12, fontWeight: "700", color: colors.brandPrimary, textTransform: "uppercase" },
  dateTextUrgent: { color: colors.onAccentOrangeLight },
  catTag: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginTop: 1 },
  rowNote: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2, lineHeight: 18 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.sm },
  chipUrgent: { backgroundColor: colors.warning },
  chipOk: { backgroundColor: colors.brandSecondary },
  chipText: { fontSize: 12, fontWeight: "700" },
});
