const axios = require("axios");

let knowledge = [];

// Add knowledge
async function addKnowledge(text) {
  const res = await axios.post("http://localhost:11434/api/embeddings", {
    model: "nomic-embed-text",
    prompt: text
  });

  knowledge.push({
    text,
    embedding: res.data.embedding
  });
}

// Cosine similarity
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

// Get context
async function getContext(query) {
  const res = await axios.post("http://localhost:11434/api/embeddings", {
    model: "nomic-embed-text",
    prompt: query
  });

  const queryEmbedding = res.data.embedding;

  const scored = knowledge.map(k => ({
    text: k.text,
    score: cosineSimilarity(queryEmbedding, k.embedding)
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map(s => s.text).join("\n");
}

module.exports = { addKnowledge, getContext };