const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const { getContext } = require("./rag");
const loadKnowledge = require("./loadKnowledge");

const app = express();
const prisma = new PrismaClient();

app.use(express.text({ type: "*/*", limit: "1mb" }));
app.use(cors());

// 🔥 LOAD RAG KNOWLEDGE
loadKnowledge();

/* ---------------- RULE ENGINE ---------------- */
function validateCode(code) {
  return {
    hasList: code.includes("[") && code.includes("]"),
    hasLoop: code.includes("for"),
    hasBoolean: code.includes("True") || code.includes("False"),
    hasPrint: code.includes("print")
  };
}

/* ---------------- EVALUATE ---------------- */
app.post("/evaluate", async (req, res) => {
  try {
    let playerCode = req.body;

    if (!playerCode || playerCode.trim() === "") {
      return res.send("Result: wrong\nReason: No code received");
    }

    console.log("📥 CODE:\n", playerCode);

    const playerId = 1; // 🔥 replace later
    const mapName = "python"; // 🔥 replace later
    const timeTaken = 5;

    const checks = validateCode(playerCode);

    let result, reason;

    if (checks.hasList && checks.hasLoop && checks.hasBoolean && checks.hasPrint) {
      result = "correct";
      reason = "All conditions satisfied";
    } else {
      result = "wrong";
      reason = "Missing required logic";
    }

    /* -------- GET OR CREATE MAP STATS -------- */
    let stats = await prisma.playerMapStats.findFirst({
      where: { playerId, mapName }
    });

    if (!stats) {
      stats = await prisma.playerMapStats.create({
        data: { playerId, mapName }
      });
    }

    /* -------- SAVE ATTEMPT -------- */
    await prisma.attempt.create({
      data: {
        playerId,
        mapName,
        question: "Knight Level",
        result,
        timeTaken
      }
    });

    /* -------- UPDATE STATS -------- */
    if (result === "correct") {
      await prisma.playerMapStats.update({
        where: { id: stats.id },
        data: {
          zenPoints: { increment: 100 },
          totalSolved: { increment: 1 },
          streak: { increment: 1 }
        }
      });
    } else {
      await prisma.playerMapStats.update({
        where: { id: stats.id },
        data: {
          totalWrong: { increment: 1 },
          streak: 0
        }
      });
    }

    const damage = result === "correct" ? 100 : 0;

    res.send(`Result: ${result}\nReason: ${reason}\nDamage: ${damage}`);

  } catch (err) {
    console.log(" ERROR:", err.message);
    res.send("Result: wrong\nReason: Server error");
  }
});

/* ---------------- HINT (RAG) ---------------- */
app.post("/hint", async (req, res) => {
  try {
    const code = req.body;

    if (!code || code.trim() === "") {
      return res.send("Hint: Write some code first.");
    }

    const context = await getContext(code);

    const prompt = `
You are a coding mentor inside a game.

Rules:
- DO NOT give full solution
- Only give hint
- Keep it short
    
Knowledge:
${context}

Player Code:
${code}
`;

    const response = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model: "tinyllama",
        prompt,
        stream: false,
        options: { temperature: 0.3 }
      },
      { timeout: 15000 }
    );

    const answer = response.data.response;

    res.send("Hint: " + answer.trim());

  } catch (err) {
    console.log(" ERROR:", err.message);
    res.send("Hint: Try checking your loop or list.");
  }
});

/* ---------------- CREATE PLAYER ---------------- */
app.post("/create-player/:name", async (req, res) => {
  const name = req.params.name;

  const player = await prisma.player.create({
    data: { name }
  });

  res.json(player);
});

/* ---------------- LEADERBOARD (PER MAP) ---------------- */
app.get("/leaderboard/:map", async (req, res) => {
  const mapName = req.params.map;

  const players = await prisma.playerMapStats.findMany({
    where: { mapName },
    orderBy: { zenPoints: "desc" },
    take: 10
  });

  res.json(players);
});

/* ---------------- STATS (PER MAP) ---------------- */
app.get("/stats/:playerId/:map", async (req, res) => {
  const playerId = parseInt(req.params.playerId);
  const mapName = req.params.map;

  const stats = await prisma.playerMapStats.findFirst({
    where: { playerId, mapName }
  });

  const attempts = await prisma.attempt.findMany({
    where: { playerId, mapName }
  });

  const totalAttempts = attempts.length;
  const correct = attempts.filter(a => a.result === "correct").length;

  const accuracy =
    totalAttempts === 0 ? 0 : ((correct / totalAttempts) * 100).toFixed(2);

  res.json({
    stats,
    totalAttempts,
    correct,
    accuracy: accuracy + "%"
  });
});

/* ---------------- TEST ---------------- */
app.get("/test", async (req, res) => {
  const players = await prisma.player.findMany();
  res.json(players);
});

/* ---------------- START ---------------- */
app.listen(3000, () => {
  console.log("lol Server running on http://localhost:3000");
});