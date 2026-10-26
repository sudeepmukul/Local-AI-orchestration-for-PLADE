/* ============================================================
   QUEST COMPASS — Agentic Learning-Path Server (standalone)
   ============================================================
   This is a NEW, independent, READ-ONLY companion server for
   the existing ai-server. It does NOT modify server.js, the
   Prisma schema, or any existing file. It only READS the same
   Prisma SQLite DB to build personalized, themed learning
   paths for students using the local Ollama LLM (tinyllama).

   Run:  node quest-compass-server.js
   Open: http://localhost:3001
   ============================================================ */

const express = require("express");
const axios = require("axios");
const path = require("path");
const {
  PrismaClient
} = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

const PORT = 3001;
const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_TAGS = "http://localhost:11434/api/tags";
// Prefer small/fast completion models that are actually installed.
const PREFERRED_MODELS = ["phi3:mini", "gemma4:e2b", "qwen3:8b", "tinyllama"];
let OLLAMA_MODEL = null;

async function pickModel() {
  try {
    const res = await axios.get(OLLAMA_TAGS, { timeout: 5000 });
    const names = (res.data.models || []).map(m => m.name);
    for (const pref of PREFERRED_MODELS) {
      if (names.includes(pref)) return pref;
    }
    // fall back to first non-embedding model
    const first = names.find(n => !/embed/i.test(n));
    return first || null;
  } catch {
    return null;
  }
}

app.use(express.json({ limit: "1mb" }));

/* ============================================================
   STEP 1 — GATHER: read a student's full history from Prisma
   ============================================================ */
