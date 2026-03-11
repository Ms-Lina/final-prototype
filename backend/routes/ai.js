/**
 * AI tutoring API – uses OpenAI to support students with real answers from the platform.
 * Requires OPENAI_API_KEY in env. Logs each chat to Firestore for admin monitoring.
 */
const express = require("express");
const OpenAI = require("openai");
const { verifyIdToken, getDb } = require("../config/firebase");

const router = express.Router();

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
  return key ? new OpenAI({ apiKey: key }) : null;
}

const SYSTEM_PROMPT = `You are MenyAI Umufasha, a reliable tutor for the MenyAI literacy app (Kinyarwanda reading and writing).

Rules:
- Reply only in Kinyarwanda. Use simple, correct Kinyarwanda suitable for literacy learners.
- Give accurate, helpful solutions using real information: step-by-step when explaining, correct spellings and grammar, and concrete examples (e.g. letters, numbers, simple words from the lesson).
- When lesson context is provided, use it to give answers that match the app content. Reference the lesson title, module, and activities. Do not invent content that is not in the context.
- If you are not sure, say so briefly and suggest they try the lesson or ask again. Do not guess or make up facts.
- Keep replies short and clear (a few sentences). Encourage the learner.`;

/** GET /api/ai/health – whether AI is configured (OPENAI_API_KEY set). No auth required. */
router.get("/health", (req, res) => {
  const configured = !!getOpenAI();
  if (!configured) {
    return res.status(503).json({ configured: false, message: "AI not configured (OPENAI_API_KEY)" });
  }
  res.json({ configured: true, model: process.env.OPENAI_MODEL || "gpt-4o-mini" });
});

router.post("/chat", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    if (!decoded?.uid) return res.status(401).json({ error: "Unauthorized" });

    const openai = getOpenAI();
    if (!openai) return res.status(503).json({ error: "AI service not configured", code: "OPENAI_NOT_CONFIGURED" });

    const { message, lessonContext } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message required" });
    }

    const contextStr = typeof lessonContext === "string" ? lessonContext.slice(0, 2000) : "";
    const userContent = contextStr
      ? `[Lesson context – use this to give accurate, curriculum-aligned help:\n${contextStr}]\n\nUser question: ${message}`
      : message;

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content ?? "Ntabwo nashoboye gusubiza ubu.";
    const uid = decoded.uid;

    const db = getDb();
    if (db) {
      try {
        const now = new Date();
        const sessionId = `${uid}_${now.toISOString().slice(0, 10)}`;
        await db.collection("aiChatLogs").add({
          uid,
          sessionId,
          message: String(message).slice(0, 2000),
          reply: String(reply).slice(0, 2000),
          lessonContext: contextStr ? contextStr.slice(0, 1000) : null,
          createdAt: now.toISOString(),
        });
      } catch (logErr) {
        console.error("AI log write failed:", logErr.message);
      }
    }

    res.json({ reply });
  } catch (e) {
    const msg = e.message || String(e);
    console.error("AI chat error:", msg);
    if (e.status === 401 || (e.response && e.response.status === 401)) {
      return res.status(500).json({ error: "OpenAI API key invalid or unauthorized" });
    }
    if (e.status === 429 || (e.response && e.response.status === 429)) {
      return res.status(503).json({ error: "AI busy. Gerageza nyuma.", code: "RATE_LIMIT" });
    }
    res.status(500).json({ error: "AI request failed", details: msg.slice(0, 100) });
  }
});

module.exports = router;
