/* =========================================================================
   邦邦老师智能体 — Node.js (Express) 后端
   - 提供前端静态资源
   - /api/config          公共配置（前端启动时读取）
   - /api/admin/config    管理后台：读取 / 保存配置（模型、默认模型、API 地址等）
   - /api/chat            聊天代理：配置了 apiBase 则转发到真实后端，否则演示回复
   - /manage              管理后台页面
   ========================================================================= */

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, "data", "config.json");

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ----------------------------- config store ---------------------------- */
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (e) {
    console.error("读取配置失败，使用默认配置:", e.message);
    return { appTitle: "邦邦老师智能体", apiBase: "", defaultModel: "", models: [] };
  }
}
function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}
function publicConfig(cfg) {
  return {
    appTitle: cfg.appTitle,
    subtitle: cfg.subtitle || "",
    defaultModel: cfg.defaultModel,
    chatReady: Boolean(cfg.apiBase),
    models: (cfg.models || []).filter(m => m.enabled !== false).map(m => ({ id: m.id, label: m.label })),
  };
}
function validateModels(arr) {
  if (!Array.isArray(arr)) return null;
  const seen = new Set();
  const out = [];
  for (const m of arr) {
    if (!m || typeof m.id !== "string" || typeof m.label !== "string") continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ id: m.id.trim(), label: m.label.trim() || m.id, enabled: m.enabled !== false });
  }
  return out;
}

/* ----------------------------- routes ---------------------------------- */
app.get("/api/config", (_req, res) => {
  res.json(publicConfig(loadConfig()));
});

app.get("/api/admin/config", (_req, res) => {
  res.json(loadConfig());
});

app.post("/api/admin/config", (req, res) => {
  const cfg = loadConfig();
  const body = req.body || {};

  if (typeof body.appTitle === "string") cfg.appTitle = body.appTitle.trim().slice(0, 60);
  if (typeof body.subtitle === "string") cfg.subtitle = body.subtitle.trim().slice(0, 120);
  if (typeof body.apiBase === "string") cfg.apiBase = body.apiBase.trim();

  if (Array.isArray(body.models)) {
    const models = validateModels(body.models);
    if (!models) return res.status(400).json({ error: "models 必须是数组" });
    cfg.models = models;
  }

  // default model must be a known id
  if (typeof body.defaultModel === "string") {
    cfg.defaultModel = cfg.models.some(m => m.id === body.defaultModel)
      ? body.defaultModel
      : (cfg.models[0] && cfg.models[0].id) || "";
  } else if (!cfg.models.some(m => m.id === cfg.defaultModel)) {
    cfg.defaultModel = (cfg.models[0] && cfg.models[0].id) || "";
  }

  try { saveConfig(cfg); }
  catch (e) { return res.status(500).json({ error: "保存失败: " + e.message }); }

  res.json({ ok: true, config: cfg, public: publicConfig(cfg) });
});

/* ---- chat proxy ----
   配置了 apiBase 时，把对话转发到真实后端；否则返回演示回复。
   上游约定：POST {apiBase}  body: { model, messages, agent, phase }
   返回：JSON { reply|content|text } 或纯文本。 */
app.post("/api/chat", async (req, res) => {
  const cfg = loadConfig();
  const { agent = "developer", model, phase = "senior", messages = [] } = req.body || {};

  if (!cfg.apiBase) {
    return res.json({ reply: demoReply(agent, lastUserText(messages), cfg), demo: true });
  }

  try {
    const upstream = await fetch(cfg.apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent, model: model || cfg.defaultModel, phase,
        messages: messages.map(m => ({ role: m.role === "bot" ? "assistant" : "user", content: m.content })),
      }),
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: `上游返回 HTTP ${upstream.status}` });
    }

    const ct = upstream.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await upstream.json();
      return res.json({ reply: data.reply || data.content || data.text || JSON.stringify(data) });
    }
    const text = await upstream.text();
    return res.json({ reply: text });
  } catch (e) {
    return res.status(502).json({ error: "转发失败: " + e.message });
  }
});

/* ---- admin pages (original used /manage-996j and /prompt-manage) ---- */
["/manage", "/manage-996j", "/prompt-manage"].forEach(p =>
  app.get(p, (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html"))));

// SPA-ish fallback to the app
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

/* ----------------------------- helpers --------------------------------- */
function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content || "";
  }
  return "";
}
const AGENT_LABEL = {
  analysis: "语篇深度分析", speechstrategy: "言说策略分析", report: "语篇深度研读报告",
  languagepoints: "课文语言点讲解", paraphrase: "地道表达转述释义", vocab: "词汇分类教学",
  chunks: "词块提取与讲解", grammar: "语法情境教学", writing: "英文写作教学",
  grading: "学生作文批改", writingcoach: "辅助应用文写作", review: "试卷重点题讲评",
  paperprojection: "试卷可视化全解", mining: "榨干一套英语试卷", class: "阅读课教学设计",
  readwrite: "读写整合教学设计", image: "图片生成", adaptation: "阅读文本改编",
  adaptation2: "阅读文本改编2", question: "阅读理解设问", question2: "阅读理解设问2",
  clozetest: "辅助完形填空命题", exam: "试题解读分析", bugdetector: "英语试题Bug侦察",
  overvocabdetect: "超标词排查+替换", developer: "自由对话",
};
function demoReply(agent, text, cfg) {
  const label = AGENT_LABEL[agent] || "智能体";
  const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;
  const body = ({
    analysis: "我会从主题意义、语篇结构、词汇语法、衔接连贯等维度做深度语篇分析，并给出可落地的教学建议。",
    image: "我会根据你的描述生成教学用图。请在管理后台配置可用的图像模型后端。",
    developer: `你好！我是${cfg.appTitle}。任何英语教学相关的问题都可以问我——在管理后台 (/manage) 配置 API 地址后即可获得真实回复。`,
  })[agent] || "我会按该智能体的流程处理你的输入并输出结构化结果。";
  return `【${label}】收到：\n「${preview}」\n\n${body}\n\n——— 演示回复 · 在管理后台配置 apiBase 后将调用真实模型。`;
}

/* ----------------------------- boot ------------------------------------ */
app.listen(PORT, () => {
  const cfg = loadConfig();
  console.log(`\n  邦邦老师智能体 已启动 →  http://localhost:${PORT}`);
  console.log(`  管理后台       →  http://localhost:${PORT}/manage`);
  console.log(`  模型后端       →  ${cfg.apiBase ? "已配置" : "未配置（演示模式）"}\n`);
});
