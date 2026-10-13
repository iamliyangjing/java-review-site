// Run with Node's built-in test runner; each test uses isolated in-memory storage.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SITE_ROOT = path.resolve(__dirname, "..");
const SOURCES = [
  "js/data.js", "js/storage.js", "js/edit-store.js", "js/progress.js",
  "js/notes/notes-core-1.js", "js/notes/notes-core-2.js",
  "js/notes/notes-core-3.js", "js/notes/notes-secondary.js", "js/notes/notes-expanded.js", "js/notes/notes-os-expanded.js", "js/notes/notes-network-expanded.js", "js/notes/note-sources.js"
].map(file => [file, fs.readFileSync(path.join(SITE_ROOT, file), "utf8")]);

function setup(initial = {}) {
  const values = new Map(Object.entries(initial));
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const context = vm.createContext({ window: {}, localStorage });
  for (const [file, code] of SOURCES) vm.runInContext(code, context, { filename: file });
  context.window.EditStore.applyOverrides();
  return { ...context.window, values, localStorage };
}

function assertHierarchy(app) {
  assert.equal(new Set(app.NODES.map(node => node.id)).size, app.NODES.length);
  for (const node of app.NODES) {
    assert.equal(node.level, node.parent === null ? 1 : app.NODE_MAP[node.parent].level + 1);
    assert.ok(app.NOTES[node.id]);
  }
}

test("base data has 183 nodes and complete notes", () => {
  const app = setup();
  assert.equal(app.NODES.length, 183);
  assert.equal(Object.keys(app.NOTES).length, 183);
  assertHierarchy(app);
});

test("curriculum preserves legacy identities and new topics have complete interview notes", () => {
  const app = setup();
  const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, "legacy-curriculum.json"), "utf8"));
  const legacyIds = new Set(legacy.map(node => node.id));
  for (const node of legacy) assert.equal(app.NODE_MAP[node.id].parent, node.parent);
  const added = app.NODES.filter(node => !legacyIds.has(node.id));
  assert.equal(added.length, 87);
  for (const node of added) {
    const note = app.NOTES[node.id];
    assert.equal(note.status, "ready");
    assert.ok(note.summary.trim());
    for (const label of ["知识地图", "核心原理", "面试重点", "实战避坑", "模拟题", "面试话术"]) {
      assert.ok(note.points.some(point => point.startsWith(label + "：")), node.id + ": " + label);
    }
    assert.ok(app.NOTE_SOURCES[node.id]?.length, node.id + ": references");
  }
  for (const [id, sources] of Object.entries(app.NOTE_SOURCES)) {
    assert.ok(app.NODE_MAP[id]);
    for (const source of sources) {
      assert.ok(source.label.trim());
      assert.equal(new URL(source.url).protocol, "https:");
    }
  }
});

test("v1 overlays preserve personal content and hide new descendants of deleted topics", () => {
  const app = setup();
  const backup = {
    version: 1,
    edits: {
      notes: { jmm: { summary: "My existing note", points: ["My point"] } },
      renamed: { jmm: "My JMM" }, moved: { jmm: "jvm" }, deleted: ["mysql-index"]
    },
    progress: { mastery: { jmm: "mastered" }, checkins: { "2026-10-07": ["jmm"] } }
  };
  assert.ok(app.EditStore.importData(backup).ok);
  const restored = setup(Object.fromEntries(app.values));
  assert.equal(restored.NODE_MAP.jmm.name, "My JMM");
  assert.equal(restored.NODE_MAP.jmm.parent, "jvm");
  assert.equal(restored.NOTES.jmm.summary, "My existing note");
  assert.equal(restored.ProgressStore.getMastery("jmm"), "mastered");
  assert.ok(JSON.parse(restored.values.get("jrs_checkins"))["2026-10-07"].includes("jmm"));
  assert.equal(restored.NODE_MAP["mysql-explain"], undefined);
  restored.EditStore.resetNode("jmm");
  const reset = setup(Object.fromEntries(restored.values));
  assert.match(reset.NOTES.jmm.summary, /^Java 内存模型/);
  assertHierarchy(reset);
});

test("custom rename and move survive a fresh context", () => {
  const app = setup();
  const id = app.EditStore.addNode("Custom", "jvm");
  app.EditStore.renameNode(id, "Renamed");
  assert.ok(app.EditStore.moveNode(id, "mysql"));
  const restored = setup(Object.fromEntries(app.values));
  assert.equal(restored.NODE_MAP[id].name, "Renamed");
  assert.equal(restored.NODE_MAP[id].parent, "mysql");
  assertHierarchy(restored);
});

test("delete and re-add never reuse a tombstoned ID", () => {
  const app = setup();
  const id = app.EditStore.addNode("Deleted", "jvm");
  app.EditStore.deleteNode(id);
  const nextId = app.EditStore.addNode("Visible", "jvm");
  assert.notEqual(nextId, id);
  const restored = setup(Object.fromEntries(app.values));
  assert.ok(restored.NODE_MAP[nextId]);
  assert.equal(restored.NODE_MAP[id], undefined);
});

