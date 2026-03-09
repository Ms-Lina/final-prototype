/**
 * Progress tracking API – get/update learner progress.
 * Stored in Firestore per user when configured.
 */
const express = require("express");
const { getDb, verifyIdToken } = require("../config/firebase");

const router = express.Router();

/** Compute badge tier from completed lesson count */
function getBadge(completed) {
  if (completed >= 30) return { key: "champion", label: "Intsinzi 🏆", color: "#A855F7", minLessons: 30 };
  if (completed >= 21) return { key: "diamond", label: "Almasi 💎", color: "#06B6D4", minLessons: 21 };
  if (completed >= 11) return { key: "gold", label: "Zahabu 🥇", color: "#F59E0B", minLessons: 11 };
  if (completed >= 6) return { key: "silver", label: "Ifeza 🥈", color: "#94A3B8", minLessons: 6 };
  if (completed >= 1) return { key: "bronze", label: "Inzibacyuho 🥉", color: "#CD7F32", minLessons: 1 };
  return { key: "none", label: null, color: null, minLessons: 0 };
}

function nextBadge(completed) {
  if (completed >= 30) return null;
  if (completed >= 21) return { label: "Intsinzi 🏆", needsTotal: 30, remaining: 30 - completed };
  if (completed >= 11) return { label: "Almasi 💎", needsTotal: 21, remaining: 21 - completed };
  if (completed >= 6) return { label: "Zahabu 🥇", needsTotal: 11, remaining: 11 - completed };
  if (completed >= 1) return { label: "Ifeza 🥈", needsTotal: 6, remaining: 6 - completed };
  return { label: "Inzibacyuho 🥉", needsTotal: 1, remaining: 1 - completed };
}

router.get("/", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    const uid = decoded?.uid;
    const db = getDb();

    // Use same query as GET /api/lessons so totalLessons matches what the app displays
    let totalLessons = 0;
    if (db) {
      const lessonsSnap = await db.collection("lessons").orderBy("order").get();
      totalLessons = lessonsSnap.size;
    }

    let completedLessons = 0;
    let streakDays = 0;
    let averageScore = 0;

    let lessonHistory = [];
    if (db && uid) {
      // Primary: lesson history from users/uid/lessonHistory (written by POST /api/lessons/:id/submit)
      const lessonHistorySnap = await db.collection("users").doc(uid).collection("lessonHistory").get();
      lessonHistory = lessonHistorySnap.docs.map(doc => ({ lessonId: doc.id, ...doc.data() }));

      // Fallback: if empty, also read from progress/uid/history (written by POST /api/progress/submit) so UI matches either path
      if (lessonHistory.length === 0) {
        const legacyHistorySnap = await db.collection("progress").doc(uid).collection("history").get();
        lessonHistory = legacyHistorySnap.docs.map(doc => {
          const d = doc.data();
          return { lessonId: doc.id, score: d.score, passed: d.passed, attempts: d.attempts, updatedAt: d.updatedAt, completedAt: d.updatedAt };
        });
      }

      completedLessons = lessonHistory.filter(h => h.passed === true).length;

      // Average score from completed lessons
      const scores = lessonHistory
        .map(h => h.score)
        .filter(score => typeof score === 'number');
      if (scores.length > 0) {
        averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      }

      // Streak: primary from users/uid/progress/overall (written by lessons.js updateUserProgress)
      const userProgressRef = db.collection("users").doc(uid).collection("progress").doc("overall");
      const userProgressDoc = await userProgressRef.get();
      if (userProgressDoc.exists) {
        const progressData = userProgressDoc.data();
        streakDays = progressData.currentStreak ?? progressData.streakDays ?? 0;
      }
      // Fallback: legacy progress/uid doc (written by POST /api/progress or /api/progress/submit)
      if (streakDays === 0) {
        const legacyProgressDoc = await db.collection("progress").doc(uid).get();
        if (legacyProgressDoc.exists) {
          const legacyData = legacyProgressDoc.data();
          streakDays = legacyData.streakDays ?? legacyData.currentStreak ?? 0;
        }
      }
    }

    const remainingLessons = totalLessons - completedLessons;

    res.json({
      completedLessons,
      totalLessons,
      remainingLessons,
      streakDays,
      averageScore,
      lessonHistory,
      badge: getBadge(completedLessons),
      nextBadge: nextBadge(completedLessons),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/progress/history – per-lesson history (same source as GET /: users/uid/lessonHistory, with legacy fallback) */
router.get("/history", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    const uid = decoded?.uid;
    const db = getDb();
    if (!db || !uid) return res.json({ history: [] });

    const snap = await db.collection("users").doc(uid).collection("lessonHistory").get();
    let history = snap.docs.map(doc => {
      const d = doc.data();
      return {
        lessonId: doc.id,
        score: d.score ?? 0,
        passed: d.passed ?? false,
        attempts: d.attempts ?? 1,
        updatedAt: d.completedAt ?? d.updatedAt ?? new Date().toISOString(),
      };
    });
    if (history.length === 0) {
      const legacySnap = await db.collection("progress").doc(uid).collection("history").get();
      history = legacySnap.docs.map(doc => {
        const d = doc.data();
        return {
          lessonId: doc.id,
          score: d.score ?? 0,
          passed: d.passed ?? false,
          attempts: d.attempts ?? 1,
          updatedAt: d.updatedAt ?? new Date().toISOString(),
        };
      });
    }
    res.json({ history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/progress/ – update progress */
router.post("/", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    const uid = decoded?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });
    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not configured" });
    const { completedLessons, streakDays } = req.body || {};
    const data = {
      updatedAt: new Date().toISOString(),
      ...(typeof completedLessons === "number" && { completedLessons }),
      ...(typeof streakDays === "number" && { streakDays }),
    };
    await db.collection("progress").doc(uid).set(data, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/progress/submit – submit lesson/assignment answers and get score */
router.post("/submit", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    const uid = decoded?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const { lessonId, answers } = req.body || {};
    if (!lessonId || !Array.isArray(answers)) {
      return res.status(400).json({ error: "lessonId and answers required" });
    }

    // Fetch lesson to verify correct answers
    const lessonDoc = await db.collection("lessons").doc(lessonId).get();
    if (!lessonDoc.exists) return res.status(404).json({ error: "Lesson not found" });

    const lessonData = lessonDoc.data();
    const activities = lessonData.activities || [];

    let correctCount = 0;
    const results = answers.map((ans, idx) => {
      const activity = activities[idx];
      if (!activity) return { correct: false };

      let isCorrect = false;
      if (activity.type === "mc" || activity.type === "typing") {
        isCorrect = String(ans).trim().toLowerCase() === String(activity.correctAnswer).trim().toLowerCase();
      } else if (activity.type === "audio") {
        // For audio, we'll auto-grade for now or use a mock logic
        isCorrect = true;
      }

      if (isCorrect) correctCount++;
      return { id: activity.id, correct: isCorrect };
    });

    const total = activities.length || 1;
    const score = Math.round((correctCount / total) * 100);
    const passed = score >= 80;

    // Update user history
    const historyRef = db.collection("progress").doc(uid).collection("history").doc(lessonId);
    await historyRef.set({
      score,
      passed,
      attempts: (await historyRef.get()).data()?.attempts + 1 || 1,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Update overall progress if passed
    if (passed) {
      await db.collection("progress").doc(uid).update({
        completedLessons: (await db.collection("progress").doc(uid).get()).data()?.completedLessons + 1 || 1
      });
    }

    res.json({ score, passed, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
