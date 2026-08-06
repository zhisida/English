/* =========================================================================
   依依老师课堂 — 静态复刻交互
   ========================================================================= */

/* ---- Backend -----------------------------------------------------------
   The frontend is config-driven: it reads models/title from GET /api/config
   and posts chat to POST /api/chat. The Node server decides whether to call
   a real model backend (configured in /manage) or return a demo reply.
   ------------------------------------------------------------------------ */
const API = {
  config: "/api/config",
  chat:   "/api/chat",
};

/* ----------------------------- DATA ------------------------------------ */
const THEMES = [
  { id: "willow",      label: "唐柳绿",   swatch: "#1f7f5b" },
  { id: "ocean-mist",  label: "海雾蓝",   swatch: "#2d6fa3" },
  { id: "sunset-paper",label: "暖纸棕",   swatch: "#b1643a" },
  { id: "rose-blush",  label: "樱粉柔光", swatch: "#b85c86" },
  { id: "night-ink",   label: "午夜黑",   swatch: "#0f0f0f" },
];

const PHASES = [
  { id: "senior", label: "高中" },
  { id: "junior", label: "初中" },
  { id: "custom", label: "小学" },
];

/* Models are loaded from the backend (GET /api/config, set in /manage).
   This list is only a fallback if the request fails. */
let MODELS = [
  { id: "vertex/gemini-2.5-flash",         label: "gemini-2.5-flash" },
  { id: "vertex/gemini-2.5-pro",           label: "gemini-2.5-pro" },
  { id: "vertex/gemini-3-flash-preview",   label: "gemini-3-flash" },
  { id: "vertex/gemini-3.1-pro-preview",   label: "gemini-3.1-pro" },
  { id: "vertex/gemini-3.6-flash",         label: "gemini-3.6-flash" },
];
let APP_TITLE = "依依老师课堂";

