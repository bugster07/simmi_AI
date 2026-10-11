
import { useEffect, useRef, useState } from "react";
import {
  Send,
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Plus,
  Menu,
  X,
  Copy,
  Check,
  Trash2,
  MessageSquare,
  UserRound,
  BriefcaseBusiness,
  BookOpen,
  Coffee,
} from "lucide-react";

const API_URL = "http://localhost:5000";

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

const uid = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

async function fetchReply(messages, mode) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, mode }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not generate a response");
  }

  return data.reply;
}

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined;

const recognitionSupported = Boolean(SpeechRecognitionAPI);

export default function App() {
  const [initialState] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("simmi-chats-v1")
      );

      if (
        saved &&
        Array.isArray(saved.chats) &&
        saved.chats.length > 0
      ) {
        return {
          chats: saved.chats,
          activeId: saved.chats.some(
            (chat) => chat.id === saved.activeId
          )
            ? saved.activeId
            : saved.chats[0].id,
        };
      }
    } catch (error) {
      console.error("Could not load chat history:", error);
    }

    const chat = createChat();
    return { chats: [chat], activeId: chat.id };
  });

  const [chats, setChats] = useState(initialState.chats);
  const [activeId, setActiveId] = useState(initialState.activeId);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [typingIds, setTypingIds] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("idle");
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

  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const speakingRequestRef = useRef(0);

  draftRef.current = draft;

  useEffect(() => {
    try {
      localStorage.setItem(
        "simmi-chats-v1",
        JSON.stringify({ chats, activeId })
      );
    } catch (error) {
      console.error("Could not save chat history:", error);
    }
  }, [chats, activeId]);

  const active =
    chats.find((chat) => chat.id === activeId) || chats[0];

  const typing = typingIds.includes(active.id);

  const activeMode =
    modes.find((item) => item.name === active.mode) || null;

  const isEmpty = active.messages.length === 0;

  const prompts = activeMode
    ? activeMode.questions
    : modes.map((item) => item.questions[0]);

  const lastReply = [...active.messages]
    .reverse()
    .find((message) => message.role === "assistant")?.text;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [active.id, active.messages.length, typing]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  }, [draft]);

  useEffect(() => {
    if (!voiceOpen) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") closeVoice();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [voiceOpen]);

  useEffect(() => {
    return () => {
      stopRecognition();
      stopSpeaking();
    };
  }, []);

  function patchChat(chatId, updater) {
    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId ? updater(chat) : chat
      )
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
    const remaining = chats.filter(
      (chat) => chat.id !== chatId
    );

    if (remaining.length === 0) {
      const fresh = createChat();
      setChats([fresh]);
      setActiveId(fresh.id);
      return;
    }

    setChats(remaining);

    if (chatId === activeId) {
      setActiveId(remaining[0].id);
    }
  }

  function selectMode(name) {
    patchChat(active.id, (chat) => ({
      ...chat,
      mode: chat.mode === name ? null : name,
    }));
  }

  async function send(text = draft, options = {}) {
    const value = text.trim();
    const chatId = active.id;

    if (!value || typingIds.includes(chatId)) return false;

    if (!options.voice) {
      stopRecognition();
      setListening(false);
    }

    const modeName = active.mode || "Casual";

    const userMessage = {
      id: uid(),
      role: "user",
      text: value,
      at: Date.now(),
    };

    const history = [
      ...active.messages,
      userMessage,
    ].slice(-20);

    patchChat(chatId, (chat) => ({
      ...chat,
      mode: modeName,
      title:
        chat.messages.length === 0
          ? value.slice(0, 36)
          : chat.title,
      messages: [...chat.messages, userMessage],
    }));

    setDraft("");
    setTypingIds((previous) =>
      previous.includes(chatId)
        ? previous
        : [...previous, chatId]
    );

    try {
      const chatHistory = history.map((message) => ({
        role: message.role,
        content: message.text,
      }));

      const replyText = await fetchReply(chatHistory, modeName);

      patchChat(chatId, (chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          {
            id: uid(),
            role: "assistant",
            text: replyText,
            at: Date.now(),
          },
        ],
      }));

      if (options.voice && voiceOpenRef.current) {
        await speak(replyText);
      }
    } catch (error) {
      console.error("Chat request failed:", error);

      const errorText =
        "Sorry, I couldn't reach my brain right now. Try again in a moment 💗";

      patchChat(chatId, (chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          {
            id: uid(),
            role: "assistant",
            text: errorText,
            at: Date.now(),
          },
        ],
      }));

      if (options.voice && voiceOpenRef.current) {
        await speak(errorText);
      }
    } finally {
      setTypingIds((previous) =>
        previous.filter((id) => id !== chatId)
      );
    }

    return true;
  }

  sendRef.current = send;

  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (error) {
      console.error("Clipboard unavailable:", error);
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

  function stopRecognition() {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;

    try {
      recognition.abort();
    } catch {
      // Recognition may already have stopped.
    }

    recognitionRef.current = null;
  }

  function startRecognition(target) {
    if (!recognitionSupported) {
      setVoiceError(
        "Voice input isn't supported in this browser. Try Chrome or Edge."
      );
      return;
    }

    if (mutedRef.current && target === "voice") return;

    stopRecognition();
    setVoiceError("");

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    const baseDraft = draftRef.current.trim();
    let finalText = "";

    recognition.onstart = () => {
      if (target === "voice") {
        setVoiceStatus("listening");
      } else {
        setListening(true);
      }
    };

    recognition.onresult = (event) => {
      let interim = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];

        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      const spoken = `${finalText}${interim}`.trim();

      if (target === "voice") {
        setLiveText(spoken);
      } else {
        setDraft(`${baseDraft} ${spoken}`.trim());
      }
    };

    recognition.onerror = (event) => {
      if (
        event.error === "no-speech" ||
        event.error === "aborted"
      ) {
        return;
      }

      fatalRef.current = true;

      if (event.error === "not-allowed") {
        setVoiceError(
          "Microphone access is blocked. Allow it in your browser settings."
        );
      } else if (event.error === "audio-capture") {
        setVoiceError("No microphone was found on this device.");
      } else {
        setVoiceError(`Voice input stopped (${event.error}).`);
      }

      if (target === "voice") {
        setVoiceStatus("idle");
      } else {
        setListening(false);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;

      if (target === "dictate") {
        setListening(false);
        return;
      }

      if (!voiceOpenRef.current) return;

      const spokenText = finalText.trim();
      setLiveText("");

      if (spokenText) {
        setVoiceStatus("thinking");

        const sent = sendRef.current(spokenText, {
          voice: true,
        });

        if (!sent) resumeListening();
      } else {
        resumeListening();
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      console.error("Could not start recognition:", error);
    }
  }

  function resumeListening() {
    if (!voiceOpenRef.current) return;

    setVoiceStatus("idle");

    if (mutedRef.current || fatalRef.current) return;

    window.setTimeout(() => {
      if (
        voiceOpenRef.current &&
        !mutedRef.current &&
        !fatalRef.current &&
        !recognitionRef.current
      ) {
        startRecognition("voice");
      }
    }, 400);
  }

  function stopSpeaking() {
    speakingRequestRef.current += 1;

    const audio = audioRef.current;

    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  async function speak(text) {
    if (!voiceOpenRef.current) return;

    const clean = text
      .replace(/\p{Extended_Pictographic}|\uFE0F/gu, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) {
      resumeListening();
      return;
    }

    stopRecognition();
    stopSpeaking();

    const requestId = speakingRequestRef.current;

    try {
      setVoiceStatus("thinking");

      const response = await fetch(`${API_URL}/api/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: clean }),
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(
          `Fish Audio TTS failed (${response.status}): ${details}`
        );
      }

      const blob = await response.blob();

      if (
        !voiceOpenRef.current ||
        requestId !== speakingRequestRef.current
      ) {
        return;
      }

      const audioUrl = URL.createObjectURL(blob);
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setVoiceStatus("speaking");
      };

      audio.onended = () => {
        if (audioRef.current === audio) {
          stopSpeaking();
          resumeListening();
        }
      };

      audio.onerror = () => {
        if (audioRef.current === audio) {
          stopSpeaking();
          setVoiceError("Couldn't play Simmi's voice. Please try again.");
          resumeListening();
        }
      };

      await audio.play();
    } catch (error) {
      console.error("Fish Audio playback error:", error);

      if (requestId === speakingRequestRef.current) {
        stopSpeaking();

        if (voiceOpenRef.current) {
          setVoiceError(
            "Couldn't generate Simmi's voice. Check the Fish Audio API settings."
          );
          resumeListening();
        }
      }
    }
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
    stopSpeaking();

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
    stopSpeaking();

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

      setVoiceStatus((status) =>
        status === "listening" ? "idle" : status
      );

      return;
    }

    if (
      voiceStatus !== "speaking" &&
      voiceStatus !== "thinking"
    ) {
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
    (voiceStatus === "listening" ||
      voiceStatus === "speaking");

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
          .simmi-float, .simmi-breathe, .simmi-rise {
            animation: none;
          }
        }
      `}</style>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

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
            <X size={18} />
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
                  <span className="block truncate text-sm">
                    {chat.title}
                  </span>
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
                className="mr-1 rounded-lg p-2 text-slate-300 hover:bg-white hover:text-rose-500 md:opacity-0 md:group-hover:opacity-100"
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

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-pink-100 bg-white/80 px-4 py-3 backdrop-blur">
          <button
            onClick={() => {
              setSidebarOpen(true);
              setCollapsed(false);
            }}
            aria-label="Open chat history"
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
                {PERSONA.owner}'s personal companion for learning, growing,
                and everyday life. 💗
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
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tint}`}>
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
                            className="flex items-center gap-1 rounded-md p-1 hover:bg-pink-50 hover:text-pink-600 sm:opacity-0 sm:group-hover:opacity-100"
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
                className={`flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-3 transition ${
                  listening
                    ? "bg-pink-100 text-pink-600"
                    : "bg-rose-50 text-rose-500 hover:bg-rose-100"
                }`}
              >
                <Mic size={19} />
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
                  voiceStatus === "speaking"
                    ? "simmi-breathe"
                    : "simmi-float"
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
                aria-label={
                  voiceMuted ? "Turn microphone on" : "Turn microphone off"
                }
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
