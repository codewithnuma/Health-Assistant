import React, { useEffect, useRef, useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import axios from "axios";
import {
  MessageOutlined,
  SendOutlined,
  RobotOutlined,
  PlusOutlined,
  MenuOutlined,
  CloseOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  SoundOutlined,
} from "@ant-design/icons";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import axiosInstance from "../axiosInstance";
import { useAuth } from "../context/AuthContext";

import "./Chatbot.css";


/* ============================================================
   CHATBOT API
   ============================================================ */

const CHATBOT_API_BASE = "https://ac56-160-250-254-31.ngrok-free.app/api/chat";

const chatbotAxios = axios.create({
  baseURL: CHATBOT_API_BASE,
});


/* ============================================================
   VOICE CONFIG
   ============================================================ */

const WAKE_PHRASES = ["avengers assemble"];

const STOP_WORDS_LOCAL = [
  "stop",
  "thank you",
  "thanks",
  "that's all",
  "thats all",
  "cancel",
  "goodbye",
  "bye",
];

// How long a fetched JWT is trusted before we quietly refresh it
// in the background. Keep this comfortably under the backend's
// actual token TTL — adjust if you know the real expiry.
const JWT_CACHE_TTL_MS = 4 * 60 * 1000;

// How long after the user stops talking (no new recognition
// results) before we treat their turn as finished and send it.
// This is transcript-based (not volume-based like the old audio
// pipeline), so it's reliable enough to keep short for snappy
// turn-taking.
const TURN_SILENCE_MS = 700;

// Minimum characters of speech heard before we treat it as a real
// barge-in attempt rather than a stray noise or recognition blip.
const INTERRUPT_MIN_CHARS = 3;

// Small breathing gap between spoken sentences — reads much more
// like a person pausing than one flat run-on utterance.
const INTER_SENTENCE_GAP_MS = 60;

const SpeechRecognitionCtor =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const speechSynthesisSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

// Strip the markdown the bot's text answers usually contain,
// so it doesn't get read aloud as literal asterisks/hashes.
const stripMarkdownForSpeech = (text) =>
  String(text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_#>~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Picks the most natural-sounding voice actually installed in this
// browser/OS. True human-quality TTS needs a cloud neural voice
// (ElevenLabs, Azure, Google Cloud TTS) — this just does the best
// with whatever system voices are available.
const VOICE_PREFERENCE_PATTERNS = [
  /Natural/i,
  /Neural/i,
  /Premium/i,
  /Enhanced/i,
  /Google US English/i,
  /Google UK English Female/i,
  /Samantha/i,
  /Aria/i,
  /Jenny/i,
  /Daniel/i,
  /Karen/i,
];

const pickBestVoice = (voices) => {

  if (!voices || voices.length === 0) return null;

  for (const pattern of VOICE_PREFERENCE_PATTERNS) {
    const match = voices.find((v) => pattern.test(v.name));
    if (match) return match;
  }

  return (
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => (v.lang || "").startsWith("en")) ||
    voices[0]
  );
};


/* ============================================================
   CREATE UUID
   ============================================================ */

const createThreadId = () => {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2)
  );
};


/* ============================================================
   CHATBOT
   ============================================================ */

