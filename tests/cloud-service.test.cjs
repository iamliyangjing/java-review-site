const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createCloudService, createEncryptedSessionStorage, validateConfig } = require("../electron/cloud-service.cjs");

const VALID_CONFIG = {
  url: "https://java-review-test.supabase.co",
  publishableKey: "sb_publishable_test_key_1234567890"
};

async function withTempDir(run) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "java-review-cloud-"));
  try { await run(dataDir); } finally { await fs.rm(dataDir, { recursive: true, force: true }); }
}

function createFakeClientFactory(state) {
  return (url, key, options) => {
    state.clientConfig = { url, key, options };
    return {
      auth: {
        async getSession() { return { data: { session: state.session }, error: null }; },
        async refreshSession() { return { data: { session: state.session, user: state.session?.user }, error: null }; },
        async signUp({ email }) {
          state.session = { user: { id: "user-1", email } };
          return { data: { user: state.session.user, session: state.session }, error: null };
        },
        async signInWithPassword({ email }) {
          state.session = { user: { id: "user-1", email } };
          return { data: { user: state.session.user, session: state.session }, error: null };
        },
        async signOut() { state.session = null; return { error: null }; }
      },
      from(table) {
        assert.equal(table, "jrs_desktop_backups");
        const query = {
          select() { return query; },
          eq(column, value) { state.queriedUser = { column, value }; return query; },
          async maybeSingle() { return { data: state.remote, error: null }; }
        };
        return query;
      },
      async rpc(name, args) {
        state.rpcCall = { name, args };
        const revision = (state.remote?.revision || 0) + 1;
        state.remote = { payload: args.p_payload, revision, updated_at: "2026-10-14T12:00:00.000Z" };
        return { data: { revision, updatedAt: state.remote.updated_at }, error: null };
      }
    };
  };
}

test("validates HTTPS Supabase config and rejects secret keys", () => {
  assert.deepEqual(validateConfig(VALID_CONFIG), VALID_CONFIG);
  assert.throws(() => validateConfig({ ...VALID_CONFIG, url: "http://java-review-test.supabase.co" }), /HTTPS/);
  assert.throws(() => validateConfig({ ...VALID_CONFIG, publishableKey: "sb_secret_12345678901234567890" }), /publishable/);
  const serviceRoleJwt = ["header", Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url"), "signature"].join(".");
  assert.throws(() => validateConfig({ ...VALID_CONFIG, publishableKey: serviceRoleJwt }), /service-role/);
});

test("encrypted auth storage persists only encrypted session data", async () => {
  await withTempDir(async dataDir => {
    const safeStorage = {
      async isAsyncEncryptionAvailable() { return true; },
      async encryptStringAsync(value) { return Buffer.from(value.split("").reverse().join("")); },
      async decryptStringAsync(value) { return { result: value.toString().split("").reverse().join("") }; }
    };
    const first = createEncryptedSessionStorage({ dataDir, safeStorage, storageIdentity: "project-key" });
    await first.setItem("session", "refresh-token-value");
    const files = await fs.readdir(dataDir);
    assert.equal(files.length, 1);
    assert.notEqual(await fs.readFile(path.join(dataDir, files[0]), "utf8"), "refresh-token-value");
    const reopened = createEncryptedSessionStorage({ dataDir, safeStorage, storageIdentity: "project-key" });
    assert.equal(await reopened.getItem("session"), "refresh-token-value");
    await reopened.removeItem("session");
    assert.equal(await reopened.getItem("session"), null);
  });
});

test("uploads and downloads a versioned backup only for the signed-in Supabase user", async () => {
  await withTempDir(async dataDir => {
    const state = { session: null, remote: null };
    const service = createCloudService({
      dataDir,
      configPath: path.join(dataDir, "cloud-config.json"),
      safeStorage: null,
      clientFactory: createFakeClientFactory(state)
    });
    service.saveConfig(VALID_CONFIG);
    assert.equal((await service.getStatus()).signedIn, false);
    await assert.rejects(() => service.uploadBackup({ version: 2, questions: [] }), /登录/);

    const login = await service.signIn({ email: "reviewer@example.com", password: "test-password" });
    assert.deepEqual(login, { authenticated: true, email: "reviewer@example.com" });
    assert.equal((await service.getStatus()).email, "reviewer@example.com");

    const backup = { version: 2, categories: [], questions: [], schedules: [], reviews: [] };
    const uploaded = await service.uploadBackup(backup);
    assert.equal(uploaded.revision, 1);
    assert.equal(state.queriedUser.column, "user_id");
    assert.equal(state.rpcCall.name, "jrs_save_desktop_backup");
    assert.equal(state.rpcCall.args.p_expected_revision, 0);
    const downloaded = await service.downloadBackup();
    assert.deepEqual(downloaded.backup, backup);
    assert.equal(downloaded.revision, 1);
  });
});

test("loads an existing local browser config without returning its key", async () => {
  await withTempDir(async dataDir => {
    const sourceConfig = path.join(dataDir, "supabase-config.local.js");
    await fs.writeFile(sourceConfig, "window.SUPABASE_CONFIG = { url: 'https://java-review-test.supabase.co', publishableKey: 'sb_publishable_test_key_1234567890' };", "utf8");
    const service = createCloudService({ dataDir, developmentConfigPath: sourceConfig, safeStorage: null });
    const status = await service.getStatus();
    assert.equal(status.configured, true);
    assert.equal(status.url, VALID_CONFIG.url);
    assert.equal(Object.hasOwn(status, "publishableKey"), false);
  });
});
