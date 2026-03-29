import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import MessageBubble from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  streamingText: string;
  isLoading: boolean;
}

export default function MessageList({
  messages,
  streamingText,
  isLoading,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="empty-state">
        <h2>Claude Chat</h2>
        <p>开始一段新对话吧</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {streamingText && (
        <div className="message-row assistant">
          <div className="avatar">C</div>
          <div className="bubble assistant-bubble">
            <div className="bubble-content">
              {streamingText.split("\n").map((line, i) => (
                <p key={i}>{line || "\u00A0"}</p>
              ))}
              <span className="cursor">|</span>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
