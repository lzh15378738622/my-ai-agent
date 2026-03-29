// 从 express 导入 Router，用于创建模块化路由
import { Router } from "express";
// 从 uuid 导入 v4 方法，用于生成唯一会话 ID
import { v4 as uuidv4 } from "uuid";
// 从数据库模块导入会话和消息的增删查方法
import {
  getSessions,
  getSession,
  createSession,
  deleteSession,
  getMessages,
} from "./database.js";
// 从对话模块导入流式聊天方法
import { streamChat } from "./chat.js";

// 创建路由实例，后续所有接口都挂载在这个实例上
const router = Router();

// ========== 会话相关接口 ==========

// GET /api/sessions - 获取所有会话列表，按更新时间倒序
router.get("/sessions", (_req, res) => {
  try {
    // 从数据库查询所有会话
    const sessions = getSessions();
    // 返回 JSON 数组给前端
    res.json(sessions);
  } catch (error) {
    // 查询失败时返回 500 错误
    res.status(500).json({ error: "获取会话列表失败" });
  }
});

// POST /api/sessions - 创建新会话
router.post("/sessions", (_req, res) => {
  try {
    // 生成一个随机唯一 ID 作为会话标识
    const id = uuidv4();
    // 在数据库中插入新会话，默认标题"新对话"
    createSession(id);
    // 立刻查回刚创建的会话对象（包含默认的时间戳等字段）
    const session = getSession(id);
    // 返回 201（已创建）状态码和新会话数据
    res.status(201).json(session);
  } catch (error) {
    // 创建失败时返回 500 错误
    res.status(500).json({ error: "创建会话失败" });
  }
});

// DELETE /api/sessions/:id - 删除指定会话
// :id 是路由参数，用户访问 /api/sessions/abc-123 时，req.params.id = "abc-123"
router.delete("/sessions/:id", (req, res) => {
  try {
    // 获取 URL 中的会话 ID
    deleteSession(req.params.id);
    // 返回成功标识
    res.json({ success: true });
  } catch (error) {
    // 删除失败时返回 500 错误
    res.status(500).json({ error: "删除会话失败" });
  }
});

// ========== 消息相关接口 ==========

// GET /api/sessions/:id/messages - 获取指定会话的所有消息，按时间正序
router.get("/sessions/:id/messages", (req, res) => {
  try {
    // 从数据库查询该会话的全部消息
    const messages = getMessages(req.params.id);
    // 返回 JSON 数组给前端
    res.json(messages);
  } catch (error) {
    // 查询失败时返回 500 错误
    res.status(500).json({ error: "获取消息失败" });
  }
});

// ========== 聊天接口（SSE 流式响应） ==========

// POST /api/sessions/:id/chat - 发送消息并获取 AI 流式回复
router.post("/sessions/:id/chat", async (req, res) => {
  // 从 URL 路径中提取会话 ID
  const { id } = req.params;
  // 从 POST 请求体中提取用户发送的消息内容
  const { message } = req.body as { message: string };

  // 校验：消息内容和会话 ID 都不能为空
  if (!message || !id) {
    res.status(400).json({ error: "缺少 message 或 session id" });
    return; // 提前返回，不继续执行后续逻辑
  }

  // 查询数据库，确认该会话是否存在（防止对着不存在的会话发消息）
  const session = getSession(id);
  if (!session) {
    res.status(404).json({ error: "会话不存在" });
    return; // 提前返回
  }

  // --- 以下开始设置 SSE（Server-Sent Events）流式响应 ---

  // 设置响应类型为事件流，浏览器据此识别这是 SSE 连接
  res.setHeader("Content-Type", "text/event-stream");
  // 禁止缓存，确保每条数据实时推送给浏览器
  res.setHeader("Cache-Control", "no-cache");
  // 保持 TCP 连接不断开，支持持续推送数据
  res.setHeader("Connection", "keep-alive");
  // 立即发送响应头给浏览器，不等待整个响应完成
  // 这一步对 SSE 至关重要，否则浏览器要等 res.end() 才会收到头
  res.flushHeaders();

  // 从数据库加载该会话的历史消息，用于给模型提供上下文
  const dbMessages = getMessages(id);
  // 将数据库消息格式转换为模型需要的格式
  // 数据库格式和模型格式一致，都是 { role, content }
  const history = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 调用流式聊天函数，传入会话 ID、用户消息、历史消息和回调
  await streamChat(id, message, history, {
    // 模型每生成一段文字时触发，立即通过 SSE 推送给前端
    // SSE 协议要求每条消息格式为 "data: " + JSON字符串 + 两个换行
    onText: (text) => {
      res.write(`data: ${JSON.stringify({ type: "text", text })}\n\n`);
    },

    // 模型决定调用工具时触发，通知前端正在执行某个工具
    // 比如前端可以显示"正在查询天气..."
    onToolUse: (toolName, toolInput) => {
      res.write(
        `data: ${JSON.stringify({ type: "tool_use", toolName, toolInput })}\n\n`,
      );
    },

    // 工具执行完毕后触发，把结果推送给前端
    // 比如前端可以显示"北京: 晴 15°C"
    onToolResult: (toolName, result) => {
      res.write(
        `data: ${JSON.stringify({ type: "tool_result", toolName, result })}\n\n`,
      );
    },

    // 整个对话流程正常结束时触发
    // 发送 [DONE] 标记告知前端流结束，然后关闭连接
    onDone: () => {
      res.write("data: [DONE]\n\n");
      res.end();
    },

    // 任何环节出错时触发
    // 将错误信息推送给前端，然后关闭连接
    onError: (error) => {
      res.write(`data: ${JSON.stringify({ type: "error", error })}\n\n`);
      res.end();
    },
  });
});

// 导出路由实例，供 index.ts 通过 app.use("/api", routes) 挂载
export default router;
