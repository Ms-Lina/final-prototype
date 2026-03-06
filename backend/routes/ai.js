/**
 * Optional AI tutoring API – controlled access via Express.
 * Uses OpenAI; requires OPENAI_API_KEY. Logs each chat to Firestore for admin monitoring.
 */
const express = require("express");
const OpenAI = require("openai");
const { verifyIdToken, getDb } = require("../config/firebase");

const router = express.Router();
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are MenyAI Umufasha, a friendly tutor for the MenyAI literacy app. 
You help learners in Kinyarwanda only. Explain simply, use examples (e.g. fingers for numbers), 
and encourage. Keep answers short and clear.`;

/** GET /api/ai/health – whether AI is configured (OPENAI_API_KEY set). No auth required. */
router.get("/health", (req, res) => {
  const configured = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
  if (!configured) {
    return res.status(503).json({ configured: false, message: "AI not configured (OPENAI_API_KEY)" });
  }
  res.json({ configured: true, model: process.env.OPENAI_MODEL || "gpt-4o-mini" });
});

router.post("/chat", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    if (!decoded?.uid) return res.status(401).json({ error: "Unauthorized" });
    if (!openai) return res.status(503).json({ error: "AI service not configured" });

    const { message, lessonContext } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message required" });
    }

    const userContent = lessonContext
      ? `[Lesson context: ${lessonContext}]\n\nUser question: ${message}`
      : message;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
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
          lessonContext: lessonContext != null ? String(lessonContext).slice(0, 500) : null,
          createdAt: now.toISOString(),
        });
      } catch (logErr) {
        console.error("AI log write failed:", logErr.message);
      }
    }

    res.json({ reply });
  } catch (e) {
    console.error("AI chat error:", e.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

module.exports = router;
