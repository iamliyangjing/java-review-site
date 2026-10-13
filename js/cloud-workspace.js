// Local-first, account-scoped snapshots with optimistic concurrency in Supabase.
window.CloudWorkspace = (function () {
  const DATA_KEYS = ["jrs_edits", "jrs_mastery", "jrs_checkins"];
  const merge = window.CloudMerge;
  const storage = window.AppStorage;

  function create(client, options = {}) {
    let user = null;
    let generation = 0;
    let base = merge.empty();
    let revision = 0;
    let suppressed = false;
    let busy = false;
    let conflict = null;
    let message = "登录后开启云同步";
    let isError = false;
    let cacheInvalid = false;
    let timer;
    let queue = Promise.resolve();

    function state() { return { user, busy, conflict, message, isError }; }
    function status(text, error = false) {
      message = text;
      isError = error;
      options.onChange?.(state());
    }
    function snapshot() { return window.EditStore.validateSnapshot(window.EditStore.exportData()); }
    function metaKey() { return "jrs_cloud_" + user.id; }
    function saveMeta() { storage.write(metaKey(), { revision, base }); }
    function replace(value) {
      suppressed = true;
      try { window.EditStore.replaceSnapshot(value); }
      finally { suppressed = false; }
      options.onRefresh?.();
    }
    function enqueue(task) {
      const taskGeneration = generation;
      const next = queue.then(async () => {
        if (taskGeneration !== generation) return false;
        busy = true;
        options.onChange?.(state());
        try { return await task(taskGeneration); }
        catch (error) {
          if (taskGeneration === generation) status("同步未完成，本机记录已保留。" + (error.message || "请检查网络后重试。"), true);
          return false;
        } finally {
          busy = false;
          options.onChange?.(state());
        }
      });
      queue = next.catch(() => {});
      return next;
    }
    async function fetchRemote(account) {
      const { data, error } = await client.from("jrs_workspaces").select("payload,revision").eq("user_id", account.id).maybeSingle();
      if (error) throw error;
      if (!data) return { payload: merge.empty(), revision: 0 };
      if (!Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error("云端版本号无效。");
      return { payload: window.EditStore.validateSnapshot(data.payload), revision: data.revision };
    }
    async function saveRemote(account, payload, expectedRevision) {
      // The RPC checks this explicit account ID against auth.uid(), including token races.
      const { data, error } = await client.rpc("jrs_save_workspace", {
        p_user_id: account.id, p_payload: payload, p_expected_revision: expectedRevision
      });
      if (error) throw error;
      if (!Number.isSafeInteger(data?.revision) || data.revision !== expectedRevision + 1) throw new Error("云端保存结果无效。");
      return data.revision;
    }
    async function synchronize(taskGeneration) {
      if (!user || conflict) return false;
      if (cacheInvalid) { status("本机同步缓存损坏，请先导出备份后恢复缓存。云端记录未修改。", true); return false; }
      if (options.isEditing?.()) { status("笔记编辑中，保存后继续同步"); return false; }
      const account = user;
      status("正在同步…");
      // Retry a concurrent write once, always reading and merging the new revision first.
      for (let attempt = 0; attempt < 2; attempt++) {
        const local = snapshot();
        const remote = await fetchRemote(account);
        if (taskGeneration !== generation) return false;
        let combined;
        try { combined = merge.merge(base, local, remote.payload); }
        catch (error) {
          conflict = { remote, reason: error.message };
          status("有同步冲突，请在云同步面板选择版本。", true);
          return false;
        }
        let nextRevision = remote.revision;
        if (remote.revision === 0 || !merge.equal(combined, remote.payload)) {
          try { nextRevision = await saveRemote(account, combined, remote.revision); }
          catch (error) { if (error.code === "PT409" && attempt === 0) continue; throw error; }
        }
        if (taskGeneration !== generation) return false;
        // Preserve edits made while the network request was in flight.
        const current = snapshot();
        const localChanged = !merge.equal(current, local);
        const nextLocal = merge.merge(local, current, combined);
        if (options.isEditing?.() && !merge.equal(nextLocal, current)) {
          status("云端已保存，笔记编辑结束后更新本机");
          return true;
        }
        if (!merge.equal(current, nextLocal)) replace(nextLocal);
        base = combined;
        revision = nextRevision;
        saveMeta();
        status(localChanged ? "新修改已保存到本机，等待同步" : "已同步 · " + new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
        if (localChanged) schedule();
        return true;
      }
      return false;
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => { void syncNow(); }, 650);
    }
    function syncNow() { return enqueue(synchronize); }
    function connect(nextUser) {
      if (nextUser?.id === user?.id) return Promise.resolve(true);
      generation++;
      clearTimeout(timer);
      return enqueue(async taskGeneration => {
        user = nextUser;
        conflict = null;
        cacheInvalid = false;
        storage.setScope(user?.id);
        base = merge.empty();
        revision = 0;
        window.EditStore.applyOverrides();
        options.onRefresh?.();
        if (!user) { status("本地学习空间 · 登录后同步"); return true; }
        try {
          const meta = storage.readStrict(metaKey(), null);
          if (meta) {
            if (!Number.isSafeInteger(meta.revision) || meta.revision < 0) throw new Error("本机同步版本无效。");
            base = window.EditStore.validateSnapshot(meta.base);
            revision = meta.revision;
          }
        } catch (error) { cacheInvalid = true; throw error; }
        return synchronize(taskGeneration);
      });
    }
    function importLocal() {
      return enqueue(async taskGeneration => {
        if (!user || conflict) return false;
        let local;
        storage.setScope(null);
        try { local = snapshot(); }
        finally { storage.setScope(user.id); }
        const current = snapshot();
        try { replace(merge.merge(merge.empty(), local, current)); }
        catch (error) { status("本机记录与当前账号有冲突，请导出本机备份并通过导入备份选择合并。" + error.message, true); return false; }
        return synchronize(taskGeneration);
      });
    }
    function resolve(choice) {
      return enqueue(async taskGeneration => {
        if (!user || !conflict) return false;
        const account = user;
        const local = snapshot();
        const remote = await fetchRemote(account);
        if (taskGeneration !== generation) return false;
        // Preserve a recovery copy before either explicit conflict resolution.
        storage.write("jrs_conflict_" + account.id, { local, remote: remote.payload, choice, savedAt: new Date().toISOString() });
        if (choice === "cloud") {
          replace(remote.payload);
          base = remote.payload;
          revision = remote.revision;
        } else if (choice === "local") {
          revision = await saveRemote(account, local, remote.revision);
          if (taskGeneration !== generation) return false;
          base = local;
        } else throw new Error("未知的冲突处理方式。");
        conflict = null;
        saveMeta();
        status("冲突已处理，另一个版本的恢复副本已留在本机");
        return true;
      });
    }
    const unsubscribe = storage.subscribe(keys => {
      if (suppressed || !user || !keys.some(key => DATA_KEYS.includes(key))) return;
      status(conflict ? "有同步冲突，新修改仍保存在本机" : "本机已保存，等待云同步", !!conflict);
      if (!conflict) schedule();
    });

    return { connect, syncNow, importLocal, resolve, getState: state,
      getRecovery() { return user ? storage.readStrict("jrs_conflict_" + user.id, null) : null; },
      dispose() { generation++; clearTimeout(timer); unsubscribe(); }
    };
  }

  return { create };
})();
