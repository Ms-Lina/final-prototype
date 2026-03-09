import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { colors, spacing, fontSize, borderRadius } from "@/theme";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { cardShadow } from "@/lib/shadowStyles";
import { copy } from "@/lib/copy";

type FeaturedLesson = { id: string; title: string; description?: string } | null;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userName = user?.displayName?.trim() || "";
  const [progress, setProgress] = useState<{ completedLessons: number; totalLessons: number; streakDays: number; remainingLessons: number } | null>(null);
  const [featuredLesson, setFeaturedLesson] = useState<FeaturedLesson>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) {
      setProgress(null);
      setFeaturedLesson(null);
      setLoading(false);
      return;
    }
    const token = await user.getIdToken();
    const [p, history, lessonsList] = await Promise.all([
      api.getProgress(token),
      api.getLessonHistory(token),
      api.getLessons(token),
    ]);
    if (p) {
      setProgress({
        completedLessons: p.completedLessons,
        totalLessons: p.totalLessons,
        streakDays: p.streakDays,
        remainingLessons: p.remainingLessons ?? Math.max(0, p.totalLessons - p.completedLessons),
      });
    } else {
      setProgress({ completedLessons: 0, totalLessons: 0, streakDays: 0, remainingLessons: 0 });
    }
    const completedIds = new Set((history ?? []).filter((h) => h.passed).map((h) => h.lessonId));
    const sorted = [...(lessonsList ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const next = sorted.find((l) => !completedIds.has(l.id)) ?? sorted[0] ?? null;
    if (next) {
      const desc =
        (next as any).description ??
        (next as any).summary ??
        (Array.isArray((next as any).learningObjectives) ? (next as any).learningObjectives[0] : undefined);
      setFeaturedLesson({ id: next.id, title: next.title, description: desc });
    } else {
      setFeaturedLesson(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProgress(null);
      setFeaturedLesson(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadData();
  }, [user?.uid, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading && progress === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, marginTop: spacing.md }}>{copy.common.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Top Bar - Greeting + Profile icon */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.lg,
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View>
            <Text style={{ fontSize: fontSize["2xl"], fontWeight: "700", color: colors.foreground }}>
              {copy.home.greeting(userName || undefined)}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 }}>
              {copy.home.encouragement}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/account")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.accentOrange,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
              {userName ? userName.charAt(0).toUpperCase() : "?"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Featured Lesson Card - data from backend (next or first lesson) */}
        <TouchableOpacity
          onPress={() => (featuredLesson ? router.push(`/lesson/${featuredLesson.id}` as any) : router.push("/(tabs)/lessons"))}
          style={{
            backgroundColor: colors.primary,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons name="locate" size={20} color="#fff" />
            <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: "#fff" }}>
              {copy.home.featuredLessonTitle}
            </Text>
          </View>
          <Text style={{ fontSize: fontSize.sm, color: "rgba(255,255,255,0.95)", marginBottom: featuredLesson?.description ? spacing.sm : spacing.md, lineHeight: 22 }}>
            {featuredLesson?.title ?? copy.home.noFeaturedLesson}
          </Text>
          {featuredLesson?.description ? (
            <Text style={{ fontSize: fontSize.xs, color: "rgba(255,255,255,0.9)", marginBottom: spacing.md, lineHeight: 20 }}>
              {featuredLesson.description}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              featuredLesson ? router.push(`/lesson/${featuredLesson.id}` as any) : router.push("/(tabs)/lessons");
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: "#fff",
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: borderRadius.md,
              alignSelf: "flex-start",
            }}
          >
            <Ionicons name="play" size={18} color={colors.primary} />
            <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.primary }}>
              {copy.home.startLesson}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Stats Grid */}
        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              ...cardShadow(),
            }}
          >
            <Text style={{ fontSize: fontSize["3xl"], fontWeight: "800", color: colors.primary, marginBottom: 4 }}>
              {progress ? progress.completedLessons : 0}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground }}>{copy.home.lessonsCompleted}</Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              ...cardShadow(),
            }}
          >
            <Text style={{ fontSize: fontSize["3xl"], fontWeight: "800", color: colors.primary, marginBottom: 4 }}>
              {progress ? progress.remainingLessons : 0}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground }}>{copy.home.lessonsRemaining}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={{ fontSize: fontSize.xl, fontWeight: "700", color: colors.foreground, marginBottom: spacing.md }}>
          {copy.home.quickActions}
        </Text>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/lessons")}
          style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
            ...cardShadow(),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons name="book" size={20} color={colors.primary} />
            <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.foreground }}>{copy.home.lessonsCta}</Text>
          </View>
          <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, lineHeight: 22 }}>
            {copy.home.viewAllLessons}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/progress")}
          style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
            ...cardShadow(),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons name="stats-chart" size={20} color={colors.primary} />
            <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.foreground }}>{copy.progress.title}</Text>
          </View>
          <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, lineHeight: 22 }}>
            {copy.home.viewProgress}
          </Text>
        </TouchableOpacity>

        {/* AI Assistant Button - Purple gradient */}
        <TouchableOpacity
          onPress={() => router.push("/ai-assistant")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            backgroundColor: colors.aiPurpleStart,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: borderRadius.md,
            marginTop: spacing.sm,
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
          <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: "#fff" }}>
            Baza AI Umufasha
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
