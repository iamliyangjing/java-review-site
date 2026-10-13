const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const SITE_ROOT = path.resolve(__dirname, "..");
const USER_A = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.com" };
const USER_B = { id: "22222222-2222-4222-8222-222222222222", email: "b@example.com" };
const clone = value => JSON.parse(JSON.stringify(value));

function setup(initial = {}) {
  const values = new Map(Object.entries(initial));
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const context = vm.createContext({ window: {}, localStorage, setTimeout, clearTimeout });
  for (const file of ["data", "storage", "edit-store", "progress", "notes/notes-core-1", "notes/notes-core-2", "notes/notes-core-3", "notes/notes-secondary", "notes/notes-expanded", "notes/notes-os-expanded", "notes/notes-network-expanded", "cloud-merge", "cloud-workspace"]) {
    vm.runInContext(fs.readFileSync(path.join(SITE_ROOT, "js", file + ".js"), "utf8"), context);
  }
  const app = context.window;
  app.EditStore.applyOverrides();
  const rows = new Map();
  const client = {
    currentUser: USER_A, offline: false, writes: 0, beforeSave: null,
    from() { return { select() { return { eq(column, id) { return { async maybeSingle() {
      if (client.offline) return { error: { message: "Network offline" } };
      return { data: id === client.currentUser?.id ? clone(rows.get(id) || null) : null };
    } }; } }; } }; },
    async rpc(name, params) {
      if (client.offline) return { error: { message: "Network offline" } };
      if (client.beforeSave) { const hook = client.beforeSave; client.beforeSave = null; await hook(); }
      if (params.p_user_id !== client.currentUser?.id) return { error: { code: "PT401", message: "User mismatch" } };
      const previous = rows.get(params.p_user_id);
      if ((previous?.revision || 0) !== params.p_expected_revision) return { error: { code: "PT409", message: "Concurrent update" } };
      const revision = params.p_expected_revision + 1;
      rows.set(params.p_user_id, { payload: clone(params.p_payload), revision });
      client.writes++;
      return { data: { revision } };
    }
  };
  const engine = app.CloudWorkspace.create(client);
  return { app, values, client, rows, engine };
}

test("login, explicit migration, logout and account switch preserve separate records", async t => {
  const { app, engine, rows, client, values } = setup();
  t.after(() => engine.dispose());
  app.ProgressStore.setMastery("jmm", "mastered");
  const guestRaw = values.get("jrs_mastery");
  await engine.connect(USER_A);
  assert.equal(app.ProgressStore.getMastery("jmm"), "unlearned");
  await engine.importLocal();
  assert.equal(rows.get(USER_A.id).payload.progress.mastery.jmm, "mastered");
  assert.equal(values.get("jrs_mastery"), guestRaw);
  client.currentUser = USER_B;
  await engine.connect(USER_B);
  assert.equal(app.ProgressStore.getMastery("jmm"), "unlearned");
  app.ProgressStore.setMastery("jvm", "learning");
  await engine.syncNow();
  assert.equal(rows.get(USER_B.id).payload.progress.mastery.jmm, undefined);
  client.currentUser = null;
  await engine.connect(null);
  assert.equal(app.ProgressStore.getMastery("jmm"), "mastered");
  assert.equal(app.ProgressStore.getMastery("jvm"), "unlearned");
});

test("offline account edits survive reload and merge with independent remote changes", async t => {
  const first = setup();
  t.after(() => first.engine.dispose());
  await first.engine.connect(USER_A);
  first.client.offline = true;
  first.app.ProgressStore.setMastery("jmm", "learning");
  assert.equal(await first.engine.syncNow(), false);
  assert.equal(first.app.ProgressStore.getMastery("jmm"), "learning");
  const second = setup(Object.fromEntries(first.values));
  t.after(() => second.engine.dispose());
  const remote = clone(first.rows.get(USER_A.id));
  remote.payload.edits.renamed.jvm = "Remote JVM";
  remote.revision++;
  second.rows.set(USER_A.id, remote);
  await second.engine.connect(USER_A);
  assert.equal(second.rows.get(USER_A.id).payload.progress.mastery.jmm, "learning");
  assert.equal(second.app.NODE_MAP.jvm.name, "Remote JVM");
});

test("a concurrent save is retried against the newly read remote revision", async t => {
  const { app, client, rows, engine } = setup();
  t.after(() => engine.dispose());
  await engine.connect(USER_A);
  app.ProgressStore.setMastery("jmm", "mastered");
  client.beforeSave = () => {
    rows.get(USER_A.id).payload.progress.mastery.jvm = "learning";
    rows.get(USER_A.id).revision++;
  };
  assert.equal(await engine.syncNow(), true);
  assert.deepEqual(rows.get(USER_A.id).payload.progress.mastery, { jmm: "mastered", jvm: "learning" });
});

