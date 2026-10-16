const fs = require("fs");
const { addKnowledge } = require("./rag");

async function loadKnowledge() {
  const data = fs.readFileSync("knowledge.txt", "utf-8");

  const docs = data.split("\n\n");

  for (const doc of docs) {
    await addKnowledge(doc);
    console.log(" Loaded:", doc.slice(0, 40));
  }
}

module.exports = loadKnowledge;