async function gatherPlayerProfile(playerId) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { mapStats: true }
  });

  if (!player) return null;

  const attempts = await prisma.attempt.findMany({
    where: { playerId },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  const totalAttempts = attempts.length;
  const correct = attempts.filter(a => a.result === "correct");
  const wrong = attempts.filter(a => a.result !== "correct");

  // Recent trend: last 15 attempts vs previous 15
  const recent15 = attempts.slice(0, 15);
  const prev15 = attempts.slice(15, 30);
  const rateOf = arr =>
    arr.length === 0
      ? null
      : Math.round((arr.filter(a => a.result === "correct").length / arr.length) * 100);
  const recentRate = rateOf(recent15);
  const prevRate = rateOf(prev15);
  const trend =
    recentRate === null || prevRate === null
      ? "unknown"
      : recentRate > prevRate
        ? "improving"
        : recentRate < prevRate
          ? "declining"
          : "steady";

  // Weakest streaks: find consecutive wrong runs
  let longestWrongRun = 0, run = 0;
  for (const a of attempts.slice(0, 50)) {
    if (a.result !== "correct") { run++; longestWrongRun = Math.max(longestWrongRun, run); }
    else run = 0;
  }

  return {
    player: {
      id: player.id,
      name: player.name,
      zenPoints: player.zenPoints,
      totalSolved: player.totalSolved,
      totalWrong: player.totalWrong,
      bestStreak: player.bestStreak,
      joined: player.createdAt
    },
    maps: player.mapStats.map(m => ({
      mapName: m.mapName,
      zenPoints: m.zenPoints,
      totalSolved: m.totalSolved,
      totalWrong: m.totalWrong,
      streak: m.streak
    })),
    analysis: {
      totalAttempts,
      correctCount: correct.length,
      wrongCount: wrong.length,
      accuracy: totalAttempts === 0 ? 0 : Math.round((correct.length / totalAttempts) * 100),
      recentRate,
      prevRate,
      trend,
      longestWrongRun,
      wrongQuestions: [...new Set(wrong.map(a => a.question).filter(Boolean))].slice(0, 10),
      lastActive: attempts[0] ? attempts[0].createdAt : player.createdAt
    }
  };
}

/* ============================================================
   STEP 2 — CLASSIFY: map performance -> skill level
   (rule-based, works even without the LLM)
   ============================================================ */
function classify(profile) {
  const a = profile.analysis;
  const accuracy = a.accuracy;
  if (accuracy >= 80) return "elite";
  if (accuracy >= 60) return "intermediate";
  if (accuracy >= 40) return "apprentice";
  return "beginner";
}

/* ============================================================
   STEP 3 — LEARNING CONTENT LIBRARY
   Real, curated free resources (videos + notes) per skill node.
   The agentic planner picks&orders these adaptively.
   ============================================================ */
const SKILL_NODES = {
  // ---- PYTHON FOUNDATION ----
  print_basics: {
    title: "The print() Command",
    themeName: { medieval: "Rune of Echoes — the print() Scroll", space: "Signal Beacon — the print() Transmission" },
    videos: [
      { title: "Python for Beginners - Learn Coding with Python in 1 Hour", url: "https://www.youtube.com/watch?v=kqtD5dpn9C8", id: "kqtD5dpn9C8" }
    ],
    notes: "print() sends output to the console. In the game, every correct 'spell' (solution) must contain print().",
    check: "You can print any message or variable to the screen."
  },
  lists: {
    title: "Lists",
    themeName: { medieval: "The Inventory Satchel — Python Lists", space: "Cargo Bay — Python Lists" },
    videos: [
      { title: "Python Lists || Python Tutorial || Learn Python Programming", url: "https://www.youtube.com/watch?v=ohCDWZgNIU0", id: "ohCDWZgNIU0" }
    ],
    notes: "A list stores many values in order: [a, b, c]. Square brackets [ ] are the game's signal that a list is required.",
    check: "You can create, read and modify items in a list."
  },
  loops: {
    title: "for Loops",
    themeName: { medieval: "March of the Endless Legion — for Loops", space: "Orbital Cycle — for Loops" },
    videos: [
      { title: "Python Tutorial for Beginners 7: Loops and Iterations - For/While Loops", url: "https://www.youtube.com/watch?v=6iF8Xb7Z3wQ", id: "6iF8Xb7Z3wQ" }
    ],
    notes: "`for x in something:` repeats work for every element. The game checks 'for' keyword to verify your loop.",
    check: "You can loop over a list and use each item."
  },
  booleans: {
    title: "Booleans & Conditions",
    themeName: { medieval: "Truth-Seer's Trial — True/False", space: "Dual-Core Logic — True/False" },
    videos: [
      { title: "Python Tutorial for Beginners 6: Conditionals and Booleans", url: "https://www.youtube.com/watch?v=DZwmZ8Usvnk", id: "DZwmZ8Usvnk" }
    ],
    notes: "True and False drive decisions. The game looks for True/False literals to confirm boolean logic.",
    check: "You can write conditions that pass True/False around."
  },
  combining: {
    title: "Combining All Skills",
    themeName: { medieval: "The Grand Gauntlet — Full Trial", space: "Docking Maneuver — Full System" },
    videos: [
      { title: "Learn Python - Full Course for Beginners [Tutorial]", url: "https://www.youtube.com/watch?v=rfscVS0vtbw", id: "rfscVS0vtbw" }
    ],
    notes: "Real quests need everything at once: a list, a loop over it, boolean decisions, and a print at the end.",
    check: "You can write one program using list + for + True/False + print together."
  },
  consistency: {
    title: "Consistency & Streaks",
    themeName: { medieval: "Squire Discipline — Daily Drills", space: "Mission Cadence — Daily Seders Drills" },
    videos: [
      { title: "Learn Python - Full Course for Beginners [Tutorial]", url: "https://www.youtube.com/watch?v=rfscVS0vtbw", id: "rfscVS0vtbw" }
    ],
    notes: "Accuracy improves with short, frequent sessions. One wrong-heavy session hurts streaks; small daily doses win.",
    check: "You have played on several different days this week."
  },
  speed: {
    title: "Speed & Confidence",
    themeName: { medieval: "Duel Reflexes — Thinking Fast", space: "Launch Window — Thinking Fast" },
    videos: [
      { title: "Learn Python - Full Course for Beginners [Tutorial]", url: "https://www.youtube.com/watch?v=rfscVS0vtbw", id: "rfscVS0vtbw" }
    ],
    notes: "Once accuracy is stable, aim to lower time per attempt by pattern recognition, not rushing.",
    check: "Your average solve time is dropping while accuracy stays high."
  }
};

const ORDER_BY_LEVEL = {
  beginner: ["print_basics", "lists", "booleans", "loops", "combining", "consistency"],
  apprentice: ["lists", "booleans", "loops", "combining", "consistency", "speed"],
  intermediate: ["loops", "booleans", "combining", "consistency", "speed"],
  elite: ["combining", "consistency", "speed"]
};

/* Deterministic planner: builds the roadmap from the student's data */
function buildFallbackPlan(profile, theme) {
  const level = classify(profile);
  const accuracy = profile.analysis.accuracy;
  const nodeIds = ORDER_BY_LEVEL[level];
  const stages = nodeIds.map((id, i) => {
    const node = SKILL_NODES[id];
    return {
      order: i + 1,
      id,
      title: node.themeName[theme],
      skill: node.title,
      goal: "Master: " + node.check,
      video: node.videos[0],
      note: node.notes,
      check: node.check,
      xpGate: i * 150,
      status: i === 0 ? "current" : "locked"
    };
  });

  const flavor =
    theme === "medieval"
      ? {
          world: "The Kingdom of Zenhold",
          intro: `Hail, ${profile.player.name}! accuracy ${accuracy}% of gauntlet trials attempted. The Grand Sage has inscribed your path upon the Compass.`,
          motivation: "Every wrong attempt is merely a shield arrow — learn its arc, and victory follows."
        }
      : {
          world: "Sector Zen-7: The Nebula Frontier",
          intro: `Navigator ${profile.player.name}, accuracy ${accuracy}% of mission simulations completed. Mission Control has plotted your flight path.`,
          motivation: "Failed simulations are engine burns — each one pushes you further into mastery."
        };

  return {
    theme,
    level,
    world: flavor.world,
    intro: flavor.intro,
    motivation: flavor.motivation,
    stages
  };
}

/* ============================================================
   STEP 4 — AGENT: use local Ollama LLM to personalize copy
   (falls back to deterministic plan if Ollama is offline)
   ============================================================ */
async function llmGenerate(prompt, fallback) {
  if (!OLLAMA_MODEL) return fallback;
  try {
    const res = await axios.post(
      OLLAMA_URL,
      {
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.6, num_predict: 900 }
      },
      { timeout: 120000 }
    );
    const text = (res.data.response || "").trim();
    if (text && text.length > 40) return text;
    return fallback;
  } catch {
    return fallback;
  }
}

