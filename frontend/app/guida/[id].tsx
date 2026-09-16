import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useProfile } from "@/src/ProfileContext";
import { PremiumLockBanner } from "@/src/components/PremiumLockBanner";
import { colors, spacing, radius } from "@/src/theme";

export default function Guida() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { premium, showPaywall } = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [guide, setGuide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [helpIndex, setHelpIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setGuide(await api.guide(id));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>;
  if (error || !guide) {
    return (
      <View style={styles.center} testID="guide-error">
        <Text style={styles.errText}>Guida non disponibile.</Text>
        <Pressable style={styles.retry} onPress={() => router.back()}><Text style={styles.retryText}>Indietro</Text></Pressable>
      </View>
    );
  }

  const Section = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
    <View style={styles.section} testID={`section-${title}`}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}><Ionicons name={icon as any} size={18} color={colors.brandPrimary} /></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );

  return (
    <View style={styles.container} testID="guide-screen">
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn} testID="guide-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.premiumTag}>
          <Ionicons name="star" size={12} color={colors.onAccentOrange} />
          <Text style={styles.premiumTagText}>PREMIUM</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{guide.title}</Text>
        <Text style={styles.intro}>{guide.intro}</Text>

        <Section icon="folder-open" title="Documenti necessari">
          {guide.documents.map((d: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="document-text-outline" size={16} color={colors.brandPrimary} />
              <Text style={styles.bulletText}>{d}</Text>
            </View>
          ))}
        </Section>

        <Section icon="list" title="Passi per la domanda">
          {guide.steps.map((s: string, i: number) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <View style={styles.stepBody}>
                <Text style={styles.stepText}>{s}</Text>
                {guide.steps_help && (
                  <Pressable style={styles.stuckBtn} onPress={() => setHelpIndex(i)} testID={`stuck-btn-${i}`}>
                    <Ionicons name="help-buoy" size={14} color={colors.accentOrange} />
                    <Text style={styles.stuckBtnText}>Bloccato?</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </Section>

        <Section icon="alert-circle" title="Campi critici da non sbagliare">
          {guide.critical_fields.map((c: any, i: number) => (
            <View key={i} style={styles.critItem}>
              <Text style={styles.critField}>{c.field}</Text>
              <Text style={styles.critNote}>{c.note}</Text>
            </View>
          ))}
        </Section>

        <Section icon="time" title="Scadenze e requisiti">
          {guide.deadlines_requirements.map((r: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.bulletText}>{r}</Text>
            </View>
          ))}
        </Section>

        <Section icon="help-buoy" title="Maggiori informazioni">
          {guide.extra_info.map((e: any, i: number) => (
            <View key={i} style={styles.infoItem}>
              <Text style={styles.infoTitle}>{e.title}</Text>
              <Text style={styles.infoText}>{e.text}</Text>
            </View>
          ))}
        </Section>

        {guide.apply_url ? (
          <Pressable style={styles.cta} onPress={() => Linking.openURL(guide.apply_url)} testID="guide-apply-link">
            <Ionicons name="open-outline" size={20} color={colors.onBrandPrimary} />
            <Text style={styles.ctaText}>Apri la pagina della domanda</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={helpIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpIndex(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setHelpIndex(null)}>
          <Pressable style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}} testID="stuck-modal">
            <View style={styles.modalHandle} />
            {helpIndex !== null && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderIcon}>
                    <Ionicons name="help-buoy" size={18} color={colors.accentOrange} />
                  </View>
                  <Text style={styles.modalTitle}>Aiuto visivo · Passo {helpIndex + 1}</Text>
                  <Pressable onPress={() => setHelpIndex(null)} hitSlop={12} testID="stuck-modal-close">
                    <Ionicons name="close" size={24} color={colors.onSurfaceTertiary} />
                  </Pressable>
                </View>
                <Text style={styles.modalStepText}>{guide.steps[helpIndex]}</Text>

                {premium ? (
                  <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}>
                    {(guide.steps_help[helpIndex]?.images || []).map((img: any, k: number) => (
                      <View key={k} style={styles.imgWrap}>
                        {img.url ? (
                          <Image source={{ uri: img.url }} style={styles.helpImg} contentFit="cover" transition={200} />
                        ) : (
                          <View style={styles.imgPlaceholder} testID={`help-placeholder-${k}`}>
                            <Ionicons name="image-outline" size={34} color={colors.onSurfaceTertiary} />
                            <Text style={styles.imgPlaceholderTag}>Immagine in arrivo</Text>
                          </View>
                        )}
                        <Text style={styles.imgCaption}>{img.caption}</Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <PremiumLockBanner
                    testID="stuck-premium-lock"
                    style={{ marginTop: spacing.md }}
                    onPress={() => { setHelpIndex(null); showPaywall(); }}
                  />
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary },
  errText: { fontSize: 16, color: colors.onSurfaceSecondary },
  retry: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  retryText: { color: colors.onBrandPrimary, fontWeight: "700" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  premiumTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accentOrange, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  premiumTagText: { color: colors.onAccentOrange, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  intro: { fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 21 },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  sectionIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, flex: 1 },
  bullet: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  bulletText: { flex: 1, fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20 },
  stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 13 },
  stepBody: { flex: 1, gap: spacing.sm },
  stepText: { fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20, paddingTop: 2 },
  stuckBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: colors.accentOrangeLight, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  stuckBtnText: { color: colors.onAccentOrangeLight, fontWeight: "800", fontSize: 12 },
  critItem: { backgroundColor: "#FFFBF5", borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.accentOrange },
  critField: { fontSize: 14, fontWeight: "800", color: colors.onAccentOrangeLight },
  critNote: { fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 19, marginTop: 2 },
  infoItem: { gap: 2 },
  infoTitle: { fontSize: 14, fontWeight: "700", color: colors.brand },
  infoText: { fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 19, marginBottom: spacing.xs },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md, marginTop: spacing.sm },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(10,29,44,0.55)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.sm },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modalHeaderIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.accentOrangeLight, alignItems: "center", justifyContent: "center" },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.onSurface },
  modalStepText: { fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20, marginTop: spacing.xs },
  imgWrap: { gap: spacing.xs },
  helpImg: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  imgPlaceholder: { width: "100%", height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1.5, borderColor: colors.borderStrong, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  imgPlaceholderTag: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceTertiary },
  imgCaption: { fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 18 },
});
