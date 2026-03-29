export interface Session {
  id: string;
  title: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: string | null;
  created_at: string;
}

export interface SSEData {
  type: "text" | "tool_use" | "tool_result" | "error";
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  result?: string;
  error?: string;
}