async function buildAgentPlan(profile, theme) {
  const level = classify(profile);
  const plan = buildFallbackPlan(profile, theme);
  const nodeIds = ORDER_BY_LEVEL[level];

  const prompt = `You are "Zen Compass", a quest designer inside a coding game for students.
The game theme is: ${theme === "medieval" ? "medieval kingdom of knights, sages and dragons" : "space odyssey of astronauts, starships and nebulae"}.
The student plays Python coding challenges on a map called "${profile.maps[0]?.mapName || "python"}" (Knight Level: write code using a LIST, a FOR LOOP, True/False booleans, and print).

Student data (name, accuracy, trend, key facts):
- Name: ${profile.player.name}
- Zen Points: ${profile.player.zenPoints}
- Accuracy: ${profile.analysis.accuracy}%
- Correct: ${profile.analysis.correctCount}, Wrong: ${profile.analysis.wrongCount}
- Recent trend: ${profile.analysis.trend}
- Longest chain of wrong answers in a row: ${profile.analysis.longestWrongRun}
- Skill level classification: ${level}
- Skills to master in order: ${nodeIds.map(id => SKILL_NODES[id].title).join(", ")}

Write a JSON object with exactly these keys: {"world":"...", "intro":"...", "motivation":"...", "stageNotes":["..." for each of the ${nodeIds.length} stages, one motivating themed sentence per stage in order], "captainTip":"..."}
Keep each string under 40 words. Fully embrace the ${theme} theme (knights/sages/dragons OR astronauts/starships/nebulae). Do not write anything outside the JSON.`;

  const raw = await llmGenerate(prompt, "");
  let enriched = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) enriched = JSON.parse(m[0]);
  } catch { /* ignore, fall back */ }

  if (enriched) {
    const cp = plan;
    cp.world = enriched.world || cp.world;
    cp.intro = enriched.intro || cp.intro;
    cp.motivation = enriched.motivation || cp.motivation;
    cp.captainTip = enriched.captainTip || (theme === "medieval" ? "The wise practice daily — even ten lines a day forges mastery." : "Mission Control advises small daily flight sims instead of marathon missions.");
    if (Array.isArray(enriched.stageNotes)) {
      cp.stages.forEach((s, i) => {
        if (enriched.stageNotes[i]) s.note = enriched.stageNotes[i] + " " + SKILL_NODES[s.id].notes;
      });
    }
    plan.generatedBy = "ollama:" + OLLAMA_MODEL;
  } else {
    plan.captainTip = theme === "medieval" ? "The wise practice daily — even ten lines a day forges mastery." : "Mission Control advises small daily flight sims instead of marathon missions.";
    plan.generatedBy = "local-rule-engine";
  }
  return plan;
}

