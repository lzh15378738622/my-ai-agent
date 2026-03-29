import { useState, useCallback, useRef } from "react";
import type { ChatMessage, Session } from "../types";

export function useChat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // 加载会话列表
  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/sessions");
    const data = (await res.json()) as Session[];
    setSessions(data);
    return data;
  }, []);

  // 创建新会话
  const createNewSession = useCallback(async () => {
    const res = await fetch("/api/sessions", { method: "POST" });
    const session = (await res.json()) as Session;
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(session.id);
    setMessages([]);
    setStreamingText("");
    return session;
  }, []);

  // 切换会话
  const switchSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setStreamingText("");
    setIsLoading(true);
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    const data = (await res.json()) as ChatMessage[];
    setMessages(data);
    setIsLoading(false);
  }, []);

  // 删除会话
  const removeSession = useCallback(
    async (sessionId: string) => {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    },
    [currentSessionId],
  );

  // 发送消息（SSE 流式）
  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentSessionId || isLoading) return;

      // 添加用户消息到 UI
      const userMsg: ChatMessage = {
        id: Date.now(),
        session_id: currentSessionId,
        role: "user",
        content,
        tool_calls: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setStreamingText("");
      setIsLoading(true);

      // 如果是第一条消息，用消息内容作为会话标题
      if (messages.length === 0) {
        const title = content.slice(0, 30) + (content.length > 30 ? "..." : "");
        setSessions((prev) =>
          prev.map((s) => (s.id === currentSessionId ? { ...s, title } : s)),
        );
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/sessions/${currentSessionId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("请求失败");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "text") {
                fullText += parsed.text;
                setStreamingText(fullText);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }

        // 流式完成后，将完整助手消息添加到列表
        if (fullText) {
          const assistantMsg: ChatMessage = {
            id: Date.now() + 1,
            session_id: currentSessionId,
            role: "assistant",
            content: fullText,
            tool_calls: null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // 用户手动取消，不报错
        } else {
          const errorMsg: ChatMessage = {
            id: Date.now() + 1,
            session_id: currentSessionId,
            role: "assistant",
            content: "抱歉，发生了错误，请重试。",
            tool_calls: null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } finally {
        setStreamingText("");
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [currentSessionId, isLoading, messages.length],
  );

  // 停止生成
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    messages,
    isLoading,
    streamingText,
    fetchSessions,
    createNewSession,
    switchSession,
    removeSession,
    sendMessage,
    stopGeneration,
  };
}
