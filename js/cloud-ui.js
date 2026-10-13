// Authentication controls; passwords are sent only to Supabase and never cached by the app.
window.CloudUI = (function () {
  let client;
  let workspace;
  let dialog;
  let form;

  function showMessage(message, error = false) {
    const element = document.getElementById("cloud-message");
    element.textContent = message;
    element.classList.toggle("is-error", error);
  }
  function render(state) {
    window.NoteImages?.setAccount(client, state.user);
    document.getElementById("cloud-login-fields").hidden = !!state.user;
    document.getElementById("cloud-account").hidden = !state.user;
    document.getElementById("cloud-account-email").textContent = state.user?.email || "";
    document.getElementById("cloud-conflict").hidden = !state.conflict;
    document.getElementById("cloud-conflict-reason").textContent = state.conflict?.reason || "";
    document.getElementById("cloud-label").textContent = state.user ? (state.isError ? "同步需处理" : state.busy ? "同步中…" : "云端学习空间") : "登录后同步";
    document.getElementById("cloud-open").title = state.message;
    document.getElementById("backup-description").textContent = state.user ? "本机自动保存 · 云端同步状态见右上角" : "保存在当前浏览器 · 登录后开启云同步";
    dialog.querySelectorAll("[data-cloud-action]").forEach(button => { button.disabled = state.busy; });
    showMessage(state.message, state.isError);
  }
  function canLeave() { return window.NotePanel.canLeave(); }
  function refresh() { window.Editor.refreshViews(window.NotePanel.getCurrentId()); }
  async function authenticate(event) {
    event.preventDefault();
    if (!client || !canLeave()) return;
    const signup = event.submitter?.id === "cloud-register";
    const email = document.getElementById("cloud-email").value.trim();
    const passwordInput = document.getElementById("cloud-password");
    const password = passwordInput.value;
    if (signup && password.length < 8) { showMessage("注册密码至少需要 8 个字符。", true); return; }
    form.querySelectorAll("button[type=submit]").forEach(button => { button.disabled = true; });
    showMessage(signup ? "正在注册…" : "正在登录…");
    try {
      const { data, error } = signup
        ? await client.auth.signUp({ email, password })
        : await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      passwordInput.value = "";
      if (data.session) await workspace.connect(data.session.user);
      else showMessage("请确认注册邮件中的链接，再返回此页面登录。已有账号可直接登录。");
    } catch (error) {
      showMessage(error.code === "invalid_credentials" ? "邮箱或密码不正确，请检查后重试。" : error.message, true);
    } finally { form.querySelectorAll("button[type=submit]").forEach(button => { button.disabled = false; }); }
  }
  function init() {
    dialog = document.getElementById("cloud-dialog");
    form = document.getElementById("cloud-form");
    document.getElementById("cloud-open").addEventListener("click", () => dialog.showModal());
    document.getElementById("cloud-close").addEventListener("click", () => dialog.close());
    const config = window.SUPABASE_CONFIG;
    if (!config?.url || !config?.publishableKey || !window.supabase) {
      showMessage("Supabase 项目尚未配置，当前记录继续保存在本机。");
      form.querySelectorAll("button[type=submit]").forEach(button => { button.disabled = true; });
      return;
    }
    try {
      client = window.supabase.createClient(config.url, config.publishableKey, {
        auth: { storageKey: "jrs_auth_" + new URL(config.url).hostname, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    } catch (error) { showMessage("Supabase 配置无效：" + error.message, true); return; }
    workspace = window.CloudWorkspace.create(client, { onChange: render, onRefresh: refresh, isEditing: () => window.NotePanel.isEditing() || window.NoteImages?.isBusy() });
    form.addEventListener("submit", authenticate);
    document.getElementById("cloud-sync").addEventListener("click", async () => {
      if (!canLeave()) return;
      refresh();
      await workspace.syncNow();
    });
    document.getElementById("cloud-import-local").addEventListener("click", async () => {
      if (!canLeave()) return;
      refresh();
      await workspace.importLocal();
    });
    document.getElementById("cloud-logout").addEventListener("click", async () => {
      if (!canLeave()) return;
      try {
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw error;
        await workspace.connect(null);
      } catch (error) { showMessage(error.message, true); }
    });
    document.getElementById("cloud-recovery").addEventListener("click", () => {
      try {
        const recovery = workspace.getRecovery();
        if (!recovery) { showMessage("当前账号没有需要恢复的冲突副本。"); return; }
        const snapshot = recovery.choice === "cloud" ? recovery.local : recovery.remote;
        const url = URL.createObjectURL(new Blob([JSON.stringify({ ...snapshot, exportedAt: recovery.savedAt }, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "java-review-conflict-backup.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { showMessage(error.message, true); }
    });
    for (const choice of ["cloud", "local"]) {
      document.getElementById("cloud-use-" + choice).addEventListener("click", async () => {
        if (!canLeave()) return;
        refresh();
        await workspace.resolve(choice);
      });
    }
    // Schedule outside the Auth callback to avoid holding the Auth session lock.
    client.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      setTimeout(() => { void workspace.connect(session?.user || null); }, 0);
    });
    client.auth.getSession().then(({ data, error }) => {
      if (error) showMessage(error.message, true);
      else void workspace.connect(data.session?.user || null);
    }).catch(error => { showMessage("登录状态读取失败：" + error.message, true); });
    const retry = () => {
      if (workspace.getState().user && !document.hidden) void workspace.syncNow();
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    setInterval(retry, 45000);
    render(workspace.getState());
  }
  return { init };
})();
