import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useProfile } from "@/src/ProfileContext";
import { PremiumLockBanner } from "@/src/components/PremiumLockBanner";
import { colors, spacing, radius, categoryColors } from "@/src/theme";
import { Bonus } from "@/src/types";

export default function BonusDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { premium, profile, showPaywall } = useProfile();
  const [bonus, setBonus] = useState<Bonus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setBonus(profile ? await api.bonusDetail(id, profile) : await api.bonus(id));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, profile]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>;
  }
  if (error || !bonus) {
    return (
      <View style={styles.center} testID="detail-error">
        <Text style={styles.errorText}>Bonus non trovato.</Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}><Text style={styles.retryText}>Indietro</Text></Pressable>
      </View>
    );
  }

  const cat = categoryColors[bonus.category] || colors.brandPrimary;
  const d = new Date(bonus.deadline + "T00:00:00");
  const notEligible = bonus.eligible === false;

  const openGoogleCalendar = () => {
    const start = bonus.deadline.replace(/-/g, "");
    const endDate = new Date(bonus.deadline + "T00:00:00");
    endDate.setDate(endDate.getDate() + 1);
    const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}`;
    const text = encodeURIComponent(`Scadenza: ${bonus.name}`);
    const details = encodeURIComponent(`Scadenza per la domanda di "${bonus.name}".\n${bonus.deadline_note}\n\nConsiglio: imposta un promemoria 30 giorni prima nelle notifiche dell'evento.`);
    Linking.openURL(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`);
  };

  const InfoBlock = ({ icon, title, text }: { icon: string; title: string; text: string }) => (
    <View style={styles.block} testID={`block-${title}`}>
      <View style={styles.blockHeader}>
        <Ionicons name={icon as any} size={18} color={colors.brandPrimary} />
        <Text style={styles.blockTitle}>{title}</Text>
      </View>
      <Text style={styles.blockText}>{text}</Text>
    </View>
  );

  return (
    <View style={styles.container} testID="bonus-detail">
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn} testID="detail-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md }} showsVerticalScrollIndicator={false}>
        {notEligible && (
          <View style={styles.blockedBanner} testID="detail-blocked-banner">
            <View style={styles.blockedIcon}>
              <Ionicons name="close-circle" size={22} color={colors.onError} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockedTitle}>Non puoi richiedere questo bonus</Text>
              <Text style={styles.blockedText}>{bonus.requirement}</Text>
            </View>
          </View>
        )}

        <View style={[styles.iconLarge, { backgroundColor: cat + "1A" }]}>
          <Ionicons name={bonus.icon as any} size={30} color={cat} />
        </View>
        <Text style={[styles.catTag, { color: cat }]}>{bonus.category}</Text>
        <Text style={styles.title}>{bonus.name}</Text>
        {bonus.region_scope && bonus.region_scope !== "Nazionale" && (
          <View style={styles.regionBadge} testID="detail-region">
            <Ionicons name="location" size={14} color={colors.onAccentOrangeLight} />
            <Text style={styles.regionBadgeText}>{bonus.region_scope}</Text>
          </View>
        )}

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Importo</Text>
          <Text style={styles.amountValue}>{bonus.amount}</Text>
        </View>

        {bonus.eligible && (
          <View style={styles.eligibleBadge}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.eligibleText}>{bonus.why}</Text>
          </View>
        )}

        {bonus.has_guide && (
          premium ? (
            <Pressable style={styles.guideBtn} onPress={() => router.push(`/guida/${bonus.id}`)} testID="btn-request-bonus">
              <Ionicons name="reader" size={20} color={colors.onBrandPrimary} />
              <Text style={styles.guideBtnText}>Voglio richiedere questo bonus</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.guideLock} onPress={showPaywall} testID="btn-request-bonus-locked">
              <View style={styles.lockIcon}>
                <Ionicons name="lock-closed" size={18} color={colors.onAccentOrange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideLockTitle}>Guida passo-passo · Premium</Text>
                <Text style={styles.guideLockText}>{"Passa a Premium per sbloccare la guida completa alla domanda."}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.onAccentOrangeLight} />
            </Pressable>
          )
        )}

        <InfoBlock icon="information-circle" title="Descrizione" text={bonus.description} />
        <View style={styles.block} testID="block-scadenza">
          <View style={styles.blockHeader}>
            <Ionicons name="calendar" size={18} color={colors.brandPrimary} />
            <Text style={styles.blockTitle}>Scadenza</Text>
          </View>
          <Text style={styles.blockText}>{`${d.toLocaleDateString("it-IT")} — ${bonus.deadline_note}`}</Text>

          {premium ? (
            <Pressable style={styles.calBtn} onPress={openGoogleCalendar} testID="detail-gcal-btn">
              <Ionicons name="logo-google" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.calBtnText}>Aggiungi a Google Calendar</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.calBtnFree} onPress={showPaywall} testID="detail-gcal-btn-locked">
              <Ionicons name="logo-google" size={18} color={colors.brandPrimary} />
              <Text style={styles.calBtnFreeText}>Aggiungi a Google Calendar</Text>
              <Ionicons name="lock-closed" size={15} color={colors.accentOrange} />
            </Pressable>
          )}
        </View>

        {bonus.declaration && (
          <InfoBlock icon="clipboard" title="Dichiarazione necessaria" text={bonus.declaration} />
        )}

        <View style={styles.block} testID="block-how">
          <View style={styles.blockHeader}>
            <Ionicons name="document-text" size={18} color={colors.brandPrimary} />
            <Text style={styles.blockTitle}>Come richiederlo</Text>
          </View>
          <Text style={styles.blockText}>{bonus.how}</Text>
          {premium ? (
            bonus.apply_url ? (
              <Pressable
                style={styles.linkBtn}
                onPress={() => Linking.openURL(bonus.apply_url!)}
                testID="detail-apply-link"
              >
                <Ionicons name="open-outline" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.linkBtnText}>Vai alla pagina della domanda</Text>
              </Pressable>
            ) : (
              <View style={styles.noteBox} testID="detail-apply-note">
                <Ionicons name="people" size={16} color={colors.brandPrimary} />
                <Text style={styles.noteText}>{bonus.apply_note || "Richiesta tramite CAF, patronato o sportello dedicato."}</Text>
              </View>
            )
          ) : (
            <PremiumLockBanner testID="detail-premium-lock" style={{ marginTop: spacing.md }} />
          )}
        </View>

        <InfoBlock icon="business" title="Ente erogatore" text={bonus.source} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary },
  errorText: { fontSize: 16, color: colors.onSurfaceSecondary },
  retryBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  retryText: { color: colors.onBrandPrimary, fontWeight: "700" },
  topBar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surfaceSecondary },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  iconLarge: { width: 64, height: 64, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  catTag: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  amountCard: { backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.lg },
  amountLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  amountValue: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2 },
  eligibleBadge: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#ECFDF5", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: "#A7F3D0" },
  eligibleText: { flex: 1, fontSize: 14, color: "#065F46", fontWeight: "500", lineHeight: 19 },
  blockedBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "#FEF2F2", borderRadius: radius.md, padding: spacing.md, borderWidth: 1.5, borderColor: colors.error },
  blockedIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  blockedTitle: { fontSize: 15, fontWeight: "800", color: "#991B1B" },
  blockedText: { fontSize: 13, color: "#991B1B", lineHeight: 18, marginTop: 2 },
  calBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, height: 48, borderRadius: radius.md, marginTop: spacing.md },
  calBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 },
  calBtnFree: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, height: 48, borderRadius: radius.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  calBtnFreeText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 15 },
  block: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  blockTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  blockText: { fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 21 },
  regionBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: colors.accentOrangeLight, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  regionBadgeText: { color: colors.onAccentOrangeLight, fontWeight: "700", fontSize: 12 },
  linkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, height: 48, borderRadius: radius.md, marginTop: spacing.md },
  linkBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 },
  noteBox: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  noteText: { flex: 1, fontSize: 13, color: colors.onBrandTertiary, lineHeight: 19, fontWeight: "500" },
  guideBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md },
  guideBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
  guideLock: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.accentOrangeLight, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.accentOrange },
  lockIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accentOrange, alignItems: "center", justifyContent: "center" },
  guideLockTitle: { fontSize: 14, fontWeight: "800", color: colors.onAccentOrangeLight },
  guideLockText: { fontSize: 12, color: colors.onAccentOrangeLight, lineHeight: 16, marginTop: 1 },
});