/* ============================================================
   STEP 5 — ENDPOINTS (read-only + plan generation)
   ============================================================ */
app.get("/api/players", async (req, res) => {
  const players = await prisma.player.findMany({
    include: { mapStats: true },
    orderBy: { id: "asc" }
  });
  res.json(players.map(p => {
    const stats = p.mapStats.reduce((s, m) => ({ solved: s.solved + m.totalSolved, wrong: s.wrong + m.totalWrong }), { solved: 0, wrong: 0 });
    return {
      id: p.id,
      name: p.name,
      zenPoints: p.zenPoints,
      totalSolved: stats.solved,
      totalWrong: stats.wrong,
      accuracy: stats.solved + stats.wrong === 0 ? 0 : Math.round((stats.solved / (stats.solved + stats.wrong)) * 100)
    };
  }));
});

app.get("/api/profile/:playerId", async (req, res) => {
  try {
    const profile = await gatherPlayerProfile(parseInt(req.params.playerId));
    if (!profile) return res.status(404).json({ error: "Player not found" });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/quest/:playerId/:theme", async (req, res) => {
  try {
    const theme = req.params.theme === "space" ? "space" : "medieval";
    const profile = await gatherPlayerProfile(parseInt(req.params.playerId));
    if (!profile) return res.status(404).json({ error: "Player not found" });
    const plan = await buildAgentPlan(profile, theme);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   STEP 6 — dashboard static files (served over HTTP so that
   YouTube embeds get a valid origin and actually play)
   ============================================================ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "plade_local_analytics.html"));
});
app.get("/compass", (req, res) => {
  res.sendFile(path.join(__dirname, "quest-compass.html"));
});
app.get("/analytics", (req, res) => {
  res.sendFile(path.join(__dirname, "plade_local_analytics.html"));
});

(async () => {
  OLLAMA_MODEL = await pickModel();
  app.listen(PORT, () => {
    console.log(``);
    console.log(`  🧭  QUEST COMPASS running (read-only companion server)`);
    console.log(`      Dashboard : http://localhost:${PORT}`);
    console.log(`      Game server (untouched, port 3000) is separate.`);
    console.log(`      LLM       : ${OLLAMA_MODEL || "none (rule engine fallback)"} @ localhost:11434`);
    console.log(``);
  });
})();
