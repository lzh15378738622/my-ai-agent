import type { ChatMessage } from "../types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`message-row ${isUser ? "user" : "assistant"}`}>
      <div className="avatar">{isUser ? "U" : "C"}</div>
      <div className={`bubble ${isUser ? "user-bubble" : "assistant-bubble"}`}>
        <div className="bubble-content">
          {message.content.split("\n").map((line, i) => (
            <p key={i}>{line || "\u00A0"}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
