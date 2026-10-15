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
        async setSession(tokens) {
          state.providedTokens = tokens;
          state.session = { user: { id: "user-1", email: "reviewer@example.com" } };
          return { data: { user: state.session.user, session: state.session }, error: null };
        },
        async signInAnonymously() {
          if (state.anonymousErrorCode) return { data: { user: null, session: null }, error: { code: state.anonymousErrorCode, message: "disabled" } };
          state.session = { user: { id: "anonymous-user-1", is_anonymous: true } };
          return { data: { user: state.session.user, session: state.session }, error: null };
        },
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
        assert.equal(table, "jrs_desktop_backup_snapshots");
        let selectedRevision = null;
        const query = {
          select() { return query; },
          eq(column, value) {
            if (column === "user_id") state.queriedUser = { column, value };
            if (column === "revision") selectedRevision = Number(value);
            return query;
          },
          order() { return query; },
          limit() { return query; },
          then(resolve, reject) { return Promise.resolve({
            data: state.snapshots.slice(-10).reverse().map(item => ({ revision: item.revision, created_at: item.created_at })),
            error: null
          }).then(resolve, reject); },
          async maybeSingle() {
            const item = selectedRevision
              ? state.snapshots.find(snapshot => snapshot.revision === selectedRevision)
              : state.snapshots.at(-1);
            return { data: item || null, error: null };
          }
        };
        return query;
      },
      async rpc(name, args) {
        state.rpcCall = { name, args };
        const revision = (state.snapshots.at(-1)?.revision || 0) + 1;
        const snapshot = { payload: args.p_payload, revision, created_at: "2026-10-14T12:00:00.000Z" };
        state.snapshots.push(snapshot);
        state.remote = snapshot;
        return { data: { revision, createdAt: snapshot.created_at }, error: null };
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
    const state = { session: null, remote: null, snapshots: [] };
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
    assert.equal(state.rpcCall.name, "jrs_save_desktop_backup_snapshot");
    assert.equal(state.rpcCall.args.p_expected_revision, 0);
    const downloaded = await service.downloadBackup();
    assert.deepEqual(downloaded.backup, backup);
    assert.equal(downloaded.revision, 1);
    assert.equal((await service.listBackups())[0].revision, 1);
    const second = await service.uploadBackup({ ...backup, marker: "second" });
    assert.equal(second.revision, 2);
    assert.deepEqual((await service.downloadBackup(1)).backup, backup);
    assert.equal((await service.downloadBackup()).revision, 2);
  });
});

test("signs in with a user-scoped access and refresh token pair only", async () => {
  await withTempDir(async dataDir => {
    const state = { session: null, remote: null, snapshots: [] };
    const service = createCloudService({
      dataDir,
      configPath: path.join(dataDir, "cloud-config.json"),
      safeStorage: null,
      clientFactory: createFakeClientFactory(state)
    });
    service.saveConfig(VALID_CONFIG);
    const accessToken = [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated" })).toString("base64url"),
      "signature"
    ].join(".");
    const tokens = { accessToken, refreshToken: "user-refresh-token-value" };
    assert.deepEqual(await service.signInWithToken(tokens), { authenticated: true, email: "reviewer@example.com" });
    assert.deepEqual(state.providedTokens, { access_token: accessToken, refresh_token: tokens.refreshToken });
    assert.equal((await service.getStatus()).signedIn, true);
    await assert.rejects(() => service.signInWithToken({ accessToken: VALID_CONFIG.publishableKey, refreshToken: "anything" }), /Supabase 用户 JWT/);
    const serviceRoleToken = [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ sub: "service", role: "service_role" })).toString("base64url"),
      "signature"
    ].join(".");
    await assert.rejects(() => service.signInWithToken({ accessToken: serviceRoleToken, refreshToken: "anything" }), /authenticated Access Token/);
    await assert.rejects(() => service.signInWithToken({ accessToken, refreshToken: "" }), /Access Token 和 Refresh Token/);
  });
});

test("creates a passwordless anonymous identity and prevents accidental replacement", async () => {
  await withTempDir(async dataDir => {
    const state = { session: null, remote: null, snapshots: [] };
    const service = createCloudService({
      dataDir,
      configPath: path.join(dataDir, "cloud-config.json"),
      safeStorage: null,
      clientFactory: createFakeClientFactory(state)
    });
    service.saveConfig(VALID_CONFIG);
    assert.deepEqual(await service.signInAnonymously(), {
      authenticated: true,
      anonymous: true,
      email: "本机匿名身份"
    });
    assert.deepEqual(await service.getStatus(), {
      configured: true,
      signedIn: true,
      anonymous: true,
      email: "本机匿名身份",
      url: VALID_CONFIG.url
    });
    await assert.rejects(() => service.signInAnonymously(), /当前已有 Supabase 会话/);
  });
});

test("explains how to enable anonymous auth when the Supabase project rejects it", async () => {
  await withTempDir(async dataDir => {
    const state = { session: null, remote: null, snapshots: [], anonymousErrorCode: "anonymous_provider_disabled" };
    const service = createCloudService({
      dataDir,
      configPath: path.join(dataDir, "cloud-config.json"),
      safeStorage: null,
      clientFactory: createFakeClientFactory(state)
    });
    service.saveConfig(VALID_CONFIG);
    await assert.rejects(() => service.signInAnonymously(), /启用匿名登录/);
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
