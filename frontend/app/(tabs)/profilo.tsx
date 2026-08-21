import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useProfile } from "@/src/ProfileContext";
import { colors, spacing, radius } from "@/src/theme";
import { EMPLOYMENTS, ISEE_RANGES } from "@/src/types";

export default function Profilo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, clearProfile, premium, setPremium } = useProfile();
  if (!profile) return null;

  const empLabel = EMPLOYMENTS.find((e) => e.key === profile.employment)?.label || profile.employment;
  const iseeLabel = ISEE_RANGES.find((i) => i.key === profile.isee_range)?.label || profile.isee_range;

  const rows: { icon: string; label: string; value: string }[] = [
    { icon: "person", label: "Età", value: `${profile.age_range} anni` },
    { icon: "location", label: "Regione", value: profile.region },
    { icon: "briefcase", label: "Occupazione", value: empLabel },
    { icon: "cash", label: "Fascia ISEE", value: iseeLabel },
    { icon: "people", label: "Nucleo familiare", value: `${profile.household_size} persone` },
    { icon: "happy", label: "Figli", value: `${profile.children}${profile.children_under_3 > 0 ? ` (${profile.children_under_3} < 3 anni)` : ""}` },
    { icon: "home", label: "Casa", value: profile.home_owner ? "Proprietario" : profile.renting ? "In affitto" : "Non indicato" },
    { icon: "document-text", label: "Dichiarazioni", value: profile.has_filed ? "Regolare" : "Mai dichiarato" },
  ];

  const reset = async () => {
    await clearProfile();
    router.replace("/onboarding");
  };

  return (
    <View style={styles.container} testID="profile-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Il tuo profilo</Text>
        <Text style={styles.headerSub}>Dati minimi conservati solo su questo dispositivo.</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={styles.privacyCard}>
          <Ionicons name="lock-closed" size={18} color={colors.success} />
          <Text style={styles.privacyText}>I tuoi dati non vengono inviati a terzi: restano privati sul telefono.</Text>
        </View>

        {/* TEMPORANEO — solo per test, rimuovere prima della distribuzione pubblica */}
        <View style={styles.devCard} testID="dev-premium-toggle">
          <View style={styles.devHeader}>
            <Ionicons name="flask" size={16} color={colors.accentOrange} />
            <Text style={styles.devTitle}>Modalità test (temporanea)</Text>
          </View>
          <View style={styles.devStatusRow}>
            <Text style={styles.devStatusLabel}>Piano attuale:</Text>
            <View style={[styles.planBadge, premium ? styles.planBadgePremium : styles.planBadgeFree]}>
              <Ionicons name={premium ? "star" : "person"} size={13} color={premium ? colors.onAccentOrange : colors.onBrandSecondary} />
              <Text style={[styles.planBadgeText, { color: premium ? colors.onAccentOrange : colors.onBrandSecondary }]}>{premium ? "PREMIUM" : "FREE"}</Text>
            </View>
          </View>
          <View style={styles.devBtnRow}>
            <Pressable style={[styles.devBtn, styles.devBtnPremium]} onPress={() => setPremium(true)} testID="btn-go-premium">
              <Ionicons name="star" size={16} color={colors.onAccentOrange} />
              <Text style={styles.devBtnPremiumText}>Passa a Premium</Text>
            </Pressable>
            <Pressable style={[styles.devBtn, styles.devBtnFree]} onPress={() => setPremium(false)} testID="btn-go-free">
              <Text style={styles.devBtnFreeText}>Passa a Free</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.group}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
              <View style={styles.iconBox}>
                <Ionicons name={r.icon as any} size={18} color={colors.brandPrimary} />
              </View>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue}>{r.value}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.editBtn} onPress={() => router.push("/onboarding")} testID="profile-edit">
          <Ionicons name="create-outline" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.editText}>Modifica profilo</Text>
        </Pressable>

        <Pressable style={styles.resetBtn} onPress={reset} testID="profile-reset">
          <Ionicons name="refresh" size={18} color={colors.error} />
          <Text style={styles.resetText}>Ricomincia da capo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  headerSub: { fontSize: 14, color: colors.onSurfaceTertiary, marginTop: 2 },
  privacyCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#ECFDF5", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: "#A7F3D0" },
  privacyText: { flex: 1, fontSize: 13, color: "#065F46", lineHeight: 18 },
  devCard: { backgroundColor: "#FFFBF5", borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accentOrangeLight, gap: spacing.md },
  devHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  devTitle: { fontSize: 14, fontWeight: "700", color: colors.onAccentOrangeLight },
  devStatusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  devStatusLabel: { fontSize: 14, color: colors.onSurfaceSecondary },
  planBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  planBadgePremium: { backgroundColor: colors.accentOrange },
  planBadgeFree: { backgroundColor: colors.brandSecondary },
  planBadgeText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  devBtnRow: { flexDirection: "row", gap: spacing.sm },
  devBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md },
  devBtnPremium: { backgroundColor: colors.accentOrange },
  devBtnPremiumText: { color: colors.onAccentOrange, fontWeight: "700", fontSize: 14 },
  devBtnFree: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  devBtnFreeText: { color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: 14 },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, minHeight: 56 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBox: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, color: colors.onSurfaceSecondary },
  rowValue: { fontSize: 15, fontWeight: "700", color: colors.onSurface, textAlign: "right", maxWidth: "50%" },
  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, height: 52, borderRadius: radius.md },
  editText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 48 },
  resetText: { color: colors.error, fontSize: 15, fontWeight: "600" },
});
