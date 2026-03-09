import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef, useMemo } from "react";
import { colors, spacing, fontSize, borderRadius } from "@/theme";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Message = { id: string; type: "ai" | "user"; text: string };

const INITIAL_MESSAGES: Message[] = [
  { id: "1", type: "ai" as const, text: "Muraho! Ndi MenyAI, umufasha wawe. Ufite ikibazo cyangwa ukenera ubufasha kuri iri somo?" },
];

const FALLBACK_REPLY = "Ntabwo nashoboye gusubiza ubu. Wongere none cyangwa injira kugira ngo ube na AI.";

export default function AIAssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lessonTitle?: string; lessonDesc?: string }>();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const lessonContext = useMemo(() => {
    const title = params.lessonTitle ?? "";
    const desc = params.lessonDesc ?? "";
    if (!title && !desc) return undefined;
    const raw = [title, desc].filter(Boolean).join(". ");
    return raw.slice(0, 500) || undefined;
  }, [params.lessonTitle, params.lessonDesc]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: Message = { id: Date.now().toString(), type: "user" as const, text };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    const token = user ? await user.getIdToken() : null;
    const reply = await api.postAiChat(text, token, { lessonContext });
    setMessages((m) => [...m, { id: (Date.now() + 1).toString(), type: "ai" as const, text: reply ?? FALLBACK_REPLY }]);
    setLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* AI Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: 2,
          borderBottomColor: colors.border,
          marginBottom: spacing.md,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.aiPurpleStart,
            alignItems: "center",
            justifyContent: "center",
            marginRight: spacing.md,
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.foreground }}>
            MenyAI Umufasha
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.success,
              }}
            />
            <Text style={{ fontSize: fontSize.xs, color: colors.success }}>Ndi hano kugufasha</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: spacing.sm }}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <View
          style={{
            backgroundColor: "#E3F2FD",
            padding: spacing.md,
            borderRadius: borderRadius.md,
            marginBottom: spacing.lg,
          }}
        >
          <Text style={{ fontSize: fontSize.sm, color: colors.foreground, lineHeight: 22 }}>
            Menya: Baza AI igihe cyose ufite ikibazo. Itanga ibisubizo mu Kinyarwanda!
          </Text>
        </View>

        {/* Chat messages */}
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={{
              alignSelf: msg.type === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: borderRadius.lg,
                backgroundColor: msg.type === "user" ? colors.primary : colors.muted,
                borderBottomRightRadius: msg.type === "user" ? 4 : borderRadius.lg,
                borderBottomLeftRadius: msg.type === "user" ? borderRadius.lg : 4,
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.sm,
                  color: msg.type === "user" ? "#fff" : colors.foreground,
                  lineHeight: 22,
                }}
              >
                {msg.text}
              </Text>
            </View>
          </View>
        ))}

        {/* Quick action buttons */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: borderRadius.md,
              borderWidth: 2,
              borderColor: colors.primary,
            }}
          >
            <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.primary }}>Sobanura neza</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: borderRadius.md,
              borderWidth: 2,
              borderColor: colors.primary,
            }}
          >
            <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.primary }}>Mpa urugero</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: borderRadius.md,
              borderWidth: 2,
              borderColor: colors.primary,
            }}
          >
            <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.primary }}>Komeza isomo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Chat input - fixed at bottom */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.md,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TextInput
          placeholder="Andika ikibazo cyawe hano..."
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          style={{
            flex: 1,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 2,
            borderColor: colors.border,
            fontSize: fontSize.sm,
            color: colors.foreground,
          }}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={loading}
          style={{
            width: 44,
            height: 44,
            borderRadius: borderRadius.md,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
