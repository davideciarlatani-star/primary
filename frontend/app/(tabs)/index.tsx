import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useProfile } from "@/src/ProfileContext";
import { api } from "@/src/api";
import { colors, spacing, radius, categoryColors } from "@/src/theme";
import { Bonus } from "@/src/types";

const HERO = "https://images.pexels.com/photos/14479388/pexels-photo-14479388.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const [eligible, setEligible] = useState<Bonus[]>([]);
  const [others, setOthers] = useState<Bonus[]>([]);
  const [ai, setAi] = useState<any>(null);
  const [aiOpen, setAiOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(false);
    try {
      const data = await api.match(profile);
      setEligible(data.eligible);
      setOthers(data.others);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const runAi = async () => {
    if (!profile) return;
    setAiLoading(true);
    try {
      const res = await api.suggest(profile);
      setAi(res);
    } catch { /* ignore */ }
    finally { setAiLoading(false); }
  };

  if (loading) {
    return (
      <View style={styles.center} testID="home-loading">
        <ActivityIndicator size="large" color={colors.brandPrimary} />
        <Text style={styles.loadingText}>Calcolo dei requisiti...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center} testID="home-error">
        <Ionicons name="cloud-offline" size={48} color={colors.onSurfaceTertiary} />
        <Text style={styles.errorText}>Errore di connessione. Riprova.</Text>
        <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); load(); }} testID="home-retry">
          <Text style={styles.retryText}>Riprova</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="home-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          <LinearGradient colors={["rgba(10,61,115,0.35)", "rgba(10,61,115,0.92)"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroContent, { paddingTop: insets.top + spacing.lg }]}>
            <Text style={styles.heroKicker}>BonusRadar</Text>
            <Text style={styles.heroTitle}>{eligible.length} aiuti disponibili per te</Text>
            <Text style={styles.heroSub}>Bonus, detrazioni e rimborsi statali su misura per il tuo profilo.</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* AI card */}
          <View style={styles.aiCard} testID="ai-card">
            <View style={styles.aiHeader}>
              <View style={styles.aiIcon}>
                <Ionicons name="sparkles" size={18} color={colors.accentOrange} />
              </View>
              <Text style={styles.aiTitle}>Assistente AI</Text>
              {ai && (
                <Pressable onPress={() => setAiOpen((v) => !v)} hitSlop={10} style={styles.aiToggle} testID="ai-toggle">
                  <Ionicons name={aiOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.onSurfaceTertiary} />
                </Pressable>
              )}
            </View>
            {ai ? (
              aiOpen ? (
                <>
                  <Text style={styles.aiHeadline}>{ai.headline}</Text>
                  <Text style={styles.aiSummary}>{ai.summary}</Text>
                  {ai.tips?.map((t: string, i: number) => (
                    <View key={i} style={styles.tipRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={styles.tipText}>{t}</Text>
                    </View>
                  ))}
                  {ai.priority && (
                    <View style={styles.priorityBadge}>
                      <Ionicons name="flag" size={14} color={colors.onWarning} />
                      <Text style={styles.priorityText}>Priorità: {ai.priority}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Pressable onPress={() => setAiOpen(true)} testID="ai-reopen">
                  <Text style={styles.aiHeadlineCollapsed} numberOfLines={1}>{ai.headline}</Text>
                  <Text style={styles.aiCollapsedHint}>{"Tocca per rivedere l'analisi"}</Text>
                </Pressable>
              )
            ) : (
              <>
                <Text style={styles.aiSummary}>{"Ricevi un'analisi personalizzata e consigli su come massimizzare i tuoi aiuti."}</Text>
                <Pressable style={styles.aiBtn} onPress={runAi} disabled={aiLoading} testID="ai-suggest-btn">
                  {aiLoading ? (
                    <ActivityIndicator color={colors.onBrandPrimary} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color={colors.onBrandPrimary} />
                      <Text style={styles.aiBtnText}>Scopri i tuoi bonus</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>

          <Text style={styles.sectionTitle}>Hai diritto a</Text>
          {eligible.length === 0 ? (
            <View style={styles.emptyBox} testID="home-empty">
              <Ionicons name="folder-open-outline" size={40} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>Nessun bonus rilevato. Aggiorna il tuo profilo per scoprire nuove agevolazioni.</Text>
            </View>
          ) : (
            eligible.map((b) => <BonusCard key={b.id} bonus={b} onPress={() => router.push(`/bonus/${b.id}`)} />)
          )}

          {others.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Altri aiuti disponibili</Text>
              {others.map((b) => <BonusCard key={b.id} bonus={b} muted onPress={() => router.push(`/bonus/${b.id}`)} />)}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export function BonusCard({ bonus, onPress, muted }: { bonus: Bonus; onPress: () => void; muted?: boolean }) {
  const cat = categoryColors[bonus.category] || colors.brandPrimary;
  return (
    <Pressable style={[styles.card, muted && styles.cardMuted]} onPress={onPress} testID={`bonus-card-${bonus.id}`}>
      <View style={[styles.cardIcon, { backgroundColor: cat + "1A" }]}>
        <Ionicons name={bonus.icon as any} size={22} color={cat} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.catTag, { color: cat }]}>{bonus.category}</Text>
        </View>
        <Text style={styles.cardTitle}>{bonus.name}</Text>
        <Text style={styles.cardShort} numberOfLines={2}>{bonus.short}</Text>
        {muted ? (
          <View style={styles.reasonRow}>
            <Ionicons name="lock-closed" size={13} color={colors.onSurfaceTertiary} />
            <Text style={styles.reasonText} numberOfLines={2}>{bonus.requirement}</Text>
          </View>
        ) : (
          <Text style={styles.cardAmount}>{bonus.amount}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, gap: spacing.md, padding: spacing.xl },
  loadingText: { color: colors.onSurfaceTertiary, fontSize: 15 },
  errorText: { color: colors.onSurfaceSecondary, fontSize: 16, textAlign: "center" },
  retryBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  retryText: { color: colors.onBrandPrimary, fontWeight: "700" },
  hero: { height: 240, justifyContent: "flex-end" },
  heroContent: { padding: spacing.lg },
  heroKicker: { color: colors.accentOrange, fontWeight: "800", letterSpacing: 1, marginBottom: spacing.xs, fontSize: 13 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "800", marginBottom: spacing.xs },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20 },
  body: { padding: spacing.lg, gap: spacing.md },
  aiCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  aiIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.accentOrangeLight, alignItems: "center", justifyContent: "center" },
  aiTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  aiToggle: { marginLeft: "auto", width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  aiHeadlineCollapsed: { fontSize: 15, fontWeight: "700", color: colors.brand, marginTop: spacing.xs },
  aiCollapsedHint: { fontSize: 12, color: colors.onSurfaceTertiary, marginTop: 2 },
  aiHeadline: { fontSize: 18, fontWeight: "800", color: colors.brand, marginTop: spacing.xs },
  aiSummary: { fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20 },
  tipRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginTop: spacing.xs },
  tipText: { flex: 1, fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 18 },
  priorityBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.warning, alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.sm },
  priorityText: { color: colors.onWarning, fontWeight: "700", fontSize: 12 },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, height: 48, borderRadius: radius.md, marginTop: spacing.sm },
  aiBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.xs },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardMuted: { opacity: 0.62 },
  cardIcon: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  cardTopRow: { flexDirection: "row", marginBottom: 2 },
  catTag: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  cardShort: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2, lineHeight: 18 },
  cardAmount: { fontSize: 14, fontWeight: "800", color: colors.success, marginTop: spacing.xs },
  reasonRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: spacing.xs },
  reasonText: { flex: 1, fontSize: 12, color: colors.onSurfaceTertiary, fontStyle: "italic", lineHeight: 16 },
  emptyBox: { alignItems: "center", gap: spacing.md, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emptyText: { textAlign: "center", color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 20 },
});
