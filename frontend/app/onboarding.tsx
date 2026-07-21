import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useProfile } from "@/src/ProfileContext";
import { colors, spacing, radius } from "@/src/theme";
import {
  Profile, DEFAULT_PROFILE, AGE_RANGES, EMPLOYMENTS, ISEE_RANGES, REGIONS,
} from "@/src/types";

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saveProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>({ ...DEFAULT_PROFILE });

  const set = (patch: Partial<Profile>) => setP((prev) => ({ ...prev, ...patch }));
  const totalSteps = 7;

  const next = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < totalSteps - 1) setStep(step + 1);
    else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await saveProfile(p);
      router.replace("/(tabs)");
    }
  };
  const back = () => (step > 0 ? setStep(step - 1) : router.back());

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={back} hitSlop={12} testID="onboarding-back" style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 && (
          <Question title="Qual è la tua fascia d'età?" subtitle="Alcune agevolazioni sono legate all'età.">
            {AGE_RANGES.map((a) => (
              <Choice key={a} label={`${a} anni`} selected={p.age_range === a} onPress={() => set({ age_range: a })} testID={`age-${a}`} />
            ))}
          </Question>
        )}

        {step === 1 && (
          <Question title="La tua situazione lavorativa" subtitle="Ci aiuta a filtrare bonus e indennità.">
            {EMPLOYMENTS.map((e) => (
              <Choice key={e.key} label={e.label} selected={p.employment === e.key} onPress={() => set({ employment: e.key, has_filed: e.key === "mai_dichiarato" ? false : p.has_filed })} testID={`emp-${e.key}`} />
            ))}
          </Question>
        )}

        {step === 2 && (
          <Question title="La tua fascia ISEE" subtitle="Molti aiuti dipendono dall'indicatore ISEE.">
            {ISEE_RANGES.map((i) => (
              <Choice key={i.key} label={i.label} selected={p.isee_range === i.key} onPress={() => set({ isee_range: i.key })} testID={`isee-${i.key}`} />
            ))}
          </Question>
        )}

        {step === 3 && (
          <Question title="Il tuo nucleo familiare" subtitle="Inserisci i dati essenziali della famiglia.">
            <Counter label="Persone nel nucleo" value={p.household_size} min={1} onChange={(v) => set({ household_size: v })} testID="counter-household" />
            <Counter label="Figli a carico" value={p.children} min={0} onChange={(v) => set({ children: v, children_under_3: Math.min(p.children_under_3, v) })} testID="counter-children" />
            {p.children > 0 && (
              <Counter label="Di cui sotto i 3 anni" value={p.children_under_3} min={0} max={p.children} onChange={(v) => set({ children_under_3: v })} testID="counter-under3" />
            )}
          </Question>
        )}

        {step === 4 && (
          <Question title="La tua abitazione" subtitle="Serve per detrazioni casa e affitto.">
            <Toggle label="Sono proprietario di casa" value={p.home_owner} onPress={() => set({ home_owner: !p.home_owner })} testID="toggle-owner" />
            <Toggle label="Vivo in affitto" value={p.renting} onPress={() => set({ renting: !p.renting })} testID="toggle-renting" />
            <Toggle label="Disabilità nel nucleo" value={p.disability} onPress={() => set({ disability: !p.disability })} testID="toggle-disability" />
          </Question>
        )}

        {step === 5 && (
          <Question title="Hai mai presentato dichiarazioni dei redditi?" subtitle="Sii sincero: sblocca la simulazione dei vantaggi.">
            <Choice label="Sì, dichiaro regolarmente" selected={p.has_filed} onPress={() => set({ has_filed: true })} testID="filed-yes" />
            <Choice label="No, non ho mai dichiarato" selected={!p.has_filed} onPress={() => set({ has_filed: false })} testID="filed-no" />
          </Question>
        )}

        {step === 6 && (
          <Question title="La tua regione" subtitle="Ultimo passo per personalizzare i risultati.">
            <View style={styles.regionGrid}>
              {REGIONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => set({ region: r })}
                  style={[styles.regionChip, p.region === r && styles.regionChipActive]}
                  testID={`region-${r}`}
                >
                  <Text style={[styles.regionText, p.region === r && styles.regionTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>
          </Question>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable style={styles.cta} onPress={next} testID="onboarding-next">
          <Text style={styles.ctaText}>{step === totalSteps - 1 ? "Scopri i tuoi bonus" : "Continua"}</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Question({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.qTitle}>{title}</Text>
      <Text style={styles.qSubtitle}>{subtitle}</Text>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

function Choice({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable style={[styles.choice, selected && styles.choiceActive]} onPress={onPress} testID={testID}>
      <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} />}
    </Pressable>
  );
}

function Counter({ label, value, min = 0, max = 20, onChange, testID }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void; testID: string }) {
  return (
    <View style={styles.counterRow} testID={testID}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterCtrls}>
        <Pressable style={styles.counterBtn} onPress={() => onChange(Math.max(min, value - 1))} testID={`${testID}-minus`}>
          <Ionicons name="remove" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable style={styles.counterBtn} onPress={() => onChange(Math.min(max, value + 1))} testID={`${testID}-plus`}>
          <Ionicons name="add" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({ label, value, onPress, testID }: { label: string; value: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable style={[styles.choice, value && styles.choiceActive]} onPress={onPress} testID={testID}>
      <Text style={[styles.choiceText, value && styles.choiceTextActive]}>{label}</Text>
      <Ionicons name={value ? "checkbox" : "square-outline"} size={22} color={value ? colors.brandPrimary : colors.onSurfaceTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  progressTrack: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accentOrange },
  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"] },
  qTitle: { fontSize: 26, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.xs },
  qSubtitle: { fontSize: 15, color: colors.onSurfaceTertiary, marginBottom: spacing.xl, lineHeight: 21 },
  choice: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 56,
  },
  choiceActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  choiceText: { fontSize: 16, color: colors.onSurface, fontWeight: "500", flex: 1 },
  choiceTextActive: { color: colors.brand, fontWeight: "700" },
  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  counterLabel: { fontSize: 16, color: colors.onSurface, flex: 1, fontWeight: "500" },
  counterCtrls: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  counterBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  counterValue: { fontSize: 18, fontWeight: "700", color: colors.onSurface, minWidth: 28, textAlign: "center" },
  regionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  regionChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  regionChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  regionText: { fontSize: 14, color: colors.onSurfaceSecondary },
  regionTextActive: { color: colors.onBrandPrimary, fontWeight: "700" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md,
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "700" },
});
