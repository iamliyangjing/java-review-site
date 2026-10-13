// Shared storage validation and rollback for local-file and hosted use.
window.AppStorage = (function () {
  const warnings = new Set();
  const MASTERY_LEVELS = ["unlearned", "learning", "mastered"];
  const listeners = new Set();
  let scope = "";

  function physicalKey(key) {
    return scope && ["jrs_edits", "jrs_mastery", "jrs_checkins"].includes(key)
      ? "jrs_user_" + scope + "_" + key : key;
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isId(value) {
    return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value) &&
      !["__proto__", "constructor", "prototype"].includes(value);
  }

  function readStrict(key, fallback, validate) {
    try {
      const raw = localStorage.getItem(physicalKey(key));
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      return validate ? validate(value) : value;
    } catch (error) {
      throw new Error("本地记录无法读取或格式有误，操作未完成。请检查浏览器存储权限；如需恢复备份，请在空白浏览器配置中导入。");
    }
  }

  function read(key, fallback, validate) {
    try {
      return readStrict(key, fallback, validate);
    } catch (error) {
      warnings.add("本地数据读取失败（" + key + "），已暂用默认值。原始记录仍保留，请检查备份或浏览器存储权限。");
      return fallback;
    }
  }

  // Restore earlier values if any write in a multi-key import fails.
  function writeMany(values) {
    const previous = new Map();
    const written = [];
    try {
      const entries = Object.entries(values).map(([key, value]) => [physicalKey(key), JSON.stringify(value)]);
      for (const [key] of entries) previous.set(key, localStorage.getItem(key));
      for (const [key, raw] of entries) {
        localStorage.setItem(key, raw);
        written.push(key);
      }
    } catch (error) {
      let restored = true;
      for (const key of written.reverse()) {
        try {
          const raw = previous.get(key);
          if (raw === null) localStorage.removeItem(key);
          else localStorage.setItem(key, raw);
        } catch (rollbackError) { restored = false; }
      }
      throw new Error(restored
        ? "保存失败：浏览器存储空间不足或权限被禁用，修改尚未保存。"
        : "保存失败，部分记录无法回退。请保留备份并检查浏览器存储。");
    }
    for (const listener of listeners) {
      try { listener(Object.keys(values)); } catch (error) { /* A sync failure must not undo local saves. */ }
    }
  }

  function mastery(value) {
    if (!isRecord(value)) throw new Error("掌握记录格式无效");
    const result = {};
    for (const [id, level] of Object.entries(value)) {
      if (!isId(id) || !MASTERY_LEVELS.includes(level)) throw new Error("掌握记录内容无效");
      result[id] = level;
    }
    return result;
  }

  function checkins(value) {
    if (!isRecord(value)) throw new Error("打卡记录格式无效");
    const result = {};
    for (const [date, ids] of Object.entries(value)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(ids) || !ids.every(isId)) {
        throw new Error("打卡记录内容无效");
      }
      const parsed = new Date(date + "T12:00:00Z");
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("打卡日期无效");
      result[date] = [...new Set(ids)];
    }
    return result;
  }

  return {
    isRecord, isId, read, readStrict, writeMany, mastery, checkins,
    setScope(userId) {
      if (userId && !/^[a-f0-9-]{36}$/i.test(userId)) throw new Error("用户 ID 无效");
      scope = userId || "";
    },
    getScope() { return scope; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    write(key, value) { writeMany({ [key]: value }); },
    takeWarnings() {
      const result = [...warnings];
      warnings.clear();
      return result;
    }
  };
})();
