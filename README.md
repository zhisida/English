# 依依老师课堂 · Node.js 复刻

对 [english.teachering.work](https://english.teachering.work/) 的功能复刻 —— 一个面向英语教师的 AI
智能体聚合平台。**前端忠实还原原站的设计与交互**（5 套主题、学段 / 模型切换、26 个教学智能体、
对话面板、历史记录），**后端用 Node.js (Express) 重写**，并附带一个**管理后台 `/manage`**，可在网页上
配置模型列表、默认模型与模型后端地址。

> 设计令牌（颜色 / 主题）逐条从原站运行时 CSS 变量中提取，1:1 还原。

---

## 快速开始

```bash
npm install
npm start            # 生产启动
# 或
npm run dev          # 带 --watch 热重载
```

- 前台： http://localhost:3000
- 管理后台： http://localhost:3000/manage （也可用原站路径 `/manage-996j`、`/prompt-manage`）

默认是**演示模式**：对话返回演示回复。要接入真实模型，把 `data/config.example.json` 复制为 `data/config.json` 并填入 `apiKey`（或在管理后台填写「API 地址 + API Key」），对话即走 OpenAI 兼容协议调用真实模型。

---

## 项目结构

```
.
├── server.js              # Express 服务：静态资源 + 配置 API + 聊天代理
├── package.json
├── data/
│   ├── config.example.json  # 配置模板（已提交，不含密钥）；首次部署复制为 config.json
│   └── config.json          # 运行时配置（含 API Key，已 gitignore）—— 管理后台直接读写
└── public/                # 前端静态资源
    ├── index.html         # 应用外壳（顶栏 / 侧栏 / 对话区）
    ├── styles.css         # 设计系统：5 套主题 CSS 变量 + 布局 + 组件
    ├── app.js             # 前端逻辑：渲染 / 主题 / 学段模型 / 卡片→对话 / 发送 / 历史 / 本地持久化
    ├── admin.html         # 管理后台页面
    ├── admin.css          # 管理后台样式
    ├── admin.js           # 管理后台逻辑：模型增删改 / 排序 / 启用 / 默认 / 保存
    └── assets/            # favicon
```

---

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET`  | `/api/config` | 公共配置（前端启动读取）：`appTitle` / `defaultModel` / `models`（仅启用的）/ `chatReady` |
| `GET`  | `/api/admin/config` | 完整配置（管理后台读取） |
| `POST` | `/api/admin/config` | 保存配置，body：`{ appTitle?, subtitle?, apiBase?, apiKey?, defaultModel?, models? }` |
| `POST` | `/api/chat` | 对话代理。body：`{ agent, model, phase, messages }`；配了 `apiBase` 则转发，否则返回演示回复 |

### 接入真实模型后端

`/api/chat` 有两种工作模式（由配置自动选择）：

**① OpenAI 兼容（推荐 · 同时填 apiBase + apiKey）**

```
POST {apiBase}/chat/completions
Authorization: Bearer {apiKey}
Content-Type: application/json
{ "model": "glm-5.2", "messages": [ { "role": "system", ... }, { "role": "user", "content": "..." } ], "stream": false }
```

服务端会按当前智能体 + 学段自动注入 `system` prompt，并取 `choices[0].message.content` 作为回复。
任何 OpenAI 兼容端点（GLM / DeepSeek / Moonshot / 自建网关等）只要填上 `apiBase`（到 `/v1`）和 `apiKey` 即可用。

**② 自定义后端（只填 apiBase、不填 apiKey）**

```
POST {apiBase}
Content-Type: application/json
{ "agent": "...", "model": "...", "phase": "...", "messages": [{ "role": "user|assistant", "content": "..." }] }
```

期望返回 JSON `{ "reply": "..." }`（也兼容 `{ content | text }` 或纯文本）。把你的网关 / 模型服务适配成这个约定即可。

也可直接改 `server.js` 的 `/api/chat`，按你的上游协议做流式 (SSE) 转发。

---

## 如何扩展

### 1. 新增一个教学智能体（侧栏卡片）

编辑 `public/app.js` 的 `AGENTS` 数组，加一项即可，无需改别处：

```js
{ id: "mytool", label: "我的工具", section: "teach", icon: "spark", ph: "在这里输入…" }
```

- `section`：`"teach"`（辅助教学功能区）或 `"test"`（辅助命题功能区）
- `icon`：取 `ICON` 字典里的任一 key（`doc / search / message / report / book / swap / grid /
  puzzle / spark / pen / badge / clip / eye / beaker / cap / arrows / image / cut / q / list /
  chart / bug / shield / chat`），也可往 `ICON` 里加新图标
- 若想让该智能体在演示模式下有定制回复，在 `server.js` 的 `demoReply()` 里加一个分支

### 2. 新增一套主题

主题完全由 CSS 变量驱动。在 `public/styles.css` 末尾加一段：

```css
[data-ui-theme="my-theme"] {
  --ui-bg: #…;  --ui-panel: #…;  --ui-accent: #…;  /* …参照现有 5 套补全令牌 */
}
```

再到 `public/app.js` 的 `THEMES` 数组（前台下拉）和 `public/admin.js` 的 `THEMES`（后台下拉）各加一项
`{ id: "my-theme", label: "我的主题", swatch: "#…" }`。

### 3. 增加学段 / 模型

- **模型**：直接在管理后台增删，无需改代码（写进 `data/config.json`）。
- **学段**：编辑 `public/app.js` 的 `PHASES` 数组；样式令牌为 `--ui-select-phase-{senior|junior|custom}-bg`。

### 4. 让对话“真的”回答

管理后台 → 「API 地址」填你的后端，或改 `server.js` 的 `/api/chat` 做流式 (SSE) 转发。

---

## 与原站的差异

- 原站是 React/Vite SPA + 自有后端（`/api/unified`）；本项目是**服务端渲染外壳 + 原生 JS**，无构建步骤。
- AI 对话能力依赖你接入的后端；未接入时为演示回复（UI / 交互 / 主题 / 模型管理 / 历史均完整可用）。
- 设计、配色、布局、文案、智能体清单与原站一致。
