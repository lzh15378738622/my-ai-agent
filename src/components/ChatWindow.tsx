import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import type { ChatMessage } from "../types";

interface ChatWindowProps {
  messages: ChatMessage[];
  streamingText: string;
  isLoading: boolean;
  hasSession: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
}

export default function ChatWindow({
  messages,
  streamingText,
  isLoading,
  hasSession,
  onSend,
  onStop,
}: ChatWindowProps) {
  return (
    <div className="chat-window">
      <MessageList
        messages={messages}
        streamingText={streamingText}
        isLoading={isLoading}
      />
      <MessageInput
        onSend={onSend}
        onStop={onStop}
        isLoading={isLoading}
        disabled={!hasSession}
      />
    </div>
  );
}
