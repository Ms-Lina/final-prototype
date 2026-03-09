import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize } from "@/theme";
import { cardShadow } from "@/lib/shadowStyles";

const TABS = [
  { key: "index", route: "/(tabs)", label: "Ahabanza", icon: "home" as const },
  { key: "lessons", route: "/(tabs)/lessons", label: "Amasomo", icon: "book" as const },
  { key: "progress", route: "/(tabs)/progress", label: "Iterambere", icon: "stats-chart" as const },
  { key: "account", route: "/(tabs)/account", label: "Konti", icon: "person" as const },
] as const;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (route: string) => {
    if (route === "/(tabs)") return pathname === "/(tabs)" || pathname === "/(tabs)/" || pathname.includes("/(tabs)/index");
    return pathname.includes(route);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        paddingBottom: 24,
        paddingHorizontal: 8,
        height: 64,
        ...cardShadow({ offset: { width: 0, height: -2 }, radius: 8 }),
        elevation: 8,
      }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab.route);
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => router.push(tab.route as any)}
            style={{
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: active ? "rgba(45, 155, 95, 0.1)" : "transparent",
            }}
          >
            <Ionicons
              name={tab.icon}
              size={24}
              color={active ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: active ? colors.primary : colors.mutedForeground,
                marginTop: 4,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
