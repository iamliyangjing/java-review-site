const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const GRADE_QUALITY = Object.freeze({ again: 1, hard: 2, good: 4, easy: 5 });
const MAX_QUESTIONS = 100000;
const SCHEMA_VERSION = 2;
const BACKUP_RETENTION = 10;

async function createQuestionStore({ dataDir, seedPath, clock = () => new Date() }) {
  const initSqlJs = require("sql.js");
  const wasmPath = path.join(path.dirname(require.resolve("sql.js")), "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  fs.mkdirSync(dataDir, { recursive: true });
  const databasePath = path.join(dataDir, "question-bank.sqlite");
  const localBackupDir = path.join(dataDir, "backups");
  fs.mkdirSync(localBackupDir, { recursive: true });
  const interruptedReplacePath = databasePath + ".previous";
  if (!fs.existsSync(databasePath) && fs.existsSync(interruptedReplacePath)) fs.renameSync(interruptedReplacePath, databasePath);
  if (fs.existsSync(databasePath) && fs.statSync(databasePath).size) {
    const datedBackup = path.join(localBackupDir, new Date(clock()).toISOString().slice(0, 10) + "-question-bank.sqlite");
    if (!fs.existsSync(datedBackup)) fs.copyFileSync(databasePath, datedBackup);
    for (const name of fs.readdirSync(localBackupDir).filter(name => name.endsWith(".sqlite")).sort().reverse().slice(BACKUP_RETENTION)) {
      fs.unlinkSync(path.join(localBackupDir, name));
    }
  }
  let db;
  if (fs.existsSync(databasePath)) {
    try {
      db = new SQL.Database(fs.readFileSync(databasePath));
      if (db.exec("PRAGMA quick_check")[0]?.values?.[0]?.[0] !== "ok") throw new Error("完整性检查失败");
    } catch (error) {
      try { db?.close(); } catch {}
      const backups = fs.readdirSync(localBackupDir).filter(name => name.endsWith(".sqlite")).sort().reverse();
      const recoveryCandidates = [
        ...(fs.existsSync(interruptedReplacePath) ? [interruptedReplacePath] : []),
        ...backups.map(name => path.join(localBackupDir, name))
      ];
      let recoveredPath = null;
      for (const candidate of recoveryCandidates) {
        try {
          const probe = new SQL.Database(fs.readFileSync(candidate));
          const valid = probe.exec("PRAGMA quick_check")[0]?.values?.[0]?.[0] === "ok";
          probe.close();
          if (valid) { recoveredPath = candidate; break; }
        } catch {}
      }
      if (!recoveredPath) throw new Error("本地题库损坏且没有可用备份，损坏文件已保留；请勿删除应用数据目录。", { cause: error });
      fs.copyFileSync(databasePath, databasePath + ".corrupt-" + Date.now());
      fs.copyFileSync(recoveredPath, databasePath);
      db = new SQL.Database(fs.readFileSync(databasePath));
    }
  } else db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  const dbVersion = Number(db.exec("PRAGMA user_version")[0]?.values?.[0]?.[0] || 0);
  if (dbVersion > SCHEMA_VERSION) {
    db.close();
    throw new Error("题库由较新版本创建，请升级应用后再打开");
  }
  if (dbVersion < SCHEMA_VERSION && fs.existsSync(databasePath) && fs.statSync(databasePath).size) {
    const migrationSnapshot = new Date(clock()).toISOString().replace(/[:.]/g, "-") + "-pre-migration.sqlite";
    fs.copyFileSync(databasePath, path.join(localBackupDir, migrationSnapshot));
    const snapshots = fs.readdirSync(localBackupDir).filter(name => name.endsWith(".sqlite")).sort().reverse();
    for (const name of snapshots.slice(BACKUP_RETENTION)) fs.unlinkSync(path.join(localBackupDir, name));
  }
  initializeSchema();
  migrateSchema();
  seedBundledContent();
  persist();

  function initializeSchema() {
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        level INTEGER NOT NULL,
        core INTEGER NOT NULL DEFAULT 0,
        origin TEXT NOT NULL DEFAULT 'builtin',
        deleted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        source_node_id TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        sources_json TEXT NOT NULL DEFAULT '[]',
        origin TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );
      CREATE TABLE IF NOT EXISTS schedules (
        question_id TEXT PRIMARY KEY,
        repetitions INTEGER NOT NULL DEFAULT 0,
        ease_factor REAL NOT NULL DEFAULT 2.5,
        interval_days INTEGER NOT NULL DEFAULT 0,
        due_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        lapses INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(question_id) REFERENCES questions(id)
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        reviewed_at TEXT NOT NULL,
        grade TEXT NOT NULL CHECK(grade IN ('again', 'hard', 'good', 'easy')),
        next_due_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS legacy_checkins (
        date TEXT NOT NULL,
        node_id TEXT NOT NULL,
        node_name TEXT NOT NULL,
        PRIMARY KEY(date, node_id)
      );
      CREATE TABLE IF NOT EXISTS legacy_mastery (
        node_id TEXT PRIMARY KEY,
        mastery TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_schedules_due ON schedules(due_at);
      CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON reviews(reviewed_at);
      CREATE INDEX IF NOT EXISTS idx_reviews_category ON reviews(category_id, reviewed_at);
    `);
  }

  function migrateSchema() {
    const columns = new Set(rows("PRAGMA table_info(questions)").map(column => column.name));
    if (!columns.has("sources_json")) run("ALTER TABLE questions ADD COLUMN sources_json TEXT NOT NULL DEFAULT '[]'");
    const version = Number(row("PRAGMA user_version")?.user_version || 0);
    if (version > SCHEMA_VERSION) throw new Error("题库由较新版本创建，请升级应用后再打开");
    run("PRAGMA user_version = " + SCHEMA_VERSION);
  }

  function rows(sql, params = []) {
    const statement = db.prepare(sql);
    statement.bind(params);
    const result = [];
    while (statement.step()) result.push(statement.getAsObject());
    statement.free();
    return result;
  }

  function row(sql, params = []) {
    return rows(sql, params)[0] || null;
  }

  function run(sql, params = []) {
    db.run(sql, params);
  }

  function persist() {
    const bytes = Buffer.from(db.export());
    const tempPath = databasePath + ".tmp";
    const file = fs.openSync(tempPath, "w", 0o600);
    try { fs.writeFileSync(file, bytes); fs.fsyncSync(file); } finally { fs.closeSync(file); }
    if (fs.existsSync(databasePath)) {
      const previousPath = databasePath + ".previous";
      try {
        try { fs.unlinkSync(previousPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
        fs.renameSync(databasePath, previousPath);
        fs.renameSync(tempPath, databasePath);
      } catch (error) {
        if (!fs.existsSync(databasePath) && fs.existsSync(previousPath)) fs.renameSync(previousPath, databasePath);
        try { fs.unlinkSync(tempPath); } catch {}
        throw error;
      }
      try { fs.unlinkSync(previousPath); } catch {}
    } else fs.renameSync(tempPath, databasePath);
  }

  function transaction(callback) {
    db.run("BEGIN IMMEDIATE");
    let committed = false;
    try {
      const result = callback();
      db.run("COMMIT");
      committed = true;
      persist();
      return result;
    } catch (error) {
      if (!committed) {
        try { db.run("ROLLBACK"); } catch {}
      } else {
        try { db.close(); } catch {}
        db = new SQL.Database(fs.readFileSync(databasePath));
        db.run("PRAGMA foreign_keys = ON");
      }
      throw error;
    }
  }

  function nowIso() {
    return new Date(clock()).toISOString();
  }

  function seedBundledContent() {
    const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
    if (seed.version !== 1 || !Array.isArray(seed.categories) || !Array.isArray(seed.questions)) {
      throw new Error("内置题库文件格式无效");
    }
    const timestamp = nowIso();
    for (const category of seed.categories) {
      run(`INSERT OR IGNORE INTO categories (id, name, parent_id, level, core, origin)
        VALUES (?, ?, ?, ?, ?, 'builtin')`, [category.id, category.name, category.parentId, category.level, category.core ? 1 : 0]);
    }
    for (const question of seed.questions) {
      run(`INSERT OR IGNORE INTO questions
        (id, category_id, source_node_id, question, answer, tags_json, sources_json, origin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'builtin', ?, ?)`, [
        question.id, question.categoryId, question.sourceNodeId, question.question,
        question.answer, JSON.stringify(question.tags), JSON.stringify(question.sources || []), timestamp, timestamp
      ]);
      run(`INSERT OR IGNORE INTO schedules (question_id, due_at) VALUES (?, ?)`, [question.id, timestamp]);
    }
  }

  function normalizeQuestion(input, existing = null) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("题目格式无效");
    const question = typeof input.question === "string" ? input.question.trim() : "";
    const answer = typeof input.answer === "string" ? input.answer.trim() : "";
    const categoryId = typeof input.categoryId === "string" ? input.categoryId : "";
    if (!question || question.length > 5000) throw new Error("题目需为 1–5000 个字符");
    if (!answer || answer.length > 50000) throw new Error("答案解析需为 1–50000 个字符");
    if (!row("SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL", [categoryId])) throw new Error("请选择有效的知识分类");
    const tags = Array.isArray(input.tags) ? input.tags : [];
    if (tags.length > 20 || !tags.every(tag => typeof tag === "string" && tag.trim().length <= 40)) throw new Error("标签最多 20 个，每个不超过 40 个字符");
    const timestamp = nowIso();
    return {
      id: existing?.id || (typeof input.id === "string" && input.id ? input.id : crypto.randomUUID()),
      categoryId,
      sourceNodeId: existing?.source_node_id || (typeof input.sourceNodeId === "string" ? input.sourceNodeId : null),
      question,
      answer,
      tags: [...new Set(tags.map(tag => tag.trim()).filter(Boolean))],
      sources: normalizeSources(input.sources ?? (existing ? JSON.parse(existing.sources_json || "[]") : [])),
      origin: existing?.origin || "custom",
      createdAt: existing?.created_at || timestamp,
      updatedAt: timestamp
    };
  }

  function normalizeSources(sources) {
    if (!Array.isArray(sources) || sources.length > 10) throw new Error("参考来源最多 10 条");
    return sources.map(source => {
      if (!source || typeof source.title !== "string" || !source.title.trim() || source.title.length > 200 || typeof source.url !== "string") throw new Error("参考来源格式无效");
      let url;
      try { url = new URL(source.url); } catch { throw new Error("参考来源链接无效"); }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("参考来源只允许 HTTP(S) 链接");
      return { title: source.title.trim(), url: url.href };
    });
  }

  function toQuestion(record) {
    return {
      id: record.id,
      categoryId: record.category_id,
      categoryName: record.category_name,
      sourceNodeId: record.source_node_id,
      question: record.question,
      answer: record.answer,
      tags: JSON.parse(record.tags_json),
      sources: JSON.parse(record.sources_json || "[]"),
      origin: record.origin,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      deletedAt: record.deleted_at,
      repetitions: Number(record.repetitions || 0),
      easeFactor: Number(record.ease_factor || 2.5),
      intervalDays: Number(record.interval_days || 0),
      dueAt: record.due_at,
      lastReviewedAt: record.last_reviewed_at,
      lapses: Number(record.lapses || 0)
    };
  }

  function getQuestion(id) {
    return row(`SELECT q.*, s.repetitions, s.ease_factor, s.interval_days, s.due_at,
      s.last_reviewed_at, s.lapses, c.name AS category_name
      FROM questions q JOIN schedules s ON s.question_id = q.id
      JOIN categories c ON c.id = q.category_id WHERE q.id = ?`, [id]);
  }

  function listQuestions(options = {}) {
    const includeDeleted = options.scope === "deleted";
    const allRows = rows(`SELECT q.*, s.repetitions, s.ease_factor, s.interval_days, s.due_at,
      s.last_reviewed_at, s.lapses, c.name AS category_name
      FROM questions q JOIN schedules s ON s.question_id = q.id
      JOIN categories c ON c.id = q.category_id
      WHERE ${includeDeleted ? "q.deleted_at IS NOT NULL" : "q.deleted_at IS NULL AND c.deleted_at IS NULL"}
      ORDER BY c.level, c.name, q.updated_at DESC, q.question COLLATE NOCASE`);
    const query = typeof options.query === "string" ? options.query.trim().toLocaleLowerCase() : "";
    const categoryId = typeof options.categoryId === "string" ? options.categoryId : "";
    const now = nowIso();
    return allRows.map(toQuestion).filter(item => {
      if (categoryId && item.categoryId !== categoryId) return false;
      if (options.scope === "due" && item.dueAt > now) return false;
      if (options.scope === "wrong" && item.lapses === 0) return false;
      if (query && ![item.question, item.answer, item.categoryName, ...item.tags].join(" ").toLocaleLowerCase().includes(query)) return false;
      return true;
    });
  }

  function getCategories() {
    return rows(`SELECT id, name, parent_id AS parentId, level, core, origin, deleted_at AS deletedAt
      FROM categories WHERE deleted_at IS NULL ORDER BY level, name`).map(item => ({ ...item, core: item.core === 1 }));
  }

  function saveQuestion(input) {
    return transaction(() => {
      const existing = input.id ? row("SELECT * FROM questions WHERE id = ? AND deleted_at IS NULL", [input.id]) : null;
      if (input.id && !existing) throw new Error("题目不存在或已删除");
      const question = normalizeQuestion(input, existing);
      if (existing) {
        run(`UPDATE questions SET category_id = ?, source_node_id = ?, question = ?, answer = ?, tags_json = ?, sources_json = ?, updated_at = ? WHERE id = ?`, [
          question.categoryId, question.sourceNodeId, question.question, question.answer, JSON.stringify(question.tags), JSON.stringify(question.sources), question.updatedAt, question.id
        ]);
      } else {
        run(`INSERT INTO questions
          (id, category_id, source_node_id, question, answer, tags_json, sources_json, origin, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'custom', ?, ?)`, [
          question.id, question.categoryId, question.sourceNodeId, question.question, question.answer,
          JSON.stringify(question.tags), JSON.stringify(question.sources), question.createdAt, question.updatedAt
        ]);
        run("INSERT INTO schedules (question_id, due_at) VALUES (?, ?)", [question.id, nowIso()]);
      }
      return toQuestion(getQuestion(question.id));
    });
  }

  function deleteQuestion(id) {
    return transaction(() => {
      const question = row("SELECT id FROM questions WHERE id = ? AND deleted_at IS NULL", [id]);
      if (!question) throw new Error("题目不存在或已删除");
      const deletedAt = nowIso();
      run("UPDATE questions SET deleted_at = ?, updated_at = ? WHERE id = ?", [deletedAt, deletedAt, id]);
      return { id, deletedAt };
    });
  }

  function restoreQuestion(id) {
    return transaction(() => {
      const question = row("SELECT id FROM questions WHERE id = ? AND deleted_at IS NOT NULL", [id]);
      if (!question) throw new Error("回收站中找不到这道题");
      run("UPDATE questions SET deleted_at = NULL, updated_at = ? WHERE id = ?", [nowIso(), id]);
      return toQuestion(getQuestion(id));
    });
  }

  function addDays(timestamp, count) {
    const date = new Date(timestamp);
    date.setDate(date.getDate() + count);
    return date.toISOString();
  }

  function recordReview({ questionId, grade, reviewedAt = nowIso() }) {
    if (!Object.hasOwn(GRADE_QUALITY, grade)) throw new Error("复习评价无效");
    const timestamp = new Date(reviewedAt);
    if (Number.isNaN(timestamp.getTime())) throw new Error("复习时间无效");
    const reviewedAtIso = timestamp.toISOString();
    return transaction(() => {
      const question = row("SELECT * FROM questions WHERE id = ? AND deleted_at IS NULL", [questionId]);
      if (!question) throw new Error("题目不存在或已删除");
      const schedule = row("SELECT * FROM schedules WHERE question_id = ?", [questionId]);
      const quality = GRADE_QUALITY[grade];
      const easeFactor = Math.max(1.3, Number(schedule.ease_factor) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
      const failed = quality < 3;
      const repetitions = failed ? 0 : Number(schedule.repetitions) + 1;
      const intervalDays = failed ? 1 : repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(Number(schedule.interval_days) * easeFactor));
      const nextDueAt = addDays(reviewedAtIso, intervalDays);
      const lapses = Number(schedule.lapses) + (failed ? 1 : 0);
      run(`UPDATE schedules SET repetitions = ?, ease_factor = ?, interval_days = ?, due_at = ?, last_reviewed_at = ?, lapses = ?
        WHERE question_id = ?`, [repetitions, easeFactor, intervalDays, nextDueAt, reviewedAtIso, lapses, questionId]);
      run(`INSERT INTO reviews (question_id, category_id, reviewed_at, grade, next_due_at)
        VALUES (?, ?, ?, ?, ?)`, [questionId, question.category_id, reviewedAtIso, grade, nextDueAt]);
      return { questionId, grade, quality, repetitions, easeFactor, intervalDays, dueAt: nextDueAt, lapses };
    });
  }

  function getReviewHistory(options = {}) {
    const conditions = [];
    const params = [];
    if (options.from) { conditions.push("r.reviewed_at >= ?"); params.push(new Date(options.from).toISOString()); }
    if (options.to) { conditions.push("r.reviewed_at < ?"); params.push(addDays(new Date(options.to).toISOString(), 1)); }
    if (options.categoryId) {
      const categories = rows("SELECT id, parent_id FROM categories WHERE deleted_at IS NULL");
      const allowed = new Set([options.categoryId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const category of categories) {
          if (category.parent_id && allowed.has(category.parent_id) && !allowed.has(category.id)) {
            allowed.add(category.id);
            changed = true;
          }
        }
      }
      conditions.push("r.category_id IN (" + [...allowed].map(() => "?").join(",") + ")");
      params.push(...allowed);
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    return rows(`SELECT r.id, r.question_id AS questionId, r.category_id AS categoryId,
      c.name AS categoryName, r.reviewed_at AS reviewedAt, r.grade, r.next_due_at AS nextDueAt,
      q.question, q.deleted_at AS questionDeletedAt
      FROM reviews r JOIN categories c ON c.id = r.category_id
      LEFT JOIN questions q ON q.id = r.question_id ${where}
      ORDER BY r.reviewed_at DESC LIMIT 5000`, params);
  }

  function getReviewStats() {
    const today = nowIso().slice(0, 10);
    const rowData = row(`SELECT
      (SELECT COUNT(*) FROM questions WHERE deleted_at IS NULL) AS total,
      (SELECT COUNT(*) FROM questions q JOIN schedules s ON s.question_id = q.id WHERE q.deleted_at IS NULL AND s.due_at <= ?) AS due,
      (SELECT COUNT(*) FROM reviews WHERE substr(reviewed_at, 1, 10) = ?) AS reviewedToday,
      (SELECT COUNT(*) FROM questions WHERE deleted_at IS NULL AND id IN (SELECT question_id FROM schedules WHERE lapses > 0)) AS wrong`, [nowIso(), today]);
    const days = rows("SELECT DISTINCT substr(reviewed_at, 1, 10) AS day FROM reviews ORDER BY day DESC").map(item => item.day);
    const daySet = new Set(days);
    let streak = 0;
    const cursor = new Date(today + "T12:00:00");
    if (!daySet.has(today)) cursor.setDate(cursor.getDate() - 1);
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { total: Number(rowData.total), due: Number(rowData.due), reviewedToday: Number(rowData.reviewedToday), wrong: Number(rowData.wrong), streak };
  }

  function exportData() {
    return {
      version: 2,
      exportedAt: nowIso(),
      categories: rows("SELECT * FROM categories ORDER BY level, id"),
      questions: rows("SELECT * FROM questions ORDER BY id"),
      schedules: rows("SELECT * FROM schedules ORDER BY question_id"),
      reviews: rows("SELECT * FROM reviews ORDER BY id"),
      legacyCheckins: rows("SELECT * FROM legacy_checkins ORDER BY date, node_id"),
      legacyMastery: rows("SELECT * FROM legacy_mastery ORDER BY node_id")
    };
  }

  function validateV2(data) {
    if (!Array.isArray(data.categories) || !Array.isArray(data.questions) || !Array.isArray(data.schedules) || !Array.isArray(data.reviews)) throw new Error("题库备份缺少必要数据");
    if (data.questions.length > MAX_QUESTIONS) throw new Error("题目数量超出备份上限");
    const categoryIds = new Set();
    for (const category of data.categories) {
      if (!category || typeof category.id !== "string" || !category.id || typeof category.name !== "string" || !category.name.trim()) throw new Error("备份中的分类格式无效");
      if (categoryIds.has(category.id)) throw new Error("备份中存在重复分类");
      categoryIds.add(category.id);
    }
    const ids = new Set();
    for (const question of data.questions) {
      if (!question || typeof question.id !== "string" || !question.id || typeof question.question !== "string" || !question.question.trim() || typeof question.answer !== "string" || !question.answer.trim() || !categoryIds.has(question.category_id)) throw new Error("备份中的题目格式无效");
      if (ids.has(question.id)) throw new Error("备份中存在重复题目");
      ids.add(question.id);
      if (!Array.isArray(JSON.parse(question.tags_json || "[]"))) throw new Error("备份中的标签格式无效");
      try { normalizeSources(JSON.parse(question.sources_json || "[]")); }
      catch { throw new Error("备份中的参考来源格式无效"); }
    }
    for (const schedule of data.schedules) {
      if (!ids.has(schedule.question_id) || !Number.isInteger(schedule.repetitions) || schedule.repetitions < 0 || !Number.isFinite(schedule.ease_factor) || !Number.isInteger(schedule.interval_days) || schedule.interval_days < 0 || Number.isNaN(new Date(schedule.due_at).getTime())) throw new Error("备份中的复习计划格式无效");
    }
    for (const review of data.reviews) {
      if (!ids.has(review.question_id) || !categoryIds.has(review.category_id) || !Object.hasOwn(GRADE_QUALITY, review.grade) || Number.isNaN(new Date(review.reviewed_at).getTime()) || Number.isNaN(new Date(review.next_due_at).getTime())) throw new Error("备份中的复习记录格式无效");
    }
  }

  function importV2(data) {
    validateV2(data);
    return transaction(() => {
      for (const table of ["reviews", "schedules", "questions", "categories", "legacy_checkins", "legacy_mastery"]) run("DELETE FROM " + table);
      for (const category of data.categories) {
        run("INSERT INTO categories (id, name, parent_id, level, core, origin, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [category.id, category.name, category.parent_id, category.level, category.core || 0, category.origin || "custom", category.deleted_at || null]);
      }
      for (const question of data.questions) {
        run(`INSERT INTO questions (id, category_id, source_node_id, question, answer, tags_json, sources_json, origin, created_at, updated_at, deleted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [question.id, question.category_id, question.source_node_id || null, question.question, question.answer, question.tags_json || "[]", question.sources_json || "[]", question.origin || "custom", question.created_at, question.updated_at, question.deleted_at || null]);
      }
      const schedulesById = new Map(data.schedules.map(item => [item.question_id, item]));
      for (const question of data.questions) {
        const schedule = schedulesById.get(question.id);
        if (schedule) run(`INSERT INTO schedules (question_id, repetitions, ease_factor, interval_days, due_at, last_reviewed_at, lapses)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, [schedule.question_id, schedule.repetitions, schedule.ease_factor, schedule.interval_days, schedule.due_at, schedule.last_reviewed_at || null, schedule.lapses || 0]);
        else run("INSERT INTO schedules (question_id, due_at) VALUES (?, ?)", [question.id, nowIso()]);
      }
      for (const review of data.reviews) run(`INSERT INTO reviews (id, question_id, category_id, reviewed_at, grade, next_due_at) VALUES (?, ?, ?, ?, ?, ?)`, [review.id, review.question_id, review.category_id, review.reviewed_at, review.grade, review.next_due_at]);
      for (const checkin of data.legacyCheckins || []) run("INSERT INTO legacy_checkins (date, node_id, node_name) VALUES (?, ?, ?)", [checkin.date, checkin.node_id, checkin.node_name]);
      for (const item of data.legacyMastery || []) run("INSERT INTO legacy_mastery (node_id, mastery) VALUES (?, ?)", [item.node_id, item.mastery]);
      return { version: 2, questions: data.questions.length, reviews: data.reviews.length };
    });
  }

  function legacyAnswer(note) {
    const points = (Array.isArray(note.points) ? note.points : []).filter(point =>
      /^(核心原理|面试重点|实战避坑|面试话术|版本边界)[：:]/.test(point)
    );
    return [
      typeof note.summary === "string" && note.summary.trim() ? "【核心概述】\n" + note.summary.trim() : "",
      points.length ? "【面试要点】\n" + points.map(point => "• " + point.replace(/^[^：:]+[：:]/, "")).join("\n") : ""
    ].filter(Boolean).join("\n\n") || "请补充这道题的答案解析。";
  }

  function importV1(data) {
    if (!data.edits || typeof data.edits !== "object" || Array.isArray(data.edits)) throw new Error("旧版备份缺少节点修改记录");
    const edits = data.edits;
    const progress = data.progress || {};
    const editNodes = edits.addedNodes || {};
    const renamed = edits.renamed || {};
    const moved = edits.moved || {};
    const notes = edits.notes || {};
    for (const [id, node] of Object.entries(editNodes)) {
      if (!node || node.id !== id || typeof node.name !== "string" || !node.name.trim() || (node.parent !== null && typeof node.parent !== "string")) throw new Error("旧版备份中的自定义分类无效");
    }
    for (const [id, note] of Object.entries(notes)) {
      if (!note || typeof note !== "object" || (note.points !== undefined && (!Array.isArray(note.points) || !note.points.every(point => typeof point === "string")))) throw new Error("旧版备份中的笔记格式无效");
    }
    const deletedIds = new Set(Array.isArray(edits.deleted) ? edits.deleted.filter(id => typeof id === "string") : []);
    let importedQuestions = 0;
    let importedCheckins = 0;
    transaction(() => {
      for (const node of Object.values(editNodes)) {
        const exists = row("SELECT id FROM categories WHERE id = ?", [node.id]);
        if (!exists) run("INSERT INTO categories (id, name, parent_id, level, core, origin) VALUES (?, ?, ?, ?, ?, 'legacy')", [node.id, node.name.trim(), node.parent || null, Number.isInteger(node.level) ? node.level : 1, node.core ? 1 : 0]);
      }
      for (const [id, name] of Object.entries(renamed)) {
        if (typeof name === "string" && name.trim()) run("UPDATE categories SET name = ? WHERE id = ?", [name.trim(), id]);
      }
      for (const [id, parentId] of Object.entries(moved)) run("UPDATE categories SET parent_id = ? WHERE id = ?", [parentId || null, id]);
      for (const id of deletedIds) {
        run("UPDATE categories SET deleted_at = ? WHERE id = ?", [nowIso(), id]);
        run("UPDATE questions SET deleted_at = ?, updated_at = ? WHERE source_node_id = ? AND deleted_at IS NULL", [nowIso(), nowIso(), id]);
      }
      for (const [nodeId, note] of Object.entries(notes)) {
        const category = row("SELECT id, name FROM categories WHERE id = ?", [nodeId]);
        if (!category) continue;
        let index = 0;
        for (const point of note.points || []) {
          const match = point.match(/^模拟题[：:]\s*(.+)$/);
          if (!match) continue;
          const prompt = match[1].trim();
          if (!prompt) continue;
          const existing = row(`SELECT id FROM questions WHERE source_node_id = ?
            ORDER BY CASE origin WHEN 'builtin' THEN 0 ELSE 1 END, id LIMIT 1 OFFSET ?`, [nodeId, index]);
          const answer = legacyAnswer(note);
          if (existing) {
            run("UPDATE questions SET question = ?, answer = ?, category_id = ?, updated_at = ? WHERE id = ?", [prompt, answer, nodeId, nowIso(), existing.id]);
          } else {
            const id = "legacy-" + crypto.createHash("sha256").update(nodeId + "\0" + index + "\0" + prompt).digest("hex").slice(0, 32);
            const createdAt = nowIso();
            run(`INSERT OR IGNORE INTO questions (id, category_id, source_node_id, question, answer, tags_json, origin, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'legacy', ?, ?)`, [id, nodeId, nodeId, prompt, answer, JSON.stringify([category.name]), createdAt, createdAt]);
            run("INSERT OR IGNORE INTO schedules (question_id, due_at) VALUES (?, ?)", [id, nowIso()]);
          }
          importedQuestions++;
          index++;
        }
      }
      for (const [date, nodeIds] of Object.entries(progress.checkins || {})) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(nodeIds)) throw new Error("旧版打卡记录格式无效");
        for (const nodeId of new Set(nodeIds.filter(id => typeof id === "string"))) {
          const category = row("SELECT name FROM categories WHERE id = ?", [nodeId]);
          run("INSERT OR IGNORE INTO legacy_checkins (date, node_id, node_name) VALUES (?, ?, ?)", [date, nodeId, category?.name || nodeId]);
          importedCheckins++;
        }
      }
      for (const [nodeId, mastery] of Object.entries(progress.mastery || {})) {
        if (["unlearned", "learning", "mastered"].includes(mastery)) run("INSERT OR REPLACE INTO legacy_mastery (node_id, mastery) VALUES (?, ?)", [nodeId, mastery]);
      }
    });
    return { version: 1, importedQuestions, importedCheckins };
  }

  function importData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("备份文件格式无效");
    if (data.version === 1) return importV1(data);
    if (data.version === 2) return importV2(data);
    throw new Error("不支持的备份版本");
  }

  function getLegacySummary() {
    return row(`SELECT (SELECT COUNT(DISTINCT date) FROM legacy_checkins) AS days,
      (SELECT COUNT(*) FROM legacy_checkins) AS nodes,
      (SELECT COUNT(*) FROM legacy_mastery) AS masteryCount`);
  }

  return {
    listQuestions,
    getCategories,
    saveQuestion,
    deleteQuestion,
    restoreQuestion,
    recordReview,
    getReviewHistory,
    getReviewStats,
    exportData,
    importData,
    getLegacySummary,
    close() { db.close(); }
  };
}

module.exports = { createQuestionStore, GRADE_QUALITY };
