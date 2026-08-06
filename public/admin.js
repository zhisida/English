/* admin panel logic — manage models, default model, apiBase, site title */

const THEMES = [
  { id: "willow", label: "唐柳绿" }, { id: "ocean-mist", label: "海雾蓝" },
  { id: "sunset-paper", label: "暖纸棕" }, { id: "rose-blush", label: "樱粉柔光" },
  { id: "night-ink", label: "午夜黑" },
];
const ADMIN = { config: "/api/admin/config" };
const $ = (s, r = document) => r.querySelector(s);

let cache = null;

/* ---------- theme select ---------- */
(function initTheme() {
  const sel = $("#theme-select");
  sel.innerHTML = THEMES.map(t => `<option value="${t.id}">${t.label}</option>`).join("");
  const saved = localStorage.getItem("bb_admin_theme") || "willow";
  sel.value = saved;
  document.documentElement.setAttribute("data-ui-theme", saved);
  sel.addEventListener("change", () => {
    const v = sel.value;
    document.documentElement.setAttribute("data-ui-theme", v);
    localStorage.setItem("bb_admin_theme", v);
  });
})();

/* ---------- load ---------- */
async function load() {
  try {
    const cfg = await (await fetch(ADMIN.config)).json();
    cache = cfg;
    $("#f-title").value = cfg.appTitle || "";
    $("#f-subtitle").value = cfg.subtitle || "";
    $("#f-apibase").value = cfg.apiBase || "";
    $("#f-apikey").value = cfg.apiKey || "";
    renderModels(cfg.models || [], cfg.defaultModel);
    updateStatus(cfg);
  } catch (e) {
    setStatus(false, "加载失败：" + e.message);
  }
}

function updateStatus(cfg) {
  if (!cfg.apiBase) return setStatus(false, "未配置 API 地址（演示模式，对话返回演示回复）");
  const mode = cfg.apiKey ? "OpenAI 兼容" : "自定义后端透传";
  setStatus(true, `${mode}：${cfg.apiBase}${cfg.defaultModel ? ` · 默认 ${cfg.defaultModel}` : ""}`);
}
function setStatus(ok, hint) {
  const b = $("#status-badge");
  b.className = "badge " + (ok ? "badge-ok" : "badge-warn");
  b.textContent = ok ? "● 已接入" : "○ 演示模式";
  $("#status-hint").textContent = hint || "";
}

/* ---------- model rows ---------- */
function renderModels(models, defaultId) {
  const list = $("#model-list");
  list.innerHTML = "";
  models.forEach(m => list.appendChild(row(m, defaultId)));
  refreshOps();
}
function row(m, defaultId) {
  const r = document.createElement("div");
  r.className = "mrow";
  r.innerHTML = `
    <div class="check-cell"><input type="radio" name="default-model" class="pick m-default" title="设为默认"></div>
    <div class="check-cell"><input type="checkbox" class="pick m-enabled" title="启用"></div>
    <div class="c-id"><input class="field m-id" placeholder="模型 id，如 vertex/gemini-3-flash"></div>
    <div class="c-label"><input class="field m-label" placeholder="显示名，如 gemini-3-flash"></div>
    <div class="c-ops m-ops">
      <button class="op" data-dir="-1" title="上移">↑</button>
      <button class="op" data-dir="1" title="下移">↓</button>
      <button class="op danger" data-act="del" title="删除">✕</button>
    </div>`;
  r.querySelector(".m-default").checked = m.id === defaultId;
  r.querySelector(".m-enabled").checked = m.enabled !== false;
  r.querySelector(".m-id").value = m.id || "";
  r.querySelector(".m-label").value = m.label || "";
  return r;
}
function gatherModels() {
  return [...$$("#model-list .mrow")].map(r => ({
    id: r.querySelector(".m-id").value.trim(),
    label: r.querySelector(".m-label").value.trim(),
    enabled: r.querySelector(".m-enabled").checked,
  })).filter(m => m.id);
}
function gatherDefault() {
  const r = $("#model-list .mrow input.m-default:checked");
  if (!r) return "";
  return r.closest(".mrow").querySelector(".m-id").value.trim();
}

/* ---------- ops (delegated) ---------- */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
$("#model-list").addEventListener("click", (e) => {
  const op = e.target.closest(".op");
  if (!op) return;
  const r = op.closest(".mrow");
  const list = $("#model-list");
  if (op.dataset.act === "del") {
    r.remove(); refreshOps(); return;
  }
  const dir = Number(op.dataset.dir);
  const rows = [...list.children];
  const i = rows.indexOf(r);
  const j = i + dir;
  if (j < 0 || j >= rows.length) return;
  if (dir < 0) list.insertBefore(r, rows[j]);
  else list.insertBefore(r, rows[j].nextSibling);
  refreshOps();
});
function refreshOps() {
  const rows = $$("#model-list .mrow");
  rows.forEach((r, i) => {
    r.querySelector('.op[data-dir="-1"]').disabled = i === 0;
    r.querySelector('.op[data-dir="1"]').disabled = i === rows.length - 1;
  });
  // ensure exactly one default selected (pick first if none)
  if (!$$("#model-list input.m-default:checked").length && rows.length) {
    rows[0].querySelector(".m-default").checked = true;
  }
}

$("#btn-add-model").addEventListener("click", () => {
  const r = row({ id: "", label: "", enabled: true }, "");
  $("#model-list").appendChild(r);
  r.querySelector(".m-id").focus();
  refreshOps();
});

/* ---------- save ---------- */
$("#btn-save").addEventListener("click", async () => {
  const msg = $("#save-msg");
  msg.className = "save-msg"; msg.textContent = "保存中…";
  const models = gatherModels();
  if (!models.length) {
    msg.className = "save-msg err"; msg.textContent = "至少保留一个模型";
    return;
  }
  const body = {
    appTitle: $("#f-title").value.trim() || "依依老师课堂",
    subtitle: $("#f-subtitle").value.trim(),
    apiBase: $("#f-apibase").value.trim(),
    apiKey: $("#f-apikey").value.trim(),
    defaultModel: gatherDefault() || models[0].id,
    models,
  };
  try {
    const res = await fetch(ADMIN.config, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    cache = data.config;
    renderModels(cache.models, cache.defaultModel);
    updateStatus(cache);
    msg.className = "save-msg ok"; msg.textContent = "已保存 ✓";
    setTimeout(() => { if (msg.textContent === "已保存 ✓") msg.textContent = ""; }, 2500);
  } catch (e) {
    msg.className = "save-msg err"; msg.textContent = "保存失败：" + e.message;
  }
});

load();
