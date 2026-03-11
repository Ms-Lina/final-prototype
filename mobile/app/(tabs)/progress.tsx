import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { colors, spacing, fontSize, borderRadius, cardShadow } from "@/theme";
import { api, lessonProgressPercent, type LessonProgressItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { copy } from "@/lib/copy";

type HistoryItem = LessonProgressItem & { lessonId: string; score?: number; passed?: boolean; attempts?: number; updatedAt?: string };

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ completedLessons: 0, totalLessons: 0, streakDays: 0, remainingLessons: 0 });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [badge, setBadge] = useState<{ key: string; label: string; color: string } | null>(null);
  const [nextBadge, setNextBadge] = useState<{ label: string; needsTotal: number; remaining: number } | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const loadProgress = useCallback(async () => {
    if (!user) {
      setProgress({ completedLessons: 0, totalLessons: 0, streakDays: 0, remainingLessons: 0 });
      setHistory([]);
      setBadge(null);
      setNextBadge(null);
      setLoading(false);
      return;
    }
    const token = await user.getIdToken();
    const [p, h] = await Promise.all([
      api.getProgress(token),
      api.getLessonHistory(token),
    ]);
    if (p) {
      setProgress({
        completedLessons: p.completedLessons,
        totalLessons: p.totalLessons,
        streakDays: p.streakDays,
        remainingLessons: p.remainingLessons ?? (p.totalLessons - p.completedLessons),
      });
      if (p.badge?.key !== "none") setBadge(p.badge ?? null);
      setNextBadge(p.nextBadge ?? null);
      // Prefer lessonHistory from GET /api/progress (same source as completedLessons) so counts and list stay in sync
      const fromProgress = Array.isArray(p.lessonHistory) ? p.lessonHistory : [];
      setHistory(fromProgress.length > 0 ? fromProgress : (h ?? []));
    } else {
      setProgress({ completedLessons: 0, totalLessons: 0, streakDays: 0, remainingLessons: 0 });
      setHistory(h ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProgress({ completedLessons: 0, totalLessons: 0, streakDays: 0, remainingLessons: 0 });
      setHistory([]);
      setBadge(null);
      setNextBadge(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProgress();
  }, [user?.uid, loadProgress]);

  // Refetch when tab gains focus so completion/streak stay in sync
  useFocusEffect(
    useCallback(() => {
      if (user) loadProgress();
    }, [user, loadProgress])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProgress();
  }, [loadProgress]);

  // Use history as fallback when API returns 0 completed but user has passed lessons (e.g. backend was out of sync)
  const passedFromHistory = history.filter((h) => h.passed).length;
  const displayCompleted = progress.completedLessons > 0 ? progress.completedLessons : passedFromHistory;
  const totalLessons = Math.max(progress.totalLessons || 0, 1);

  const percent = Math.round((displayCompleted / totalLessons) * 100);

  const nextPercent = nextBadge
    ? Math.min(100, Math.round((displayCompleted / nextBadge.needsTotal) * 100))
    : 100;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("rw-RW", { day: "numeric", month: "short" });
    } catch {
      return iso;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: fontSize["2xl"], fontWeight: "700", color: colors.foreground }}>{copy.progress.title}</Text>
        <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 }}>
          {copy.progress.subtitle}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, marginTop: spacing.md }}>{copy.progress.loading}</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        >
          {/* Quick Actions */}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
            <TouchableOpacity
              onPress={() => router.push("/review" as any)}
              style={{ flex: 1, backgroundColor: "#EEF2FF", borderRadius: borderRadius.md, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}
            >
              <Ionicons name="albums" size={22} color="#6366F1" />
              <View>
                <Text style={{ fontWeight: "700", color: "#6366F1", fontSize: fontSize.sm }}>Flashcards</Text>
                <Text style={{ fontSize: 10, color: "#8182C4" }}>Subiramo amagambo</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/report" as any)}
              style={{ flex: 1, backgroundColor: "#F0FDF4", borderRadius: borderRadius.md, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}
            >
              <Ionicons name="ribbon" size={22} color={colors.primary} />
              <View>
                <Text style={{ fontWeight: "700", color: colors.primary, fontSize: fontSize.sm }}>Raporo</Text>
                <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Raporo yanjye</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Badge Card */}
          {badge ? (
            <View style={{
              backgroundColor: badge.color,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              ...cardShadow({ color: badge.color, offset: { width: 0, height: 4 }, opacity: 0.35, radius: 12 }),
              elevation: 6,
            }}>
              <Text style={{ fontSize: 48 }}>
                {badge.label.split(" ").pop()}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: fontSize.xs, fontWeight: "600", opacity: 0.85 }}>IMPAMYABUSHOBOZI YAWE</Text>
                <Text style={{ color: "#fff", fontSize: fontSize["2xl"], fontWeight: "800", marginTop: 2 }}>
                  {badge.label.split(" ").slice(0, -1).join(" ")}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: fontSize.xs, marginTop: 4 }}>
                  {copy.progress.badgeEarned} {displayCompleted}. {copy.progress.keepGoing}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{
              backgroundColor: colors.card, borderRadius: borderRadius.lg,
              padding: spacing.lg, marginBottom: spacing.md,
              flexDirection: "row", alignItems: "center", gap: spacing.md,
              borderWidth: 2, borderColor: colors.border, borderStyle: "dashed",
            }}>
              <Ionicons name="medal" size={40} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.foreground }}>
                  {copy.progress.firstBadge}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 }}>
                  {copy.progress.firstBadgeHint}
                </Text>
              </View>
            </View>
          )}

          {/* Next Badge Goal */}
          {nextBadge && (
            <View style={{
              backgroundColor: colors.card, borderRadius: borderRadius.lg,
              padding: spacing.md, marginBottom: spacing.md,
              ...cardShadow({ color: "#000", offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4 }),
              elevation: 1,
            }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs }}>
                <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground }}>
                  {copy.progress.nextBadge} <Text style={{ fontWeight: "700", color: colors.foreground }}>{nextBadge.label}</Text>
                </Text>
                <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: colors.primary }}>
                  {nextBadge.remaining} {copy.progress.left}
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: colors.muted, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ width: `${Math.min(nextPercent, 100)}%`, height: "100%", backgroundColor: colors.primary, borderRadius: 3 }} />
              </View>
            </View>
          )}

          {/* Overall Progress Bar */}
          <View style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
            ...cardShadow({ color: "#000", offset: { width: 0, height: 2 }, opacity: 0.08, radius: 8 }),
            elevation: 2,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
              <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.foreground }}>{copy.progress.overallPercentage}</Text>
              <Text style={{ fontSize: fontSize.xl, fontWeight: "800", color: colors.primary }}>{percent}%</Text>
            </View>
            <View style={{ height: 10, backgroundColor: colors.muted, borderRadius: 5, overflow: "hidden", marginBottom: spacing.sm }}>
              <View style={{ width: `${Math.min(percent, 100)}%`, height: "100%", backgroundColor: colors.primary, borderRadius: 5 }} />
            </View>
            <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground }}>
              {copy.progress.completedCount(displayCompleted, progress.totalLessons || totalLessons)}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }}>
            {/* Completed */}
            <View style={{
              flex: 1, backgroundColor: colors.card, borderRadius: borderRadius.md,
              padding: spacing.md, alignItems: "center",
              ...cardShadow({ color: "#000", offset: { width: 0, height: 2 }, opacity: 0.06, radius: 6 }),
              elevation: 2,
            }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryMuted, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs }}>
                <Ionicons name="checkmark-done-circle" size={26} color={colors.primary} />
              </View>
              <Text style={{ fontSize: fontSize["2xl"], fontWeight: "800", color: colors.primary }}>{displayCompleted}</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: "center", marginTop: 2 }}>{copy.progress.completed}</Text>
            </View>

            {/* Remaining */}
            <View style={{
              flex: 1, backgroundColor: colors.card, borderRadius: borderRadius.md,
              padding: spacing.md, alignItems: "center",
              ...cardShadow({ color: "#000", offset: { width: 0, height: 2 }, opacity: 0.06, radius: 6 }),
              elevation: 2,
            }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFF3E0", alignItems: "center", justifyContent: "center", marginBottom: spacing.xs }}>
                <Ionicons name="time" size={26} color="#F59E0B" />
              </View>
              <Text style={{ fontSize: fontSize["2xl"], fontWeight: "800", color: "#F59E0B" }}>{Math.max(0, (progress.totalLessons || 0) - displayCompleted)}</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: "center", marginTop: 2 }}>{copy.progress.remaining}</Text>
            </View>

            {/* Streak */}
            <View style={{
              flex: 1, backgroundColor: colors.card, borderRadius: borderRadius.md,
              padding: spacing.md, alignItems: "center",
              shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
            }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFE4E1", alignItems: "center", justifyContent: "center", marginBottom: spacing.xs }}>
                <Ionicons name="flame" size={26} color="#EF4444" />
              </View>
              <Text style={{ fontSize: fontSize["2xl"], fontWeight: "800", color: "#EF4444" }}>{progress.streakDays}</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: "center", marginTop: 2 }}>{copy.progress.days}</Text>
            </View>
          </View>

          {/* Completed lessons only – checkmark and obtained marks */}
          <Text style={{ fontSize: fontSize.xl, fontWeight: "700", color: colors.foreground, marginBottom: spacing.md }}>
            {copy.progress.lessonHistoryTitle}
          </Text>

          {(() => {
            const passedItems = history.filter((h) => h.passed === true);
            const needRetryItems = history.filter((h) => !h.passed);
            const hasAny = history.length > 0;

            if (!hasAny) {
              return (
                <View style={{
                  backgroundColor: colors.card, borderRadius: borderRadius.lg,
                  padding: spacing.xl, alignItems: "center",
                  ...cardShadow({ color: "#000", offset: { width: 0, height: 2 }, opacity: 0.06, radius: 6 }),
                  elevation: 2,
                }}>
                  <Ionicons name="school-outline" size={56} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, marginTop: spacing.md, fontSize: fontSize.base, fontWeight: "600", textAlign: "center" }}>
                    {copy.progress.noHistory}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, marginTop: spacing.xs, fontSize: fontSize.sm, textAlign: "center" }}>
                    {copy.progress.noHistoryHint}
                  </Text>
                </View>
              );
            }

            const renderLessonCard = (item: HistoryItem, showRetry: boolean) => {
              const passed = item.passed === true;
              // Match Lessons page: use same derivation (video 50%, read 30%, score when passed)
              const displayPercent = passed
                ? (typeof item.score === "number" ? item.score : 100)
                : Math.max(typeof item.score === "number" ? item.score : 0, lessonProgressPercent(item));
              const subtitle = showRetry
                ? `${copy.progress.ahoUgeze} • ${formatDate(item.updatedAt)}`
                : `${item.attempts} ${copy.progress.attempt(item.attempts)} • ${formatDate(item.updatedAt)}`;
              return (
                <View
                  key={item.lessonId}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    ...cardShadow({ color: "#000", offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4 }),
                    elevation: 1,
                  }}
                >
                  {/* Pass = checkmark, Fail / below 80% = X */}
                  <View style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: passed ? colors.primaryMuted : "#FFE4E1",
                    alignItems: "center", justifyContent: "center", marginRight: spacing.md,
                  }}>
                    <Ionicons
                      name={passed ? "checkmark-circle" : "close-circle"}
                      size={28}
                      color={passed ? colors.success : "#EF4444"}
                    />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.foreground }}>
                      Isomo #{item.lessonId.slice(0, 6)}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 }}>
                      {subtitle}
                    </Text>
                  </View>

                  {/* Same % as Lessons: score when passed, else video/read tier or score */}
                  <View style={{
                    backgroundColor: passed ? colors.primaryMuted : "#FFE4E1",
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: borderRadius.full,
                    marginRight: showRetry ? spacing.sm : 0,
                  }}>
                    <Text style={{
                      fontSize: fontSize.sm,
                      fontWeight: "700",
                      color: passed ? colors.primary : "#EF4444",
                    }}>
                      {displayPercent}%
                    </Text>
                  </View>

                  {showRetry && (
                    <TouchableOpacity
                      onPress={() => router.push(`/lesson/${item.lessonId}` as any)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: colors.primary,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                        borderRadius: borderRadius.full,
                      }}
                    >
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <Text style={{ fontSize: fontSize.xs, fontWeight: "700", color: "#fff" }}>
                        {copy.progress.retryButton}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            };

            return (
              <>
                {passedItems.map((item) => renderLessonCard(item, false))}
                {passedItems.length === 0 && hasAny && (
                  <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.sm }}>
                    Nta masomo yarangiye ubu. Ongera ugerageze hasi.
                  </Text>
                )}
                {needRetryItems.length > 0 && (
                  <>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.foreground, marginTop: spacing.lg, marginBottom: spacing.sm }}>
                      {copy.progress.lessonHistoryRetryTitle}
                    </Text>
                    {needRetryItems.map((item) => renderLessonCard(item, true))}
                  </>
                )}
              </>
            );
          })()}

          {/* Encouragement banner – only when we have completed lessons in history (avoids mismatch with "Nta masomo yarangiwe") */}
          {history.filter((h) => h.passed).length > 0 && (
            <View style={{
              backgroundColor: colors.primary,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginTop: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}>
              <Ionicons name="trophy" size={32} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: fontSize.base }}>
                  {copy.progress.keepGoing}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: fontSize.xs, marginTop: 2 }}>
                  {copy.progress.encouragement(history.filter((h) => h.passed).length)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
