// User edits overlay immutable base data, retaining v1 backup compatibility.
window.EditStore = (function () {
  const KEY = "jrs_edits";
  const storage = window.AppStorage;
  let baseNodes = null;
  let baseNotes = null;

  function empty() {
    return { notes: {}, addedNodes: {}, deleted: [], renamed: {}, moved: {} };
  }

  function captureBase() {
    if (baseNodes) return;
    baseNodes = window.NODES.map(node => ({ ...node }));
    baseNotes = JSON.parse(JSON.stringify(window.NOTES || {}));
  }

  function nodeName(value) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new Error("节点名称需为 1–200 个字符");
    }
    return value.trim();
  }

  function normalizeNote(note) {
    if (!storage.isRecord(note) || typeof note.summary !== "string" ||
      !Array.isArray(note.points) || !note.points.every(point => typeof point === "string") ||
      (note.status !== undefined && !["ready", "pending"].includes(note.status))) throw new Error("笔记格式无效");
    return { core: note.core === true, summary: note.summary, points: note.points.slice(), status: note.status || "ready" };
  }

  function normalizeEdits(value) {
    if (!storage.isRecord(value)) throw new Error("编辑记录格式无效");
    const result = empty();
    for (const field of ["notes", "addedNodes", "renamed", "moved"]) {
      const entries = value[field] === undefined ? {} : value[field];
      if (!storage.isRecord(entries)) throw new Error("编辑记录字段无效：" + field);
      for (const [id, item] of Object.entries(entries)) {
        if (!storage.isId(id)) throw new Error("节点 ID 无效");
        if (field === "notes") result.notes[id] = normalizeNote(item);
        if (field === "renamed") result.renamed[id] = nodeName(item);
        if (field === "moved") {
          if (item !== null && !storage.isId(item)) throw new Error("父节点 ID 无效");
          result.moved[id] = item;
        }
        if (field === "addedNodes") {
          if (!storage.isRecord(item) || item.id !== id ||
            (item.parent !== null && !storage.isId(item.parent))) throw new Error("新增节点格式无效");
          result.addedNodes[id] = {
            id, name: nodeName(item.name), parent: item.parent,
            level: Number.isInteger(item.level) && item.level > 0 ? item.level : 1,
            core: item.core === true, custom: true
          };
        }
      }
    }
    const deleted = value.deleted === undefined ? [] : value.deleted;
    if (!Array.isArray(deleted) || !deleted.every(storage.isId)) throw new Error("删除记录格式无效");
    result.deleted = [...new Set(deleted)];
    return result;
  }

  // Derive every level iteratively and reject missing parents or cycles before writing.
  function buildState(edits) {
    captureBase();
    const nodeMap = {};
    for (const node of baseNodes.concat(Object.values(edits.addedNodes))) {
      if (Object.hasOwn(nodeMap, node.id)) throw new Error("重复节点 ID：" + node.id);
      nodeMap[node.id] = { ...node };
    }
    for (const [id, name] of Object.entries(edits.renamed)) {
      if (!nodeMap[id]) throw new Error("改名节点不存在：" + id);
      nodeMap[id].name = name;
    }
    for (const [id, parent] of Object.entries(edits.moved)) {
      if (!nodeMap[id]) throw new Error("移动节点不存在：" + id);
      nodeMap[id].parent = parent;
    }
    const levels = new Map();
    for (const node of Object.values(nodeMap)) {
      const chain = [];
      const visited = new Set();
      let current = node;
      while (current && !levels.has(current.id)) {
        if (visited.has(current.id)) throw new Error("节点归属形成循环，无法保存或导入");
        visited.add(current.id);
        chain.push(current);
        if (current.parent !== null && !nodeMap[current.parent]) throw new Error("父节点不存在：" + current.parent);
        current = current.parent === null ? null : nodeMap[current.parent];
      }
      let level = current ? levels.get(current.id) : 0;
      for (const item of chain.reverse()) levels.set(item.id, ++level);
    }
    const deleted = new Set(edits.deleted);
    const children = new Map();
    for (const node of Object.values(nodeMap)) {
      if (!children.has(node.parent)) children.set(node.parent, []);
      children.get(node.parent).push(node.id);
    }
    const queue = [...deleted];
    for (let index = 0; index < queue.length; index++) {
      for (const id of children.get(queue[index]) || []) {
        if (!deleted.has(id)) { deleted.add(id); queue.push(id); }
      }
    }
    const nodes = Object.values(nodeMap).filter(node => !deleted.has(node.id));
    const notes = {};
    const visibleMap = {};
    const edges = [];
    for (const node of nodes) {
      node.level = levels.get(node.id);
      visibleMap[node.id] = node;
      if (node.parent !== null) edges.push({ source: node.parent, target: node.id });
      const note = edits.notes[node.id] || baseNotes[node.id] || { summary: "", points: [], status: "pending" };
      notes[node.id] = { ...note, core: node.core, points: (note.points || []).slice() };
    }
    return { nodes, notes, nodeMap: visibleMap, edges };
  }

  function load(strict = false) {
    return storage[strict ? "readStrict" : "read"](KEY, empty(), value => {
      const edits = normalizeEdits(value);
      buildState(edits);
      return edits;
    });
  }

  function publish(state) {
    window.NODES = state.nodes;
    window.NOTES = state.notes;
    window.NODE_MAP = state.nodeMap;
    window.EDGES = state.edges;
  }

  function commit(edits) {
    const state = buildState(edits);
    storage.write(KEY, edits);
    publish(state);
  }

  function validateSnapshot(value) {
    if (!storage.isRecord(value) || value.version !== 1 || !storage.isRecord(value.progress)) {
      throw new Error("云端工作区格式或版本无效");
    }
    const edits = normalizeEdits(value.edits);
    buildState(edits);
    return { version: 1, edits, progress: {
      mastery: storage.mastery(value.progress.mastery),
      checkins: storage.checkins(value.progress.checkins)
    } };
  }

  function collectDescendants(id) {
    const result = [];
    const queue = [id];
    const visited = new Set();
    const children = new Map();
    for (const node of window.NODES) {
      if (!children.has(node.parent)) children.set(node.parent, []);
      children.get(node.parent).push(node.id);
    }
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      if (visited.has(current) || !Object.hasOwn(window.NODE_MAP, current)) continue;
      visited.add(current);
      result.push(current);
      queue.push(...(children.get(current) || []));
    }
    return result;
  }

  function nextCustomId(edits) {
    let max = 0;
    const ids = window.NODES.map(node => node.id).concat(Object.keys(edits.addedNodes), edits.deleted);
    for (const id of ids) {
      const match = id.match(/^custom-(\d+)$/);
      if (match) max = Math.max(max, Number(match[1]));
    }
    if (!Number.isSafeInteger(max + 1)) throw new Error("自定义节点编号已超出范围");
    return "custom-" + (max + 1);
  }

  function requireNode(id) {
    if (!Object.hasOwn(window.NODE_MAP, id)) throw new Error("节点不存在或已删除");
  }

  return {
    applyOverrides() { publish(buildState(load())); },
    validateSnapshot,
    replaceSnapshot(value) {
      const snapshot = validateSnapshot(value);
      const state = buildState(snapshot.edits);
      storage.writeMany({ [KEY]: snapshot.edits, jrs_mastery: snapshot.progress.mastery, jrs_checkins: snapshot.progress.checkins });
      publish(state);
    },
    collectDescendants,
    addNode(name, parentId, note) {
      if (parentId !== null && parentId !== undefined) requireNode(parentId);
      const edits = load(true);
      const id = nextCustomId(edits);
      edits.addedNodes[id] = {
        id, name: nodeName(name), parent: parentId || null,
        level: parentId ? window.NODE_MAP[parentId].level + 1 : 1, core: false, custom: true
      };
      if (note) edits.notes[id] = normalizeNote(note);
      commit(edits);
      return id;
    },
    deleteNode(id) {
      requireNode(id);
      const edits = load(true);
      const ids = collectDescendants(id);
      edits.deleted = [...new Set(edits.deleted.concat(ids))];
      commit(edits);
      return ids.length;
    },
    renameNode(id, name) {
      requireNode(id);
      const edits = load(true);
      edits.renamed[id] = nodeName(name);
      commit(edits);
    },
    moveNode(id, parentId) {
      if (!Object.hasOwn(window.NODE_MAP, id) || (parentId !== null && !Object.hasOwn(window.NODE_MAP, parentId)) ||
        collectDescendants(id).includes(parentId)) return false;
      const edits = load(true);
      edits.moved[id] = parentId;
      commit(edits);
      return true;
    },
    saveNote(id, note) {
      requireNode(id);
      const edits = load(true);
      edits.notes[id] = normalizeNote(note);
      commit(edits);
    },
    resetNode(id) {
      requireNode(id);
      const edits = load(true);
      delete edits.notes[id];
      delete edits.renamed[id];
      delete edits.moved[id];
      const state = buildState(edits);
      if (!state.nodeMap[id]) throw new Error("原父节点已删除，无法还原该节点");
      commit(edits);
    },
    hasEdits(id) {
      const edits = load();
      return !!(edits.notes[id] || edits.renamed[id] || Object.hasOwn(edits.moved, id));
    },
    isCustom(id) { return window.NODE_MAP[id]?.custom === true; },
    getEditCounts() {
      const edits = load();
      return { addedNodes: Object.keys(edits.addedNodes).length, deleted: edits.deleted.length, notes: Object.keys(edits.notes).length };
    },
    exportData() {
      return {
        version: 1, exportedAt: new Date().toISOString(), edits: load(true),
        progress: {
          mastery: storage.readStrict("jrs_mastery", {}, storage.mastery),
          checkins: storage.readStrict("jrs_checkins", {}, storage.checkins)
        }
      };
    },
    importData(json) {
      try {
        if (!storage.isRecord(json) || json.version !== 1 || !json.edits) throw new Error("无效的备份文件或版本");
        const incoming = normalizeEdits(json.edits);
        const progress = json.progress === undefined ? {} : json.progress;
        if (!storage.isRecord(progress)) throw new Error("进度记录格式无效");
        const mastery = storage.mastery(progress.mastery === undefined ? {} : progress.mastery);
        const checkins = storage.checkins(progress.checkins === undefined ? {} : progress.checkins);
        const edits = load(true);
        const stats = { nodes: 0, notes: 0 };
        for (const [id, node] of Object.entries(incoming.addedNodes)) {
          const existing = edits.addedNodes[id];
          if (existing && (existing.name !== node.name || existing.parent !== node.parent || existing.core !== node.core)) {
            throw new Error("自定义节点 ID 冲突：" + id + "。请在空白浏览器配置中恢复此备份，当前数据未修改。");
          }
          if (!existing) { edits.addedNodes[id] = node; stats.nodes++; }
        }
        for (const [id, note] of Object.entries(incoming.notes)) {
          if (!edits.notes[id]) { edits.notes[id] = note; stats.notes++; }
        }
        edits.deleted = [...new Set(edits.deleted.concat(incoming.deleted))];
        Object.assign(edits.renamed, incoming.renamed);
        Object.assign(edits.moved, incoming.moved);
        const state = buildState(edits);
        const mergedMastery = Object.assign(storage.readStrict("jrs_mastery", {}, storage.mastery), mastery);
        const mergedCheckins = storage.readStrict("jrs_checkins", {}, storage.checkins);
        for (const [date, ids] of Object.entries(checkins)) {
          mergedCheckins[date] = [...new Set((mergedCheckins[date] || []).concat(ids))];
        }
        storage.writeMany({ [KEY]: edits, jrs_mastery: mergedMastery, jrs_checkins: mergedCheckins });
        publish(state);
        return { ok: true, stats };
      } catch (error) { return { ok: false, message: error.message }; }
    }
  };
})();
