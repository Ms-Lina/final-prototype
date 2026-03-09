import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

export default function RegisterScreen() {
  const router = useRouter();
  const { user, register: doRegister, error, clearError, loading: authLoading } = useAuth();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  if (!authLoading && user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleRegister = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      Alert.alert("", "Shyiramo nimero ya telefoni.");
      return;
    }
    setLoading(true);
    clearError();
    try {
      await doRegister(trimmedPhone, name.trim(), pin);
      Alert.alert("Neza!", "Wiyandikishije neza. Injira ubu.", [
        { text: "OK", onPress: () => router.replace({ pathname: "/login", params: { registered: "1" } }) },
      ]);
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
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: spacing.lg }}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={{ fontSize: fontSize["2xl"], fontWeight: "700", color: colors.foreground, marginBottom: spacing.xs }}>
          Kwiyandikisha
        </Text>
        <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.lg }}>
          Shyiramo amakuru ukeneye kugira ngo utangire kwiga
        </Text>

        <Input
          label="Amazina"
          placeholder="Urugero: Alice"
          value={name}
          onChangeText={setName}
          containerStyle={{ marginBottom: spacing.md }}
        />
        <Input
          label="Nimero ya telefoni"
          placeholder="+250 7xx xxx xxx"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          containerStyle={{ marginBottom: spacing.md }}
        />

        <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.sm }}>
          PIN (imibare 6)
        </Text>
        <Input
          label="PIN"
          placeholder="Imibare 6"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          containerStyle={{ marginBottom: spacing.lg }}
        />

        <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground, marginBottom: spacing.md }}>
          Uzahabwa PIN nshya ku telefoni yawe nyuma yo kwiyandikisha.
        </Text>

        {error ? (
          <Text style={{ fontSize: fontSize.sm, color: colors.warning, marginBottom: spacing.md }}>
            {error}
          </Text>
        ) : null}

        <Button
          title="Emeza imyirondoro"
          onPress={handleRegister}
          loading={loading}
          style={{ marginBottom: spacing.md }}
        />

        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: "center", flexDirection: "row", justifyContent: "center", gap: spacing.sm }}>
          <Text style={{ fontSize: fontSize.sm, color: colors.foreground }}>Usanzwemo?</Text>
          <View style={{ backgroundColor: colors.accentYellow, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.foreground }}>Injirira hano</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
