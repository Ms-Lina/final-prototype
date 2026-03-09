/**
 * Enhanced Lesson delivery API with assessment features
 * Data from Firestore when configured, else stub for development.
 */
const express = require("express");
const { getDb, verifyIdToken } = require("../config/firebase");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const snap = await db.collection("lessons").orderBy("order").get();
    const lessons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // Add enhanced metadata
    const enhancedLessons = lessons.map(lesson => ({
      ...lesson,
      estimatedDuration: calculateEstimatedDuration(lesson),
      difficultyLevel: getDifficultyLevel(lesson),
      prerequisites: getPrerequisites(lesson, lessons),
      nextLesson: getNextLesson(lesson, lessons)
    }));
    
    res.json({ lessons: enhancedLessons });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const doc = await db.collection("lessons").doc(req.params.id).get();
    if (doc.exists) {
      const lesson = { id: doc.id, ...doc.data() };
      
      // Add enhanced lesson data
      const enhancedLesson = {
        ...lesson,
        estimatedDuration: calculateEstimatedDuration(lesson),
        difficultyLevel: getDifficultyLevel(lesson),
        adaptiveContent: generateAdaptiveContent(lesson),
        learningObjectives: getLearningObjectives(lesson),
        assessmentStrategy: getAssessmentStrategy(lesson)
      };
      
      return res.json(enhancedLesson);
    }

    res.status(404).json({ error: "Lesson not found" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/lessons/:id/progress
 * Return saved progress for this lesson so the user can resume (step, time, video position, answers).
 */
router.get("/:id/progress", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    const uid = decoded?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const lessonId = req.params.id;
    const historyRef = db.collection("users").doc(uid).collection("lessonHistory").doc(lessonId);
    const doc = await historyRef.get();
    if (!doc.exists) return res.json({ progress: null });

    const d = doc.data();
    if (d.passed) return res.json({ progress: null, completed: true, score: d.score });

    const progress = {
      currentStep: typeof d.currentStep === "number" ? d.currentStep : 0,
      totalTimeSpent: typeof d.totalTimeSpent === "number" ? d.totalTimeSpent : 0,
      videoProgressSeconds: typeof d.videoProgressSeconds === "number" ? d.videoProgressSeconds : 0,
      answers: Array.isArray(d.answers) ? d.answers : [],
      descriptionRead: !!d.descriptionRead,
      videoWatched: !!d.videoWatched,
    };
    return res.json({ progress, completed: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/lessons/:id/progress
 * Save progress: description read (30%), video watched (50%), current step, total time, video position, answers.
 */
router.post("/:id/progress", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    const uid = decoded?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const lessonId = req.params.id;
    const { descriptionRead, videoWatched, currentStep, totalTimeSpent, videoProgressSeconds, answers } = req.body || {};

    const historyRef = db.collection("users").doc(uid).collection("lessonHistory").doc(lessonId);
    const existing = (await historyRef.get()).data() || {};

    const updates = {
      updatedAt: new Date().toISOString(),
      ...(descriptionRead === true && { descriptionRead: true }),
      ...(videoWatched === true && { videoWatched: true }),
      ...(typeof currentStep === "number" && currentStep >= 0 && { currentStep }),
      ...(typeof totalTimeSpent === "number" && totalTimeSpent >= 0 && { totalTimeSpent }),
      ...(typeof videoProgressSeconds === "number" && videoProgressSeconds >= 0 && { videoProgressSeconds }),
      ...(Array.isArray(answers) && { answers }),
    };

    await historyRef.set(updates, { merge: true });
    const merged = { ...existing, ...updates };

    const progressPercent = merged.passed ? 100 : merged.videoWatched ? 50 : merged.descriptionRead ? 30 : 0;
    return res.json({
      ok: true,
      progressPercent,
      descriptionRead: !!merged.descriptionRead,
      videoWatched: !!merged.videoWatched,
      passed: !!merged.passed,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/lessons/:id/submit
 * Enhanced lesson submission with detailed analytics
 */
router.post("/:id/submit", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    const uid = decoded?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const { answers, timeSpent, questionTimes, deviceInfo } = req.body || {};

    // Get lesson data
    const lessonDoc = await db.collection("lessons").doc(req.params.id).get();
    if (!lessonDoc.exists) return res.status(404).json({ error: "Lesson not found" });

    const lessonData = lessonDoc.data();
    const activities = lessonData.activities || [];

    // Video-only or no activities: treat as completion with 100%
    if (activities.length === 0) {
      const historyRef = db.collection("users").doc(uid).collection("lessonHistory").doc(req.params.id);
      const passed = true;
      const scoring = { score: 100, passed, timeBonus: 0, breakdown: [], averageScore: 100 };
      await historyRef.set({
        ...scoring,
        results: [],
        timeSpent: timeSpent || 0,
        completedAt: new Date().toISOString(),
        attempts: (await historyRef.get()).data()?.attempts + 1 || 1,
        descriptionRead: true,
        videoWatched: true,
      }, { merge: true });
      await updateUserProgress(uid, req.params.id, scoring);
      return res.json({ score: 100, passed: true, ...scoring });
    }

    // Enhanced evaluation – ensure answers array matches activities length (pad with "")
    const paddedAnswers = Array.from({ length: activities.length }, (_, i) => answers[i] ?? "");
    const results = paddedAnswers.map((answer, index) => {
      const activity = activities[index];
      if (!activity) return { activityId: "unknown", correct: false, score: 0, feedback: "" };

      const evaluation = evaluateActivityAnswer(answer, activity);
      return {
        activityId: activity.id,
        correct: evaluation.correct,
        score: evaluation.score,
        timeSpent: questionTimes?.[index] || 0,
        hints: activity.hints || 0,
        feedback: evaluation.feedback
      };
    });

    // Calculate comprehensive score
    const scoring = calculateLessonScore(results, lessonData, timeSpent);
    
    // Save enhanced results
    const historyRef = db.collection("users").doc(uid).collection("lessonHistory").doc(req.params.id);
    
    const enhancedData = {
      ...scoring,
      results,
      timeSpent,
      questionTimes,
      deviceInfo,
      completedAt: new Date().toISOString(),
      attempts: (await historyRef.get()).data()?.attempts + 1 || 1,
      descriptionRead: true,
      videoWatched: true,
      learningMetrics: {
        engagementScore: calculateEngagementScore(results, timeSpent),
        masteryLevel: calculateMasteryLevel(results, lessonData),
        improvementAreas: identifyImprovementAreas(results, activities),
        nextRecommendations: generateNextRecommendations(scoring, lessonData)
      }
    };

    await historyRef.set(enhancedData, { merge: true });

    // Update user progress
    await updateUserProgress(uid, req.params.id, scoring);

    res.json(enhancedData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/lessons/:id/next
 * Get next recommended lesson based on performance
 */
router.get("/:id/next", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req);
    const uid = decoded?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    // Get current lesson
    const currentLessonDoc = await db.collection("lessons").doc(req.params.id).get();
    if (!currentLessonDoc.exists) return res.status(404).json({ error: "Lesson not found" });

    const currentLesson = { id: currentLessonDoc.id, ...currentLessonDoc.data() };

    // Get user's performance in current lesson
    const performanceDoc = await db.collection("users").doc(uid)
      .collection("lessonHistory")
      .doc(req.params.id)
      .get();
    
    const performance = performanceDoc.exists ? performanceDoc.data() : null;

    // Get all lessons for progression
    const allLessonsSnap = await db.collection("lessons").orderBy("order").get();
    const allLessons = allLessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate next lesson
    const nextLesson = calculateNextLesson(currentLesson, performance, allLessons);

    res.json({ nextLesson, recommendations: nextLesson.recommendations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper functions for enhanced lesson features
function calculateEstimatedDuration(lesson) {
  const baseTime = 10; // Base 10 minutes
  const activityTime = (lesson.activities || []).length * 3; // 3 minutes per activity
  const difficultyMultiplier = {
    easy: 0.8,
    medium: 1.0,
    hard: 1.3
  }[lesson.difficulty] || 1.0;
  
  return Math.round((baseTime + activityTime) * difficultyMultiplier);
}

function getDifficultyLevel(lesson) {
  const levelMap = {
    1: 'Beginner',
    2: 'Elementary', 
    3: 'Intermediate',
    4: 'Advanced',
    5: 'Expert'
  };
  
  return levelMap[lesson.level] || 'Beginner';
}

function getPrerequisites(lesson, allLessons) {
  // Simple prerequisite logic based on order and level
  const currentOrder = lesson.order || 0;
  const currentLevel = lesson.level || 1;
  
  return allLessons
    .filter(l => (l.order || 0) < currentOrder && (l.level || 1) <= currentLevel)
    .slice(-3) // Last 3 lessons as prerequisites
    .map(l => ({ id: l.id, title: l.title }));
}

function getNextLesson(lesson, allLessons) {
  const currentIndex = allLessons.findIndex(l => l.id === lesson.id);
  if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
    const next = allLessons[currentIndex + 1];
    return { id: next.id, title: next.title, order: next.order };
  }
  return null;
}

function generateAdaptiveContent(lesson) {
  return {
    personalizedInstructions: generateInstructions(lesson),
    adaptiveHints: generateHints(lesson),
    scaffolding: generateScaffolding(lesson)
  };
}

function generateInstructions(lesson) {
  const instructions = [];
  
  if (lesson.difficulty === 'easy') {
    instructions.push("Take your time and read each instruction carefully.");
  }
  
  if (lesson.module === 'Inyuguti') {
    instructions.push("Focus on the shape and sound of each letter.");
  } else if (lesson.module === 'Imibare') {
    instructions.push("Practice counting and recognizing number patterns.");
  }
  
  return instructions;
}

function generateHints(lesson) {
  return {
    available: 3,
    cost: 5, // Points deducted per hint
    adaptive: true // Hints adapt based on user performance
  };
}

function generateScaffolding(lesson) {
  return {
    showExamples: lesson.difficulty !== 'hard',
    provideTemplates: lesson.module === 'Imirongo',
    allowRetry: true,
    maxAttempts: 3
  };
}

function getLearningObjectives(lesson) {
  const objectives = [];
  
  if (lesson.module === 'Inyuguti') {
    objectives.push("Recognize and write Kinyarwanda letters");
    objectives.push("Understand letter-sound relationships");
  } else if (lesson.module === 'Imibare') {
    objectives.push("Count and recognize numbers");
    objectives.push("Perform basic mathematical operations");
  }
  
  return objectives;
}

function getAssessmentStrategy(lesson) {
  return {
    type: "mixed",
    weightDistribution: {
      accuracy: 0.6,
      speed: 0.2,
      completion: 0.2
    },
    passingScore: getPassingScore(lesson.difficulty),
    timeLimit: calculateEstimatedDuration(lesson) * 60 // Convert to seconds
  };
}

function getPassingScore(difficulty) {
  const scores = {
    easy: 70,
    medium: 75,
    hard: 80
  };
  return scores[difficulty] || 75;
}

function evaluateActivityAnswer(answer, activity) {
  let correct = false;
  let score = 0;
  let feedback = "";

  switch (activity.type) {
    case "typing":
      const userAnswer = String(answer).trim().toLowerCase();
      const correctAnswer = String(activity.correctAnswer).trim().toLowerCase();
      correct = userAnswer === correctAnswer;
      score = correct ? 100 : calculatePartialCredit(userAnswer, correctAnswer);
      feedback = correct ? "Wabikoze neza! Umeze ku wihangire!" : "Wongere ugerageze - Reba neza ihindura ry'ijambo";
      break;
      
    case "mc":
      correct = String(answer || "").trim() === String(activity.correctAnswer || "").trim();
      score = correct ? 100 : 0;
      feedback = correct ? "Wabikoze neza! Umeze ku wihangire!" : "Subira kureba ibyo umize none wongere ugerageze";
      break;
      
    case "audio":
      correct = answer && answer !== "recorded";
      score = correct ? 100 : 50;
      feedback = correct ? "Wabikoze neza ku njyuguti! Umeze ku wihangire!" : "Komeza kurwanira no guhindura ijwi ryawe";
      break;
      
    default:
      score = 0;
      feedback = "Ubwoko bw'ibibazo ntabwo bubizwi";
  }

  return { correct, score, feedback };
}

function calculatePartialCredit(userAnswer, correctAnswer) {
  if (!userAnswer || !correctAnswer) return 0;
  
  // Simple similarity calculation
  const similarity = userAnswer === correctAnswer ? 1 : 
    (userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)) ? 0.5 : 0;
  
  return Math.round(similarity * 100);
}

function calculateLessonScore(results, lessonData, timeSpent) {
  if (!results || results.length === 0) {
    return { score: 0, passed: false, timeBonus: 0, breakdown: [], averageScore: 0 };
  }
  const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
  const averageScore = Math.round(totalScore / results.length);
  
  // Apply time bonus
  const estimatedTime = calculateEstimatedDuration(lessonData) * 60;
  const timeBonus = timeSpent < estimatedTime ? 5 : 0;
  
  const finalScore = Math.min(100, averageScore + timeBonus);
  const passed = finalScore >= getPassingScore(lessonData.difficulty);
  
  return {
    score: finalScore,
    passed,
    timeBonus,
    breakdown: results,
    averageScore
  };
}

function calculateEngagementScore(results, timeSpent) {
  const completionRate = results.filter(r => r.score > 0).length / results.length;
  const timeEngagement = Math.min(1, timeSpent / 600); // 10 minutes as full engagement
  return Math.round((completionRate * 0.7 + timeEngagement * 0.3) * 100);
}

function calculateMasteryLevel(results, lessonData) {
  const averageScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;
  
  if (averageScore >= 90) return 'Expert';
  if (averageScore >= 80) return 'Advanced';
  if (averageScore >= 70) return 'Proficient';
  if (averageScore >= 60) return 'Developing';
  return 'Beginning';
}

function identifyImprovementAreas(results, activities) {
  return results
    .filter(r => r.score < 70)
    .map(r => {
      const activity = activities.find(a => a.id === r.activityId);
      return activity?.category || 'general';
    })
    .filter((area, index, arr) => arr.indexOf(area) === index);
}

function generateNextRecommendations(scoring, lessonData) {
  const recommendations = [];
  
  if (scoring.score >= 90) {
    recommendations.push({
      type: 'advance',
      title: 'Ready for next level',
      description: 'Excellent work! You\'re ready for more challenging content.'
    });
  } else if (scoring.score >= 70) {
    recommendations.push({
      type: 'practice',
      title: 'Practice similar exercises',
      description: 'Good progress! Practice more to strengthen your skills.'
    });
  } else {
    recommendations.push({
      type: 'review',
      title: 'Review fundamentals',
      description: 'Let\'s review the basic concepts before moving forward.'
    });
  }
  
  return recommendations;
}

async function updateUserProgress(uid, lessonId, scoring) {
  const db = getDb();
  const progressRef = db.collection("users").doc(uid).collection("progress").doc("overall");
  const now = new Date().toISOString();

  const currentProgress = (await progressRef.get()).data() || {
    completedLessons: 0,
    totalLessons: 0,
    averageScore: 0,
    currentStreak: 0
  };

  const currentStreak = typeof currentProgress.currentStreak === "number" ? currentProgress.currentStreak : 0;
  const updatedProgress = {
    completedLessons: scoring.passed ? (currentProgress.completedLessons || 0) + 1 : (currentProgress.completedLessons || 0),
    totalLessons: (currentProgress.totalLessons || 0) + 1,
    averageScore: Math.round(
      ((currentProgress.averageScore || 0) * (currentProgress.totalLessons || 0) + scoring.score) /
      ((currentProgress.totalLessons || 0) + 1)
    ),
    lastCompletedAt: now,
    lastActivityAt: now,
    currentStreak: scoring.passed ? currentStreak + 1 : 0
  };

  await progressRef.set(updatedProgress, { merge: true });

  const profileRef = db.collection("userProfiles").doc(uid);
  await profileRef.set({ lastActivityAt: now }, { merge: true });
}

function calculateNextLesson(currentLesson, performance, allLessons) {
  const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
  
  if (!performance || !performance.passed) {
    return {
      lesson: currentLesson,
      recommendations: [{
        type: 'retry',
        title: 'Try this lesson again',
        description: 'Master this concept before moving forward.'
      }]
    };
  }
  
  // Find next appropriate lesson
  let nextLesson = null;
  if (currentIndex < allLessons.length - 1) {
    nextLesson = allLessons[currentIndex + 1];
  }
  
  const recommendations = [];
  if (performance.score >= 90) {
    recommendations.push({
      type: 'skip-ahead',
      title: 'Ready for challenge',
      description: 'Consider skipping to more advanced content.'
    });
  }
  
  return {
    lesson: nextLesson,
    recommendations
  };
}

module.exports = router;