const Chatbot = () => {

  const { user, isAuthenticated, loading } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);

  /* ---------------- VOICE STATE ---------------- */

  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);

  // Persistent "voice conversation" mode. While true, the mic is
  // continuously listening — through the bot thinking AND speaking
  // — so the user can interrupt at any point, and it self-restarts
  // if the browser ever silently drops it. Ends on a stop phrase or
  // clicking the mic.
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const voiceModeActiveRef = useRef(false);

  const micSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia;

  // Both the wake-word listener and voice-mode dictation run on the
  // Web Speech API, so both features share this one capability flag.
  const speechRecognitionSupported = !!SpeechRecognitionCtor;

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const wakeRecognitionRef = useRef(null);
  const wakeWordEnabledRef = useRef(wakeWordEnabled);

  const voicesRef = useRef([]);

  // ---- JWT cache: avoids re-hitting the token endpoint on every
  // single voice/text turn.
  const jwtCacheRef = useRef({ token: null, expiresAt: 0 });
  const jwtFetchPromiseRef = useRef(null);

  // ---- Mirrors of state that long-lived listeners (the
  // continuous dictation recognizer, in particular) need to read
  // fresh values from without being recreated every render.
  const activeThreadIdRef = useRef(null);
  const isAuthenticatedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isProcessingVoiceRef = useRef(false);

  // ---- Continuous voice-mode dictation.
  const dictationRecognitionRef = useRef(null);
  const turnTranscriptRef = useRef("");
  const interruptedThisTurnRef = useRef(false);
  const turnSilenceTimerRef = useRef(null);

  // ---- Spoken-reply queue + the in-flight streamed request.
  const ttsQueueRef = useRef([]);
  const voiceStreamAbortRef = useRef(null);

  // ---- "Latest function" indirection so the dictation recognizer
  // (created once, long-lived) always calls the current closure
  // instead of a stale one from whichever render created it.
  const sendVoiceTextRef = useRef(() => { });
  const finalizeTurnRef = useRef(() => { });
  const cancelBotOutputRef = useRef(() => { });
  const enqueueSpeechRef = useRef(() => { });
  const processTtsQueueRef = useRef(() => { });

  useEffect(() => { wakeWordEnabledRef.current = wakeWordEnabled; }, [wakeWordEnabled]);
  useEffect(() => { voiceModeActiveRef.current = voiceModeActive; }, [voiceModeActive]);
  useEffect(() => { activeThreadIdRef.current = activeThreadId; }, [activeThreadId]);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isProcessingVoiceRef.current = isProcessingVoice; }, [isProcessingVoice]);

  const setVoiceMode = (active) => {
    voiceModeActiveRef.current = active;
    setVoiceModeActive(active);
  };


  /* ==========================================================
     JWT + THREADS
     ========================================================== */

  const fetchJWTFromBackend = async () => {

    try {
      const response = await axiosInstance.get("/accounts/rasa-token/");
      return response.data?.jwt_token || null;
    } catch (error) {
      console.error("Failed to get chatbot JWT:", error.response?.data || error.message);
      return null;
    }
  };

  // Cached + de-duplicated JWT getter. Returns instantly if a
  // still-fresh token is cached; if a fetch is already in flight,
  // awaits that same fetch instead of starting a second one.
  const ensureJwtToken = useCallback(({ forceRefresh = false } = {}) => {

    const cache = jwtCacheRef.current;
    const isFresh = cache.token && Date.now() < cache.expiresAt;

    if (isFresh && !forceRefresh) {
      return Promise.resolve(cache.token);
    }

    if (jwtFetchPromiseRef.current) {
      return jwtFetchPromiseRef.current;
    }

    const fetchPromise = fetchJWTFromBackend()
      .then((token) => {

        if (token) {
          jwtCacheRef.current = { token, expiresAt: Date.now() + JWT_CACHE_TTL_MS };
        }

        return token;
      })
      .finally(() => {
        jwtFetchPromiseRef.current = null;
      });

    jwtFetchPromiseRef.current = fetchPromise;
    return fetchPromise;

  }, []);

  const fetchThreadsFromBackend = async () => {

    const token = await ensureJwtToken();

    if (!token) return [];

    try {
      const response = await chatbotAxios.get("/threads/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data?.threads || [];
    } catch (error) {
      console.error("Failed to fetch threads:", error.response?.data || error.message);
      return [];
    }
  };

  const loadThreadMessages = async (threadId) => {

    const token = await ensureJwtToken();

    if (!token) return [];

    try {
      const response = await chatbotAxios.get(`/threads/${threadId}/messages/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Backend sends { role: "user" | "assistant", content: "..." }.
      // The UI renders { sender: "user" | "bot", text: "..." }.
      const rawMessages = response.data?.messages || [];

      return rawMessages.map((message) => ({
        sender: message.role === "user" ? "user" : "bot",
        text: message.content || "",
      }));

    } catch (error) {
      console.error("Failed to load thread history:", error.response?.data || error.message);
      return [];
    }
  };

  useEffect(() => {

    if (loading) return;

    let cancelled = false;

    const init = async () => {

      if (isAuthenticated) {

        setIsLoadingThreads(true);
        const backendThreads = await fetchThreadsFromBackend();
        if (cancelled) return;

        setThreads(backendThreads);
        setIsLoadingThreads(false);

        if (backendThreads.length > 0) {

          const first = backendThreads[0];
          setActiveThreadId(first.thread_id);
          setIsLoadingHistory(true);

          const history = await loadThreadMessages(first.thread_id);
          if (cancelled) return;

          setMessages(history);
          setIsLoadingHistory(false);

        } else {
          setActiveThreadId(createThreadId());
          setMessages([]);
        }

      } else {
        setThreads([]);
        setActiveThreadId(createThreadId());
        setMessages([]);
      }
    };

    init();

    return () => { cancelled = true; };

  }, [isAuthenticated, loading]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Warms up the connection to the chatbot origin on mount (DNS +
  // TCP + TLS handshake) so the very first request doesn't pay
  // that cost on top of everything else.
  useEffect(() => {
    fetch(CHATBOT_API_BASE, { method: "HEAD", mode: "no-cors" }).catch(() => { });
  }, []);

  const toggleChat = () => setIsOpen((previous) => !previous);

  const startNewChat = () => {

    if (isLoading) return;

    setActiveThreadId(createThreadId());
    setMessages([]);
    setInput("");

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const selectThread = async (threadId) => {

    if (isLoading || threadId === activeThreadId) return;

    setActiveThreadId(threadId);
    setMessages([]);
    setIsLoadingHistory(true);

    const history = await loadThreadMessages(threadId);

    setMessages(history);
    setIsLoadingHistory(false);
  };


  /* ==========================================================
     SEND TEXT MESSAGE — STREAMING (typed input)
     ========================================================== */

  const sendMessage = async (textToSend) => {

    const messageText = textToSend || input;
    const trimmed = messageText.trim();

    if (!trimmed || isLoading) return;

    let currentThreadId = activeThreadId;

    if (!currentThreadId) {
      currentThreadId = createThreadId();
      setActiveThreadId(currentThreadId);
    }

    setMessages((previous) => [
      ...previous,
      { sender: "user", text: trimmed },
      { sender: "bot", text: "" },
    ]);

    setInput("");
    setIsLoading(true);

    let botText = "";

    const updateBotMessage = (text) => {
      setMessages((previous) => {
        const updated = [...previous];
        updated[updated.length - 1] = { sender: "bot", text };
        return updated;
      });
    };

    try {

      let jwtToken = null;
      if (isAuthenticated) jwtToken = await ensureJwtToken();

      const response = await fetch(`${CHATBOT_API_BASE}/chat/stream/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          thread_id: currentThreadId,
          jwt_token: jwtToken || null,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const rawEvents = buffer.split("\n\n");
        buffer = rawEvents.pop() || "";

        for (const rawEvent of rawEvents) {

          const line = rawEvent.trim();
          if (!line.startsWith("data:")) continue;

          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          let event;
          try {
            event = JSON.parse(dataStr);
          } catch (parseError) {
            console.error("Failed to parse SSE event:", dataStr, parseError);
            continue;
          }

          if (event.type === "token") {
            botText += event.content || "";
            updateBotMessage(botText);
          } else if (event.type === "node") {
            if (!botText && event.content) {
              botText = event.content;
              updateBotMessage(botText);
            }
          } else if (event.type === "done") {
            if (event.thread_id) {
              currentThreadId = event.thread_id;
              setActiveThreadId(currentThreadId);
            }
          } else if (event.type === "error") {
            console.error("Stream error event:", event.error);
            if (!botText) {
              botText = "Server error. Please try again.";
              updateBotMessage(botText);
            }
          }
        }
      }

      if (!botText) {
        updateBotMessage("Sorry, I couldn't generate a response.");
      }

      if (isAuthenticated) {
        const backendThreads = await fetchThreadsFromBackend();
        setThreads(backendThreads);
      }

    } catch (error) {

      console.error("CHAT STREAM ERROR:", error.message);
      updateBotMessage(botText || "Server error. Please try again.");

    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!isLoading && input.trim()) sendMessage();
    }
  };

  const quickSuggestions = [
    "How to report a civic issue?",
    "What are public reports?",
    "Emergency contacts?",
  ];

  const handleSuggestionClick = (text) => {
    setInput(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  };


  /* ==========================================================
     TEXT-TO-SPEECH — queued, sentence-by-sentence, interruptible
     ========================================================== */

  useEffect(() => {

    if (!speechSynthesisSupported) return;

    const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices(); };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

  }, []);

  // Lowest-level: speaks one already-cleaned chunk of text.
  const speakUtterance = useCallback((cleanText, { onEnd } = {}) => {

    if (!speechSynthesisSupported || !cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = "en-US";

    const preferred = pickBestVoice(voicesRef.current);
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = () => { if (onEnd) onEnd(); };

    window.speechSynthesis.speak(utterance);

  }, []);

  // One-off convenience (e.g. the wake-word greeting) — cleans
  // markdown then speaks immediately, bypassing the queue.
  const speak = useCallback((text, opts = {}) => {
    speakUtterance(stripMarkdownForSpeech(text), opts);
  }, [speakUtterance]);

  // Drains the sentence queue one at a time. Never calls
  // speechSynthesis.cancel() mid-stream — that was what caused
  // replies to occasionally cut themselves off before finishing.
  const processTtsQueue = () => {

    if (ttsQueueRef.current.length === 0) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    const next = ttsQueueRef.current.shift();
    isSpeakingRef.current = true;
    setIsSpeaking(true);

    speakUtterance(next, {
      onEnd: () => setTimeout(() => processTtsQueueRef.current(), INTER_SENTENCE_GAP_MS),
    });
  };
  processTtsQueueRef.current = processTtsQueue;

  // Queues a chunk of raw (possibly markdown) text for speech,
  // kicking off playback immediately if nothing is currently
  // speaking.
  const enqueueSpeech = (rawText) => {

    const clean = stripMarkdownForSpeech(rawText);
    if (!clean) return;

    ttsQueueRef.current.push(clean);

    if (!isSpeakingRef.current) processTtsQueueRef.current();
  };
  enqueueSpeechRef.current = enqueueSpeech;

  const stopSpeaking = () => {
    if (speechSynthesisSupported) window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  };

  // Interruption handler: wipes the speech queue, cancels any
  // audio currently playing, and aborts the in-flight streamed
  // response — used both for a manual "stop" and for barge-in
  // when the user starts talking over the bot.
  const cancelBotOutput = () => {

    ttsQueueRef.current = [];
    if (speechSynthesisSupported) window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);

    if (voiceStreamAbortRef.current) {
      voiceStreamAbortRef.current.abort();
      voiceStreamAbortRef.current = null;
    }

    isProcessingVoiceRef.current = false;
    setIsProcessingVoice(false);
  };
  cancelBotOutputRef.current = cancelBotOutput;


  /* ==========================================================
     VOICE — send a transcribed turn through the streaming chat
     endpoint, speaking each sentence as soon as it's complete.
     ========================================================== */

  const sendVoiceText = async (transcript) => {

    let currentThreadId = activeThreadIdRef.current;

    if (!currentThreadId) {
      currentThreadId = createThreadId();
      setActiveThreadId(currentThreadId);
      activeThreadIdRef.current = currentThreadId;
    }

    setMessages((previous) => [
      ...previous,
      { sender: "user", text: transcript },
      { sender: "bot", text: "" },
    ]);

    isProcessingVoiceRef.current = true;
    setIsProcessingVoice(true);

    // Cancel any previous still-in-flight voice request so it
    // can't land after this one and clobber the conversation.
    if (voiceStreamAbortRef.current) voiceStreamAbortRef.current.abort();
    const abortController = new AbortController();
    voiceStreamAbortRef.current = abortController;

    let botText = "";
    let speechBuffer = "";

    const updateBotMessage = (text) => {
      setMessages((previous) => {
        const updated = [...previous];
        updated[updated.length - 1] = { sender: "bot", text };
        return updated;
      });
    };

    // Pulls every complete sentence out of the buffer and queues
    // it for speech right away — this is what lets speech start on
    // the first sentence while the rest is still streaming in,
    // instead of waiting for the whole reply.
    const flushCompleteSentences = (force = false) => {

      const sentenceEnd = /[^.!?\n]*[.!?\n]+/g;
      let match;
      let consumed = 0;

      while ((match = sentenceEnd.exec(speechBuffer)) !== null) {
        const sentence = match[0];
        if (sentence.trim()) enqueueSpeechRef.current(sentence);
        consumed = sentenceEnd.lastIndex;
      }

      speechBuffer = speechBuffer.slice(consumed);

      if (force && speechBuffer.trim()) {
        enqueueSpeechRef.current(speechBuffer);
        speechBuffer = "";
      }
    };

    try {

      let jwtToken = null;
      if (isAuthenticatedRef.current) jwtToken = await ensureJwtToken();

      const response = await fetch(`${CHATBOT_API_BASE}/chat/stream/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: transcript,
          thread_id: currentThreadId,
          jwt_token: jwtToken || null,
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const rawEvents = buffer.split("\n\n");
        buffer = rawEvents.pop() || "";

        for (const rawEvent of rawEvents) {

          const line = rawEvent.trim();
          if (!line.startsWith("data:")) continue;

          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          let event;
          try {
            event = JSON.parse(dataStr);
          } catch (parseError) {
            console.error("Failed to parse SSE event:", dataStr, parseError);
            continue;
          }

          if (event.type === "token") {
            const chunk = event.content || "";
            botText += chunk;
            speechBuffer += chunk;
            updateBotMessage(botText);
            flushCompleteSentences();
          } else if (event.type === "node") {
            if (!botText && event.content) {
              botText = event.content;
              speechBuffer += event.content;
              updateBotMessage(botText);
              flushCompleteSentences();
            }
          } else if (event.type === "done") {
            if (event.thread_id) {
              currentThreadId = event.thread_id;
              setActiveThreadId(currentThreadId);
              activeThreadIdRef.current = currentThreadId;
            }
          } else if (event.type === "error") {
            console.error("Stream error event:", event.error);
            if (!botText) {
              botText = "Server error. Please try again.";
              updateBotMessage(botText);
            }
          }
        }
      }

      flushCompleteSentences(true);

      if (!botText) {
        updateBotMessage("Sorry, I couldn't generate a response.");
      }

      if (isAuthenticatedRef.current) {
        const backendThreads = await fetchThreadsFromBackend();
        setThreads(backendThreads);
      }

    } catch (error) {

      if (error.name === "AbortError") {
        // Superseded by an interruption or a newer turn — not a
        // real failure, nothing to show the user.
      } else {
        console.error("Voice stream error:", error.message);
        updateBotMessage(botText || "Server error. Please try again.");
      }

    } finally {

      if (voiceStreamAbortRef.current === abortController) {
        voiceStreamAbortRef.current = null;
      }

      isProcessingVoiceRef.current = false;
      setIsProcessingVoice(false);
    }
  };
  sendVoiceTextRef.current = sendVoiceText;


  /* ==========================================================
     VOICE — turn finalization + voice-mode lifecycle
     ========================================================== */

  const stopDictation = () => {

    if (dictationRecognitionRef.current) {

      try {
        dictationRecognitionRef.current.onend = null;
        dictationRecognitionRef.current.onresult = null;
        dictationRecognitionRef.current.onerror = null;
        dictationRecognitionRef.current.abort();
      } catch (e) { /* no-op */ }

      dictationRecognitionRef.current = null;
    }

    if (turnSilenceTimerRef.current) {
      clearTimeout(turnSilenceTimerRef.current);
      turnSilenceTimerRef.current = null;
    }

    turnTranscriptRef.current = "";
  };

  const finalizeTurn = () => {

    turnSilenceTimerRef.current = null;

    const transcript = turnTranscriptRef.current.trim();
    turnTranscriptRef.current = "";
    interruptedThisTurnRef.current = false;

    if (!transcript) return; // nothing said — keep listening, no-op

    const isStopPhrase = STOP_WORDS_LOCAL.includes(transcript.toLowerCase());

    if (isStopPhrase) {
      endVoiceMode("Okay, bye!");
      return;
    }

    sendVoiceTextRef.current(transcript);
  };
  finalizeTurnRef.current = finalizeTurn;

  // Single exit point for ending voice mode, no matter how it
  // happens (manual stop, stop phrase, etc.) — always restarts
  // wake-word listening afterward. Previously that restart only
  // happened along one specific path, so ending voice mode certain
  // ways left the mic silently dead until the page was refreshed.
  const endVoiceMode = (goodbyeText) => {

    setVoiceMode(false);
    cancelBotOutputRef.current();
    stopDictation();

    const restartWakeWord = () => {
      if (wakeWordEnabledRef.current) startWakeWordListening();
    };

    if (goodbyeText) {
      speak(goodbyeText, { onEnd: restartWakeWord });
    } else {
      restartWakeWord();
    }
  };

  // Long-lived continuous recognizer for the duration of a voice
  // session. Created once per session (not per turn), so there's
  // no start/stop overhead between turns — it just keeps listening
  // straight through the bot thinking and speaking, which is what
  // makes barge-in possible.
  const startDictation = useCallback(() => {

    if (!SpeechRecognitionCtor || dictationRecognitionRef.current) return;

    const recognition = new SpeechRecognitionCtor();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {

      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {

        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          turnTranscriptRef.current = (turnTranscriptRef.current + " " + transcript).trim();
        } else {
          interimText += transcript;
        }
      }

      const heardEnough =
        (turnTranscriptRef.current + " " + interimText).trim().length >= INTERRUPT_MIN_CHARS;

      // Barge-in: the bot is talking or thinking and the user just
      // started speaking — stop it immediately instead of making
      // them wait. Browsers don't expose echo-cancellation control
      // for SpeechRecognition, so on speakers (not headphones) this
      // can occasionally pick up the bot's own voice; headphones
      // avoid that entirely.
      if (
        heardEnough &&
        (isSpeakingRef.current || isProcessingVoiceRef.current) &&
        !interruptedThisTurnRef.current
      ) {
        interruptedThisTurnRef.current = true;
        cancelBotOutputRef.current();
      }

      if (turnSilenceTimerRef.current) clearTimeout(turnSilenceTimerRef.current);
      turnSilenceTimerRef.current = setTimeout(() => {
        finalizeTurnRef.current();
      }, TURN_SILENCE_MS);
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("Dictation recognition error:", event.error);
      }
    };

    recognition.onend = () => {

      dictationRecognitionRef.current = null;

      // Browsers sometimes end a continuous session on their own
      // (long silence, tab backgrounding, etc). If we're still
      // meant to be in voice mode, restart right away instead of
      // leaving the mic silently dead — this is what previously
      // required a page refresh to fix.
      if (voiceModeActiveRef.current) {
        setTimeout(() => startDictation(), 150);
      }
    };

    try {
      recognition.start();
      dictationRecognitionRef.current = recognition;
    } catch (error) {
      console.error("Could not start dictation:", error.message);
      dictationRecognitionRef.current = null;
    }

  }, []);

  const startVoiceMode = () => {

    stopWakeWordListening();
    setIsOpen(true);
    setVoiceMode(true);
    interruptedThisTurnRef.current = false;
    turnTranscriptRef.current = "";
    startDictation();
  };

  const handleMicButtonClick = () => {

    if (voiceModeActive) {
      endVoiceMode();
      return;
    }

    startVoiceMode();
  };


  /* ==========================================================
     WAKE WORD — "AVENGERS ASSEMBLE"
     ========================================================== */

  // Greets using the identity already available on the client (no
  // backend round trip needed just to say hello) and starts
  // listening immediately, in parallel with the greeting — not
  // after it — so you can start talking the instant it finishes,
  // or even talk over it.
  const greetAndStartVoiceMode = useCallback(() => {

    setIsOpen(true);
    setVoiceMode(true);
    interruptedThisTurnRef.current = false;
    turnTranscriptRef.current = "";

    const displayName = user?.username || user?.email;

    const greeting = isAuthenticated && displayName
      ? `Hi ${displayName}, how can I help you?`
      : "Hi, how can I help you?";

    setMessages((previous) => [
      ...previous,
      { sender: "bot", text: greeting },
    ]);

    startDictation();
    speak(greeting);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, speak, startDictation]);

  const startWakeWordListening = useCallback(() => {

    if (
      !SpeechRecognitionCtor ||
      !wakeWordEnabledRef.current ||
      voiceModeActiveRef.current ||
      wakeRecognitionRef.current
    ) {
      return;
    }

    const recognition = new SpeechRecognitionCtor();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let triggered = false;

    recognition.onresult = (event) => {

      if (triggered) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {

        const transcript = event.results[i][0].transcript.toLowerCase().trim();

        const heardWakeWord = WAKE_PHRASES.some((phrase) => transcript.includes(phrase));

        if (heardWakeWord) {

          // Disarm this instance completely BEFORE tearing it
          // down, so its own onend can't race with the dictation
          // that's about to start and steal the mic back.
          triggered = true;
          recognition.onend = null;
          recognition.onresult = null;
          recognition.onerror = null;

          try { recognition.abort(); } catch (e) { /* no-op */ }

          wakeRecognitionRef.current = null;

          greetAndStartVoiceMode();

          return;
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("Wake-word recognition error:", event.error);
      }
    };

    recognition.onend = () => {

      wakeRecognitionRef.current = null;

      if (wakeWordEnabledRef.current && !voiceModeActiveRef.current) {
        setTimeout(() => startWakeWordListening(), 300);
      }
    };

    try {
      recognition.start();
      wakeRecognitionRef.current = recognition;
    } catch (error) {
      console.error("Could not start wake-word listener:", error.message);
      wakeRecognitionRef.current = null;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetAndStartVoiceMode]);

  const stopWakeWordListening = useCallback(() => {

    if (wakeRecognitionRef.current) {

      try {
        wakeRecognitionRef.current.onend = null;
        wakeRecognitionRef.current.onresult = null;
        wakeRecognitionRef.current.abort();
      } catch (e) { /* no-op */ }

      wakeRecognitionRef.current = null;
    }

  }, []);

  const toggleWakeWord = () => {

    setWakeWordEnabled((previous) => {

      const next = !previous;
      wakeWordEnabledRef.current = next;

      if (next) startWakeWordListening();
      else stopWakeWordListening();

      return next;
    });
  };

  // On mount: ask for mic permission once up front (so the browser
  // doesn't silently block the wake-word listener the first time
  // it tries to start — SpeechRecognition shares the same
  // microphone permission as getUserMedia), then begin listening.
  useEffect(() => {

    let cancelled = false;

    const init = async () => {

      if (micSupported) {

        try {
          const primingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          primingStream.getTracks().forEach((track) => track.stop());
        } catch (error) {
          console.warn("Microphone permission not granted:", error.message);
        }
      }

      if (cancelled) return;

      if (wakeWordEnabledRef.current) startWakeWordListening();
    };

    init();

    return () => {
      cancelled = true;
      if (voiceStreamAbortRef.current) voiceStreamAbortRef.current.abort();
      stopWakeWordListening();
      stopDictation();
      if (speechSynthesisSupported) window.speechSynthesis.cancel();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const activeThread = threads.find((thread) => thread.thread_id === activeThreadId);

  // Derived, not stored state — exactly one of these three is true
  // whenever voice mode is on: listening for the user, waiting on
  // the stream, or speaking the reply.
  const isListening = voiceModeActive && !isProcessingVoice && !isSpeaking;


  /* ==========================================================
     UI
     ========================================================== */

  return (

    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      <div style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
      </div>

      {!isOpen && (

        <button
          type="button"
          onClick={toggleChat}
          className={"chatbot-big-launcher " + (isListening ? "chatbot-launcher-recording" : "")}
          aria-label="Open AI Assistance"
        >
          <RobotOutlined />
          <span>
            {voiceModeActive
              ? (isSpeaking ? "Speaking..." : isProcessingVoice ? "Thinking..." : "Listening...")
              : wakeWordEnabled && speechRecognitionSupported
                ? "AI agent for you • say “Avengers Assemble”"
                : "AI agent for you"}
          </span>
        </button>

      )}

      {isOpen && (

        <div className="chatbot-shell">

          {isAuthenticated && isSidebarOpen && (

            <div className="chatbot-sidebar">

              <div className="chatbot-sidebar-header">
                <div className="chatbot-sidebar-brand">
                  <RobotOutlined />
                  <span>AI Assistance</span>
                </div>
                <button type="button" onClick={() => setIsSidebarOpen(false)} className="chatbot-icon-button">
                  <CloseOutlined />
                </button>
              </div>

              <button type="button" onClick={startNewChat} className="chatbot-new-chat-button">
                <PlusOutlined />
                <span>New chat</span>
              </button>

              <div className="chatbot-thread-list">

                {isLoadingThreads && (
                  <div className="chatbot-empty-threads">Loading conversations...</div>
                )}

                {!isLoadingThreads && threads.length === 0 && (
                  <div className="chatbot-empty-threads">No conversations yet.</div>
                )}

                {!isLoadingThreads && threads.map((thread) => (
                  <div
                    key={thread.thread_id}
                    className={"chatbot-thread-item " + (thread.thread_id === activeThreadId ? "active" : "")}
                    onClick={() => selectThread(thread.thread_id)}
                  >
                    <MessageOutlined />
                    <span className="chatbot-thread-title">{thread.title}</span>
                  </div>
                ))}

              </div>

              <div className="chatbot-sidebar-footer">
                <div className="chatbot-user-avatar">
                  {(user?.username || user?.email || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div>{user?.username || user?.email || "User"}</div>
                  <small>Logged in</small>
                </div>
              </div>

            </div>

          )}

          <div className="chatbot-main">

            <div className="chatbot-main-header">

              {isAuthenticated && !isSidebarOpen && (
                <button type="button" onClick={() => setIsSidebarOpen(true)} className="chatbot-icon-button">
                  <MenuOutlined />
                </button>
              )}

              <div className="chatbot-header-info">
                <div className="chatbot-header-avatar">
                  <RobotOutlined />
                </div>
                <div>
                  <div className="chatbot-header-title">AI Assistance</div>
                  <div className="chatbot-header-status">
                    <span className="chatbot-status-dot" />
                    {isSpeaking
                      ? "Speaking... • start talking to interrupt"
                      : isProcessingVoice
                        ? "Thinking... • start talking to interrupt"
                        : voiceModeActive
                          ? "Listening... • say “stop” or tap mic to end"
                          : loading
                            ? "Connecting..."
                            : isAuthenticated
                              ? `Online • ${user?.username || user?.email || "Logged in"}`
                              : "Online • Guest"}
                  </div>
                </div>
              </div>

              {voiceModeActive && (

                <div
                  className={
                    "chatbot-voice-orb " +
                    (isSpeaking
                      ? "is-speaking"
                      : isProcessingVoice
                        ? "is-thinking"
                        : "is-listening")
                  }
                  aria-hidden="true"
                >

                  {isProcessingVoice ? (
                    <div className="chatbot-orb-dots">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <div className="chatbot-orb-bars">
                      <span /><span /><span /><span /><span />
                    </div>
                  )}

                </div>

              )}

              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="chatbot-icon-button"
                  title="Stop speaking"
                >
                  <SoundOutlined />
                </button>
              )}

              {speechRecognitionSupported && (
                <button
                  type="button"
                  onClick={toggleWakeWord}
                  className="chatbot-icon-button"
                  title={
                    wakeWordEnabled
                      ? "Wake word listening is ON — click to disable"
                      : "Wake word listening is OFF — click to enable"
                  }
                >
                  {wakeWordEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                </button>
              )}

              <button type="button" onClick={toggleChat} className="chatbot-icon-button">
                <CloseOutlined />
              </button>

            </div>

            {isAuthenticated && activeThread && (
              <div className="chatbot-current-thread">{activeThread.title}</div>
            )}

            <div className="chatbot-messages-area">

              {isLoadingHistory && (
                <div className="chatbot-welcome"><p>Loading conversation...</p></div>
              )}

              {!isLoadingHistory && messages.length === 0 && (

                <div className="chatbot-welcome">
                  <div className="chatbot-welcome-icon"><RobotOutlined /></div>
                  <h2>Namaste! 👋</h2>
                  <p>How can I help you with AI Assistance today?</p>

                  <div className="chatbot-suggestions">
                    {quickSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        className="chatbot-suggestion"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

              )}

              {!isLoadingHistory && messages.map((message, index) => {

                const isLastMessage = index === messages.length - 1;

                const isStreamingPlaceholder =
                  message.sender === "bot" &&
                  message.text === "" &&
                  (isLoading || isProcessingVoice) &&
                  isLastMessage;

                return (

                  <div
                    key={index}
                    className={message.sender === "user" ? "chatbot-message-row user" : "chatbot-message-row bot"}
                  >

                    {message.sender === "bot" && (
                      <div className="chatbot-message-avatar"><RobotOutlined /></div>
                    )}

                    <div className={message.sender === "user" ? "chatbot-user-message" : "chatbot-bot-message"}>

                      {isStreamingPlaceholder ? (
                        <span className="chatbot-typing"><span /><span /><span /></span>
                      ) : message.sender === "bot" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                      ) : (
                        message.text
                      )}

                    </div>

                  </div>

                );

              })}

              <div ref={chatEndRef} />

            </div>

            <div className="chatbot-input-wrapper">

              <div className="chatbot-input-box">

                {speechRecognitionSupported && (
                  <button
                    type="button"
                    onClick={handleMicButtonClick}
                    disabled={isLoading}
                    className={"chatbot-mic-button " + (isListening ? "recording" : "") + (voiceModeActive ? " active" : "")}
                    title={voiceModeActive ? "Tap to end voice mode" : "Speak your message"}
                  >
                    <AudioOutlined />
                  </button>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  placeholder={
                    isListening
                      ? "Listening..."
                      : isProcessingVoice
                        ? "Thinking..."
                        : isSpeaking
                          ? "Speaking..."
                          : "Message with AI Assistance..."
                  }
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading || voiceModeActive}
                  autoComplete="off"
                />

                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="chatbot-send-button"
                >
                  {isLoading ? <span className="chatbot-spinner" /> : <SendOutlined />}
                </button>

              </div>

              <div className="chatbot-disclaimer">
                AI can make mistakes. Please verify important information.
              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
};

export default Chatbot;