test("competing edits block writes and explicit cloud resolution preserves recovery", async t => {
  const { app, rows, engine } = setup();
  t.after(() => engine.dispose());
  await engine.connect(USER_A);
  app.ProgressStore.setMastery("jmm", "learning");
  rows.get(USER_A.id).payload.progress.mastery.jmm = "mastered";
  rows.get(USER_A.id).revision++;
  assert.equal(await engine.syncNow(), false);
  assert.ok(engine.getState().conflict);
  assert.equal(app.ProgressStore.getMastery("jmm"), "learning");
  assert.equal(await engine.resolve("cloud"), true);
  assert.equal(app.ProgressStore.getMastery("jmm"), "mastered");
  assert.equal(engine.getRecovery().local.progress.mastery.jmm, "learning");
});

test("explicit local resolution writes a fresh revision and preserves the cloud copy", async t => {
  const { app, rows, engine } = setup();
  t.after(() => engine.dispose());
  await engine.connect(USER_A);
  app.EditStore.renameNode("jvm", "Local name");
  rows.get(USER_A.id).payload.edits.renamed.jvm = "Remote name";
  rows.get(USER_A.id).revision++;
  await engine.syncNow();
  assert.equal(await engine.resolve("local"), true);
  assert.equal(rows.get(USER_A.id).payload.edits.renamed.jvm, "Local name");
  assert.equal(engine.getRecovery().remote.edits.renamed.jvm, "Remote name");
});

test("a local edit during a pending save is retained and synchronized on the next pass", async t => {
  const { app, rows, client, engine } = setup();
  t.after(() => engine.dispose());
  await engine.connect(USER_A);
  app.ProgressStore.setMastery("jmm", "learning");
  client.beforeSave = () => app.ProgressStore.setMastery("jvm", "mastered");
  await engine.syncNow();
  assert.equal(app.ProgressStore.getMastery("jvm"), "mastered");
  await engine.syncNow();
  assert.equal(rows.get(USER_A.id).payload.progress.mastery.jvm, "mastered");
});

test("switching auth identity during an in-flight save cannot copy one account to another", async t => {
  const { app, rows, client, engine } = setup();
  t.after(() => engine.dispose());
  await engine.connect(USER_A);
  app.ProgressStore.setMastery("jmm", "mastered");
  let switchTask;
  client.beforeSave = () => { client.currentUser = USER_B; switchTask = engine.connect(USER_B); };
  await engine.syncNow();
  await switchTask;
  assert.equal(rows.get(USER_B.id).payload.progress.mastery.jmm, undefined);
  assert.equal(rows.get(USER_A.id).payload.progress.mastery.jmm, undefined);
  client.currentUser = USER_A;
  await engine.connect(USER_A);
  assert.equal(rows.get(USER_A.id).payload.progress.mastery.jmm, "mastered");
});

test("invalid remote hierarchy is rejected before replacing or uploading local data", async t => {
  const { app, rows, client, engine } = setup();
  t.after(() => engine.dispose());
  await engine.connect(USER_A);
  app.ProgressStore.setMastery("jmm", "mastered");
  rows.get(USER_A.id).payload.edits.moved.jvm = "jvm";
  const writes = client.writes;
  assert.equal(await engine.syncNow(), false);
  assert.equal(client.writes, writes);
  assert.equal(app.ProgressStore.getMastery("jmm"), "mastered");
  assert.equal(engine.getState().isError, true);
});

test("corrupt sync metadata is preserved and blocks accidental remote writes", async t => {
  const { engine, client, values } = setup({ ["jrs_cloud_" + USER_A.id]: "broken" });
  t.after(() => engine.dispose());
  assert.equal(await engine.connect(USER_A), false);
  assert.equal(await engine.syncNow(), false);
  assert.equal(client.writes, 0);
  assert.equal(values.get("jrs_cloud_" + USER_A.id), "broken");
});

test("three-way merge handles note resets, check-in union and custom-ID collisions", () => {
  const { app, engine } = setup();
  engine.dispose();
  const base = app.CloudMerge.empty();
  base.edits.notes.jmm = { summary: "Edited", points: [], status: "ready", core: true };
  const local = clone(base);
  const remote = clone(base);
  delete local.edits.notes.jmm;
  local.progress.checkins["2026-10-07"] = ["jmm"];
  remote.progress.checkins["2026-10-07"] = ["jvm", "jmm"];
  const merged = app.CloudMerge.merge(base, local, remote);
  assert.equal(merged.edits.notes.jmm, undefined);
  assert.deepEqual(clone(merged.progress.checkins["2026-10-07"]), ["jmm", "jvm"]);
  local.edits.addedNodes["custom-1"] = { id: "custom-1", name: "A", parent: null, core: false };
  remote.edits.addedNodes["custom-1"] = { id: "custom-1", name: "B", parent: null, core: false };
  assert.throws(() => app.CloudMerge.merge(base, local, remote), /同时修改/);
});
