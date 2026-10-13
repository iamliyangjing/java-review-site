// Search names and notes with keyboard navigation and a cached text index.
window.SearchView = (function () {
  let input = null;
  let dropdown = null;
  let index = [];
  let matches = [];
  let activeIndex = -1;

  function hide() {
    dropdown.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function activate(position) {
    const items = dropdown.querySelectorAll(".search-item");
    if (!items.length) return;
    activeIndex = (position + items.length) % items.length;
    items.forEach((item, i) => {
      item.classList.toggle("active", i === activeIndex);
      item.setAttribute("aria-selected", String(i === activeIndex));
    });
    input.setAttribute("aria-activedescendant", items[activeIndex].id);
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function choose(nodeId) {
    if (!window.GraphView.selectNode(nodeId)) return;
    input.value = "";
    hide();
  }

  function render() {
    const query = input.value.trim().toLowerCase();
    if (!query) { hide(); return; }
    matches = index.map(item => ({
      ...item, score: item.name === query ? 0 : item.name.startsWith(query) ? 1 : item.name.includes(query) ? 2 : 3
    })).filter(item => item.name.includes(query) || item.text.includes(query))
      .sort((a, b) => a.score - b.score).slice(0, 20);
    dropdown.replaceChildren();
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = "未找到相关知识点";
      dropdown.appendChild(empty);
    }
    for (const [i, item] of matches.entries()) {
      const result = document.createElement("div");
      result.id = "search-result-" + i;
      result.className = "search-item";
      result.setAttribute("role", "option");
      result.setAttribute("aria-selected", "false");
      result.textContent = item.node.name;
      result.addEventListener("mousedown", event => event.preventDefault());
      result.addEventListener("click", () => choose(item.node.id));
      dropdown.appendChild(result);
    }
    dropdown.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function refresh() {
    index = window.NODES.map(node => {
      const note = window.NOTES[node.id];
      return {
        node, name: node.name.toLowerCase(),
        text: [note?.summary || "", ...(note?.points || [])].join(" ").toLowerCase()
      };
    });
    if (input) render();
  }

  function init(inputId, dropdownId) {
    input = document.getElementById(inputId);
    dropdown = document.getElementById(dropdownId);
    refresh();
    input.addEventListener("input", render);
    input.addEventListener("focus", () => { if (input.value.trim()) render(); });
    input.addEventListener("keydown", event => {
      if (event.isComposing) return;
      if (event.key === "Escape") { event.preventDefault(); hide(); }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        if (dropdown.hidden) render();
        activate(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
      }
      if (event.key === "Enter" && !dropdown.hidden && matches.length) {
        event.preventDefault();
        choose(matches[activeIndex < 0 ? 0 : activeIndex].node.id);
      }
    });
    document.addEventListener("click", event => {
      if (!dropdown.contains(event.target) && event.target !== input) hide();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "/" && !document.querySelector("dialog[open]") &&
        !event.target.closest("input, textarea, select, [contenteditable]")) {
        event.preventDefault();
        input.focus();
      }
    });
  }

  return { init, refresh };
})();
