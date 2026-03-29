// 导入 OpenAI SDK（智谱 API 兼容 OpenAI 格式，所以用这个 SDK 连接智谱）
import OpenAI from "openai";
// 导入工具定义和工具处理函数
import { allTools, toolHandlers } from "./tools/weather.js";
// 导入数据库的 addMessage 方法，用于保存对话记录
import { addMessage } from "./database.js";

// 创建 OpenAI 客户端实例，指向智谱 API
const client = new OpenAI({
  // 从环境变量读取智谱 API Key（在 .env 中配置）
  apiKey: process.env.ZHIPU_API_KEY,
  // 智谱 API 的基础地址（兼容 OpenAI 接口格式）
  baseURL: "https://open.bigmodel.cn/api/paas/v4",
});

// ========== 类型定义 ==========

// 流式回调接口，定义了 5 个回调方法，路由层通过这些方法接收实时数据
export interface StreamCallbacks {
  onText: (text: string) => void;            // 模型生成文字片段时回调
  onToolUse: (toolName: string, toolInput: Record<string, unknown>) => void;   // 模型调用工具时回调
  onToolResult: (toolName: string, result: string) => void;   // 工具执行完毕时回调
  onDone: () => void;                        // 整个对话流程结束时回调
  onError: (error: string) => void;          // 发生错误时回调
}

/**
 * 流式对话主函数
 * @param sessionId   - 当前会话 ID，用于保存消息到数据库
 * @param userMessage - 用户本次发送的消息
 * @param history     - 该会话之前的所有历史消息（从数据库加载）
 * @param callbacks   - 回调函数集合，用于将实时数据传回路由层
 */
export async function streamChat(
  sessionId: string,
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  callbacks: StreamCallbacks,
): Promise<void> {
  try {
    // ====== 第一步：构建消息历史 ======
    // 将数据库格式的历史消息转换为 OpenAI SDK 需要的消息格式
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = history.map(
      (m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }),
    );
    // 将用户本次发送的消息追加到末尾
    messages.push({ role: "user", content: userMessage });

    // 立刻保存用户消息到数据库（不等 AI 回复，先存）
    addMessage(sessionId, "user", userMessage);

    // 用于累积 AI 完整回复内容，最后保存到数据库
    let assistantContent = "";

    // ====== 第二步：工具调用循环 ======
    // 循环原因：模型可能调用工具后还需要继续回复，所以需要反复调用
    while (true) {
      // 调用智谱 API，启用流式输出
      const stream = await client.chat.completions.create({
        model: "glm-4.7",       // 使用的模型
        max_tokens: 64000,      // 单次回复最大 token 数
        messages,                // 完整消息历史（包含之前的对话 + 本次用户消息）
        tools: allTools,         // 可用工具列表（如天气查询）
        stream: true,            // 开启流式返回
      });

      // ====== 第三步：收集流式数据 ======
      // 当前轮次模型生成的文本
      let currentText = "";
      // 收集本轮的工具调用信息
      let toolCalls: {
        id: string;        // 工具调用 ID（由模型生成，用于匹配请求和响应）
        name: string;      // 工具名称，如 "get_weather"
        arguments: string; // 工具参数（JSON 字符串）
      }[] = [];

      // 以下变量用于逐块拼接当前正在接收的工具调用
      let currentToolCallId = "";    // 当前工具调用的 ID
      let currentToolCallName = "";  // 当前工具调用的名称
      let currentToolCallArgs = "";  // 当前工具调用的参数（JSON 字符串，可能分多次传完）

      // 遍历流式返回的每个数据块
      for await (const chunk of stream) {
        // 取第一个 choice 的 delta（增量数据）
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue; // 没有增量数据则跳过

        // --- 处理文本内容 ---
        // delta.content 存在说明模型在生成文字
        if (delta.content) {
          currentText += delta.content; // 拼接到当前轮次的完整文本
          callbacks.onText(delta.content); // 立刻通过回调推给前端
        }

        // --- 处理工具调用 ---
        // delta.tool_calls 存在说明模型决定调用工具
        if (delta.tool_calls) {
          // 一个 chunk 可能包含多个工具调用
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined) {
              // tc.id 存在且和当前不同，说明开始了一个新的工具调用
              if (tc.id && tc.id !== currentToolCallId) {
                // 先把上一个完整的工具调用保存到数组中
                if (currentToolCallId) {
                  toolCalls.push({
                    id: currentToolCallId,
                    name: currentToolCallName,
                    arguments: currentToolCallArgs,
                  });
                }
                // 重置变量，开始记录新工具调用
                currentToolCallId = tc.id;
                currentToolCallName = "";
                currentToolCallArgs = "";
              }
              // 拼接工具名称（通常第一次就会传完整）
              if (tc.function?.name) {
                currentToolCallName = tc.function.name;
              }
              // 拼接工具参数（JSON 可能分多个 chunk 传完，所以用 += 拼接）
              if (tc.function?.arguments) {
                currentToolCallArgs += tc.function.arguments;
              }
            }
          }
        }
      }

      // 流结束后，把最后一个工具调用也保存到数组中（循环内不会保存最后一个）
      if (currentToolCallId) {
        toolCalls.push({
          id: currentToolCallId,
          name: currentToolCallName,
          arguments: currentToolCallArgs,
        });
      }

      // 将当前轮次的文本累积到总回复中
      assistantContent += currentText;

      // ====== 第四步：判断是否需要执行工具 ======
      // 没有工具调用，说明模型给出了最终文字回复，退出循环
      if (toolCalls.length === 0) {
        break;
      }

      // ====== 第五步：处理工具调用 ======
      // 将本轮模型的回复（包含工具调用指令）追加到消息历史
      // content 为 null 是因为本轮模型没有生成文本，只是要求调用工具
      messages.push({
        role: "assistant",
        content: currentText || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",  // 固定为 function 类型
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // 逐个执行工具，并将结果追加到消息历史
      for (const tc of toolCalls) {
        // 通知前端：正在执行某个工具
        callbacks.onToolUse(tc.name, JSON.parse(tc.arguments));

        // 从工具注册表中找到对应的处理函数
        const handler = toolHandlers[tc.name];
        let result: string;
        if (handler) {
          // 有对应处理函数，执行并获取结果
          result = await handler(JSON.parse(tc.arguments));
        } else {
          // 没有找到处理函数，返回错误信息
          result = JSON.stringify({ error: `未知工具: ${tc.name}` });
        }

        // 通知前端：工具执行完毕，展示结果
        callbacks.onToolResult(tc.name, result);

        // 将工具执行结果以 "tool" 角色追加到消息历史
        // 模型下一轮调用时能看到这个结果，从而生成最终回复
        messages.push({
          role: "tool",
          tool_call_id: tc.id,  // 通过 ID 关联到对应的工具调用请求
          content: result,
        });
      }

      // 循环回到 while(true)，带着工具结果再调一次 API
      // 模型看到工具结果后会生成最终文字回复
    }

    // ====== 第六步：保存 AI 回复到数据库 ======
    if (assistantContent) {
      addMessage(sessionId, "assistant", assistantContent);
    }

    // 通知路由层：整个对话流程正常结束
    callbacks.onDone();
  } catch (error) {
    // 捕获所有异常，通知路由层发生错误
    const msg = error instanceof Error ? error.message : "未知错误";
    callbacks.onError(msg);
  }
}
