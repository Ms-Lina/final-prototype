/**
 * Learner Report / Certificate screen — /report
 * Shows a full personal achievement report the learner can share.
 */
import { View, Text, ScrollView, TouchableOpacity, Share, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { colors, spacing, fontSize, borderRadius } from "@/theme";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { copy } from "@/lib/copy";

const MODULES = [
    { name: "Imirongo", icon: "pencil" as const, color: "#4CAF78", total: 5 },
    { name: "Inyuguti", icon: "text" as const, color: "#3B82F6", total: 8 },
    { name: "Imibare", icon: "calculator" as const, color: "#F59E0B", total: 10 },
    { name: "Amashusho n'Amabara", icon: "shapes" as const, color: "#EC4899", total: 7 },
];

export default function ReportScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            const token = user ? await user.getIdToken() : null;
            const [p, h] = await Promise.all([api.getProgress(token), api.getLessonHistory(token)]);
            setProgress(p ?? null);
            setHistory(h ?? []);
            setLoading(false);
        };
        load();
    }, [user?.uid]);

    const handleShare = async () => {
        if (!progress) return;
        const badge = progress.badge?.label ?? copy.report.noBadge;
        const avg = (progress as any).averageScore ?? avgScore;
        const avgStr = avg != null ? `${avg}%` : "—";
        const msg = copy.report.shareMessage(progress.completedLessons, progress.totalLessons, badge, progress.streakDays, avgStr);
        await Share.share({ message: msg });
    };

    const passedHistory = history.filter(h => h.passed);
    const avgScore = history.length ? Math.round(history.reduce((s, h) => s + (h.score ?? 0), 0) / history.length) : null;
    const percent = progress ? Math.round((progress.completedLessons / progress.totalLessons) * 100) : 0;
    const badge = progress?.badge;
    const nextBadgeInfo = progress?.nextBadge;

    const dateStr = new Date().toLocaleDateString("rw-RW", { year: "numeric", month: "long", day: "numeric" });

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
                    <Ionicons name="arrow-back" size={22} color={colors.foreground} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.foreground }}>{copy.report.title}</Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground }}>{copy.report.subtitle}</Text>
                </View>
                <TouchableOpacity onPress={handleShare} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full }}>
                    <Ionicons name="share-outline" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: fontSize.xs }}>{copy.report.share}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {/* Certificate-style Card */}
                <View style={{
                    backgroundColor: badge?.color ?? colors.card,
                    borderRadius: borderRadius.xl,
                    padding: spacing.xl,
                    marginBottom: spacing.lg,
                    alignItems: "center",
                    shadowColor: badge?.color ?? "#000",
                    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
                }}>
                    <Text style={{ fontSize: 56, marginBottom: spacing.sm }}>
                        {badge?.label.split(" ").pop() ?? "🎓"}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: fontSize.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>
                        IMPAMYABUSHOBOZI
                    </Text>
                    <Text style={{ color: "#fff", fontSize: fontSize["2xl"], fontWeight: "800", marginTop: 4, textAlign: "center" }}>
                        {badge?.label.split(" ").slice(0, -1).join(" ") ?? "Tangira Kwiga"}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: fontSize.xs, marginTop: spacing.xs }}>
                        {user?.displayName ?? "Umunyeshuri wa MenyAI"}
                    </Text>
                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", width: "100%", marginVertical: spacing.md }} />
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{dateStr}</Text>
                </View>

                {/* Stats Row */}
                <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
                    {[
                        { label: "Yarangiye", value: `${progress?.completedLessons ?? 0}/${progress?.totalLessons ?? 0}`, icon: "checkmark-done-circle", color: colors.primary },
                        { label: "Amanota", value: avgScore !== null ? `${avgScore}%` : "—", icon: "ribbon", color: "#F59E0B" },
                        { label: "Streak", value: `${progress?.streakDays ?? 0}🔥`, icon: "flame", color: "#EF4444" },
                    ].map(item => (
                        <View key={item.label} style={{ flex: 1, backgroundColor: colors.card, borderRadius: borderRadius.md, padding: spacing.md, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                            <Text style={{ fontSize: fontSize.lg, fontWeight: "800", color: item.color }}>{item.value}</Text>
                            <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2, textAlign: "center" }}>{item.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Overall progress */}
                <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
                        <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: fontSize.base }}>{copy.progress.overallPercentage}</Text>
                        <Text style={{ fontWeight: "800", color: colors.primary, fontSize: fontSize.xl }}>{percent}%</Text>
                    </View>
                    <View style={{ height: 10, backgroundColor: colors.muted, borderRadius: 5, overflow: "hidden" }}>
                        <View style={{ width: `${percent}%`, height: "100%", backgroundColor: colors.primary, borderRadius: 5 }} />
                    </View>
                    {nextBadgeInfo && (
                        <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: spacing.xs }}>
                            Urakeneye amasomo {nextBadgeInfo.remaining} kugira ubone {nextBadgeInfo.label}
                        </Text>
                    )}
                </View>

                {/* Module breakdown */}
                <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.foreground, marginBottom: spacing.md }}>Imishinga ku Moduli</Text>
                {MODULES.map(mod => (
                    <View key={mod.name} style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, borderLeftWidth: 4, borderLeftColor: mod.color }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: mod.color + "20", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name={mod.icon} size={20} color={mod.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: fontSize.sm }}>{mod.name}</Text>
                            <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground }}>{mod.total} amasomo</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                            <Text style={{ fontWeight: "700", color: mod.color, fontSize: fontSize.sm }}>—</Text>
                            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>asigaye</Text>
                        </View>
                    </View>
                ))}

                {/* Recent completed lessons */}
                {passedHistory.length > 0 && (
                    <>
                        <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.foreground, marginTop: spacing.md, marginBottom: spacing.md }}>
                            {copy.report.comingSoon} ({passedHistory.length})
                        </Text>
                        {passedHistory.slice(0, 5).map(h => (
                            <View key={h.lessonId} style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.xs, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.foreground }}>
                                        Isomo #{h.lessonId.slice(0, 6)}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                                        {new Date(h.updatedAt).toLocaleDateString("rw-RW")} · {h.attempts} {copy.progress.attempt(h.attempts)}
                                    </Text>
                                </View>
                                <View style={{ backgroundColor: colors.primaryMuted, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full }}>
                                    <Text style={{ fontWeight: "700", color: colors.primary, fontSize: fontSize.sm }}>{h.score}%</Text>
                                </View>
                            </View>
                        ))}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
