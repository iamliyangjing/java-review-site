const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const SNAPSHOT_TABLE = "jrs_desktop_backup_snapshots";

function readConfigObject(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return validateConfig(parsed);
  } catch {
    return null;
  }
}

function readDevelopmentConfig(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const source = fs.readFileSync(filePath, "utf8");
    const readString = key => source.match(new RegExp("\\b" + key + "\\s*:\\s*['\"]([^'\"]*)['\"]"))?.[1] || "";
    return validateConfig({
      url: readString("url"),
      publishableKey: readString("publishableKey") || readString("anonKey")
    });
  } catch {
    return null;
  }
}

function validateConfig(input) {
  if (!input || typeof input.url !== "string" || typeof input.publishableKey !== "string") {
    throw new Error("请填写 Supabase 项目 URL 和 publishable/anon key");
  }
  let projectUrl;
  try { projectUrl = new URL(input.url.trim()); } catch { throw new Error("Supabase 项目 URL 格式无效"); }
  if (projectUrl.protocol !== "https:" || projectUrl.username || projectUrl.password || projectUrl.search || projectUrl.hash || !["", "/"].includes(projectUrl.pathname)) {
    throw new Error("Supabase 项目 URL 必须是 HTTPS 项目根地址");
  }
  const publishableKey = input.publishableKey.trim();
  if (publishableKey.length < 20 || publishableKey.length > 4096 || /^sb_secret_/i.test(publishableKey)) {
    throw new Error("只能填写 Supabase publishable/anon key，不能使用 secret key");
  }
  if (publishableKey.split(".").length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(publishableKey.split(".")[1], "base64url").toString("utf8"));
      if (claims.role === "service_role") throw new Error("不能在桌面应用中使用 service-role key");
    } catch (error) {
      if (error.message.includes("service-role")) throw error;
    }
  }
  return { url: projectUrl.origin, publishableKey };
}

function validateAuthTokens(input) {
  const accessToken = String(input?.accessToken || "").trim();
  const refreshToken = String(input?.refreshToken || "").trim();
  if (accessToken.length > 16384 || refreshToken.length > 8192) throw new Error("Supabase 登录令牌长度无效");
  if (!accessToken || !refreshToken) throw new Error("请输入 Supabase Auth 的 Access Token 和 Refresh Token");
  const parts = accessToken.split(".");
  if (parts.length !== 3) throw new Error("Access Token 不是有效的 Supabase 用户 JWT");
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); }
  catch { throw new Error("Access Token 不是有效的 Supabase 用户 JWT"); }
  if (claims.role !== "authenticated" || !claims.sub) {
    throw new Error("只接受已登录用户的 authenticated Access Token，不能使用项目 API key 或高权限 token");
  }
  return { accessToken, refreshToken };
}