test("consecutive adds before explicit merge produce distinct IDs", () => {
  const app = setup();
  const initialCount = app.NODES.length;
  const first = app.EditStore.addNode("One", null);
  const second = app.EditStore.addNode("Two", null);
  assert.notEqual(first, second);
  assert.equal(setup(Object.fromEntries(app.values)).NODES.length, initialCount + 2);
});

test("moving a subtree recalculates every descendant level", () => {
  const app = setup();
  assert.ok(app.EditStore.moveNode("classloader", "mysql-index"));
  const restored = setup(Object.fromEntries(app.values));
  assert.equal(restored.NODE_MAP.classloader.level, 4);
  assert.equal(restored.NODE_MAP["classloader-parents"].level, 5);
  assertHierarchy(restored);
});

test("nodes can become roots while invalid moves leave storage unchanged", () => {
  const app = setup();
  assert.ok(app.EditStore.moveNode("jmm", null));
  const raw = app.values.get("jrs_edits");
  for (const [id, parent] of [["jvm", "gc"], ["jmm", "jmm"], ["jmm", "missing"], ["missing", "jvm"], ["constructor", "jvm"]]) {
    assert.equal(app.EditStore.moveNode(id, parent), false);
    assert.equal(app.values.get("jrs_edits"), raw);
  }
  const restored = setup(Object.fromEntries(app.values));
  assert.equal(restored.NODE_MAP.jmm.parent, null);
  assert.equal(restored.NODE_MAP.jmm.level, 1);
});

test("delete cascades through custom nodes and preserves historic progress", () => {
  const app = setup();
  const id = app.EditStore.addNode("Child", "gc");
  app.ProgressStore.checkIn(id);
  app.ProgressStore.setMastery(id, "mastered");
  const progress = app.values.get("jrs_checkins");
  app.EditStore.deleteNode("jvm");
  const restored = setup(Object.fromEntries(app.values));
  assert.equal(restored.NODE_MAP[id], undefined);
  assert.equal(app.values.get("jrs_checkins"), progress);
  assert.equal(app.ProgressStore.getMastery(id), "mastered");
  assertHierarchy(restored);
});

test("custom reset restores original name, parent, and pending note", () => {
  const app = setup();
  const id = app.EditStore.addNode("Original", "jvm");
  app.EditStore.renameNode(id, "Changed");
  app.EditStore.moveNode(id, null);
  app.EditStore.saveNote(id, { summary: "Edited", points: ["Point"] });
  app.EditStore.resetNode(id);
  const restored = setup(Object.fromEntries(app.values));
  assert.equal(restored.NODE_MAP[id].name, "Original");
  assert.equal(restored.NODE_MAP[id].parent, "jvm");
  assert.equal(restored.NOTES[id].status, "pending");
});

test("reset that would create a cycle is rejected without data loss", () => {
  const app = setup();
  app.EditStore.moveNode("gc", null);
  app.EditStore.moveNode("jvm", "gc");
  const before = app.values.get("jrs_edits");
  assert.throws(() => app.EditStore.resetNode("gc"));
  assert.equal(app.values.get("jrs_edits"), before);
});

test("export and import restore edits, notes, and mastery", () => {
  const source = setup();
  const id = source.EditStore.addNode("Backup", "mysql", { summary: "Summary", points: ["Point"] });
  source.EditStore.renameNode(id, "Backup renamed");
  source.ProgressStore.setMastery(id, "learning");
  source.ProgressStore.checkIn(id);
  const destination = setup();
  const result = destination.EditStore.importData(source.EditStore.exportData());
  assert.equal(result.ok, true);
  const restored = setup(Object.fromEntries(destination.values));
  assert.equal(restored.NODE_MAP[id].name, "Backup renamed");
  assert.equal(restored.NOTES[id].summary, "Summary");
  assert.equal(restored.ProgressStore.getMastery(id), "learning");
  assert.ok(restored.ProgressStore.isCheckedInToday(id));
});

test("repeat import is idempotent and check-ins merge by union", () => {
  const app = setup({ jrs_checkins: JSON.stringify({ "2026-10-07": ["jmm"] }) });
  app.EditStore.saveNote("jmm", { summary: "Local", points: [] });
  const backup = { version: 1, edits: { notes: { jmm: { summary: "Incoming", points: [] } } }, progress: { checkins: { "2026-10-07": ["volatile", "volatile"] } } };
  assert.ok(app.EditStore.importData(backup).ok);
  assert.ok(app.EditStore.importData(backup).ok);
  assert.deepEqual(JSON.parse(app.values.get("jrs_checkins"))["2026-10-07"].sort(), ["jmm", "volatile"]);
  assert.equal(setup(Object.fromEntries(app.values)).NOTES.jmm.summary, "Local");
});

