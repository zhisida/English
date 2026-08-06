/* =========================================================================
   依依老师课堂 — Node.js (Express) 后端
   - 提供前端静态资源
   - /api/config          公共配置（前端启动时读取）
   - /api/admin/config    管理后台：读取 / 保存配置（模型、默认模型、API 地址等）
   - /api/chat            聊天代理：配置了 apiBase 则转发到真实后端，否则演示回复
   - /manage              管理后台页面
   ========================================================================= */

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, "data", "config.json");
const EXAMPLE_FILES = [
  path.join(__dirname, "data", "config.example.json"), // 本地开发 / 宿主机挂载
  path.join(__dirname, "config.example.json"),         // 烤进镜像根目录（避免被 data 卷遮蔽）
];

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ----------------------------- config store ---------------------------- */
function loadConfig() {
  // 运行时配置（含密钥）优先；缺失时依次回退到模板（演示模式）。
  for (const f of [CONFIG_FILE, ...EXAMPLE_FILES]) {
    try { return JSON.parse(fs.readFileSync(f, "utf-8")); } catch {}
  }
  console.error("读取配置失败，使用内置默认配置");
  return { appTitle: "依依老师课堂", apiBase: "", apiKey: "", defaultModel: "", models: [] };
}
// 运行时读取：在文件配置之上叠加环境变量（API_BASE / API_KEY / APP_TITLE），便于容器化部署。
// 注意：管理后台的读 / 写仍用 loadConfig()（纯文件），避免把环境变量写回文件。
function runtimeConfig() {
  const cfg = loadConfig();
  if (process.env.API_BASE) cfg.apiBase = process.env.API_BASE.trim();
  if (process.env.API_KEY) cfg.apiKey = process.env.API_KEY.trim();
  if (process.env.APP_TITLE) cfg.appTitle = process.env.APP_TITLE.trim().slice(0, 60);
  return cfg;
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

/* ----------------------------- admin auth ------------------------------ */
// 管理后台鉴权：HTTP Basic。凭据优先级：环境变量 ADMIN_USER/ADMIN_PASS >
// data/config.json 的 adminUser/adminPass > 首次启动自动生成（持久化并打印日志），
// 保证默认即安全。
function safeEq(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
function resolveAdminCreds() {
  const cfg = loadConfig();
  const user = (process.env.ADMIN_USER || cfg.adminUser || "admin").trim();
  if (process.env.ADMIN_PASS && process.env.ADMIN_PASS.trim()) {
    return { user, pass: process.env.ADMIN_PASS.trim(), source: "环境变量" };
  }
  if (cfg.adminPass) {
    return { user: cfg.adminUser || user, pass: cfg.adminPass, source: "配置文件" };
  }
  const pass = crypto.randomBytes(9).toString("base64").slice(0, 14);
  try { saveConfig({ ...cfg, adminUser: user, adminPass: pass }); } catch {}
  return { user, pass, source: "自动生成" };
}
function requireAdmin(req, res, next) {
  const { user, pass } = resolveAdminCreds();
  const auth = req.headers.authorization || "";
  let ok = false;
  if (auth.startsWith("Basic ")) {
    let decoded = "";
    try { decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8"); } catch {}
    const idx = decoded.indexOf(":");
    if (idx >= 0) ok = safeEq(decoded.slice(0, idx), user) && safeEq(decoded.slice(idx + 1), pass);
  }
  if (!ok) {
    res.setHeader("WWW-Authenticate", 'Basic realm="yiyi-classroom admin"');
    return res.status(401).send("需要管理员鉴权");
  }
  next();
}
function stripAdminCreds(cfg) {
  const { adminPass, ...rest } = cfg;   // 不把密码返回给前端
  return rest;
}

/* ----------------------------- routes ---------------------------------- */
app.get("/api/config", (_req, res) => {
  res.json(publicConfig(runtimeConfig()));
});

app.get("/api/admin/config", requireAdmin, (_req, res) => {
  res.json(stripAdminCreds(loadConfig()));
});

app.post("/api/admin/config", requireAdmin, (req, res) => {
  const cfg = loadConfig();
  const body = req.body || {};

  if (typeof body.appTitle === "string") cfg.appTitle = body.appTitle.trim().slice(0, 60);
  if (typeof body.subtitle === "string") cfg.subtitle = body.subtitle.trim().slice(0, 120);
  if (typeof body.apiBase === "string") cfg.apiBase = body.apiBase.trim();
  if (typeof body.apiKey === "string") cfg.apiKey = body.apiKey.trim();

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

  res.json({ ok: true, config: stripAdminCreds(cfg), public: publicConfig(cfg) });
});

/* ---- chat proxy ----
   - 未配置 apiBase：返回演示回复。
   - apiBase + apiKey：按 OpenAI 兼容协议 POST {apiBase}/chat/completions，
     Bearer 鉴权，并按当前智能体自动注入 system prompt。
   - 仅 apiBase（无 key）：按自定义后端透传 { agent, model, phase, messages }，
     期望返回 { reply|content|text } 或纯文本。 */
app.post("/api/chat", async (req, res) => {
  const cfg = runtimeConfig();
  const { agent = "developer", model, phase = "senior", messages = [] } = req.body || {};

  if (!cfg.apiBase) {
    return res.json({ reply: demoReply(agent, lastUserText(messages), cfg), demo: true });
  }

  // 规整对话：丢弃空轮（含前端末尾的空 bot 占位），bot→assistant
  const turns = messages
    .map(m => ({ role: m.role === "bot" ? "assistant" : m.role, content: (m.content || "").trim() }))
    .filter(m => m.role === "system" || m.role === "user" || m.role === "assistant")
    .filter(m => m.content);

  try {
    if (cfg.apiKey) {
      const url = cfg.apiBase.replace(/\/+$/, "") + "/chat/completions";
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: model || cfg.defaultModel,
          messages: [{ role: "system", content: systemPrompt(agent, phase, cfg) }, ...turns],
          stream: false,
          temperature: 0.6,
        }),
      });
      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "");
        return res.status(502).json({ error: `模型后端返回 HTTP ${upstream.status}` + (errText ? `：${errText.slice(0, 200)}` : "") });
      }
      const data = await upstream.json();
      const reply = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.content ?? data?.reply ?? "";
      if (!reply) return res.json({ reply: "（模型未返回正文）\n" + JSON.stringify(data).slice(0, 300) });
      return res.json({ reply });
    }

    // 自定义后端透传
    const upstream = await fetch(cfg.apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, model: model || cfg.defaultModel, phase, messages: turns }),
    });
    if (!upstream.ok) return res.status(502).json({ error: `上游返回 HTTP ${upstream.status}` });
    const ct = upstream.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await upstream.json();
      return res.json({ reply: data.reply || data.content || data.text || JSON.stringify(data) });
    }
    const text = await upstream.text();
    return res.json({ reply: text });
  } catch (e) {
    return res.status(502).json({ error: "转发失败：" + e.message });
  }
});