/* line icons (inner SVG markup); monochrome, inherit currentColor */
const ICON = {
  doc:    '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 13h8M8 16h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  search: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M20 20l-5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  message:'<path d="M4 5h16v11H8l-4 3V5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  report: '<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  book:   '<path d="M5 4a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2V4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 18a2 2 0 0 1 2-2h12" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  swap:   '<path d="M7 7h11l-3-3M17 17H6l3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  grid:   '<rect x="4" y="4" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  puzzle: '<path d="M10 3h4v3a2 2 0 1 1 4 0v3h-2a2 2 0 1 0 0 4h2v4a2 2 0 0 1-2 2h-3v-2a2 2 0 1 0-4 0v2H6a2 2 0 0 1-2-2v-3h2a2 2 0 1 0 0-4H4V6a2 2 0 0 1 2-2h4v-1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  spark:  '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M18 15l.7 2 .3-2 2-.3-2-.7-.3-2-.7 2-2 .3 2 .7z" fill="currentColor"/>',
  pen:    '<path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M13 6l5 5" stroke="currentColor" stroke-width="1.5"/>',
  badge:  '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  clip:   '<rect x="5" y="4" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 4v3h6V4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 12l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  eye:    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  beaker: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7.5 15h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  cap:    '<path d="M2 9l10-4 10 4-10 4-10-4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  arrows: '<path d="M7 8h11M14 5l3 3-3 3M17 16H6M9 13l-3 3 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  image:  '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 18l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  cut:    '<circle cx="6" cy="6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 8l12 8M8 16L20 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  q:      '<path d="M9 8a3 3 0 1 1 4 2.8c-1 .5-2 1.2-2 2.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="11" cy="17" r="1" fill="currentColor"/>',
  list:   '<path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="4" cy="6" r="1.3" fill="currentColor"/><circle cx="4" cy="12" r="1.3" fill="currentColor"/><circle cx="4" cy="18" r="1.3" fill="currentColor"/>',
  chart:  '<path d="M4 20V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 20h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="7" y="11" width="3" height="6" rx="1" fill="currentColor"/><rect x="12" y="7" width="3" height="10" rx="1" fill="currentColor"/><rect x="17" y="13" width="3" height="4" rx="1" fill="currentColor"/>',
  bug:    '<rect x="8" y="7" width="8" height="12" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 5l1.5 2M15 5l-1.5 2M4 10h4M16 10h4M4 16h4M16 16h4M12 7v12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  chat:   '<path d="M4 5h16v10H9l-5 4V5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24">${ICON[name] || ICON.doc}</svg>`;

/* agents — labels/grouping match the source site's rendered sidebar */
const AGENTS = [
  // ---- 辅助教学功能区 ----
  { id: "analysis",        label: "语篇深度分析",    section: "teach", icon: "search", ph: "粘贴一篇文章，获取深度语篇分析" },
  { id: "speechstrategy",  label: "言说策略分析",    section: "teach", icon: "message",ph: "输入语篇，分析其言说 / 修辞策略" },
  { id: "report",          label: "语篇深度研读报告",section: "teach", icon: "report", ph: "粘贴文本，生成深度研读报告" },
  { id: "languagepoints",  label: "课文语言点讲解",  section: "teach", icon: "book",   ph: "输入课文，提取并讲解语言点" },
  { id: "paraphrase",      label: "地道表达转述释义",section: "teach", icon: "swap",   ph: "输入句子，给出地道转述与释义" },
  { id: "vocab",           label: "词汇分类教学",    section: "teach", icon: "grid",   ph: "粘贴词汇，按主题 / 级别分类讲解" },
  { id: "chunks",          label: "词块提取与讲解",  section: "teach", icon: "puzzle", ph: "输入文本，提取并讲解词块" },
  { id: "grammar",         label: "语法情境教学",    section: "teach", icon: "spark",  ph: "输入语法点，设计情境化教学" },
  { id: "writing",         label: "英文写作教学",    section: "teach", icon: "pen",    ph: "输入写作任务，获取教学设计" },
  { id: "grading",         label: "学生作文批改",    section: "teach", icon: "badge",  ph: "粘贴学生作文，获取批改建议" },
  { id: "writingcoach",    label: "辅助应用文写作",  section: "teach", icon: "pen",    ph: "描述写作场景，生成应用文" },
  { id: "review",          label: "试卷重点题讲评",  section: "teach", icon: "clip",   ph: "粘贴试题，生成重点题讲评" },
  { id: "paperprojection", label: "试卷可视化全解",  section: "teach", icon: "eye",    ph: "上传 / 粘贴试卷，生成可视化全解" },
  { id: "mining",          label: "榨干一套英语试卷",section: "teach", icon: "beaker", ph: "粘贴一套试卷，深度挖掘利用" },
  { id: "class",           label: "阅读课教学设计",  section: "teach", icon: "cap",    ph: "输入阅读文本，生成课堂设计" },
  { id: "readwrite",       label: "读写整合教学设计",section: "teach", icon: "arrows", ph: "输入文本，设计读写整合课" },
  { id: "image",           label: "图片生成",        section: "teach", icon: "image",  ph: "描述需要的教学图片，开始生成" },
  // ---- 辅助命题功能区 ----
  { id: "adaptation",      label: "阅读文本改编",    section: "test", icon: "cut",    ph: "粘贴原文，按要求改编阅读文本" },
  { id: "adaptation2",     label: "阅读文本改编2",   section: "test", icon: "cut",    ph: "粘贴原文，进入改编工作流 2" },
  { id: "question",        label: "阅读理解设问",    section: "test", icon: "q",      ph: "输入文本与要求，生成阅读理解设问" },
  { id: "question2",       label: "阅读理解设问2",   section: "test", icon: "q",      ph: "输入文本与要求，生成设问 2" },
  { id: "clozetest",       label: "辅助完形填空命题",section: "test", icon: "list",   ph: "输入文本，生成完形填空题" },
  { id: "exam",            label: "试题解读分析",    section: "test", icon: "chart",  ph: "粘贴试题，生成解读分析" },
  { id: "bugdetector",     label: "英语试题Bug侦察", section: "test", icon: "bug",    ph: "粘贴试题，排查命题 Bug" },
  { id: "overvocabdetect", label: "超标词排查+替换", section: "test", icon: "shield", ph: "粘贴文本，排查超标词并给出替换" },
  { id: "developer",       label: "自由对话",        section: "test", icon: "chat",   ph: "和依依老师自由对话，提问任何教学问题" },
];

const SECTIONS = [
  { id: "teach", label: "辅助教学功能区" },
  { id: "test",  label: "辅助命题功能区" },
];

/* ----------------------------- STATE ----------------------------------- */
const STORE_KEY = "bb_teacher_state_v1";
const DEFAULT_STATE = {
  theme: "willow",
  phase: "senior",
  model: "glm-5.2",
  agent: "analysis",
  collapsed: { teach: false, test: false },
  conversations: {}, // { agentId: [{role:'user'|'bot', content}] }
  history: [],       // [{ agentId, label, ts }]
};
let state = loadState();

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    return Object.assign({}, structuredClone(DEFAULT_STATE), s || {});
  } catch { return structuredClone(DEFAULT_STATE); }
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}
const agentById = (id) => AGENTS.find(a => a.id === id) || AGENTS[0];

/* ----------------------------- HELPERS --------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function fmtTime(ts) {
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toTimeString().slice(0, 5)
    : `${d.getMonth() + 1}/${d.getDate()} ${d.toTimeString().slice(0, 5)}`;
}

/* ----------------------------- RENDER ---------------------------------- */
function renderAll() {
  applyTheme(state.theme);
  renderSidebar();
  renderHistory();
  renderThemeMenu();
  renderPhaseMenu();
  renderModelMenu();
  renderTopbarState();
  renderChat();
}

function applyTheme(id) {
  document.documentElement.setAttribute("data-ui-theme", id);
}

function renderSidebar() {
  const nav = $("#side-nav");
  nav.innerHTML = "";
  SECTIONS.forEach(sec => {
    const cards = AGENTS.filter(a => a.section === sec.id);
    const collapsed = state.collapsed[sec.id];
    const section = el("div", "section" + (collapsed ? " collapsed" : ""));
    section.dataset.sec = sec.id;

    const head = el("div", "section-head",
      `<h3>${sec.label}</h3>
       <button class="section-toggle" aria-label="${collapsed ? "展开" : "收起"} ${sec.label}">
         <svg viewBox="0 0 20 20"><path d="M7.293 14.293a1 1 0 0 1 0-1.414L10.172 10 7.293 7.12a1 1 0 0 1 1.414-1.414l3.89 3.889a1 1 0 0 1 0 1.415l-3.89 3.889a1 1 0 0 1-1.414 0Z" fill="currentColor"/></svg>
       </button>`);
    head.querySelector(".section-toggle").addEventListener("click", () => {
      state.collapsed[sec.id] = !state.collapsed[sec.id];
      saveState(); renderSidebar();
    });

    const body = el("div", "section-body");
    cards.forEach(a => {
      const card = el("button", "card" + (a.id === state.agent ? " is-active" : ""),
        `<span class="card-ic">${svg(a.icon)}</span><span class="card-label">${a.label}</span>`);
      card.title = a.label;
      card.addEventListener("click", () => openAgent(a.id, true));
      body.appendChild(card);
    });

    section.append(head, body);
    nav.appendChild(section);
  });
}

function renderHistory() {
  const list = $("#history-list");
  list.innerHTML = "";
  if (!state.history.length) {
    list.appendChild(el("li", "history-empty", "暂无历史记录"));
    return;
  }
  state.history.slice().reverse().forEach(h => {
    const li = el("li", "history-item",
      `<span class="h-dot"></span><span class="h-label">${h.label}</span>`);
    li.title = `${h.label} · ${fmtTime(h.ts)}`;
    li.addEventListener("click", () => openAgent(h.agentId, false));
    list.appendChild(li);
  });
}

function renderThemeMenu() {
  const menu = $("#menu-theme");
  menu.innerHTML = "";
  THEMES.forEach(t => {
    const active = t.id === state.theme;
    const item = el("button", "menu-item" + (active ? " is-active" : ""),
      `<span class="dot" style="background:${t.swatch}"></span><span>${t.label}</span>${active ? '<span class="check">✓</span>' : ""}`);
    item.addEventListener("click", () => { state.theme = t.id; saveState(); applyTheme(t.id); renderThemeMenu(); closeMenus(); });
    menu.appendChild(item);
  });
}

function renderPhaseMenu() {
  const menu = $("#menu-phase");
  menu.innerHTML = "";
  PHASES.forEach(p => {
    const active = p.id === state.phase;
    const item = el("button", "menu-item" + (active ? " is-active" : ""),
      `<span>${p.label}</span>${active ? '<span class="check">✓</span>' : ""}`);
    item.addEventListener("click", () => { state.phase = p.id; saveState(); renderTopbarState(); renderPhaseMenu(); closeMenus(); });
    menu.appendChild(item);
  });
}

function renderModelMenu() {
  const menu = $("#menu-model");
  menu.innerHTML = "";
  MODELS.forEach(m => {
    const active = m.id === state.model;
    const item = el("button", "menu-item" + (active ? " is-active" : ""),
      `<span>${m.label}</span>${active ? '<span class="check">✓</span>' : ""}`);
    item.addEventListener("click", () => { state.model = m.id; saveState(); renderTopbarState(); renderModelMenu(); closeMenus(); });
    menu.appendChild(item);
  });
}

function renderTopbarState() {
  const phase = PHASES.find(p => p.id === state.phase);
  const model = MODELS.find(m => m.id === state.model);
  $("#phase-label").textContent = phase ? phase.label : "";
  const pill = $(".pill-phase");
  if (pill) pill.dataset.phase = state.phase;
  $("#model-label").textContent = model ? model.label : "";
}

/* ----------------------------- CHAT ------------------------------------ */
function renderChat() {
  const a = agentById(state.agent);
  $("#chat-title").textContent = a.label;
  const input = $("#input");
  input.placeholder = a.ph || `输入内容，开始与「${a.label}」对话`;
  input.value = "";
  autoSize(input);

  const box = $("#messages");
  box.innerHTML = "";
  const convo = state.conversations[a.id] || [];
  if (!convo.length) {
    box.appendChild(el("div", "empty",
      `<div class="empty-logo">${a.id === "image" ? "🎨" : a.id === "developer" ? "💬" : "📚"}</div>
       <div class="empty-title">${a.label}</div>
       <div class="empty-sub">${a.ph}</div>`));
  } else {
    convo.forEach(m => box.appendChild(bubble(m.role, m.content)));
  }
  box.scrollTop = box.scrollHeight;
  setActiveCard();
}

function bubble(role, content) {
  const wrap = el("div", "msg " + (role === "user" ? "user" : "bot"));
  wrap.appendChild(el("div", "bubble" + (role === "bot" && !content ? " is-empty" : ""), escapeHtml(content)));
  return wrap;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function setActiveCard() {
  $$(".card").forEach(c => c.classList.remove("is-active"));
  // cards are re-rendered; mark by label match
  const a = agentById(state.agent);
  $$(".card").forEach(c => {
    if (c.querySelector(".card-label")?.textContent === a.label) c.classList.add("is-active");
  });
}

function openAgent(id, fromClick) {
  state.agent = id;
  // record history when first opened from a card
  if (fromClick) {
    const a = agentById(id);
    state.history = state.history.filter(h => h.agentId !== id);
    state.history.push({ agentId: id, label: a.label, ts: Date.now() });
    if (state.history.length > 30) state.history.shift();
  }
  saveState();
  renderSidebar(); renderHistory(); renderChat();
  closeSidebar();
}

function pushMessage(role, content) {
  const a = agentById(state.agent);
  (state.conversations[a.id] ||= []).push({ role, content });
  saveState();
  const box = $("#messages");
  // clear empty state
  if (box.querySelector(".empty")) box.innerHTML = "";
  const node = bubble(role, content);
  box.appendChild(node);
  box.scrollTop = box.scrollHeight;
  return node;
}

/* ----- send / respond ----- */
async function send() {
  const input = $("#input");
  const text = input.value.trim();
  if (!text) return;
  pushMessage("user", text);
  input.value = "";
  autoSize(input);

  const a = agentById(state.agent);
  const botNode = pushMessage("bot", "");
  botNode.querySelector(".bubble").classList.add("is-empty");
  botNode.querySelector(".bubble").innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;
  $("#btn-send").disabled = true;

  let reply;
  try {
    const p = callBackend(a);
    await Promise.all([p, delay(500)]); // keep the typing indicator briefly visible
    reply = await p;
  } catch (e) {
    reply = `⚠️ 请求失败：${e.message}`;
  }

  const b = botNode.querySelector(".bubble");
  b.classList.remove("is-empty");
  b.textContent = reply;
  // persist final bot message content
  const convo = state.conversations[a.id];
  convo[convo.length - 1].content = reply;
  saveState();
  $("#btn-send").disabled = false;
  $("#messages").scrollTop = $("#messages").scrollHeight;
}

async function callBackend(agent) {
  const convo = state.conversations[agent.id] || [];
  const res = await fetch(API.chat, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent: agent.id,
      model: state.model,
      phase: state.phase,
      messages: convo.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.reply || "";
}

function autoSize(t) {
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight, 160) + "px";
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ----------------------------- MENUS ----------------------------------- */
function closeMenus() { $$(".select").forEach(s => s.dataset.open = "false"); }
function toggleMenu(sel) {
  const open = sel.dataset.open === "true";
  closeMenus();
  sel.dataset.open = open ? "false" : "true";
}
["sel-theme", "sel-phase", "sel-model"].forEach(id => {
  const sel = document.getElementById(id);
  sel.querySelector("button").addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(sel); });
});
document.addEventListener("click", closeMenus);

/* ----------------------------- SIDEBAR (mobile) ------------------------ */
function openSidebar() { $("#sidebar").classList.add("open"); $("#backdrop").classList.add("show"); }
function closeSidebar() { $("#sidebar").classList.remove("open"); $("#backdrop").classList.remove("show"); }
$("#btn-sidebar").addEventListener("click", (e) => { e.stopPropagation(); openSidebar(); });
$("#backdrop").addEventListener("click", closeSidebar);

/* ----------------------------- ACTIONS --------------------------------- */
$("#btn-send").addEventListener("click", send);
$("#input").addEventListener("input", (e) => autoSize(e.target));
$("#input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});
$("#btn-new").addEventListener("click", () => {
  const a = agentById(state.agent);
  state.conversations[a.id] = [];
  saveState(); renderChat();
});
$("#btn-clear").addEventListener("click", () => {
  const a = agentById(state.agent);
  state.conversations[a.id] = [];
  saveState(); renderChat();
});
$("#btn-close-chat").addEventListener("click", () => { openSidebar(); });

/* ----------------------------- BOOT ------------------------------------ */
async function init() {
  try {
    const cfg = await (await fetch(API.config)).json();
    if (Array.isArray(cfg.models) && cfg.models.length) MODELS = cfg.models;
    if (cfg.appTitle) {
      APP_TITLE = cfg.appTitle;
      document.title = APP_TITLE;
      const brand = $(".brand-name"); if (brand) brand.textContent = APP_TITLE;
    }
    // first visit: adopt the backend's default model
    if (!localStorage.getItem(STORE_KEY) && cfg.defaultModel) state.model = cfg.defaultModel;
    // make sure the selected model still exists in the list
    if (!MODELS.some(m => m.id === state.model)) state.model = (MODELS[0] && MODELS[0].id) || state.model;
  } catch (e) {
    console.warn("加载后端配置失败，使用内置默认值:", e);
  }
  renderAll();
}
init();
