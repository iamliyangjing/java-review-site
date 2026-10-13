// Accessible tree navigation preserves branch state across data changes.
window.TreeView = (function () {
  let container = null;
  let selectedId = null;
  const expanded = new Map();
  const elements = new Map();

  function buildTree() {
    const children = new Map();
    for (const node of window.NODES) {
      if (!children.has(node.parent)) children.set(node.parent, []);
      children.get(node.parent).push(node);
    }
    return children;
  }

  function setExpanded(id, isExpanded) {
    const li = elements.get(id);
    if (!li) return;
    expanded.set(id, isExpanded);
    const row = li.firstElementChild;
    const toggle = row.querySelector(".tree-toggle");
    const sub = li.querySelector(":scope > ul");
    row.classList.toggle("expanded", isExpanded);
    if (toggle) {
      toggle.textContent = isExpanded ? "▾" : "▸";
      toggle.setAttribute("aria-expanded", String(isExpanded));
    }
    if (sub) sub.hidden = !isExpanded;
  }

  function renderNode(node, children) {
    const li = document.createElement("li");
    li.dataset.nodeId = node.id;
    elements.set(node.id, li);
    const row = document.createElement("div");
    row.className = "tree-node";
    if (node.parent === null) row.classList.add("tree-module");
    const descendants = children.get(node.id) || [];
    if (descendants.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "tree-arrow tree-toggle";
      toggle.setAttribute("aria-label", "展开或收起 " + node.name);
      toggle.addEventListener("click", event => {
        event.stopPropagation();
        setExpanded(node.id, !expanded.get(node.id));
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "tree-arrow tree-arrow-placeholder";
      row.appendChild(spacer);
    }
    const select = document.createElement("button");
    select.type = "button";
    select.className = "tree-select";
    select.title = node.name;
    const dot = document.createElement("span");
    dot.className = "tree-dot";
    dot.dataset.mastery = "unlearned";
    select.appendChild(dot);
    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = node.name;
    select.appendChild(label);
    row.appendChild(select);
    row.addEventListener("click", () => window.GraphView.selectNode(node.id));
    li.appendChild(row);
    if (descendants.length) {
      const sub = document.createElement("ul");
      sub.className = "tree-children";
      for (const child of descendants) sub.appendChild(renderNode(child, children));
      li.appendChild(sub);
      setExpanded(node.id, expanded.has(node.id) ? expanded.get(node.id) : node.level <= 2);
    }
    return li;
  }

  function render() {
    const scrollTop = container.scrollTop;
    elements.clear();
    const children = buildTree();
    const ul = document.createElement("ul");
    ul.className = "tree-root";
    for (const node of children.get(null) || []) ul.appendChild(renderNode(node, children));
    container.replaceChildren(ul);
    container.scrollTop = scrollTop;
  }

  function init(containerId) {
    container = document.getElementById(containerId);
    render();
  }

  function expandTo(nodeId) {
    let node = window.NODE_MAP[nodeId];
    const visited = new Set();
    while (node && node.parent && !visited.has(node.id)) {
      visited.add(node.id);
      setExpanded(node.parent, true);
      node = window.NODE_MAP[node.parent];
    }
  }

  function highlightNode(nodeId) {
    const previous = elements.get(selectedId)?.firstElementChild;
    if (previous) {
      previous.classList.remove("selected");
      previous.querySelector(".tree-select").removeAttribute("aria-current");
    }
    selectedId = nodeId;
    expandTo(nodeId);
    const row = elements.get(nodeId)?.firstElementChild;
    if (row) {
      row.classList.add("selected");
      row.querySelector(".tree-select").setAttribute("aria-current", "true");
    }
  }

  function setMasteryDots(masteryMap) {
    for (const [id, li] of elements) {
      li.firstElementChild.querySelector(".tree-dot").dataset.mastery = masteryMap[id] || "unlearned";
    }
  }

  function refresh() {
    if (!container) return;
    if (selectedId && !window.NODE_MAP[selectedId]) selectedId = null;
    for (const id of expanded.keys()) if (!window.NODE_MAP[id]) expanded.delete(id);
    render();
    setMasteryDots(window.ProgressStore.getAllMastery());
    if (selectedId) highlightNode(selectedId);
  }

  return { init, highlightNode, expandTo, setMasteryDots, refresh };
})();
