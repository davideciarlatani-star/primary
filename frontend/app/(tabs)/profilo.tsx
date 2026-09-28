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
  const { profile, clearProfile, premium, setPremium, showPaywall } = useProfile();
  if (!profile) return null;

  const empLabel = EMPLOYMENTS.find((e) => e.key === profile.employment)?.label || profile.employment;
  const iseeLabel = ISEE_RANGES.find((i) => i.key === profile.isee_range)?.label || profile.isee_range;
  const ageValue = profile.age != null ? `${profile.age} anni` : `${profile.age_range} anni`;
  const iseeValue = profile.isee_exact != null ? `${profile.isee_exact.toLocaleString("it-IT")} € (esatto)` : iseeLabel;

  const rows: { icon: string; label: string; value: string }[] = [
    { icon: "person", label: "Età", value: ageValue },
    { icon: "location", label: "Regione", value: profile.region },
    { icon: "briefcase", label: "Occupazione", value: empLabel },
    { icon: "cash", label: "ISEE", value: iseeValue },
    { icon: "people", label: "Nucleo familiare", value: `${profile.household_size} persone` },
    { icon: "happy", label: "Figli", value: `${profile.children}${profile.children_under_3 > 0 ? ` (${profile.children_under_3} < 3 anni)` : ""}` },
    { icon: "home", label: "Casa", value: profile.home_owner ? "Proprietario" : profile.renting ? "In affitto" : "Non indicato" },
    { icon: "document-text", label: "Dichiarazioni", value: profile.has_filed ? "Regolare" : "Mai dichiarato" },
  ];

  const reset = async () => {
    await clearProfile();
    router.replace("/intro");
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

        {/* Premium status / upsell */}
        {premium ? (
          <View style={styles.premiumCard} testID="premium-status-card">
            <View style={styles.premiumRow}>
              <View style={styles.premiumIcon}>
                <Ionicons name="star" size={18} color={colors.onAccentOrange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumTitle}>Sei un utente Premium</Text>
                <Text style={styles.premiumSub}>Hai accesso a tutte le funzionalità.</Text>
              </View>
            </View>
            <Pressable onPress={() => setPremium(false)} hitSlop={8} testID="btn-reset-premium">
              <Text style={styles.premiumResetText}>Disattiva Premium (solo test)</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.upsellCard} onPress={showPaywall} testID="btn-open-paywall">
            <View style={styles.premiumIcon}>
              <Ionicons name="star" size={18} color={colors.onAccentOrange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.upsellTitle}>Passa a Premium</Text>
              <Text style={styles.upsellSub}>Sblocca guide, link diretti e calendario scadenze.</Text>
            </View>
            <View style={styles.upsellCta}>
              <Text style={styles.upsellCtaText}>€ 5</Text>
            </View>
          </Pressable>
        )}

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

        <Pressable style={styles.editBtn} onPress={() => router.replace("/intro")} testID="profile-edit">
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
  premiumCard: { backgroundColor: "#FFFBF5", borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accentOrangeLight, gap: spacing.md },
  premiumRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  premiumIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accentOrange, alignItems: "center", justifyContent: "center" },
  premiumTitle: { fontSize: 16, fontWeight: "800", color: colors.onAccentOrangeLight },
  premiumSub: { fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 1 },
  premiumResetText: { fontSize: 12, color: colors.onSurfaceTertiary, fontWeight: "600", textDecorationLine: "underline" },
  upsellCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "#FFFBF5", borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accentOrange },
  upsellTitle: { fontSize: 16, fontWeight: "800", color: colors.onAccentOrangeLight },
  upsellSub: { fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 1, lineHeight: 18 },
  upsellCta: { backgroundColor: colors.accentOrange, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  upsellCtaText: { color: colors.onAccentOrange, fontWeight: "900", fontSize: 16 },
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