test("malformed or cyclic backups cannot write any storage key", () => {
  const app = setup();
  app.EditStore.saveNote("jmm", { summary: "Keep", points: [] });
  const before = Object.fromEntries(app.values);
  const invalid = [
    { version: 2, edits: {} }, { version: 1, edits: [] },
    { version: 1, edits: { moved: { jvm: "gc" } } },
    { version: 1, edits: { moved: { jmm: "missing" } } },
    { version: 1, edits: { notes: { jmm: { summary: "Wrong", points: "bad" } } } },
    { version: 1, edits: { deleted: {} } },
    { version: 1, edits: {}, progress: { mastery: { jmm: "invalid" } } },
    { version: 1, edits: {}, progress: { checkins: { "2026-02-30": ["jmm"] } } },
    JSON.parse('{"version":1,"edits":{"renamed":{"__proto__":"bad"}}}')
  ];
  for (const backup of invalid) {
    assert.equal(app.EditStore.importData(backup).ok, false);
    assert.deepEqual(Object.fromEntries(app.values), before);
  }
});

test("conflicting custom IDs are reported without silently losing nodes", () => {
  const destination = setup();
  const source = setup();
  destination.EditStore.addNode("Local", null);
  source.EditStore.addNode("Other", null);
  const before = destination.values.get("jrs_edits");
  const result = destination.EditStore.importData(source.EditStore.exportData());
  assert.equal(result.ok, false);
  assert.match(result.message, /ID/);
  assert.equal(destination.values.get("jrs_edits"), before);
});

test("import rollback restores all earlier keys after a quota failure", () => {
  const app = setup();
  app.EditStore.saveNote("jmm", { summary: "Local", points: [] });
  app.ProgressStore.setMastery("jmm", "learning");
  const before = Object.fromEntries(app.values);
  const originalSet = app.localStorage.setItem;
  app.localStorage.setItem = (key, raw) => {
    if (key === "jrs_checkins") throw new Error("QuotaExceededError");
    originalSet(key, raw);
  };
  const result = app.EditStore.importData({ version: 1, edits: { renamed: { jmm: "Incoming" } }, progress: { mastery: { jmm: "mastered" } } });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.fromEntries(app.values), before);
});

test("failed save leaves published data untouched", () => {
  const app = setup();
  const originalName = app.NODE_MAP.jmm.name;
  app.localStorage.setItem = () => { throw new Error("Storage disabled"); };
  assert.throws(() => app.EditStore.renameNode("jmm", "Lost"));
  assert.equal(app.NODE_MAP.jmm.name, originalName);
  assert.equal(app.values.size, 0);
});

test("corrupt local records safely fall back without erasing raw data", () => {
  for (const raw of ["{bad", "null", '{"deleted":{}}', '{"moved":{"jvm":"gc"}}']) {
    const app = setup({ jrs_edits: raw, jrs_mastery: "null", jrs_checkins: "[]" });
    assert.equal(app.NODES.length, 183);
    assert.equal(app.ProgressStore.getMastery("jmm"), "unlearned");
    assert.equal(app.ProgressStore.getTodayCount(), 0);
    assert.equal(app.values.get("jrs_edits"), raw);
    assert.ok(app.AppStorage.takeWarnings().length);
  }
});

test("legacy backups without optional fields remain compatible", () => {
  const app = setup();
  assert.ok(app.EditStore.importData({ version: 1, edits: { renamed: { jmm: "Legacy" } } }).ok);
  assert.equal(setup(Object.fromEntries(app.values)).NODE_MAP.jmm.name, "Legacy");
});

test("corrupt records cannot be overwritten by edits, progress, or import", () => {
  const app = setup({ jrs_edits: "{bad", jrs_mastery: "null", jrs_checkins: "[]" });
  const before = Object.fromEntries(app.values);
  assert.throws(() => app.EditStore.addNode("No overwrite", null));
  assert.throws(() => app.EditStore.saveNote("jmm", { summary: "No overwrite", points: [] }));
  assert.throws(() => app.ProgressStore.setMastery("jmm", "mastered"));
  assert.throws(() => app.ProgressStore.checkIn("jmm"));
  assert.throws(() => app.EditStore.exportData());
  assert.equal(app.EditStore.importData({ version: 1, edits: {} }).ok, false);
  assert.deepEqual(Object.fromEntries(app.values), before);
});

test("graph maps mastery states to colors and clears previous selection", () => {
  const app = setup();
  let option;
  const actions = [];
  const context = vm.createContext({
    window: {
      ...app, addEventListener() {},
      NotePanel: { canLeave: () => true, show() {} },
      echarts: { init: () => ({ setOption(value) { option = value; }, on() {}, dispatchAction(value) { actions.push(value); } }) }
    },
    document: { getElementById: () => ({}) }
  });
  vm.runInContext(fs.readFileSync(path.join(SITE_ROOT, "js/graph.js"), "utf8"), context);
  context.window.GraphView.init("graph");
  context.window.GraphView.setMasteryColors({ jmm: "mastered", volatile: "learning" });
  assert.equal(option.series[0].data.find(node => node.id === "jmm").itemStyle.color, "#4caf50");
  assert.equal(option.series[0].data.find(node => node.id === "volatile").itemStyle.color, "#ffb300");
  context.window.GraphView.selectNode("jmm");
  context.window.GraphView.selectNode("volatile");
  assert.equal(actions.filter(action => action.type === "downplay").length, 2);
});
