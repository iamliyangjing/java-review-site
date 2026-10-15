const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createQuestionStore } = require("../electron/question-store.cjs");

const SEED_PATH = path.resolve(__dirname, "../data/questions.json");

async function withStore(run, options = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "java-review-store-"));
  let currentTime = new Date("2026-10-13T10:00:00.000Z");
  const clock = options.clock || (() => currentTime);
  let store = await createQuestionStore({ dataDir, seedPath: SEED_PATH, clock });
  try {
    const reopen = async () => {
      store.close();
      store = await createQuestionStore({ dataDir, seedPath: SEED_PATH, clock });
      return store;
    };
    await run({ store, dataDir, setTime(value) { currentTime = new Date(value); }, clock, reopen });
  } finally {
    store?.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
}

test("first launch imports all built-in questions and categories exactly once", async () => {
  await withStore(async ({ store, clock, reopen }) => {
    const questions = store.listQuestions();
    assert.equal(questions.length, 183);
    assert.equal(store.getCategories().length, 183);
    assert.ok(questions.every(question => question.question && question.answer && question.categoryName && question.sources.length > 0));
    assert.equal(new Set(questions.map(question => question.categoryId)).size, 183);
    assert.ok(questions.every(question => question.sources.every(source => source.url.startsWith("https://"))));
    assert.equal(questions.every(question => question.dueAt === clock().toISOString()), true);
    const reopened = await reopen();
    assert.equal(reopened.listQuestions().length, 183);
  });
});

test("custom questions persist, soft deletion hides them, and restore returns them", async () => {
  await withStore(async ({ store, clock, reopen }) => {
    const saved = store.saveQuestion({ categoryId: "multithreading", question: "What is a happens-before relation?", answer: "It defines visibility and ordering.", tags: ["JMM", "JMM"] });
    assert.equal(saved.origin, "custom");
    assert.deepEqual(saved.tags, ["JMM"]);
    assert.equal(store.listQuestions().some(question => question.id === saved.id), true);
    store.deleteQuestion(saved.id);
    assert.equal(store.listQuestions().some(question => question.id === saved.id), false);
    assert.equal(store.listQuestions({ scope: "deleted" }).some(question => question.id === saved.id), true);
    const reopened = await reopen();
    assert.equal(reopened.restoreQuestion(saved.id).question, saved.question);
    assert.equal(reopened.listQuestions().length, 184);
  });
});

test("four SM-2 grades update ease, intervals, due dates, and wrong-question state", async () => {
  await withStore(async ({ store, setTime }) => {
    const questionId = "seed-jmm-1";
    const again = store.recordReview({ questionId, grade: "again" });
    assert.equal(again.intervalDays, 1);
    assert.equal(again.repetitions, 0);
    assert.equal(again.lapses, 1);
    assert.equal(again.easeFactor, 1.96);
    assert.equal(store.listQuestions({ scope: "wrong" }).some(question => question.id === questionId), true);

    setTime("2026-10-14T10:00:00.000Z");
    const hard = store.recordReview({ questionId, grade: "hard" });
    assert.equal(hard.intervalDays, 1);
    assert.equal(hard.repetitions, 0);
    assert.equal(hard.lapses, 2);

    setTime("2026-10-15T10:00:00.000Z");
    const goodFirst = store.recordReview({ questionId, grade: "good" });
    assert.equal(goodFirst.intervalDays, 1);
    assert.equal(goodFirst.repetitions, 1);
    assert.equal(goodFirst.easeFactor, 1.64);

    setTime("2026-10-16T10:00:00.000Z");
    const goodSecond = store.recordReview({ questionId, grade: "good" });
    assert.equal(goodSecond.intervalDays, 6);
    assert.equal(goodSecond.repetitions, 2);
    assert.equal(store.getReviewHistory({ categoryId: "multithreading" }).length, 4);
    assert.equal(store.getReviewStats().reviewedToday, 1);
  });
});

