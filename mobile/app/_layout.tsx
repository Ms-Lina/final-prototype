import { View } from "react-native";
import { Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const segments = useSegments();
  const isInTabs = segments[0] === "(tabs)";
  const showBottomNav = isInTabs;

  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
        {showBottomNav && <BottomNav />}
      </View>
    </AuthProvider>
  );
}
