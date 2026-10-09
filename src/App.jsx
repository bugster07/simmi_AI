import { useEffect, useRef, useState } from "react";
import { Send, Mic, MicOff, Headphones, PhoneOff, Plus, Menu, X, ChevronsLeft, Copy, Check, Trash2, MessageSquare, UserRound, BriefcaseBusiness, BookOpen, Coffee } from "lucide-react";


const PERSONA = {
  name: "Simmi",
  emoji: "🌸",
  owner: "Shikha Gupta",
};

const modes = [
  {
    name: "Personal",
    description: "Life, feelings & decisions",
    icon: UserRound,
    tint: "bg-rose-50 text-rose-500",
    chipOn: "bg-rose-500 text-white ring-rose-500",
    questions: [
      "How can I become more confident?",
      "Help me plan my day",
      "I need advice about a decision",
      "Let's talk about my goals",
    ],
  },
  {
    name: "Professional",
    description: "Work, career & productivity",
    icon: BriefcaseBusiness,
    tint: "bg-sky-50 text-sky-500",
    chipOn: "bg-sky-500 text-white ring-sky-500",
    questions: [
      "Help me improve my resume",
      "How should I prepare for interviews?",
      "Help me plan my career",
      "How can I be more productive?",
    ],
  },
  {
    name: "Learning",
    description: "Explore ideas & learn skills",
    icon: BookOpen,
    tint: "bg-fuchsia-50 text-fuchsia-500",
    chipOn: "bg-fuchsia-500 text-white ring-fuchsia-500",
    questions: [
      "Explain a difficult concept simply",
      "Help me learn something new",
      "Teach me a coding concept",
      "Make me a learning plan",
    ],
  },
  {
    name: "Casual",
    description: "Relax, chat & have fun",
    icon: Coffee,
    tint: "bg-amber-50 text-amber-600",
    chipOn: "bg-amber-500 text-white ring-amber-500",
    questions: [
      "Tell me something interesting",
      "Let's have a fun conversation",
      "Tell me a funny joke",
      "Surprise me with something fun",
    ],
  },
];


const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const createChat = () => ({
  id: uid(),
  title: "New chat",
  mode: null,
  messages: [],
});

// UI-only placeholder. Replace the body with your real API call later.
async function fetchReply(messages, mode) {
  try {
    const res = await fetch("http://localhost:5000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, mode }),
    });
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    return data.reply;
  } catch {
    return "Sorry, I couldn't reach my brain right now. Try again in a moment 💗";
  }
}

function placeholderReply() {
  return "I'm here with you 💗 Tell me a little more, and let's figure it out together.";
}

// Browser speech APIs (Chrome, Edge and Safari support recognition; Firefox does not).
const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined;
const recognitionSupported = Boolean(SpeechRecognitionAPI);
const synthesisSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

function pickVoice() {
  if (!synthesisSupported) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter((voice) => voice.lang.startsWith("en"));
  return (
    english.find((voice) =>
      /female|samantha|zira|heera|veena|aria|jenny|karen|moira|tessa/i.test(
        voice.name
      )
    ) || english[0]
  );
}

function recognitionErrorMessage(code) {
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "Microphone access is blocked. Allow it in your browser's site settings.";
  }
  if (code === "audio-capture") {
    return "No microphone was found on this device.";
  }
  if (code === "network") {
    return "Voice input needs an internet connection.";
  }
  return `Voice input stopped (${code}).`;
}

/* ----------------------------------- app ---------------------------------- */

