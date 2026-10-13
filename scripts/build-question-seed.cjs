const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_FILES = [
  "js/data.js",
  "js/notes/notes-core-1.js",
  "js/notes/notes-core-2.js",
  "js/notes/notes-core-3.js",
  "js/notes/notes-secondary.js",
  "js/notes/notes-expanded.js",
  "js/notes/notes-os-expanded.js",
  "js/notes/notes-network-expanded.js"
];

function createQuestion(node, note, prompt, index) {
  const points = note.points.filter(point =>
    /^(核心原理|面试重点|实战避坑|面试话术|版本边界)[：:]/.test(point)
  );
  const answer = [
    "【核心概述】\n" + note.summary,
    points.length ? "【面试要点】\n" + points.map(point => "• " + point.replace(/^[^：:]+[：:]/, "")).join("\n") : ""
  ].filter(Boolean).join("\n\n");
  return {
    id: "seed-" + node.id + "-" + (index + 1),
    categoryId: node.id,
    sourceNodeId: node.id,
    question: prompt,
    answer,
    tags: [node.name, ...(node.core ? ["核心考点"] : [])],
    origin: "builtin"
  };
}

function main() {
  const context = { window: {} };
  vm.createContext(context);
  for (const relativePath of SOURCE_FILES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    vm.runInContext(source, context, { filename: relativePath });
  }

  const nodes = context.window.NODES;
  const notes = context.window.NOTES;
  const questions = [];
  for (const node of nodes) {
    const note = notes[node.id];
    if (!note || !Array.isArray(note.points)) continue;
    let index = 0;
    for (const point of note.points) {
      const match = point.match(/^模拟题[：:]\s*(.+)$/);
      if (match) questions.push(createQuestion(node, note, match[1].trim(), index++));
    }
  }

  const result = {
    version: 1,
    generatedAt: new Date().toISOString(),
    categories: nodes.map(node => ({
      id: node.id,
      name: node.name,
      parentId: node.parent,
      level: node.level,
      core: node.core === true,
      origin: "builtin"
    })),
    questions
  };
  const outputPath = path.join(ROOT, "data", "questions.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  process.stdout.write(JSON.stringify({ categories: result.categories.length, questions: questions.length, outputPath }) + "\n");
}

main();