/* ---- admin pages (original used /manage-996j and /prompt-manage) ---- */
["/manage", "/manage-996j", "/prompt-manage"].forEach(p =>
  app.get(p, requireAdmin, (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html"))));

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
const PHASE_LABEL = { senior: "高中", junior: "初中", custom: "小学" };
function systemPrompt(agent, phase, cfg) {
  const label = AGENT_LABEL[agent] || "教学智能体";
  const ph = PHASE_LABEL[phase] || "基础教育";
  const title = cfg.appTitle || "依依老师课堂";
  return [
    `你是「${title}」中的「${label}」智能体，服务对象是中国英语教师，当前学段为${ph}。`,
    `你的职责是：${label}。请就用户提交的内容完成该项工作。`,
    "输出要求：使用简体中文；专业准确、条理清晰；直接给出可用于备课或课堂的成果（必要时用小标题或列表组织）；若信息不足，先简短说明需补充什么，再给出基于现有信息的尽量完整的方案。",
  ].join("\n");
}
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
  const cfg = runtimeConfig();
  const admin = resolveAdminCreds();
  console.log(`\n  依依老师课堂 已启动 →  http://localhost:${PORT}`);
  console.log(`  管理后台       →  http://localhost:${PORT}/manage （需鉴权）`);
  if (admin.source === "自动生成") {
    console.log(`  管理账号       →  ${admin.user} / ${admin.pass}  （首次自动生成，已写入 data/config.json）`);
    console.log(`                  可用环境变量 ADMIN_USER / ADMIN_PASS 覆盖`);
  } else {
    console.log(`  管理账号       →  ${admin.user} （密码来源：${admin.source}）`);
  }
  console.log(`  模型后端       →  ${cfg.apiBase ? "已配置" : "未配置（演示模式）"}\n`);
});