test("v2 backup restores the whole workspace and invalid data cannot replace it", async () => {
  await withStore(async ({ store }) => {
    const custom = store.saveQuestion({ categoryId: "database", question: "How does MVCC work?", answer: "Versioned records provide consistent snapshots.", tags: ["MySQL"] });
    store.recordReview({ questionId: custom.id, grade: "easy" });
    const backup = store.exportData();
    assert.equal(backup.version, 2);

    const questionCount = store.listQuestions().length;
    const invalid = structuredClone(backup);
    invalid.questions[0].category_id = "missing-category";
    assert.throws(() => store.importData(invalid), /题目格式无效/);
    assert.equal(store.listQuestions().length, questionCount);

    backup.questions = backup.questions.filter(question => question.id !== custom.id);
    backup.schedules = backup.schedules.filter(schedule => schedule.question_id !== custom.id);
    backup.reviews = [];
    const restored = store.importData(backup);
    assert.equal(restored.questions, 183);
    assert.equal(restored.reviews, 0);
    assert.equal(store.listQuestions().length, 183);
  });
});

test("v1 knowledge-site backups merge mock questions and keep legacy check-ins idempotently", async () => {
  await withStore(async ({ store }) => {
    const backup = {
      version: 1,
      edits: {
        notes: {
          jmm: {
            summary: "JMM defines when writes become visible.",
            points: ["核心原理：happens-before creates ordering.", "模拟题：Why can a plain boolean stay stale?", "面试话术：Explain visibility with safe publication."]
          },
          "custom-thread-note": {
            summary: "Custom thread topic.",
            points: ["模拟题：How would you size a thread pool?"]
          }
        },
        addedNodes: {
          "custom-thread-note": { id: "custom-thread-note", name: "自定义线程题", parent: "multithreading", level: 3, core: false }
        },
        deleted: [],
        renamed: {},
        moved: {}
      },
      progress: {
        mastery: { jmm: "mastered" },
        checkins: { "2026-10-12": ["jmm"] }
      }
    };
    const first = store.importData(backup);
    const second = store.importData(backup);
    assert.equal(first.importedQuestions, 2);
    assert.equal(second.importedQuestions, 2);
    assert.equal(store.listQuestions().filter(question => question.sourceNodeId === "jmm").length, 1);
    assert.equal(store.listQuestions().some(question => question.question === "How would you size a thread pool?"), true);
    assert.deepEqual(store.getLegacySummary(), { days: 1, nodes: 1, masteryCount: 1 });
  });
});

test("question references validate, persist, and appear in exported backups", async () => {
  await withStore(async ({ store }) => {
    const saved = store.saveQuestion({
      categoryId: "basic",
      question: "Explain a Java language guarantee.",
      answer: "Separate specification guarantees from VM implementation details.",
      sources: [{ title: "Java SE specification", url: "https://docs.oracle.com/javase/specs/" }]
    });
    assert.deepEqual(saved.sources, [{ title: "Java SE specification", url: "https://docs.oracle.com/javase/specs/" }]);
    assert.throws(() => store.saveQuestion({
      categoryId: "basic", question: "Invalid source", answer: "Text",
      sources: [{ title: "unsafe", url: "javascript:alert(1)" }]
    }), /HTTP/);
    const backup = store.exportData();
    const exported = backup.questions.find(question => question.id === saved.id);
    assert.deepEqual(JSON.parse(exported.sources_json), saved.sources);
  });
});

