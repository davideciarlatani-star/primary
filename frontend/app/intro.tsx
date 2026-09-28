import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { storage } from "@/src/utils/storage";
import { colors, spacing, radius } from "@/src/theme";

const SEEN_KEY = "bonusradar_intro_seen";

type Slide = {
  key: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  footnote?: string;
};

const SLIDES: Slide[] = [
  {
    key: "radar",
    icon: "scan-circle",
    iconColor: colors.brandPrimary,
    iconBg: colors.brandTertiary,
    title: "Un radar per i tuoi diritti",
    body: "BonusRadar scandaglia aiuti, bonus, detrazioni e rimborsi dello Stato e ti mostra solo quelli a cui hai davvero diritto, in base alla tua situazione. E ti avvisa prima delle scadenze.",
  },
  {
    key: "privacy",
    icon: "shield-checkmark",
    iconColor: colors.success,
    iconBg: "#ECFDF5",
    title: "I tuoi dati restano privati",
    body: "I dati che inserisci non vengono diffusi né condivisi con nessuno. Puoi modificarli in qualsiasi momento e sono auto-certificati da te: nessuna verifica esterna è richiesta.",
    footnote: "BonusRadar è uno strumento informativo: non sostituisce la consulenza di un professionista.",
  },
  {
    key: "start",
    icon: "rocket",
    iconColor: colors.accentOrange,
    iconBg: colors.accentOrangeLight,
    title: "Siamo pronti, iniziamo!",
    body: "Combinando i dati riusciremo a trovare i bonus specifici per te, sei pronto a scoprirli?",
  },
];

export default function Intro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const finish = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await storage.setItem(SEEN_KEY, true);
    router.replace("/onboarding");
  };

  const goNext = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (last) {
      await finish();
      return;
    }
    setIndex(index + 1);
  };

  return (
    <View style={styles.container} testID="intro-screen">
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={finish} hitSlop={12} testID="intro-skip">
          <Text style={styles.skip}>Salta</Text>
        </Pressable>
      </View>

      <View style={styles.slide} testID={`intro-slide-${slide.key}`}>
        <View style={[styles.iconCircle, { backgroundColor: slide.iconBg }]}>
          <Ionicons name={slide.icon as any} size={44} color={slide.iconColor} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
        {!!slide.footnote && <Text style={styles.footnote}>{slide.footnote}</Text>}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable style={styles.cta} onPress={goNext} testID="intro-next">
          <Text style={styles.ctaText}>{last ? "Iniziamo" : "Continua"}</Text>
          <Ionicons
            name={last ? "checkmark" : "arrow-forward"}
            size={20}
            color={colors.onBrandPrimary}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  topBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  skip: { fontSize: 15, fontWeight: "600", color: colors.onSurfaceTertiary },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing["2xl"] },
  iconCircle: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center", marginBottom: spacing["2xl"] },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, textAlign: "center", marginBottom: spacing.md },
  body: { fontSize: 16, color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 24 },
  footnote: { fontSize: 12, color: colors.onSurfaceTertiary, textAlign: "center", marginTop: spacing.lg, fontStyle: "italic" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, gap: spacing.lg },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  dotActive: { width: 24, backgroundColor: colors.accentOrange },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md,
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "700" },
});
