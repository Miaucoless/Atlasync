/**
 * AIChat.js — Enhanced
 *
 * Enhancements:
 *  ✦ Floating mode — renders as a fixed bottom-right panel (pass floating prop)
 *  ✦ Message appear animations — each message slides up with its own delay
 *  ✦ Quick-prompt stagger — chips animate in sequentially on first render
 *  ✦ Improved typing indicator — three dots with smooth pulse phase offset
 *  ✦ Session clear — trash button wipes history with a fade-out
 *  ✦ Character count — subtle counter fades in as user types
 */

import { useState, useRef, useEffect, useCallback } from 'react';

const QUICK_PROMPTS = [
  'Suggest a 3-day itinerary for this city',
  'What restaurants should I try?',
  'Optimize my current route',
  'Best time of year to visit?',
  'Off-the-beaten-path tips',
];

export default function AIChat({
  enabled   = true,
  tripName  = '',
  cityHint  = '',
  className = '',
  onClose   = () => {},
  floating  = false,   // fixed bottom-right panel mode
}) {
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [isMinimised, setIsMinimised] = useState(false);
  const [clearing,    setClearing]    = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  /* Auto-scroll on new messages */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!enabled) return null;

  const systemContext = [
    tripName && `The user is planning a trip: "${tripName}".`,
    cityHint && `They are currently focused on: ${cityHint}.`,
    'Help them plan an amazing trip with specific, practical recommendations.',
    'Keep responses concise and formatted with bullet points when listing items.',
  ].filter(Boolean).join(' ');

  async function sendMessage(text) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput('');
    setError(null);

    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: newMessages, systemContext }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
    } catch (err) {
      setError(err.message || 'Failed to get a response. Check your API key.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearHistory() {
    setClearing(true);
    setTimeout(() => {
      setMessages([]);
      setError(null);
      setClearing(false);
    }, 300);
  }

  /* ── Panel wrapper styles ──────────────────────────────────────── */
  const panelBase = `glass-heavy rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${isMinimised ? 'h-14' : 'h-[520px]'} ${className}`;

  const floatingStyle = floating ? {
    position: 'fixed',
    bottom:   '20px',
    right:    '20px',
    width:    '340px',
    zIndex:   200,
    animation: 'slide-in-bottom 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both',
  } : {};

  return (
    <div className={panelBase} style={floatingStyle}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-atlas-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-atlas-blue flex items-center justify-center flex-shrink-0"
            style={{ animation: loading ? 'pulse-glow 1.5s ease-in-out infinite' : 'none' }}>
            <SparkleIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">AI Travel Assistant</p>
            <p className="text-[10px] text-atlas-text-muted">Powered by Claude</p>
          </div>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[10px] text-emerald-400 font-medium">
            Optional
          </span>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && !isMinimised && (
            <button
              onClick={clearHistory}
              className="p-1.5 rounded-lg text-atlas-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Clear history"
            >
              <TrashIcon />
            </button>
          )}
          <button
            onClick={() => setIsMinimised((v) => !v)}
            className="p-1.5 rounded-lg text-atlas-text-muted hover:text-white hover:bg-white/[0.06] transition-all"
            title={isMinimised ? 'Expand' : 'Minimise'}
          >
            <MinimiseIcon minimised={isMinimised} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-atlas-text-muted hover:text-white hover:bg-white/[0.06] transition-all"
            title="Close"
          >
            <XIcon />
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      {!isMinimised && (
        <>
          {/* Messages area */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth"
            style={{ opacity: clearing ? 0 : 1, transition: 'opacity 0.25s ease' }}
          >
            {/* Empty state with staggered quick prompts */}
            {messages.length === 0 && !clearing && (
              <div className="space-y-3">
                <p className="text-center text-atlas-text-muted text-xs pt-1">
                  Ask me anything about your trip!
                </p>
                <div className="space-y-2">
                  {QUICK_PROMPTS.map((p, i) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-atlas-border hover:border-atlas-blue/30 hover:bg-atlas-blue/5 text-xs text-atlas-text-secondary hover:text-white transition-all duration-200"
                      style={{ animation: `slide-up 0.35s ${80 + i * 60}ms both` }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles with staggered reveal */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animation: `slide-up 0.3s ${Math.min(i * 30, 120)}ms both` }}
              >
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-atlas-blue flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <SparkleIcon small />
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-atlas-blue text-white rounded-br-sm'
                      : 'bg-white/[0.06] border border-atlas-border text-atlas-text-primary rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start" style={{ animation: 'fade-in 0.2s both' }}>
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-atlas-blue flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <SparkleIcon small />
                </div>
                <div className="px-3.5 py-3 rounded-2xl rounded-bl-sm bg-white/[0.06] border border-atlas-border flex items-center gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 bg-violet-400 rounded-full"
                      style={{ animation: `bounce 1.2s ${delay}ms ease-in-out infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                style={{ animation: 'slide-up 0.25s both' }}>
                {error}
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* ── Input area ───────────────────────────────────── */}
          <div className="px-4 pb-4 pt-2 border-t border-atlas-border flex-shrink-0">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask about restaurants, routes, tips…"
                  rows={1}
                  className="atlas-input w-full resize-none text-xs py-2.5 pr-10 min-h-[40px] max-h-[100px]"
                  style={{ fieldSizing: 'content' }}
                />
                {input.length > 0 && (
                  <span
                    className="absolute right-2.5 bottom-2 text-[9px] text-atlas-text-muted pointer-events-none"
                    style={{ animation: 'fade-in 0.2s both' }}
                  >
                    {input.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className={`p-2.5 rounded-xl transition-all duration-200 flex-shrink-0 ${
                  input.trim() && !loading
                    ? 'bg-atlas-blue hover:bg-blue-500 text-white shadow-glow-sm'
                    : 'bg-white/[0.04] text-atlas-text-muted cursor-not-allowed'
                }`}
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-[10px] text-atlas-text-muted mt-1.5 text-center">
              AI features are optional — the app works fully offline without them.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Micro icons ─────────────────────────────────────────────────── */
function SparkleIcon({ small }) {
  return (
    <svg className={small ? 'w-2.5 h-2.5' : 'w-4 h-4'} fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 1l1.5 4.5H16l-3.75 2.75 1.5 4.5L10 10.25 6.25 12.75l1.5-4.5L4 5.5h4.5L10 1z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6m4-6v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}
function MinimiseIcon({ minimised }) {
  return minimised ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
      <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
    </svg>
  );
}
