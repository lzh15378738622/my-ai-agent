import { useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { useChat } from "./hooks/useChat";
import "./App.css";

export default function App() {
  const {
    sessions,
    currentSessionId,
    messages,
    isLoading,
    streamingText,
    fetchSessions,
    createNewSession,
    switchSession,
    removeSession,
    sendMessage,
    stopGeneration,
  } = useChat();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={createNewSession}
        onSelectSession={switchSession}
        onDeleteSession={removeSession}
      />
      <ChatWindow
        messages={messages}
        streamingText={streamingText}
        isLoading={isLoading}
        hasSession={!!currentSessionId}
        onSend={sendMessage}
        onStop={stopGeneration}
      />
    </div>
  );
}
