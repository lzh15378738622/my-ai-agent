import { useState, useRef, useEffect, type KeyboardEvent } from "react";

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export default function MessageInput({
  onSend,
  onStop,
  isLoading,
  disabled,
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || disabled) return;
    setInput("");
    onSend(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setInput("");
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const supportsSpeech = !!(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );

  return (
    <div className="message-input-wrapper">
      {supportsSpeech && !disabled && (
        <button
          className={`voice-btn ${isRecording ? "recording" : ""}`}
          onClick={toggleRecording}
          disabled={isLoading}
          title={isRecording ? "停止录音" : "语音输入"}
        >
          {isRecording ? "⏹" : "🎤"}
        </button>
      )}
      <textarea
        className="message-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "请先创建或选择一个会话" : "输入消息... (Enter 发送, Shift+Enter 换行)"}
        disabled={disabled}
        rows={1}
      />
      {isLoading ? (
        <button className="stop-btn" onClick={onStop}>
          停止
        </button>
      ) : (
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
        >
          发送
        </button>
      )}
    </div>
  );
}
