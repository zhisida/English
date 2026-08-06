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

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, "data", "config.json");
const EXAMPLE_FILE = path.join(__dirname, "data", "config.example.json");

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ----------------------------- config store ---------------------------- */
function loadConfig() {
  // 运行时配置（含密钥）优先；缺失时回退到提交在仓库里的模板（演示模式）。
  for (const f of [CONFIG_FILE, EXAMPLE_FILE]) {
    try { return JSON.parse(fs.readFileSync(f, "utf-8")); } catch {}
  }
  console.error("读取配置失败，使用内置默认配置");
  return { appTitle: "依依老师课堂", apiBase: "", apiKey: "", defaultModel: "", models: [] };
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

  res.json({ ok: true, config: cfg, public: publicConfig(cfg) });
});

/* ---- chat proxy ----
   - 未配置 apiBase：返回演示回复。
   - apiBase + apiKey：按 OpenAI 兼容协议 POST {apiBase}/chat/completions，
     Bearer 鉴权，并按当前智能体自动注入 system prompt。
   - 仅 apiBase（无 key）：按自定义后端透传 { agent, model, phase, messages }，
     期望返回 { reply|content|text } 或纯文本。 */
app.post("/api/chat", async (req, res) => {
  const cfg = loadConfig();
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
  const cfg = loadConfig();
  console.log(`\n  依依老师课堂 已启动 →  http://localhost:${PORT}`);
  console.log(`  管理后台       →  http://localhost:${PORT}/manage`);
  console.log(`  模型后端       →  ${cfg.apiBase ? "已配置" : "未配置（演示模式）"}\n`);
});