export default function App() {
  const [initialChat] = useState(createChat);
  const [chats, setChats] = useState([initialChat]);
  const [activeId, setActiveId] = useState(initialChat.id);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [typingIds, setTypingIds] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // voice chat
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [voiceError, setVoiceError] = useState("");

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceOpenRef = useRef(false);
  const mutedRef = useRef(false);
  const fatalRef = useRef(false);
  const draftRef = useRef("");
  const sendRef = useRef(null);

  draftRef.current = draft;

  const active = chats.find((chat) => chat.id === activeId) || chats[0];
  const typing = typingIds.includes(active.id);
  const activeMode = modes.find((item) => item.name === active.mode) || null;
  const isEmpty = active.messages.length === 0;
  const prompts = activeMode
    ? activeMode.questions
    : modes.map((item) => item.questions[0]);
  const lastReply = [...active.messages]
    .reverse()
    .find((message) => message.role === "assistant")?.text;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active.id, active.messages.length, typing]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  useEffect(() => {
    if (!voiceOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeVoice();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [voiceOpen]);

  useEffect(
    () => () => {
      stopRecognition();
      if (synthesisSupported) window.speechSynthesis.cancel();
    },
    []
  );

  /* ------------------------------ chat actions ----------------------------- */

  function patchChat(chatId, updater) {
    setChats((previous) =>
      previous.map((chat) => (chat.id === chatId ? updater(chat) : chat))
    );
  }

  function newChat() {
    const chat = createChat();
    setChats((previous) => [chat, ...previous]);
    setActiveId(chat.id);
    setDraft("");
    stopRecognition();
    setListening(false);
    setSidebarOpen(false);
  }

  function openChat(chatId) {
    setActiveId(chatId);
    setDraft("");
    stopRecognition();
    setListening(false);
    setSidebarOpen(false);
  }

  function deleteChat(chatId) {
    const remaining = chats.filter((chat) => chat.id !== chatId);

    if (remaining.length === 0) {
      const fresh = createChat();
      setChats([fresh]);
      setActiveId(fresh.id);
      return;
    }

    setChats(remaining);
    if (chatId === activeId) setActiveId(remaining[0].id);
  }

  function selectMode(name) {
    patchChat(active.id, (chat) => ({
      ...chat,
      mode: chat.mode === name ? null : name,
    }));
  }

  // Returns true when a message was actually sent.
  function send(text = draft, options = {}) {
    const value = text.trim();
    if (!value || typing) return false;

    if (!options.voice) {
      stopRecognition();
      setListening(false);
    }

    const chatId = active.id;
    const modeName = active.mode || "Casual";

    patchChat(chatId, (chat) => ({
      ...chat,
      mode: modeName,
      title: chat.messages.length === 0 ? value.slice(0, 36) : chat.title,
      messages: [
        ...chat.messages,
        { id: uid(), role: "user", text: value, at: Date.now() },
      ],
    }));

    setDraft("");
    setTypingIds((previous) => [...previous, chatId]);

        const chatHistory = [...active.messages, { role: "user", text: value }].map(
      (item) => ({ role: item.role, content: item.text })
    );

    fetchReply(chatHistory, modeName).then((replyText) => {
      patchChat(chatId, (chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          { id: uid(), role: "assistant", text: replyText, at: Date.now() },
        ],
      }));
      setTypingIds((previous) => previous.filter((id) => id !== chatId));

      if (options.voice) speak(replyText);
    });

    return true;
  }

  sendRef.current = send;

  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send();
    }
  }

  /* ------------------------------- voice logic ------------------------------ */

  function stopRecognition() {
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.onstart = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {
      /* already stopped */
    }
    recognitionRef.current = null;
  }

  // target: "dictate" fills the text box, "voice" drives the voice chat screen.
  function startRecognition(target) {
    if (!recognitionSupported) {
      setVoiceError(
        "Voice input isn't supported in this browser. Try Chrome, Edge or Safari."
      );
      return;
    }

    stopRecognition();
    setVoiceError("");

    const rec = new SpeechRecognitionAPI();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    const baseDraft = draftRef.current.trim();
    let finalText = "";

    rec.onstart = () => {
      if (target === "voice") setVoiceStatus("listening");
      else setListening(true);
    };

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      const spoken = `${finalText}${interim}`.trim();

      if (target === "voice") setLiveText(spoken);
      else setDraft(`${baseDraft} ${spoken}`.trim());
    };

    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      fatalRef.current = true;
      setVoiceError(recognitionErrorMessage(event.error));
      if (target === "voice") setVoiceStatus("idle");
      else setListening(false);
    };

    rec.onend = () => {
      recognitionRef.current = null;

      if (target === "dictate") {
        setListening(false);
        return;
      }

      if (!voiceOpenRef.current) return;

      const text = finalText.trim();
      setLiveText("");

      if (text) {
        setVoiceStatus("thinking");
        const sent = sendRef.current(text, { voice: true });
        if (!sent) resumeListening();
      } else {
        resumeListening();
      }
    };

    recognitionRef.current = rec;

    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
    }
  }

  function resumeListening() {
    if (!voiceOpenRef.current) return;
    setVoiceStatus("idle");
    if (mutedRef.current || fatalRef.current) return;

    setTimeout(() => {
      if (
        voiceOpenRef.current &&
        !mutedRef.current &&
        !fatalRef.current &&
        !recognitionRef.current
      ) {
        startRecognition("voice");
      }
    }, 300);
  }

  function speak(text) {
    if (!voiceOpenRef.current) return;

    if (!synthesisSupported) {
      resumeListening();
      return;
    }

    const clean = text
      .replace(/\p{Extended_Pictographic}|\uFE0F/gu, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) {
      resumeListening();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.pitch = 1.1;
    utterance.rate = 1;

    utterance.onstart = () => setVoiceStatus("speaking");
    utterance.onend = () => resumeListening();
    utterance.onerror = () => resumeListening();

    window.speechSynthesis.speak(utterance);
  }

  function toggleDictation() {
    if (listening) {
      stopRecognition();
      setListening(false);
      return;
    }
    fatalRef.current = false;
    startRecognition("dictate");
  }

  function openVoice() {
    stopRecognition();
    setListening(false);
    setDraft("");

    voiceOpenRef.current = true;
    mutedRef.current = false;
    fatalRef.current = false;

    setVoiceOpen(true);
    setVoiceMuted(false);
    setVoiceStatus("idle");
    setLiveText("");
    setVoiceError("");

    startRecognition("voice");
  }

  function closeVoice() {
    voiceOpenRef.current = false;
    stopRecognition();
    if (synthesisSupported) window.speechSynthesis.cancel();

    setVoiceOpen(false);
    setVoiceStatus("idle");
    setVoiceMuted(false);
    setLiveText("");
    setVoiceError("");
    setListening(false);
  }

  function toggleMute() {
    const next = !voiceMuted;
    setVoiceMuted(next);
    mutedRef.current = next;

    if (next) {
      stopRecognition();
      setLiveText("");
      setVoiceStatus((status) => (status === "listening" ? "idle" : status));
      return;
    }

    if (voiceStatus !== "speaking" && voiceStatus !== "thinking") {
      fatalRef.current = false;
      setVoiceError("");
      startRecognition("voice");
    }
  }

  const voiceLabel = voiceError
    ? voiceError
    : voiceMuted
    ? "Mic is off. Tap the mic to talk."
    : voiceStatus === "listening"
    ? liveText || "Listening..."
    : voiceStatus === "thinking"
    ? "Thinking..."
    : voiceStatus === "speaking"
    ? `${PERSONA.name} is speaking...`
    : "Getting ready...";

  const voiceActive =
    !voiceError &&
    !voiceMuted &&
    (voiceStatus === "listening" || voiceStatus === "speaking");

  /* --------------------------------- render --------------------------------- */

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#fffafb] text-slate-800">
      <style>{`
        @keyframes simmi-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes simmi-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes simmi-rise {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .simmi-float { animation: simmi-float 5s ease-in-out infinite; }
        .simmi-breathe { animation: simmi-breathe 1.4s ease-in-out infinite; }
        .simmi-rise { animation: simmi-rise 0.25s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .simmi-float, .simmi-breathe, .simmi-rise { animation: none; }
        }
      `}</style>

      {/* mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-pink-100 bg-white transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:hidden" : ""}`}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <div className="flex items-center gap-2.5">
            <Orb size={32} />
            <span className="text-lg font-semibold tracking-tight">
              {PERSONA.name}
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-slate-400 hover:bg-pink-50 hover:text-pink-600 md:hidden"
          >
            <X size={18} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse chat history"
            title="Collapse chat history"
            className="hidden rounded-lg p-2 text-slate-400 hover:bg-pink-50 hover:text-pink-600 md:block"
          >
            <ChevronsLeft size={18} />
          </button>
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={newChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-pink-600"
          >
            <Plus size={16} />
            New chat
          </button>
        </div>

        <p className="px-4 pb-2 pt-1 text-xs font-medium text-slate-400">
          Recent chats
        </p>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center rounded-xl transition ${
                chat.id === active.id
                  ? "bg-pink-50 text-pink-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <button
                onClick={() => openChat(chat.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
              >
                <MessageSquare size={15} className="shrink-0 opacity-60" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{chat.title}</span>
                  {chat.mode && (
                    <span className="block text-[11px] text-slate-400">
                      {chat.mode}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => deleteChat(chat.id)}
                aria-label={`Delete chat: ${chat.title}`}
                className="mr-1 rounded-lg p-2 text-slate-300 hover:bg-white hover:text-rose-500 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </nav>

        <div className="border-t border-pink-100 px-4 py-3 text-xs text-slate-400">
          Made for {PERSONA.owner} 💗
        </div>
      </aside>

      {/* main column */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-pink-100 bg-white/80 px-4 py-3 backdrop-blur">
          <button
            onClick={() => {
              setSidebarOpen(true);
              setCollapsed(false);
            }}
            aria-label="Open chat history"
            title="Open chat history"
            className={`rounded-lg p-2 text-slate-500 hover:bg-pink-50 hover:text-pink-600 ${
              collapsed ? "" : "md:hidden"
            }`}
          >
            <Menu size={20} />
          </button>

          <Orb size={36} />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold leading-tight sm:text-base">
              {PERSONA.name}
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {typing
                ? "Typing..."
                : activeMode
                ? `Online, ${activeMode.name} mode`
                : "Online"}
            </p>
          </div>

          <button
            onClick={openVoice}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-pink-600 ring-1 ring-pink-200 transition hover:bg-pink-50"
          >
            <Headphones size={14} />
            <span className="hidden sm:inline">Voice chat</span>
          </button>

          <button
            onClick={newChat}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-slate-500 ring-1 ring-pink-100 transition hover:bg-pink-50 hover:text-pink-600"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </header>

        {/* conversation area */}
        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          {isEmpty ? (
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center py-4">
              <div className="simmi-float">
                <Orb size={88} glow />
              </div>

              <h2 className="mt-5 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
                Hey, I'm <span className="text-pink-500">{PERSONA.name}.</span>
              </h2>
              <p className="mt-2 max-w-md text-center text-sm leading-6 text-slate-500 sm:text-base">
                {PERSONA.owner}'s personal companion for learning, growing, and
                everyday life. 💗
              </p>

              <p className="mb-3 mt-8 text-center text-xs font-medium text-slate-400">
                Choose how we chat
              </p>

              <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                {modes.map((item) => {
                  const Icon = item.icon;
                  const selected = active.mode === item.name;

                  return (
                    <button
                      key={item.name}
                      onClick={() => selectMode(item.name)}
                      aria-pressed={selected}
                      className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center shadow-sm ring-1 transition hover:shadow-md ${
                        selected
                          ? "bg-pink-50 ring-pink-300"
                          : "bg-white ring-slate-100"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tint}`}
                      >
                        <Icon size={19} />
                      </span>
                      <span className="text-sm font-semibold">{item.name}</span>
                      <span className="hidden text-xs leading-4 text-slate-400 sm:block">
                        {item.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mb-3 mt-8 text-center text-xs font-medium text-slate-400">
                {activeMode
                  ? `Try a ${activeMode.name} prompt`
                  : "Or start with one of these"}
              </p>

              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {prompts.map((question) => (
                  <button
                    key={question}
                    onClick={() => send(question)}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 text-left text-sm shadow-sm ring-1 ring-pink-100 transition hover:bg-pink-50"
                  >
                    <span>{question}</span>
                    <Send size={14} className="shrink-0 text-pink-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
              {active.messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`simmi-rise group flex items-end gap-2.5 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && <Orb size={32} />}

                    <div
                      className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${
                        isUser ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${
                          isUser
                            ? "rounded-br-sm bg-pink-500 text-white"
                            : "rounded-bl-sm bg-white text-slate-700 shadow-sm ring-1 ring-pink-100"
                        }`}
                      >
                        {message.text}
                      </div>

                      <div className="mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-400">
                        <span>{formatTime(message.at)}</span>
                        {!isUser && (
                          <button
                            onClick={() => copyMessage(message)}
                            aria-label="Copy message"
                            className="flex items-center gap-1 rounded-md p-1 hover:bg-pink-50 hover:text-pink-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                          >
                            {copiedId === message.id ? (
                              <>
                                <Check size={12} />
                                Copied
                              </>
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {typing && (
                <div className="simmi-rise flex items-end gap-2.5">
                  <Orb size={32} />
                  <div
                    className="flex gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-4 shadow-sm ring-1 ring-pink-100"
                    role="status"
                    aria-label={`${PERSONA.name} is typing`}
                  >
                    <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400 [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </section>

        {/* composer */}
        <footer className="shrink-0 border-t border-pink-100 bg-white/80 px-4 pb-4 pt-3 backdrop-blur sm:px-8">
          <div className="mx-auto w-full max-w-3xl">
            {!isEmpty && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {modes.map((item) => {
                  const Icon = item.icon;
                  const selected = active.mode === item.name;

                  return (
                    <button
                      key={item.name}
                      onClick={() => selectMode(item.name)}
                      aria-pressed={selected}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                        selected
                          ? item.chipOn
                          : "bg-white text-slate-500 ring-slate-200 hover:bg-pink-50"
                      }`}
                    >
                      <Icon size={13} />
                      {item.name}
                    </button>
                  );
                })}
              </div>
            )}

            {voiceError && !voiceOpen && (
              <p role="alert" className="mb-2 text-xs text-rose-500">
                {voiceError}
              </p>
            )}

            <div className="flex items-end gap-2 rounded-2xl bg-white p-2 shadow-[0_5px_25px_rgba(244,114,182,0.08)] ring-1 ring-pink-100 focus-within:ring-pink-300">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={
                  listening ? "Listening..." : `Message ${PERSONA.name}...`
                }
                aria-label="Message"
                className="max-h-[140px] min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 sm:text-base"
              />

              <button
                type="button"
                onClick={toggleDictation}
                aria-label={listening ? "Stop dictation" : "Dictate a message"}
                title={listening ? "Stop dictation" : "Dictate a message"}
                aria-pressed={listening}
                className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl px-3 transition ${
                  listening
                    ? "bg-pink-100 text-pink-600"
                    : "bg-rose-50 text-rose-500 hover:bg-rose-100"
                }`}
              >
                {listening ? (
                  <>
                    <span className="h-2 w-1.5 animate-bounce rounded-full bg-pink-500" />
                    <span className="h-4 w-1.5 animate-bounce rounded-full bg-pink-500 [animation-delay:150ms]" />
                    <span className="h-2 w-1.5 animate-bounce rounded-full bg-pink-500 [animation-delay:300ms]" />
                  </>
                ) : (
                  <Mic size={19} />
                )}
              </button>

              <button
                type="button"
                onClick={openVoice}
                aria-label="Start voice chat"
                title="Start voice chat"
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-pink-400 to-fuchsia-400 px-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                <Headphones size={18} />
                <span className="hidden sm:inline">Voice</span>
              </button>

              <button
                type="button"
                onClick={() => send()}
                disabled={!draft.trim() || typing}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500 text-white transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </footer>
      </main>

      {/* voice chat screen */}
      {voiceOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Voice chat"
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-[#fff5f8] via-[#ffeef5] to-[#ffe3ef] px-6 pb-10 pt-6"
        >
          <div className="flex w-full max-w-md items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Voice chat with {PERSONA.name}
            </span>
            <button
              onClick={closeVoice}
              aria-label="Close voice chat"
              className="rounded-full p-2 text-slate-400 hover:bg-white/70 hover:text-pink-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex w-full max-w-md flex-col items-center">
            <div className="relative h-40 w-40">
              {voiceActive && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-pink-300/30 motion-reduce:animate-none" />
                  <span className="absolute -inset-4 animate-ping rounded-full bg-pink-200/30 [animation-delay:400ms] motion-reduce:animate-none" />
                </>
              )}
              <div
                className={`relative ${
                  voiceStatus === "speaking" ? "simmi-breathe" : "simmi-float"
                }`}
              >
                <Orb size={160} glow />
              </div>
            </div>

            <p
              role="status"
              aria-live="polite"
              className={`mt-10 min-h-[3.5rem] text-center text-xl font-medium leading-7 ${
                voiceError ? "text-rose-500" : "text-slate-700"
              }`}
            >
              {voiceLabel}
            </p>

            {lastReply && !liveText && !voiceError && (
              <p className="mt-3 max-h-24 overflow-y-auto text-center text-sm leading-6 text-slate-400">
                {lastReply}
              </p>
            )}
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={toggleMute}
                aria-pressed={voiceMuted}
                aria-label={voiceMuted ? "Turn microphone on" : "Turn microphone off"}
                className={`flex h-14 w-14 items-center justify-center rounded-full shadow-sm ring-1 transition ${
                  voiceMuted
                    ? "bg-slate-800 text-white ring-slate-800"
                    : "bg-white text-pink-500 ring-pink-200 hover:bg-pink-50"
                }`}
              >
                {voiceMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
              <span className="text-xs text-slate-500">
                {voiceMuted ? "Unmute" : "Mute"}
              </span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={closeVoice}
                aria-label="End voice chat"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition hover:bg-rose-600"
              >
                <PhoneOff size={22} />
              </button>
              <span className="text-xs text-slate-500">End</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- components ------------------------------- */

function Orb({ size = 40, glow = false }) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {glow && (
        <div className="absolute inset-0 rounded-full bg-pink-300/40 blur-2xl" />
      )}
      <div className="relative h-full w-full overflow-hidden rounded-full bg-gradient-to-br from-pink-200 via-rose-300 to-fuchsia-300 shadow-[0_0_20px_rgba(244,114,182,0.25)]">
        <div className="absolute left-[18%] top-[14%] h-[30%] w-[30%] rounded-full bg-white/70 blur-[3px]" />
        <div className="absolute bottom-[15%] right-[16%] h-[36%] w-[36%] rounded-full bg-rose-100/50 blur-[4px]" />
        <span
          className="absolute inset-0 flex items-center justify-center leading-none"
          style={{ fontSize: Math.round(size * 0.5) }}
        >
          {PERSONA.emoji}
        </span>
      </div>
    </div>
  );
}