function createEncryptedSessionStorage({ dataDir, safeStorage, storageIdentity }) {
  const fileName = "supabase-auth-" + crypto.createHash("sha256").update(storageIdentity).digest("hex").slice(0, 20) + ".bin";
  const filePath = path.join(dataDir, fileName);
  const memory = new Map();

  async function isEncryptionAvailable() {
    try {
      if (typeof safeStorage?.isAsyncEncryptionAvailable === "function") return await safeStorage.isAsyncEncryptionAvailable();
      return Boolean(safeStorage?.isEncryptionAvailable?.());
    } catch { return false; }
  }

  return {
    async getItem(key) {
      if (memory.has(key)) return memory.get(key);
      if (!(await isEncryptionAvailable()) || !fs.existsSync(filePath)) return null;
      try {
        const encrypted = fs.readFileSync(filePath);
        if (typeof safeStorage.decryptStringAsync === "function") {
          const decrypted = await safeStorage.decryptStringAsync(encrypted);
          const value = typeof decrypted === "string" ? decrypted : decrypted.result;
          memory.set(key, value);
          return value;
        }
        const value = safeStorage.decryptString(encrypted);
        memory.set(key, value);
        return value;
      } catch { return null; }
    },
    async setItem(key, value) {
      memory.set(key, value);
      if (!(await isEncryptionAvailable())) return;
      fs.mkdirSync(dataDir, { recursive: true });
      const encrypted = typeof safeStorage.encryptStringAsync === "function"
        ? await safeStorage.encryptStringAsync(value)
        : safeStorage.encryptString(value);
      const tempPath = filePath + ".tmp";
      fs.writeFileSync(tempPath, encrypted, { mode: 0o600 });
      fs.renameSync(tempPath, filePath);
    },
    async removeItem(key) {
      memory.delete(key);
      try { fs.unlinkSync(filePath); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  };
}

function createCloudService({ dataDir, safeStorage, configPath, developmentConfigPath, clientFactory = createClient }) {
  const resolvedConfigPath = configPath || path.join(dataDir, "supabase-config.json");
  let config = readConfigObject(resolvedConfigPath) || readDevelopmentConfig(developmentConfigPath);
  let client = null;

  function persistConfig(nextConfig) {
    fs.mkdirSync(dataDir, { recursive: true });
    const tempPath = resolvedConfigPath + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(nextConfig, null, 2), { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tempPath, resolvedConfigPath);
  }

  function getClient() {
    if (!config) throw new Error("请先配置 Supabase 项目 URL 和 publishable/anon key");
    if (!client) {
      const storage = createEncryptedSessionStorage({
        dataDir,
        safeStorage,
        storageIdentity: config.url + "\0" + config.publishableKey
      });
      client = clientFactory(config.url, config.publishableKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          storage
        }
      });
    }
    return client;
  }

  async function currentUser() {
    const { data, error } = await getClient().auth.getSession();
    if (error) throw error;
    return data.session?.user || null;
  }

  async function requireUser() {
    const api = getClient();
    const { data: current, error: readError } = await api.auth.getSession();
    if (readError) throw readError;
    if (!current.session) throw new Error("请先登录 Supabase 账号");
    const { data: refreshed, error: refreshError } = await api.auth.refreshSession();
    if (refreshError) throw new Error("Supabase 登录状态已过期，请重新登录");
    return refreshed.user || refreshed.session?.user;
  }

  async function signUp({ email, password }) {
    if (typeof email !== "string" || !email.trim() || typeof password !== "string" || password.length < 6) {
      throw new Error("请填写有效邮箱和至少 6 位密码");
    }
    const { data, error } = await getClient().auth.signUp({ email: email.trim(), password });
    if (error) throw error;
    return {
      authenticated: Boolean(data.session),
      email: data.user?.email || email.trim(),
      needsEmailConfirmation: !data.session
    };
  }

  async function signIn({ email, password }) {
    if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
      throw new Error("请填写邮箱和密码");
    }
    const { data, error } = await getClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return { authenticated: true, email: data.user?.email || email.trim() };
  }

  async function signInWithToken(input) {
    const tokens = validateAuthTokens(input);
    const { data, error } = await getClient().auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    });
    if (error) throw error;
    const user = data.user || data.session?.user;
    if (!user?.id) throw new Error("令牌未能验证为有效的 Supabase 用户会话");
    return { authenticated: true, email: user.email || user.id };
  }

  async function signInAnonymously() {
    if (await currentUser()) throw new Error("当前已有 Supabase 会话。请先退出登录，再创建新的本机匿名身份。");
    const { data, error } = await getClient().auth.signInAnonymously();
    if (error?.code === "anonymous_provider_disabled") {
      throw new Error("Supabase 项目尚未启用匿名登录。请在 Dashboard 的 Authentication 设置中启用 Allow anonymous sign-ins 后重试。");
    }
    if (error) throw error;
    const user = data.user || data.session?.user;
    if (!user?.id || !user.is_anonymous) throw new Error("Supabase 未返回有效的匿名用户会话");
    return { authenticated: true, anonymous: true, email: "本机匿名身份" };
  }

  async function getStatus() {
    if (!config) return { configured: false, signedIn: false, email: "" };
    try {
      const user = await currentUser();
      return {
        configured: true,
        signedIn: Boolean(user),
        anonymous: Boolean(user?.is_anonymous),
        email: user?.email || (user?.is_anonymous ? "本机匿名身份" : ""),
        url: config.url
      };
    } catch {
      return { configured: true, signedIn: false, email: "", url: config.url };
    }
  }

  return {
    getStatus,
    saveConfig(input) {
      let inputUrl = "";
      try { inputUrl = new URL(String(input?.url || "").trim()).origin; } catch {}
      const publishableKey = String(input?.publishableKey || "").trim() || (config?.url === inputUrl ? config.publishableKey : "");
      const nextConfig = validateConfig({ url: input?.url, publishableKey });
      config = nextConfig;
      client = null;
      persistConfig(config);
      return { configured: true, url: config.url };
    },
    async signUp(input) { return signUp(input); },
    async signIn(input) { return signIn(input); },
    async signInWithToken(input) { return signInWithToken(input); },
    async signInAnonymously() { return signInAnonymously(); },
    async signOut() {
      const { error } = await getClient().auth.signOut();
      if (error) throw error;
      return { signedIn: false };
    },
    async uploadBackup(backup) {
      const user = await requireUser();
      if (!backup || backup.version !== 2 || !Array.isArray(backup.questions)) throw new Error("本机题库备份格式无效");
      const serialized = JSON.stringify(backup);
      if (Buffer.byteLength(serialized, "utf8") > MAX_BACKUP_BYTES) throw new Error("题库备份超过 20 MB，无法上传");
      const api = getClient();
      const { data: current, error: readError } = await api.from(SNAPSHOT_TABLE)
        .select("revision")
        .eq("user_id", user.id)
        .order("revision", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (readError) throw readError;
      const { data, error } = await api.rpc("jrs_save_desktop_backup_snapshot", {
        p_user_id: user.id,
        p_payload: backup,
        p_expected_revision: current?.revision || 0
      });
      if (error) throw error;
      return { revision: Number(data.revision), uploadedAt: data.createdAt || new Date().toISOString() };
    },
    async listBackups() {
      const user = await requireUser();
      const { data, error } = await getClient().from(SNAPSHOT_TABLE)
        .select("revision,created_at")
        .eq("user_id", user.id)
        .order("revision", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []).map(item => ({ revision: Number(item.revision), createdAt: item.created_at }));
    },
    async downloadBackup(revision = null) {
      const user = await requireUser();
      let query = getClient().from(SNAPSHOT_TABLE)
        .select("payload,revision,created_at")
        .eq("user_id", user.id);
      if (revision !== null && revision !== undefined) {
        const normalizedRevision = Number(revision);
        if (!Number.isSafeInteger(normalizedRevision) || normalizedRevision < 1) throw new Error("云端版本号无效");
        query = query.eq("revision", normalizedRevision);
      } else query = query.order("revision", { ascending: false }).limit(1);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(revision ? "所选云端历史版本已不存在" : "云端还没有备份，请先上传本机题库");
      const serialized = JSON.stringify(data.payload);
      if (Buffer.byteLength(serialized, "utf8") > MAX_BACKUP_BYTES) throw new Error("云端备份超过 20 MB，无法恢复");
      return { backup: data.payload, revision: Number(data.revision), updatedAt: data.created_at };
    }
  };
}

module.exports = { createCloudService, createEncryptedSessionStorage, validateAuthTokens, validateConfig, MAX_BACKUP_BYTES };
