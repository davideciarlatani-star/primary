import { View, Text, Pressable, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useProfile } from "@/src/ProfileContext";
import { colors, spacing, radius } from "@/src/theme";

export function PremiumLockBanner({
  testID,
  style,
  onPress,
}: {
  testID?: string;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { showPaywall } = useProfile();
  const handle = onPress ?? showPaywall;
  return (
    <Pressable style={[styles.banner, style]} onPress={handle} testID={testID}>
      <View style={styles.icon}>
        <Ionicons name="lock-closed" size={18} color={colors.onAccentOrange} />
      </View>
      <View style={{ flex: 1 }} />
      <View style={styles.cta}>
        <Text style={styles.ctaText}>Passa a Premium</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.accentOrangeLight, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.accentOrange },
  icon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accentOrange, alignItems: "center", justifyContent: "center" },
  cta: { backgroundColor: colors.accentOrange, paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill },
  ctaText: { color: colors.onAccentOrange, fontWeight: "800", fontSize: 13 },
});
