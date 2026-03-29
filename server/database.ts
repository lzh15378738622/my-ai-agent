// 导入 better-sqlite3 库，用于操作 SQLite 数据库（轻量级、无需额外安装数据库服务）
import Database from "better-sqlite3";
// 导入 Node.js 的 path 模块，用于拼接文件路径
import path from "path";
// 导入 fileURLToPath，用于将 ES Module 的 import.meta.url 转换为文件路径
import { fileURLToPath } from "url";
// 导入 fs 模块，用于检查目录是否存在
import fs from "fs";

// 获取当前文件（database.ts）所在的目录路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 拼接数据库文件路径：项目根目录/data/chatbot.db
const DB_PATH = path.join(__dirname, "..", "data", "chatbot.db");

// 声明数据库实例变量，全局只有一个连接，避免重复创建
let db: Database.Database;

// ========== 类型定义 ==========

// 会话的类型接口，对应数据库 sessions 表的每一行
export interface Session {
  id: string;           // 会话唯一标识（UUID 格式）
  title: string;        // 会话标题
  system_prompt: string;// 系统提示词（定义 AI 的角色和行为）
  created_at: string;   // 创建时间
  updated_at: string;   // 最后更新时间
}

// 消息的类型接口，对应数据库 messages 表的每一行
export interface Message {
  id: number;                // 消息自增 ID
  session_id: string;        // 所属会话的 ID
  role: "user" | "assistant";// 消息角色：用户 或 AI 助手
  content: string;           // 消息文本内容
  tool_calls: string | null; // 工具调用记录（JSON 字符串），没有则为 null
  created_at: string;        // 创建时间
}

// ========== 数据库连接管理 ==========

// 获取数据库实例，如果还未初始化则先初始化
export function getDb(): Database.Database {
  if (!db) initDb(); // 首次调用时自动初始化
  return db;
}

// 初始化数据库：创建目录、连接数据库、建表
export function initDb(): void {
  // 获取数据库文件所在目录（即 data/ 目录）
  const dir = path.dirname(DB_PATH);
  // 检查目录是否存在，不存在则递归创建（recursive: true 会创建所有中间目录）
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 以读写模式打开（或创建）数据库文件
  db = new Database(DB_PATH);
  // 启用 WAL（Write-Ahead Logging）模式
  // 优点：允许读写同时进行，不会因为读操作阻塞写操作
  db.pragma("journal_mode = WAL");
  // 启用外键约束（SQLite 默认关闭）
  // 启用后删除 session 时，关联的 messages 会级联删除（由 ON DELETE CASCADE 控制）
  db.pragma("foreign_keys = ON");

  // 创建 sessions 表（IF NOT EXISTS：表已存在则跳过，不会报错）
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,                                    -- 主键，文本类型（存 UUID）
      title TEXT NOT NULL DEFAULT '新对话',                     -- 标题，默认"新对话"
      system_prompt TEXT DEFAULT '你是一个友好的AI助手。',       -- 系统提示词，有默认值
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),  -- 创建时间，本地时间
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))   -- 更新时间，本地时间
    );

    -- 创建 messages 表
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,                   -- 自增主键
      session_id TEXT NOT NULL,                               -- 所属会话 ID
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')) -- 角色只能是 user 或 assistant
      content TEXT NOT NULL,                                  -- 消息内容
      tool_calls TEXT,                                        -- 工具调用记录（可选）
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),  -- 创建时间
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE  -- 外键，级联删除
    );
  `);
}

// ========== 会话操作 ==========

// 创建新会话
export function createSession(
  id: string,                              // 会话 ID（由路由层生成 UUID）
  title = "新对话",                         // 标题，默认"新对话"
  systemPrompt = "你是一个友好的AI助手。",   // 系统提示词，有默认值
): void {
  // 使用 prepare 预编译 SQL（防止 SQL 注入），然后执行插入
  getDb()
    .prepare("INSERT INTO sessions (id, title, system_prompt) VALUES (?, ?, ?)")
    .run(id, title, systemPrompt);
}

// 获取所有会话列表，按更新时间倒序排列（最新的在前）
export function getSessions(): Session[] {
  return getDb()
    .prepare("SELECT * FROM sessions ORDER BY updated_at DESC")
    .all() as Session[]; // all() 返回所有行组成的数组
}

// 根据 ID 获取单个会话
export function getSession(id: string): Session | undefined {
  return getDb()
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(id) as Session | undefined; // get() 返回单行或 undefined
}

// 更新会话标题，同时更新 updated_at 时间戳
export function updateSessionTitle(id: string, title: string): void {
  getDb()
    .prepare(
      "UPDATE sessions SET title = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
    )
    .run(title, id);
}

// 删除会话（因为启用了外键级联删除，该会话下的所有消息也会自动删除）
export function deleteSession(id: string): void {
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

// ========== 消息操作 ==========

// 获取指定会话的所有消息，按创建时间正序排列（先发的在前，保证对话顺序）
export function getMessages(sessionId: string): Message[] {
  return getDb()
    .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as Message[];
}

// 添加一条消息到指定会话
export function addMessage(
  sessionId: string,              // 所属会话 ID
  role: "user" | "assistant",     // 消息角色
  content: string,                // 消息文本
  toolCalls?: object,             // 工具调用记录（可选）
): void {
  // 插入消息，toolCalls 有值则序列化为 JSON 字符串，无值则存 null
  getDb()
    .prepare(
      "INSERT INTO messages (session_id, role, content, tool_calls) VALUES (?, ?, ?, ?)",
    )
    .run(
      sessionId,
      role,
      content,
      toolCalls ? JSON.stringify(toolCalls) : null,
    );

  // 同时更新所属会话的 updated_at 时间戳（这样会话列表能按最新活动排序）
  getDb()
    .prepare(
      "UPDATE sessions SET updated_at = datetime('now', 'localtime') WHERE id = ?",
    )
    .run(sessionId);
}
