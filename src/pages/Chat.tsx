import { useState, useRef, useEffect } from "react";
import { Send, Compass, Loader2, MessageCircle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { streamChat } from "@/api";
import type { ChatMessage } from "@/types";

export default function Chat() {
  const {
    chatMessages,
    addChatMessage,
    updateLastAssistantMessage,
    chatContext,
    userInput,
  } = useAppStore();

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 页面挂载时强制重置滚动位置，确保从顶部开始
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  // 如果没有上下文，使用 userInput 或默认值
  const context = chatContext || {
    city: userInput?.city || "未知城市",
    identity: userInput?.identity || "新市民",
    income: userInput?.income || 0,
    work_location: userInput?.work_location || "未知",
  };

  const handleSend = async () => {
    const message = input.trim();
    if (!message || isStreaming) return;

    setInput("");
    addChatMessage({ role: "user", content: message });

    // 添加空的 assistant 消息，准备接收流式内容
    addChatMessage({ role: "assistant", content: "" });
    setIsStreaming(true);

    try {
      let accumulated = "";
      const history: ChatMessage[] = chatMessages.slice(-10);

      for await (const chunk of streamChat({
        message,
        context,
        history,
      })) {
        accumulated += chunk;
        updateLastAssistantMessage(accumulated);
      }
    } catch (err) {
      updateLastAssistantMessage(
        err instanceof Error
          ? `抱歉，出了点问题：${err.message}`
          : "抱歉，对话服务暂时不可用，请稍后重试。"
      );
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 快捷问题
  const quickQuestions = [
    "这个区域适合女生独居吗？",
    "租房合同需要注意什么？",
    "办理居住证需要哪些材料？",
    "首月预算怎么分配最合理？",
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 标题区 */}
      <div className="bg-parchment-dark/30 border-b border-parchment-400/30 py-6">
        <div className="container mx-auto px-6 max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-terracotta flex items-center justify-center shadow-warm">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-espresso">
                AI 城市顾问
              </h1>
              <p className="text-xs text-espresso-300">
                上下文：{context.city} · {context.identity} ·{" "}
                {context.work_location}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 container mx-auto px-6 max-w-3xl py-6 overflow-y-auto">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 rounded-full bg-terracotta/10 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-terracotta" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-espresso mb-2">
              有什么问题都可以问我哦~
            </h2>
            <p className="text-espresso-300 text-sm mb-8 max-w-md">
              我已经了解了你的基本情况，可以针对租房、通勤、预算、办证等问题给出个性化建议
            </p>
            {/* 快捷问题 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="card-parchment p-3 text-left text-sm text-espresso hover:border-terracotta/40 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {chatMessages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                message={msg}
                isStreaming={
                  isStreaming &&
                  idx === chatMessages.length - 1 &&
                  msg.role === "assistant"
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="border-t border-parchment-400/30 bg-parchment-light/80 backdrop-blur-md">
        <div className="container mx-auto px-6 max-w-3xl py-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的问题..."
                disabled={isStreaming}
                rows={1}
                className="input-field resize-none min-h-[48px] max-h-32 pr-4"
                style={{ paddingTop: "14px" }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="btn-primary !px-5 !py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-espresso-300 mt-2 text-center">
            按 Enter 发送 · Shift + Enter 换行
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== 消息气泡组件 =====
function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="max-w-[80%] bg-terracotta text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-warm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in-up">
      <div className="w-8 h-8 rounded-full bg-sage flex items-center justify-center flex-shrink-0 mt-1">
        <Compass className="w-4 h-4 text-white" />
      </div>
      <div className="max-w-[80%] bg-parchment-light border border-parchment-400/40 rounded-2xl rounded-tl-md px-4 py-3 shadow-card">
        {message.content ? (
          <p
            className={`text-sm leading-relaxed text-espresso whitespace-pre-wrap ${
              isStreaming ? "typing-cursor" : ""
            }`}
          >
            {message.content}
          </p>
        ) : (
          <div className="flex items-center gap-1.5 py-1">
            <span className="w-2 h-2 bg-terracotta rounded-full animate-typing" />
            <span
              className="w-2 h-2 bg-terracotta rounded-full animate-typing"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="w-2 h-2 bg-terracotta rounded-full animate-typing"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
