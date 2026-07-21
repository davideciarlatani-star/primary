import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useProfile } from "@/src/ProfileContext";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1580529352977-df08012d92b0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhdGElMjBmaW5hbmNlJTIwZ3JhcGglMjBvcmFuZ2UlMjBibHVlfGVufDB8fHx8MTc4NDY0Mzg5M3ww&ixlib=rb-4.1.0&q=85";

export default function Simulazione() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [income, setIncome] = useState("20000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    if (!profile) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setResult(null);
    try {
      const res = await api.simulate(profile, parseFloat(income) || 0);
      setResult(res);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fmt = (n: number) => new Intl.NumberFormat("it-IT").format(n);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          <LinearGradient colors={["rgba(10,61,115,0.4)", "rgba(26,29,32,0.9)"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroContent, { paddingTop: insets.top + spacing.lg }]}>
            <Text style={styles.heroKicker}>SIMULAZIONE VANTAGGI</Text>
            <Text style={styles.heroTitle}>Quanto guadagni mettendoti in regola?</Text>
            <Text style={styles.heroSub}>Scopri bonus e rimborsi che potresti ottenere dichiarando i tuoi redditi.</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Reddito annuo stimato (lordo)</Text>
            <View style={styles.inputRow}>
              <Text style={styles.euro}>€</Text>
              <TextInput
                style={styles.input}
                value={income}
                onChangeText={setIncome}
                keyboardType="numeric"
                placeholder="20000"
                placeholderTextColor={colors.onSurfaceTertiary}
                testID="sim-income-input"
              />
            </View>
          </View>

          {result && (
            <View testID="sim-result" style={{ gap: spacing.md }}>
              <View style={styles.beforeCard}>
                <View style={styles.beforeHeader}>
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                  <Text style={styles.beforeTitle}>Situazione attuale</Text>
                </View>
                <Text style={styles.beforeText}>{result.current_situation}</Text>
              </View>

              <LinearGradient colors={[colors.brandPrimary, colors.brand]} style={styles.afterCard}>
                <Text style={styles.afterLabel}>Vantaggio annuo stimato</Text>
                <Text style={styles.afterAmount}>€ {fmt(result.estimated_annual_gain)}</Text>
                <Text style={styles.afterHint}>mettendoti in regola ogni anno</Text>
              </LinearGradient>

              {result.breakdown?.length > 0 && (
                <View style={styles.breakdownCard}>
                  <Text style={styles.breakdownTitle}>Come si compone</Text>
                  {result.breakdown.map((b: any, i: number) => (
                    <View key={i} style={styles.breakdownRow}>
                      <View style={styles.dot} />
                      <Text style={styles.breakdownLabel}>{b.label}</Text>
                      <Text style={styles.breakdownAmount}>€ {fmt(b.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.conclusionCard}>
                <Ionicons name="bulb" size={20} color={colors.accentOrange} />
                <Text style={styles.conclusionText}>{result.conclusion}</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable style={styles.cta} onPress={run} disabled={loading} testID="sim-run-btn">
          {loading ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Ionicons name="trending-up" size={20} color={colors.onBrandPrimary} />
              <Text style={styles.ctaText}>{result ? "Ricalcola" : "Avvia simulazione"}</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  hero: { height: 230, justifyContent: "flex-end" },
  heroContent: { padding: spacing.lg },
  heroKicker: { color: colors.accentOrange, fontWeight: "800", letterSpacing: 1, fontSize: 12, marginBottom: spacing.xs },
  heroTitle: { color: "#fff", fontSize: 25, fontWeight: "800", marginBottom: spacing.xs },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20 },
  body: { padding: spacing.lg, gap: spacing.md },
  inputCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  inputLabel: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceSecondary, marginBottom: spacing.sm },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 54 },
  euro: { fontSize: 20, fontWeight: "700", color: colors.onSurfaceTertiary, marginRight: spacing.sm },
  input: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.onSurface },
  beforeCard: { backgroundColor: "#FEF2F2", borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: "#FECACA" },
  beforeHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  beforeTitle: { fontSize: 15, fontWeight: "700", color: colors.error },
  beforeText: { fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20 },
  afterCard: { borderRadius: radius.lg, padding: spacing.xl, alignItems: "center" },
  afterLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "600" },
  afterAmount: { color: "#fff", fontSize: 44, fontWeight: "900", marginVertical: spacing.xs },
  afterHint: { color: colors.accentOrange, fontSize: 13, fontWeight: "700" },
  breakdownCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  breakdownTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.sm },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentOrange },
  breakdownLabel: { flex: 1, fontSize: 14, color: colors.onSurfaceSecondary },
  breakdownAmount: { fontSize: 15, fontWeight: "800", color: colors.success },
  conclusionCard: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.accentOrangeLight, borderRadius: radius.lg, padding: spacing.lg },
  conclusionText: { flex: 1, fontSize: 14, color: colors.onAccentOrangeLight, lineHeight: 20, fontWeight: "500" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md },
  ctaText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "700" },
});
