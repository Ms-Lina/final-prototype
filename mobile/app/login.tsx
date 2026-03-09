import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter, Redirect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ registered?: string }>();
  const { user, login, error, clearError, loading: authLoading } = useAuth();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  if (!authLoading && user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      Alert.alert("", "Shyiramo nimero ya telefoni.");
      return;
    }
    setLoading(true);
    clearError();
    try {
      await login(trimmedPhone, pin);
      Alert.alert("Neza!", "Winjiye neza!", [{ text: "OK", onPress: () => router.replace("/(tabs)") }]);
    } catch {
      // error shown via useAuth().error
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: Iterambere + MenyAI */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.xs }}>
            Iterambere
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="book" size={16} color="#fff" />
              </View>
              <Text style={{ fontSize: fontSize.xl, fontWeight: "700", color: colors.foreground }}>MenyAI</Text>
            </View>
          </View>
        </View>

        {/* Green info card with headphones icon on right */}
        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            position: "relative",
          }}
        >
          <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.primaryForeground, marginBottom: spacing.sm }}>
            Injira ubone iterambere ryawe
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: "rgba(255,255,255,0.95)", marginBottom: spacing.lg, lineHeight: 22 }}>
            Kwiga, kumva amajwi, no gukurikirana amasomo yawe.
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                backgroundColor: "rgba(255,255,255,0.2)",
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: borderRadius.md,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.5)",
              }}
            >
              <Ionicons name="play" size={18} color={colors.primaryForeground} />
              <Text style={{ fontSize: fontSize.sm, color: colors.primaryForeground }}>Tega amatwi amabwiriza</Text>
            </TouchableOpacity>
            <Ionicons name="headset" size={48} color="rgba(255,255,255,0.8)" />
          </View>
        </View>

        {/* Steps */}
        <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.sm }}>
          1. Shyiramo nimero ya telefoni
        </Text>
        <Input
          label="Telefoni"
          placeholder="Urugero: 07xx xxx xxx"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          rightIcon={<Ionicons name="volume-high" size={20} color={colors.mutedForeground} />}
          containerStyle={{ marginBottom: spacing.lg }}
        />

        <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.sm }}>
          2. Injiza PIN cyangwa ijambo banga
        </Text>
        <Input
          label="PIN"
          placeholder="Imibare 6"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          rightIcon={<Ionicons name="volume-high" size={20} color={colors.mutedForeground} />}
          containerStyle={{ marginBottom: spacing.lg }}
        />

        {params?.registered === "1" ? (
          <Text style={{ fontSize: fontSize.sm, color: colors.primary, marginBottom: spacing.md }}>
            Wiyandikishije neza. Injira ubu.
          </Text>
        ) : null}
        {error ? (
          <Text style={{ fontSize: fontSize.sm, color: colors.warning, marginBottom: spacing.md }}>
            {error}
          </Text>
        ) : null}

        <Button
          title="Injira"
          onPress={handleLogin}
          loading={loading}
          icon={<Ionicons name="chevron-forward" size={20} color={colors.foreground} />}
          style={{ marginBottom: spacing.md, backgroundColor: colors.accentYellow }}
          textStyle={{ color: colors.foreground }}
        />

        <TouchableOpacity
          onPress={() => router.push("/register")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            paddingVertical: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          <Ionicons name="person-add" size={20} color={colors.foreground} />
          <Text style={{ fontSize: fontSize.sm, color: colors.foreground }}>Uri mushya? </Text>
          <View
            style={{
              backgroundColor: colors.accentYellow,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: borderRadius.sm,
            }}
          >
            <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.foreground }}>
              Tangira wiyandikisha
            </Text>
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.push("/forgot-pin")}>
            <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground }}>Wibagiwe PIN?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/forgot-pin")}>
            <Text style={{ fontSize: fontSize.xs, color: colors.primary, fontWeight: "500" }}>Saba indi PIN</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
