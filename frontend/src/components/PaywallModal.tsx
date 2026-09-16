import { Modal, View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "@/src/theme";

const BENEFITS = [
  "Guide passo-passo dettagliate per ogni bonus",
  "Link diretti alle domande online degli enti",
  "Calendario delle scadenze con promemoria",
  "Funzionalità avanzate e aggiornamenti futuri",
];

export function PaywallModal({
  visible,
  onClose,
  onPurchase,
}: {
  visible: boolean;
  onClose: () => void;
  onPurchase: () => void;
}) {
  const { height } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, { height: Math.min(height * 0.72, 640) }]}
          onPress={() => {}}
          testID="paywall-modal"
        >
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12} testID="paywall-close">
            <Ionicons name="close" size={22} color={colors.onSurfaceSecondary} />
          </Pressable>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.badge}>
              <Ionicons name="star" size={30} color={colors.onAccentOrange} />
            </View>
            <Text style={styles.title}>Passa a Premium</Text>
            <Text style={styles.subtitle}>
              Sblocca tutti gli strumenti per non perdere nemmeno un aiuto a cui hai diritto.
            </Text>

            <View style={styles.benefits}>
              {BENEFITS.map((b) => (
                <View key={b} style={styles.benefitRow}>
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark" size={15} color={colors.onSuccess} />
                  </View>
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>

            <View style={styles.priceBox}>
              <Text style={styles.price}>€ 5</Text>
              <Text style={styles.priceNote}>una tantum · nessun abbonamento</Text>
            </View>
          </ScrollView>

          <Pressable style={styles.buyBtn} onPress={onPurchase} testID="paywall-buy">
            <Ionicons name="lock-open" size={18} color={colors.onAccentOrange} />
            <Text style={styles.buyText}>Acquista ora</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(10,29,44,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: { width: "100%", maxWidth: 440, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, paddingTop: spacing["2xl"] },
  closeBtn: { position: "absolute", top: spacing.md, right: spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", zIndex: 2 },
  content: { alignItems: "center", gap: spacing.md, paddingBottom: spacing.lg },
  badge: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.accentOrange, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.onSurfaceSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: spacing.sm },
  benefits: { alignSelf: "stretch", gap: spacing.md, marginTop: spacing.sm },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  checkIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, fontSize: 14, color: colors.onSurface, lineHeight: 19, fontWeight: "500" },
  priceBox: { alignItems: "center", marginTop: spacing.md, gap: 2 },
  price: { fontSize: 34, fontWeight: "900", color: colors.brand },
  priceNote: { fontSize: 13, color: colors.onSurfaceTertiary },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.accentOrange, height: 54, borderRadius: radius.md, marginTop: spacing.sm },
  buyText: { color: colors.onAccentOrange, fontWeight: "800", fontSize: 17 },
});
