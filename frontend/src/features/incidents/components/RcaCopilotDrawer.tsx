import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  X,
  Terminal,
  ShieldAlert,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Incident } from '../../../types';
import { incidentService } from '../../../services/incident-service';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  model?: string;
}

interface RcaCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident;
  projectId: string;
}

export const RcaCopilotDrawer: React.FC<RcaCopilotDrawerProps> = ({
  isOpen,
  onClose,
  incident,
  projectId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize welcome message when drawer opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const topCand = incident.rootCauseCandidates[0];
      const initialGreeting: ChatMessage = {
        id: 'msg-welcome',
        role: 'model',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: `👋 **Welcome to the RCA War Room Copilot.**\n\nI have indexed the chronological error traces, service telemetry, and **15-point multi-factor root cause analysis** for this incident.\n\n- **Identified Root Cause:** \`${topCand?.displayTitle || incident.title}\`\n- **Top Candidate Pattern:** \`${topCand?.template || 'Evaluating'}\`\n\nYou can counter-question why this cause was chosen over others, drill into specific log timestamps or trace IDs, or ask for exact remediation commands.`,
      };
      setMessages([initialGreeting]);
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, incident]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const quickQuestions = [
    'Why is Candidate #1 the root cause instead of Candidate #2?',
    'Show the earliest error log timestamp and trace ID.',
    'Give me exact SQL or CLI commands to remediate this now.',
    'Could this error have originated from downstream timeouts?',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Build history for backend
      const history = newMessages
        .filter((m) => m.id !== 'msg-welcome')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await incidentService.chatWithCopilot(
        projectId,
        incident.id,
        query,
        history
      );

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        role: 'model',
        content: `⚠️ **Unable to complete response:** ${err?.message || 'Connection error with Copilot service. Please try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
      <div
        className={`relative h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-full md:w-[850px]' : 'w-full md:w-[540px]'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:px-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/80 dark:bg-neutral-850/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  RCA War Room Copilot
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Live Context
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 truncate max-w-xs sm:max-w-sm">
                Incident: {incident.displayTitle || incident.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              title={isExpanded ? 'Collapse width' : 'Expand width'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClearChat}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              title="Close Copilot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Incident Quick Snapshot Badge */}
        <div className="px-4 sm:px-6 py-2 bg-neutral-100/70 dark:bg-neutral-800/50 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-xs font-mono text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-2 truncate">
            <Terminal className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="truncate">
              Candidate #1:{' '}
              <strong className="text-neutral-900 dark:text-neutral-100">
                {incident.rootCauseCandidates[0]?.template.slice(0, 45) || 'Under analysis'}...
              </strong>
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
            Rank #1
          </span>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                      : 'bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  {/* Markdown formatted content */}
                  <div className="space-y-2 whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>

                  {/* Message footer */}
                  <div className="mt-2 pt-1.5 flex items-center justify-between gap-3 text-[10px] text-neutral-400 font-mono border-t border-neutral-200/40 dark:border-neutral-700/40">
                    <span>{msg.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="hover:text-neutral-700 dark:hover:text-neutral-200 inline-flex items-center gap-1 transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 flex items-center gap-2">
                <span>RCA Copilot is cross-referencing log traces and causality...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        {messages.length <= 2 && (
          <div className="px-4 sm:px-6 py-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
              Suggested Counter-Questions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 sm:p-6 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Challenge RCA, ask why X caused Y, or request remediation..."
              disabled={loading}
              className="flex-1 h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || loading}
              className="h-10 px-4 rounded-xl"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
          <p className="mt-1.5 text-[10px] text-neutral-400 text-center font-mono">
            Powered by Gemini with real-time log evidence and 15-point scoring context.
          </p>
        </div>
      </div>
    </div>
  );
};
