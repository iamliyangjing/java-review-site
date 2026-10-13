// Merge independent edits against the last synchronized snapshot; reject competing changes.
window.CloudMerge = (function () {
  function empty() {
    return { version: 1, edits: { notes: {}, addedNodes: {}, deleted: [], renamed: {}, moved: {} }, progress: { mastery: {}, checkins: {} } };
  }

  function equal(left, right) {
    if (left === right) return true;
    if (left === undefined || right === undefined || left === null || right === null) return false;
    if (typeof left !== "object" || typeof right !== "object") return false;
    if (Array.isArray(left) || Array.isArray(right)) {
      return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((v, i) => equal(v, right[i]));
    }
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
  }

  function mergeMap(base, local, remote, label) {
    const result = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      let value;
      if (equal(local[key], base[key])) value = remote[key];
      else if (equal(remote[key], base[key]) || equal(local[key], remote[key])) value = local[key];
      else throw new Error(label + "（" + key + "）在两处同时修改，请选择要保留的版本。");
      if (value !== undefined) result[key] = value;
    }
    return result;
  }

  function merge(base, local, remote) {
    const result = empty();
    for (const field of ["notes", "addedNodes", "renamed", "moved"]) {
      result.edits[field] = mergeMap(base.edits[field], local.edits[field], remote.edits[field], "节点修改");
    }
    result.edits.deleted = [...new Set([...local.edits.deleted, ...remote.edits.deleted])];
    result.progress.mastery = mergeMap(base.progress.mastery, local.progress.mastery, remote.progress.mastery, "掌握程度");
    for (const date of new Set([...Object.keys(local.progress.checkins), ...Object.keys(remote.progress.checkins)])) {
      result.progress.checkins[date] = [...new Set([...(local.progress.checkins[date] || []), ...(remote.progress.checkins[date] || [])])];
    }
    return window.EditStore.validateSnapshot(result);
  }

  return { empty, equal, merge };
})();
