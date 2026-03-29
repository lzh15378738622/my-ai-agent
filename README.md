# AI Chatbot

## 项目介绍
本项目是基于 Express + React 的 AI 聊天机器人，接入了智谱 GLM 大模型，支持流式对话、语音输入和工具调用。

## 功能特性
- 🔹 流式对话：SSE 实时推送，打字机效果回复
- 🔹 多轮会话：支持创建、切换、删除多个聊天会话
- 🔹 语音输入：基于 Web Speech API 的浏览器端语音识别
- 🔹 工具调用：支持模型调用外部工具（如天气查询）
- 🔹 对话历史：自动保存聊天记录到数据库

## 环境依赖
- Node.js >= 18
- npm >= 9

## 快速开始
### 1. 克隆项目
```bash
git clone https://github.com/lzh15378738622/my-ai-agent.git
cd my-ai-agent
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置项目
复制配置模板并修改配置：
```bash
cp .env.example .env
```
打开 `.env` 文件，填入你的智谱 API Key：
```
ZHIPU_API_KEY=你的智谱API密钥
```
API Key 请在 [智谱开放平台](https://open.bigmodel.cn) 申请。

### 4. 运行项目
```bash
npm run dev
```
访问 http://localhost:5173 即可使用。

## 使用说明
1. 点击左侧「新对话」创建聊天会话
2. 在输入框输入消息，按 Enter 发送（Shift+Enter 换行）
3. 点击输入框左侧的麦克风按钮可以语音输入（仅 Chrome 浏览器）
4. 左侧列表可以切换或删除历史会话

## 项目结构
```
├── server/              # 后端代码
│   ├── index.ts         # 服务器入口
│   ├── routes.ts        # API 路由
│   ├── chat.ts          # 对话逻辑（调用智谱 API）
│   ├── database.ts      # 数据库操作
│   └── tools/           # 工具定义
│       └── weather.ts   # 天气查询工具
├── src/                 # 前端代码
│   ├── components/      # React 组件
│   │   ├── Sidebar.tsx      # 侧边栏（会话列表）
│   │   ├── ChatWindow.tsx   # 聊天窗口
│   │   ├── MessageList.tsx  # 消息列表
│   │   ├── MessageBubble.tsx# 消息气泡
│   │   └── MessageInput.tsx # 输入框（含语音按钮）
│   ├── hooks/           # 自定义 Hook
│   │   └── useChat.ts   # 聊天状态管理
│   ├── types/           # TypeScript 类型定义
│   ├── App.tsx          # 根组件
│   └── App.css          # 全局样式
├── data/                # 数据库文件（自动生成，不提交到 Git）
├── .env.example         # 环境变量模板
├── .gitignore
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 贡献指南
欢迎提交 Issue 和 Pull Request 参与项目开发：
1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 许可证
本项目基于 [MIT](https://choosealicense.com/licenses/mit/) 许可证开源。

## 联系方式
如果你有任何问题或者建议，可以通过以下方式联系我：
- 邮箱：9494926@qq.com
- 项目地址：https://github.com/lzh15378738622/my-ai-agent
