import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { colors, spacing, fontSize, borderRadius } from "@/theme";
import { api, lessonProgressPercent, type LessonProgressItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { copy } from "@/lib/copy";

type Lesson = {
  id: string;
  title: string;
  subtitle?: string;
  duration?: string;
  level?: string;
  module?: string;
  moduleColor?: string;
  order?: number;
  activities?: any[];
};

/** Module metadata – aligned with capstone: Basic Literacy, Everyday Numbers, Practical Life Skills */
const MODULE_META: Record<string, { icon: string; color: string; description: string }> = {
  "Imirongo": { icon: "pencil", color: "#4CAF78", description: "Imirongo n'amashusho" },
  "Inyuguti": { icon: "text", color: "#3B82F6", description: "Inyuguti n'amagambo" },
  "Imibare": { icon: "calculator", color: "#F59E0B", description: "Imibare n'imari" },
  "Imishusho": { icon: "shapes", color: "#EC4899", description: "Imishusho n'amabara" },
  "Amashusho n'Amabara": { icon: "shapes", color: "#EC4899", description: "Amashusho n'amabara" },
  "Ubuzima n'ubucuruzi": { icon: "medkit", color: "#10B981", description: "Ubuzima, imari, Umuganda" },
  "Ibindi": { icon: "book", color: "#6B7280", description: "Ibindi" },
};

export default function LessonsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = user ? await user.getIdToken() : null;
        const [list, prog] = await Promise.all([
          api.getLessons(token),
          api.getProgress(token),
        ]);
        setLessons(list as any[]);
        setProgress(prog);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  // Group lessons by module, sorted by order
  const grouped = lessons
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .reduce<Record<string, Lesson[]>>((acc, l) => {
      const mod = (l as any).module ?? "Ibindi";
      if (!acc[mod]) acc[mod] = [];
      acc[mod].push(l);
      return acc;
    }, {});

  const modules = Object.keys(grouped);

  const progressByLessonId: Record<string, LessonProgressItem> = {};
  (progress?.lessonHistory ?? []).forEach((h: LessonProgressItem) => {
    progressByLessonId[h.lessonId] = h;
  });

  const getLessonProgress = (lessonId: string) => progressByLessonId[lessonId];
  const getLessonProgressPercent = (lessonId: string) => lessonProgressPercent(getLessonProgress(lessonId));

  const isLessonCompleted = (lessonId: string): boolean => {
    return !!getLessonProgress(lessonId)?.passed;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View style={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ fontSize: fontSize["2xl"], fontWeight: "800", color: colors.foreground }}>
          {copy.lessons.title}
        </Text>
        <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 }}>
          {loading ? copy.common.loading : copy.lessons.subtitle(lessons.length)}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, marginTop: spacing.md }}>Tegereza amasomo...</Text>
        </View>
      ) : lessons.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <Ionicons name="book-outline" size={64} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, marginTop: spacing.md, fontSize: fontSize.base, textAlign: "center" }}>
            {copy.lessons.noLessons}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {modules.map((mod) => {
            const meta = MODULE_META[mod] ?? { icon: "school", color: colors.primary, description: "" };
            const modLessons = grouped[mod];

            return (
              <View key={mod} style={{ marginBottom: spacing.xl }}>
                {/* Module Header */}
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  marginBottom: spacing.md,
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: meta.color + "22",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                  </View>
                  <View>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.foreground }}>
                      {mod}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground }}>
                      {meta.description} • {modLessons.length} amasomo
                    </Text>
                  </View>
                </View>

                {/* Lesson Cards */}
                {modLessons.map((lesson, idx) => {
                  const isCompleted = isLessonCompleted(lesson.id);
                  const progressPercent = getLessonProgressPercent(lesson.id);
                  const progressItem = getLessonProgress(lesson.id);
                  const score = progressItem?.passed && typeof progressItem?.score === "number" ? progressItem.score : null;
                  return (
                    <TouchableOpacity
                      key={lesson.id}
                      onPress={() => router.push(`/lesson/${lesson.id}` as any)}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: borderRadius.lg,
                        marginBottom: spacing.sm,
                        overflow: "hidden",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.07,
                        shadowRadius: 8,
                        elevation: 2,
                        borderLeftWidth: 4,
                        borderLeftColor: isCompleted ? colors.success : progressPercent >= 50 ? meta.color : colors.border,
                      }}
                    >
                      <View style={{ padding: spacing.md }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                          <View style={{
                            width: 40, height: 40, borderRadius: 20,
                            backgroundColor: isCompleted ? colors.success + "18" : meta.color + "18",
                            alignItems: "center", justifyContent: "center",
                            marginRight: spacing.md,
                          }}>
                            {isCompleted ? (
                              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                            ) : (
                              <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: meta.color }}>
                                {(lesson as any).order ?? idx + 1}
                              </Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.foreground }}>
                              {lesson.title}
                            </Text>
                            {(lesson as any).subtitle && (
                              <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 1 }}>
                                {(lesson as any).subtitle}
                              </Text>
                            )}
                            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
                              {lesson.duration && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                                  <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
                                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{lesson.duration}</Text>
                                </View>
                              )}
                              {(lesson as any).activities?.length > 0 && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                                  <Ionicons name="list-outline" size={11} color={colors.mutedForeground} />
                                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                                    {(lesson as any).activities.length} ibibazo
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          {score !== null && (
                            <View style={{
                              backgroundColor: score >= 80 ? colors.success + "18" : colors.danger + "18",
                              paddingHorizontal: spacing.sm,
                              paddingVertical: 6,
                              borderRadius: borderRadius.md,
                              minWidth: 48,
                              alignItems: "center",
                              justifyContent: "center",
                            }}>
                              <Text style={{
                                fontSize: fontSize.base,
                                fontWeight: "800",
                                color: score >= 80 ? colors.success : colors.danger,
                              }}>
                                {score}%
                              </Text>
                              <Text style={{ fontSize: 10, fontWeight: "600", color: score >= 80 ? colors.success : colors.danger, marginTop: 0 }}>
                                {score >= 80 ? "Yarangiye" : "Ongera"}
                              </Text>
                            </View>
                          )}
                          {score === null && (
                            <Ionicons name="chevron-forward" size={20} color={meta.color} />
                          )}
                        </View>
                        {/* Progress bar – Coursera-style */}
                        <View style={{ marginTop: spacing.sm, marginLeft: 40 + spacing.md }}>
                          <View style={{
                            height: 6,
                            backgroundColor: colors.muted,
                            borderRadius: 3,
                            overflow: "hidden",
                          }}>
                            <View style={{
                              width: `${progressPercent}%`,
                              height: "100%",
                              backgroundColor: progressPercent === 100 ? colors.success : meta.color,
                              borderRadius: 3,
                            }} />
                          </View>
                          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                            {progressPercent > 0 ? `${progressPercent}%` : "0%"} {progressPercent === 100 ? "· Yarangiye" : progressPercent >= 50 ? "· Videwo" : progressPercent >= 30 ? "· Gusoma" : ""}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