test("upgrades an existing schema in place and keeps personal rows and progress", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "java-review-migration-"));
  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs({ locateFile: file => path.join(path.dirname(require.resolve("sql.js")), file) });
  const legacy = new SQL.Database();
  legacy.run("CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT, level INTEGER NOT NULL, core INTEGER NOT NULL DEFAULT 0, origin TEXT NOT NULL DEFAULT 'builtin', deleted_at TEXT)");
  legacy.run("CREATE TABLE questions (id TEXT PRIMARY KEY, category_id TEXT NOT NULL, source_node_id TEXT, question TEXT NOT NULL, answer TEXT NOT NULL, tags_json TEXT NOT NULL DEFAULT '[]', origin TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT)");
  legacy.run("CREATE TABLE schedules (question_id TEXT PRIMARY KEY, repetitions INTEGER NOT NULL DEFAULT 0, ease_factor REAL NOT NULL DEFAULT 2.5, interval_days INTEGER NOT NULL DEFAULT 0, due_at TEXT NOT NULL, last_reviewed_at TEXT, lapses INTEGER NOT NULL DEFAULT 0)");
  legacy.run("INSERT INTO categories (id, name, parent_id, level, origin) VALUES ('personal', 'My category', NULL, 1, 'custom')");
  legacy.run("INSERT INTO questions (id, category_id, question, answer, tags_json, origin, created_at, updated_at) VALUES ('personal-q', 'personal', 'My saved prompt', 'My answer', '[]', 'custom', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')");
  legacy.run("INSERT INTO schedules (question_id, due_at) VALUES ('personal-q', '2026-10-20T00:00:00.000Z')");
  await fs.writeFile(path.join(dataDir, "question-bank.sqlite"), Buffer.from(legacy.export()));
  legacy.close();

  const store = await createQuestionStore({ dataDir, seedPath: SEED_PATH });
  try {
    const question = store.listQuestions().find(item => item.id === "personal-q");
    assert.equal(question.question, "My saved prompt");
    assert.deepEqual(question.sources, []);
    assert.equal(question.dueAt, "2026-10-20T00:00:00.000Z");
    const migrated = new SQL.Database(await fs.readFile(path.join(dataDir, "question-bank.sqlite")));
    assert.equal(migrated.exec("PRAGMA user_version")[0].values[0][0], 2);
    migrated.close();
    const snapshots = (await fs.readdir(path.join(dataDir, "backups"))).filter(name => name.endsWith(".sqlite"));
    assert.equal(snapshots.length, 2);
    assert.ok(snapshots.some(name => name.endsWith("-pre-migration.sqlite")));
  } finally {
    store.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("recovers a corrupt SQLite file from the newest valid local snapshot without discarding it", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "java-review-recovery-"));
  let store = await createQuestionStore({ dataDir, seedPath: SEED_PATH });
  store.close();
  store = null;
  const databasePath = path.join(dataDir, "question-bank.sqlite");
  await fs.copyFile(databasePath, databasePath + ".previous");
  await fs.writeFile(databasePath, Buffer.from("not a SQLite database"));

  store = await createQuestionStore({ dataDir, seedPath: SEED_PATH });
  try {
    assert.equal(store.listQuestions().length, 183);
    assert.equal((await fs.readdir(dataDir)).some(name => name.startsWith("question-bank.sqlite.corrupt-")), true);
  } finally {
    store.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("keeps only the ten newest dated local database snapshots", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "java-review-retention-"));
  let date = new Date("2026-10-01T10:00:00.000Z");
  let store = await createQuestionStore({ dataDir, seedPath: SEED_PATH, clock: () => date });
  for (let day = 2; day <= 13; day++) {
    store.close();
    date = new Date("2026-10-" + String(day).padStart(2, "0") + "T10:00:00.000Z");
    store = await createQuestionStore({ dataDir, seedPath: SEED_PATH, clock: () => date });
  }
  try {
    const snapshots = (await fs.readdir(path.join(dataDir, "backups"))).filter(name => name.endsWith(".sqlite"));
    assert.equal(snapshots.length, 10);
    assert.ok(snapshots.includes("2026-10-13-question-bank.sqlite"));
    assert.ok(!snapshots.includes("2026-10-02-question-bank.sqlite"));
  } finally {
    store.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
