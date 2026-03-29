import OpenAI from "openai";

// 示例工具：天气查询
export const weatherTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_weather",
    description: "获取指定城市的当前天气信息",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "城市名称，如：北京、上海、广州",
        },
      },
      required: ["city"],
    },
  },
};

export async function executeWeatherTool(
  input: Record<string, unknown>,
): Promise<string> {
  const city = input.city as string;

  // 模拟天气数据（实际项目中可对接真实天气 API）
  const weatherData: Record<string, { temp: number; condition: string; humidity: number }> = {
    "北京": { temp: 15, condition: "晴", humidity: 35 },
    "上海": { temp: 18, condition: "多云", humidity: 65 },
    "广州": { temp: 25, condition: "小雨", humidity: 80 },
    "深圳": { temp: 24, condition: "阴", humidity: 75 },
    "杭州": { temp: 16, condition: "晴转多云", humidity: 55 },
  };

  const data = weatherData[city];
  if (data) {
    return JSON.stringify({ city, ...data, unit: "celsius" });
  }

  return JSON.stringify({
    city,
    temp: Math.floor(Math.random() * 30) + 5,
    condition: ["晴", "多云", "阴", "小雨"][Math.floor(Math.random() * 4)],
    humidity: Math.floor(Math.random() * 60) + 30,
    unit: "celsius",
  });
}

// 工具注册表：名称 -> 执行函数
export const toolHandlers: Record<
  string,
  (input: Record<string, unknown>) => Promise<string>
> = {
  get_weather: executeWeatherTool,
};

// 所有可用工具定义
export const allTools: OpenAI.Chat.ChatCompletionTool[] = [weatherTool];
