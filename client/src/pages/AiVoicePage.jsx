import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '../lib/apiBaseUrl.js';

const PAGE_COLOR   = '#e2c97e'; // אלוהים — page background & soft accent
/** כותרת ראשית בעמוד — זהב עמוק יותר מ־PAGE_COLOR */
const HEADER_TITLE_COLOR = '#f0cf4a';
const SELECT_COLOR = '#f59e0b'; // רב זמיר כהן — all selection highlights

const EL_KEY = 'sk_82f7f6de950fcbcc9cc54e1108e7b330ebd2e88f4897dee9';
const EL_VOICES = {
  1:'3gRjssTCTqbHGck8mIv7', 2:'nuVtpPA1A7SQPqVRggLF', 3:'mNltV315CbDeheQKBRaG',
  4:'mNltV315CbDeheQKBRaG',  5:'mNltV315CbDeheQKBRaG', 6:'yoZ06aMxZJJ28mfd3POQ',
  7:'ErXwobaYiN019PkySvjV',  8:'ErXwobaYiN019PkySvjV', 9:'VR6AewLTigWG4xSOukaG',
  10:'mNltV315CbDeheQKBRaG',
};

// Shared AudioContext — unlocked on first user gesture, immune to autoplay policy
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  return _audioCtx;
}

async function elTTSDirect(text, char) {
  const voiceId = EL_VOICES[char.id] || 'pNInz6obpgDQGcFmaJgB';
  // eleven_multilingual_v2 auto-detects language (including Hebrew) from text
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.slice(0, 1000),
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!r.ok) throw new Error(`el-direct ${r.status}`);
  return r.arrayBuffer();
}

// Google Translate TTS via server proxy — bypasses CORS, Hebrew female voice
async function googleTTSHebrew(text, gender = 'female') {
  const chunks = text.match(/.{1,200}/g) || [text];
  const buffers = [];
  const PROXY = `${getApiBaseUrl()}/api/radio-proxy?url=`;
  for (const chunk of chunks) {
    const gttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=he&client=tw-ob&ttsspeed=0.9`;
    const r = await fetch(PROXY + encodeURIComponent(gttsUrl));
    if (!r.ok) throw new Error('gtts');
    buffers.push(await r.arrayBuffer());
  }
  // Concatenate all chunks
  const total = buffers.reduce((s, b) => s + b.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) { merged.set(new Uint8Array(b), offset); offset += b.byteLength; }
  return merged.buffer;
}

// Play ArrayBuffer via AudioContext — bypasses autoplay policy
function playArrayBuffer(arrayBuf, onDone, onError, pitchRate = 1.0) {
  const ctx = getAudioCtx();
  ctx.decodeAudioData(arrayBuf, (decoded) => {
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.playbackRate.value = pitchRate;
    src.connect(ctx.destination);
    src.onended = onDone;
    src.start(0);
    _currentSrc = src;
  }, onError);
}
let _currentSrc = null;

// pitch: 0=lowest, 2=highest (default 1). rate: speed (default 1).
const CHARACTERS = [
  {
    id: 1, emoji: '🎙️', name: 'קול רדיופוני גברי',
    desc: 'קריין מקצועי, ברור ורהוט', lang: 'he-IL', gender: 'male',
    color: '#6366f1', pitch: 0.85, rate: 0.97,
    greeting: 'כאן קול ישראל. שלום וברכה. במה אוכל לעזור לך היום?',
  },
  {
    id: 2, emoji: '🎤', name: 'קריינית נשית',
    desc: 'קול נשי חם ומקצועי', lang: 'he-IL', gender: 'female',
    color: '#ec4899', pitch: 1.6, rate: 1.05,
    greeting: 'שלום! כיף לדבר איתך. על מה נשוחח היום?',
  },
  {
    id: 3, emoji: '🕍', name: 'רב זמיר כהן',
    desc: 'בעל ידע תורני עמוק', lang: 'he-IL', gender: 'male',
    color: '#f59e0b', pitch: 0.78, rate: 0.88,
    greeting: 'שלום עליכם! ברוך הבא. שאל מה שתרצה, ונלמד יחד.',
  },
  {
    id: 4, emoji: '🧠', name: 'פרופ׳ יובל נ. הררי',
    desc: 'היסטוריון וחושב גדול', lang: 'he-IL', gender: 'male',
    color: '#06b6d4', pitch: 0.92, rate: 1.05,
    greeting: 'שלום. ההיסטוריה האנושית מלאה שאלות מרתקות. מה מעסיק אותך?',
  },
  {
    id: 5, emoji: '🇮🇱', name: 'ראש ממשלת ישראל',
    desc: 'מדינאי ודובר ציבורי', lang: 'he-IL', gender: 'male',
    color: '#3b82f6', pitch: 0.88, rate: 0.93,
    greeting: 'שלום לכולם. מדינת ישראל עומדת איתן. במה אוכל לסייע?',
  },
  {
    id: 6, emoji: '🇺🇸', name: 'נשיא טראמפ',
    desc: 'TREMENDOUS! BELIEVE ME!', lang: 'en-US', gender: 'male',
    color: '#ef4444', pitch: 0.80, rate: 0.91,
    greeting: 'Hello! Believe me, nobody knows more about this than me. Let\'s talk!',
  },
  {
    id: 7, emoji: '🇬🇧', name: 'דובר אנגלית',
    desc: 'English native speaker', lang: 'en-US', gender: 'male',
    color: '#8b5cf6', pitch: 0.95, rate: 1.0,
    greeting: 'Hello there! Great to meet you. What would you like to talk about?',
  },
  {
    id: 8, emoji: '🇪🇸', name: 'דובר ספרדית',
    desc: 'Hablante nativo de español', lang: 'es-ES', gender: 'male',
    color: '#f97316', pitch: 0.90, rate: 1.0,
    greeting: '¡Hola! Mucho gusto. ¿De qué quieres que hablemos hoy?',
  },
  {
    id: 9, emoji: '✡️', name: 'דובר אידיש',
    desc: 'אַ אידישע שפּראַך', lang: 'he-IL', gender: 'male',
    color: '#84cc16', pitch: 0.82, rate: 0.85,
    greeting: 'שלום עליכם! א גוטן טאג. וואס וועסטו פרעגן?',
  },
  {
    id: 10, emoji: '☁️', name: 'אלוהים',
    desc: 'יודע כל, חכמת עולמות', lang: 'he-IL', gender: 'male',
    color: '#e2c97e', pitch: 0.65, rate: 0.82,
    greeting: 'שלום, ברואי. הנני. שאל מה שלבך חפץ.',
  },
];

function PhoneIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <circle cx="24" cy="24" r="24" fill="#22c55e" />
      <path d="M16 14h4.5l2 5-2.5 1.5a11 11 0 0 0 7.5 7.5L29 25.5l5 2V32a2 2 0 0 1-2 2C18.3 34 14 20.7 14 16a2 2 0 0 1 2-2z"
        fill="#fff" stroke="#fff" strokeWidth="0.5" />
    </svg>
  );
}

function EndCallIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <circle cx="24" cy="24" r="24" fill="#dc2626" />
      <g transform="rotate(135 24 24)" style={{ transformOrigin: '24px 24px' }}>
        <path d="M16 14h4.5l2 5-2.5 1.5a11 11 0 0 0 7.5 7.5L29 25.5l5 2V32a2 2 0 0 1-2 2C18.3 34 14 20.7 14 16a2 2 0 0 1 2-2z"
          fill="#fff" stroke="#fff" strokeWidth="0.5" />
      </g>
    </svg>
  );
}

export default function AiVoicePage() {
  const [callState, setCallState] = useState('idle');
  const [selectedChar, setSelectedChar] = useState(CHARACTERS[0]);
  const [transcript, setTranscript] = useState([]);
  const [factErrors, setFactErrors] = useState([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [error, setError] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const [previewCharId, setPreviewCharId] = useState(null);
  const [lastPreviewedId, setLastPreviewedId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [userTurn, setUserTurn] = useState(false);
  const [inputText, setInputText] = useState('');

  const synthRef = useRef(window.speechSynthesis);
  const currentAudioRef = useRef(null);
  const previewTokenRef = useRef(0);
  const previewActiveRef = useRef(false);   // true מרגע לחיצה ראשונה עד סוף הברכה
  const pendingCallRef   = useRef(null);    // callback שיופעל כשהברכה תסיים
  const callTimerRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const errorsEndRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const abortRef = useRef(false);
  const askAIRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const animateTypingRef = useRef(null);

  useEffect(() => {
    if (callState === 'active') {
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      clearInterval(callTimerRef.current);
      if (callState === 'idle') setCallDuration(0);
    }
    return () => clearInterval(callTimerRef.current);
  }, [callState]);

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript, aiThinking]);
  useEffect(() => { errorsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [factErrors]);
  useEffect(() => { if (userTurn) setInputText(''); }, [userTurn]);

  animateTypingRef.current = (text) => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    let i = 0;
    setInputText('');
    typingIntervalRef.current = setInterval(() => {
      i++;
      setInputText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    }, 28);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function utterFor(text, char) {
    const synth = synthRef.current;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang   = char.lang   || 'he-IL';
    utt.pitch  = char.pitch  ?? (char.gender === 'female' ? 1.2 : 0.85);
    utt.rate   = char.rate   ?? 1.0;
    const match = pickVoice(synth.getVoices(), utt.lang, char.gender || 'male');
    if (match) utt.voice = match;
    return utt;
  }

  const speakPreview = useCallback((char) => {
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    // Stop any ongoing AudioContext preview
    if (_currentSrc) { try { _currentSrc.stop(); } catch {} _currentSrc = null; }
    // Discard any pending startCall from a previous preview cycle
    pendingCallRef.current = null;
    synthRef.current.cancel();
    getAudioCtx(); // unlock AudioContext during user gesture

    const token = ++previewTokenRef.current;
    previewActiveRef.current = true;
    setPreviewCharId(char.id);

    const done = () => {
      previewActiveRef.current = false;
      if (previewTokenRef.current === token) setPreviewCharId(null);
      const cb = pendingCallRef.current;
      pendingCallRef.current = null;
      cb?.();
    };
    const previewWebSpeech = () => {
      done();
      const utt = new SpeechSynthesisUtterance(char.greeting);
      utt.lang = char.lang || 'he-IL';
      utt.pitch = char.pitch ?? 1;
      utt.rate = char.rate ?? 1;
      synthRef.current.speak(utt);
    };
    // ElevenLabs voices are already gendered — no pitch shift needed
    const playBuf = (buf) => {
      if (previewTokenRef.current !== token) return;
      playArrayBuffer(buf, done, previewWebSpeech, 1.0);
    };
    // Google TTS is female by default — lower pitch for male characters
    const gttsRate = char.gender === 'female' ? 1.0 : 0.78;
    const playBufGTTS = (buf) => {
      if (previewTokenRef.current !== token) return;
      playArrayBuffer(buf, done, previewWebSpeech, gttsRate);
    };

    const BASE = getApiBaseUrl();
    fetch(`${BASE}/api/elevenlabs-tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: char.greeting, characterId: char.id, lang: char.lang }),
    })
      .then(r => { if (!r.ok) throw new Error('tts'); return r.arrayBuffer(); })
      .then(playBuf)
      .catch(() => {
        const lc = (char.lang || 'he-IL').split('-')[0];
        if (lc === 'he') return googleTTSHebrew(char.greeting).then(playBufGTTS).catch(previewWebSpeech);
        return elTTSDirect(char.greeting, char).then(playBuf).catch(previewWebSpeech);
      });
  }, []);

  // speak(text, char, onDone) — ElevenLabs TTS with Web Speech fallback
  const speak = useCallback((text, char, onDone) => {
    if (abortRef.current) return;
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    synthRef.current.cancel();
    getAudioCtx(); // unlock AudioContext during user gesture

    const fallbackWebSpeech = () => {
      if (abortRef.current) return;
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = char.lang || 'he-IL';
      utt.pitch = char.pitch ?? 1;
      utt.rate = char.rate ?? 1;
      utt.onend = () => { if (!abortRef.current) onDone?.(); };
      utt.onerror = () => { if (!abortRef.current) onDone?.(); };
      synthRef.current.speak(utt);
    };

    const langCode = (char.lang || 'he-IL').split('-')[0];
    // ElevenLabs voices are already gendered — no pitch shift needed
    const playBuf = (buf) => {
      if (abortRef.current) return;
      playArrayBuffer(buf, () => { if (!abortRef.current) onDone?.(); }, fallbackWebSpeech, 1.0);
    };
    // Google TTS is female by default — lower pitch for male characters
    const gttsRate = char.gender === 'female' ? 1.0 : 0.78;
    const playBufGTTS = (buf) => {
      if (abortRef.current) return;
      playArrayBuffer(buf, () => { if (!abortRef.current) onDone?.(); }, fallbackWebSpeech, gttsRate);
    };

    const BASE = getApiBaseUrl();
    fetch(`${BASE}/api/elevenlabs-tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, characterId: char.id, lang: char.lang }),
    })
      .then(r => { if (!r.ok) throw new Error('tts'); return r.arrayBuffer(); })
      .then(playBuf)
      .catch(() => {
        if (langCode === 'he') return googleTTSHebrew(text).then(playBufGTTS).catch(fallbackWebSpeech);
        return elTTSDirect(text, char).then(playBuf).catch(fallbackWebSpeech);
      });
  }, []);

  const sendAudioForTranscription = useCallback(async (blob, char) => {
    if (abortRef.current) return;
    setAiThinking(true);
    try {
      const BASE = getApiBaseUrl();
      const lang = (char.lang || 'he-IL').split('-')[0];
      const res = await fetch(`${BASE}/api/transcribe?lang=${lang}`, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      if (!res.ok) throw new Error('transcribe failed');
      const data = await res.json();
      const text = (data.transcript || '').trim();

      if (!text || abortRef.current) {
        setAiThinking(false);
        setUserTurn(true);
        return;
      }
      animateTypingRef.current?.(text);
      setTranscript(prev => {
        const next = [...prev, { from: 'user', text }];
        askAIRef.current?.(text, next);
        return next;
      });
    } catch {
      if (abortRef.current) return;
      setAiThinking(false);
      setUserTurn(true);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (abortRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        if (abortRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 500) { setUserTurn(true); return; }
        sendAudioForTranscription(blob, charRef.current);
      };
      recorder.start();
      setIsRecording(true);
      setUserTurn(false);
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || e.name === 'NotFoundError') {
        setError('נדרשת הרשאת מיקרופון — אפשר בהגדרות הדפדפן ולחץ שוב.');
      }
      setIsRecording(false);
      setUserTurn(true);
    }
  }, [sendAudioForTranscription]);

  const stopRecording = useCallback(() => {
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const askAI = useCallback(async (userText, history, char) => {
    if (abortRef.current) return;
    setAiThinking(true);
    try {
      const BASE = getApiBaseUrl();
      const res = await fetch(`${BASE}/api/ai-voice-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText, history: history.slice(-8), characterId: char.id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (abortRef.current) return;

      const reply = data.reply || '...';
      const errors = Array.isArray(data.factErrors) ? data.factErrors.filter(Boolean) : [];

      setTranscript(prev => [...prev, { from: 'ai', text: reply }]);
      if (errors.length > 0) {
        const ts = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setFactErrors(prev => [...prev, ...errors.map(e => ({ text: e, time: ts, userSaid: userText }))]);
      }
      setAiThinking(false);
      speak(reply, char, () => { if (!abortRef.current) setUserTurn(true); });
    } catch {
      if (abortRef.current) return;
      setAiThinking(false);
      const fallback = 'מצטער, יש בעיית תקשורת.';
      setTranscript(prev => [...prev, { from: 'ai', text: fallback }]);
      speak(fallback, char, () => { if (!abortRef.current) setUserTurn(true); });
    }
  }, [speak]);

  // Keep ref in sync so startListening can call it
  const charRef = useRef(selectedChar);
  useEffect(() => { charRef.current = selectedChar; }, [selectedChar]);
  askAIRef.current = (text, hist) => askAI(text, hist, charRef.current);

  const startCall = useCallback((char) => {
    abortRef.current = false;
    // Don't invalidate the token when continuing an active preview greeting
    if (!previewActiveRef.current) previewTokenRef.current++;
    setPreviewCharId(null);
    setCallState('active');
    setError(null);
    setTranscript([{ from: 'ai', text: char.greeting }]);
    setFactErrors([]);
    setUserTurn(false);

    // If preview greeting is still playing — let it finish, then give user turn
    if (previewActiveRef.current) {
      pendingCallRef.current = () => { if (!abortRef.current) setUserTurn(true); };
      return;
    }
    // Otherwise speak greeting fresh
    synthRef.current.cancel();
    speak(char.greeting, char, () => { if (!abortRef.current) setUserTurn(true); });
  }, [speak]);

  const sendTextMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || aiThinking || isRecording) return;
    if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null; }
    setInputText('');
    setTranscript(prev => {
      const next = [...prev, { from: 'user', text }];
      askAIRef.current?.(text, next);
      return next;
    });
  }, [inputText, aiThinking, isRecording]);

  const endCall = useCallback(() => {
    abortRef.current = true;
    setIsRecording(false);
    setUserTurn(false);
    if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null; }
    setInputText('');
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    synthRef.current.cancel();
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    setCallState('ended');
    setAiThinking(false);
  }, []);

  useEffect(() => () => {
    abortRef.current = true;
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    synthRef.current?.cancel();
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    clearInterval(callTimerRef.current);
  }, []);

  const isActive = callState === 'active';
  const isCalling = callState === 'calling';
  const isIdle = callState === 'idle' || callState === 'ended';

  const pageRgb    = hexToRgb(PAGE_COLOR);
  const headerRgb  = hexToRgb(HEADER_TITLE_COLOR);
  const selectRgb  = hexToRgb(SELECT_COLOR);

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, #06060e 0%, rgba(${pageRgb},0.08) 50%, #06060e 100%)`,
      display: 'flex', flexDirection: 'column',
      padding: '62px 0 0',
      direction: 'rtl',
      fontFamily: 'var(--font-sans, Rubik, sans-serif)',
      overflow: 'hidden',
      transition: 'background 0.5s ease',
    }}>
      {/* X סגירת עמוד — קבוע, מוצג רק במצב idle */}
      {isIdle && (
        <button
          type="button"
          aria-label="חזור"
          onClick={() => window.history.back()}
          style={{
            position: 'fixed', top: 64, left: 12, zIndex: 200,
            minWidth: 52, height: 44, padding: '0 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.18)',
            color: '#fff', fontSize: '1.35rem', lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(6px)',
          }}
        >✕</button>
      )}
      <style>{`
        @keyframes pulseRing {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanPulse {
          0%,100% { opacity: 0.5; }
          50%     { opacity: 1; }
        }
        @keyframes liveDot {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes waveBar {
          0%,100% { transform: scaleY(0.3); }
          50%     { transform: scaleY(1); }
        }
        .aiv-char-card { transition: all 0.18s ease; }
        .aiv-char-card:hover { transform: translateY(-1px); }
        .aiv-cta-btn { transition: all 0.18s ease; }
        .aiv-cta-btn:hover { transform: scale(1.04); filter: brightness(1.1); }
        .aiv-cta-btn:active { transform: scale(0.97); }
        .aiv-end-btn { transition: all 0.18s ease; }
        .aiv-end-btn:hover { transform: scale(1.04); }
        .aiv-end-btn:active { transform: scale(0.96); }
      `}</style>

      {/* ── Page header ── */}
      <div style={{
        textAlign: 'center', padding: '8px 20px 10px',
        borderBottom: `1px solid rgba(${headerRgb},0.38)`, flexShrink: 0,
      }}>
        <h1 style={{ margin: '0 0 3px', color: HEADER_TITLE_COLOR, fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.01em' }}>
          שיחה קולית עם AI
        </h1>
        <p style={{ margin: '0 0 4px', color: `rgba(${headerRgb},0.95)`, fontSize: '1.04rem', fontWeight: 700, lineHeight: 1.4 }}>
          בדיקת עובדות וטיב הטענות שלך בזמן אמת
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ fontSize: '1.17rem' }}>📞</span>
          <span style={{ color: `rgba(${headerRgb},0.98)`, fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.04em' }}>
            סימולטור שיחה
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* ════════════════ IDLE STATE ════════════════ */}
        {isIdle && (<>

          {/* Page hint */}
          <div style={{
            flexShrink: 0, padding: '10px 16px 8px',
            textAlign: 'center',
            color: `rgba(${pageRgb},0.55)`,
            fontSize: '0.72rem', fontWeight: 600,
            animation: 'fadeUp 0.3s ease',
          }}>
            {lastPreviewedId
              ? 'לחץ שוב על אותו דובר להתחלת שיחה 👆'
              : 'לחץ על דובר — הוא יברך אותך ויזמין לשיחה 👇'}
          </div>

          {/* Character grid — first click = preview, second click = start call */}
          <div style={{ flexShrink: 0, padding: '10px 12px 4px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {lastPreviewedId ? 'לחץ שוב להתחלת שיחה' : 'לחץ על דובר לתצוגה מקדימה'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.63rem' }}>{CHARACTERS.length} דמויות</span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6,
              maxHeight: '32vh', overflowY: 'auto',
              paddingBottom: 2,
            }}>
              {CHARACTERS.map(ch => {
                const sel = lastPreviewedId === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    className="aiv-char-card"
                    onClick={() => {
                      if (lastPreviewedId === ch.id) {
                        // second click → start conversation
                        setLastPreviewedId(null);
                        setSelectedChar(ch);
                        startCall(ch);
                      } else {
                        // first click → preview greeting
                        setLastPreviewedId(ch.id);
                        speakPreview(ch);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                      borderRadius: 11, textAlign: 'right', cursor: 'pointer',
                      border: sel
                        ? `1.5px solid rgba(${selectRgb},0.7)`
                        : '1px solid rgba(255,255,255,0.08)',
                      background: sel
                        ? `rgba(${selectRgb},0.13)`
                        : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <span style={{ fontSize: '1.45rem', lineHeight: 1, flexShrink: 0 }}>{ch.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'block', fontWeight: 700, fontSize: '0.74rem', lineHeight: 1.2,
                        color: '#fff',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{ch.name}</span>
                      <span style={{
                        display: 'block', fontSize: '0.6rem', marginTop: 2,
                        color: 'rgba(255,255,255,0.38)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{ch.desc}</span>
                    </span>
                    <svg viewBox="0 0 16 16" fill="#22c55e" style={{ width: 13, height: 13, flexShrink: 0, opacity: 0.7 }}>
                      <path d="M3.5 2.5h3l1 2.5-1.5 1a7 7 0 0 0 4 4l1-1.5 2.5 1v3a1 1 0 0 1-1 1C6.5 13.5 2.5 9.5 2.5 4.5a1 1 0 0 1 1-2z"/>
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          {/* error */}
          {error && (
            <div style={{
              margin: '4px 16px 0', padding: '7px 14px', borderRadius: 10,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', fontSize: '0.74rem', fontWeight: 600,
            }}>{error}</div>
          )}

          {/* Fact-check teaser */}
          <div style={{
            margin: '0 12px 10px',
            padding: '11px 14px',
            borderRadius: 13,
            background: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.25)',
            display: 'flex', alignItems: 'center', gap: 12,
            animation: 'fadeUp 0.4s ease 0.1s both',
          }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🔍</span>
            <div>
              <div style={{ color: '#86efac', fontWeight: 800, fontSize: '0.78rem', marginBottom: 2 }}>
                בדיקת עובדות בזמן אמת
              </div>
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.68rem', lineHeight: 1.5 }}>
                AI יזהה טעויות עובדתיות בדבריך תוך כדי השיחה ויציג אותן כאן
              </div>
            </div>
          </div>

        </>)}

        {/* ════════════════ ACTIVE / CALLING STATE ════════════════ */}
        {!isIdle && (<>

          {/* Character + status bar */}
          <div style={{
            flexShrink: 0, padding: '10px 14px 8px',
            display: 'flex', alignItems: 'center', gap: 10,
            background: `rgba(${selectRgb},0.08)`,
            borderBottom: `1px solid rgba(${selectRgb},0.15)`,
          }}>
            {/* Avatar with pulse rings */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {isActive && [1, 2].map(i => (
                <span key={i} style={{
                  position: 'absolute', inset: -6 * i, borderRadius: '50%',
                  border: `1px solid rgba(${selectRgb},0.25)`,
                  animation: `pulseRing ${1.2 + i * 0.4}s ease-out infinite`,
                  animationDelay: `${i * 0.3}s`, pointerEvents: 'none',
                }} />
              ))}
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `radial-gradient(circle at 40% 35%, rgba(${selectRgb},0.3), rgba(${selectRgb},0.08))`,
                border: `2px solid rgba(${selectRgb},0.5)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', position: 'relative', zIndex: 1,
              }}>{selectedChar.emoji}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.85rem', lineHeight: 1.2 }}>{selectedChar.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                {isCalling && (
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem' }}>מתחבר...</span>
                )}
                {isActive && (<>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0,
                    animation: 'liveDot 1.2s ease-in-out infinite',
                  }} />
                  <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(callDuration)}
                  </span>
                </>)}
                {/* spacer */}
                <span style={{ flex: 1 }} />
                {isActive && (<>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', marginRight: 4 }}>·</span>
                  {isRecording ? (
                    <span style={{ color: '#ef4444', fontSize: '0.68rem', fontWeight: 700, animation: 'liveDot 1.2s infinite' }}>
                      🎙 מקליט...
                    </span>
                  ) : aiThinking ? (
                    <span style={{ color: SELECT_COLOR, fontSize: '0.68rem', fontWeight: 600, animation: 'scanPulse 0.9s infinite' }}>
                      🤔 עונה...
                    </span>
                  ) : userTurn ? (
                    <span style={{ color: '#4ade80', fontSize: '0.68rem', fontWeight: 600 }}>
                      🎤 תורך לדבר
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {[1,2,3,4].map(i => (
                        <span key={i} style={{
                          display: 'inline-block', width: 2.5, height: 10, borderRadius: 2,
                          background: '#4ade80',
                          animation: `waveBar ${0.5 + i * 0.12}s ease-in-out infinite`,
                          animationDelay: `${i * 0.1}s`,
                        }} />
                      ))}
                      <span style={{ color: '#4ade80', fontSize: '0.68rem', fontWeight: 600, marginRight: 4 }}>מדבר</span>
                    </span>
                  )}
                </>)}
              </div>
            </div>
            {/* כפתורי ניווט + סיום — שמאל */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* חזרה לבחירת דובר */}
              <button
                type="button"
                aria-label="חזור לבחירת דובר"
                onClick={() => { endCall(); setTimeout(() => { setCallState('idle'); setTranscript([]); setFactErrors([]); setUserTurn(false); setIsRecording(false); setLastPreviewedId(null); }, 50); }}
                style={{
                  minHeight: 44,
                  borderRadius: 22,
                  padding: '0 16px',
                  background: 'rgba(255,255,255,0.10)', border: '2px solid rgba(255,255,255,0.25)',
                  color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>דוברים</span>
              </button>
              {/* סיים שיחה */}
              <button
                type="button"
                className="aiv-end-btn"
                onClick={endCall}
                aria-label="סיים שיחה"
                style={{
                  width: 52, height: 52, borderRadius: '50%', border: 'none',
                  cursor: 'pointer', padding: 0, background: 'transparent', flexShrink: 0,
                  filter: 'drop-shadow(0 3px 10px rgba(220,38,38,0.5))',
                }}
              >
                <EndCallIcon />
              </button>
            </div>
          </div>

          {/* Transcript */}
          <div style={{
            flex: '0 0 auto', maxHeight: '30vh', overflowY: 'auto',
            padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {transcript.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 8px', color: 'rgba(255,255,255,0.25)', fontSize: '0.74rem' }}>
                {isCalling ? 'מתחבר לשיחה...' : ''}
              </div>
            )}
            {transcript.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.from === 'user' ? 'flex-start' : 'flex-end',
                animation: 'fadeUp 0.25s ease',
              }}>
                <div style={{
                  maxWidth: '80%', padding: '8px 12px',
                  borderRadius: msg.from === 'user' ? '14px 14px 14px 3px' : '14px 14px 3px 14px',
                  background: msg.from === 'user'
                    ? 'rgba(255,255,255,0.07)'
                    : `rgba(${selectRgb},0.16)`,
                  border: `1px solid ${msg.from === 'user'
                    ? 'rgba(255,255,255,0.09)'
                    : `rgba(${selectRgb},0.28)`}`,
                  color: msg.from === 'user' ? '#cbd5e1' : '#f1f5f9',
                  fontSize: '0.82rem', lineHeight: 1.5, textAlign: 'right',
                }}>
                  <div style={{ fontSize: '0.58rem', opacity: 0.4, marginBottom: 3 }}>
                    {msg.from === 'user' ? '👤 אתה' : `${selectedChar.emoji} ${selectedChar.name.split(' ')[0]}`}
                  </div>
                  {msg.text}
                </div>
              </div>
            ))}
            {aiThinking && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'fadeUp 0.2s ease' }}>
                <div style={{
                  padding: '8px 14px', borderRadius: '14px 14px 3px 14px',
                  background: `rgba(${selectRgb},0.1)`,
                  border: `1px solid rgba(${selectRgb},0.2)`,
                }}>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0,1,2].map(i => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: SELECT_COLOR, display: 'inline-block',
                        animation: 'scanPulse 1.1s ease-in-out infinite',
                        animationDelay: `${i * 0.22}s`,
                      }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* ── Mic push-to-talk button ── */}
          {isActive && (
            <div style={{
              flexShrink: 0, padding: '8px 12px 4px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={aiThinking && !isRecording}
                style={{
                  width: 62, height: 62, borderRadius: '50%',
                  cursor: aiThinking && !isRecording ? 'not-allowed' : 'pointer',
                  padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  background: isRecording
                    ? 'rgba(220,38,38,0.2)'
                    : aiThinking
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(34,197,94,0.14)',
                  border: isRecording
                    ? '2px solid rgba(220,38,38,0.65)'
                    : aiThinking
                      ? '1px solid rgba(255,255,255,0.1)'
                      : '2px solid rgba(34,197,94,0.55)',
                  boxShadow: isRecording
                    ? '0 0 22px rgba(220,38,38,0.45)'
                    : aiThinking
                      ? 'none'
                      : '0 0 16px rgba(34,197,94,0.28)',
                }}
              >
                {isRecording ? (
                  <span style={{ width: 18, height: 18, borderRadius: 3, background: '#ef4444', animation: 'liveDot 1.2s infinite' }} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 28, height: 28 }}>
                    <rect x="9" y="2" width="6" height="11" rx="3" fill={aiThinking ? 'rgba(255,255,255,0.18)' : '#22c55e'} />
                    <path d="M5 11a7 7 0 0 0 14 0" stroke={aiThinking ? 'rgba(255,255,255,0.18)' : '#22c55e'} strokeWidth="2" strokeLinecap="round" />
                    <line x1="12" y1="18" x2="12" y2="22" stroke={aiThinking ? 'rgba(255,255,255,0.18)' : '#22c55e'} strokeWidth="2" strokeLinecap="round" />
                    <line x1="8" y1="22" x2="16" y2="22" stroke={aiThinking ? 'rgba(255,255,255,0.18)' : '#22c55e'} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <span style={{
                fontSize: '0.67rem', fontWeight: 700,
                color: isRecording ? '#ef4444' : aiThinking ? 'rgba(255,255,255,0.3)' : '#4ade80',
              }}>
                {isRecording ? '⏹ לחץ לסיום הקלטה' : aiThinking ? 'ממתין...' : '🎤 לחץ לדבר'}
              </span>
            </div>
          )}

          {/* Text input box */}
          {isActive && (
            <div style={{ flexShrink: 0, padding: '4px 10px 6px', display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendTextMessage()}
                placeholder="ההודעה המוקלטת תופיע כאן..."
                disabled={aiThinking}
                dir="rtl"
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10,
                  padding: '8px 12px', color: '#fff', fontSize: '0.82rem',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={sendTextMessage}
                disabled={!inputText.trim() || aiThinking || isRecording}
                style={{
                  background: inputText.trim() && !aiThinking && !isRecording ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${inputText.trim() && !aiThinking && !isRecording ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10, padding: '8px 14px',
                  color: inputText.trim() && !aiThinking && !isRecording ? '#4ade80' : 'rgba(255,255,255,0.28)',
                  cursor: inputText.trim() && !aiThinking && !isRecording ? 'pointer' : 'not-allowed',
                  fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 700, flexShrink: 0,
                }}
              >שלח</button>
            </div>
          )}

          {/* Fact-check panel */}
          <div style={{
            flex: 1, margin: '0 10px 10px',
            background: factErrors.length > 0
              ? 'rgba(220,38,38,0.07)'
              : 'rgba(34,197,94,0.05)',
            border: `1px solid ${factErrors.length > 0 ? 'rgba(220,38,38,0.28)' : 'rgba(34,197,94,0.22)'}`,
            borderRadius: 14, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', minHeight: 80,
            transition: 'border-color 0.4s, background 0.4s',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              borderBottom: `1px solid ${factErrors.length > 0 ? 'rgba(220,38,38,0.18)' : 'rgba(34,197,94,0.18)'}`,
              background: factErrors.length > 0 ? 'rgba(220,38,38,0.09)' : 'rgba(34,197,94,0.07)',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '0.82rem', animation: aiThinking ? 'scanPulse 0.8s infinite' : 'none' }}>🔍</span>
              <span style={{ color: factErrors.length > 0 ? '#fca5a5' : '#86efac', fontWeight: 800, fontSize: '0.76rem' }}>
                בדיקת עובדות בזמן אמת
              </span>
              {aiThinking && (
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.63rem', animation: 'scanPulse 0.8s infinite' }}>
                  סורק...
                </span>
              )}
              {factErrors.length > 0 && (
                <span style={{
                  marginRight: 'auto', background: '#dc2626', color: '#fff',
                  fontSize: '0.62rem', fontWeight: 900, borderRadius: 20, padding: '2px 8px',
                  boxShadow: '0 0 8px rgba(220,38,38,0.5)',
                }}>{factErrors.length} טעויות</span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {factErrors.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.22)', fontSize: '0.72rem', padding: '14px 8px', lineHeight: 1.7 }}>
                  {callState === 'ended' ? '✅ לא נמצאו טעויות עובדתיות' : '✅ אין טעויות עד כה'}
                </div>
              ) : (
                factErrors.map((err, i) => (
                  <div key={i} style={{
                    padding: '9px 12px',
                    background: 'rgba(220,38,38,0.09)',
                    border: '1px solid rgba(220,38,38,0.25)',
                    borderRadius: 11,
                    animation: 'fadeUp 0.3s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ color: '#f87171', fontSize: '0.66rem', fontWeight: 800 }}>⚠️ טעות #{i + 1}</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.6rem' }}>{err.time}</span>
                    </div>
                    <div style={{ color: '#fecaca', fontSize: '0.79rem', lineHeight: 1.5, textAlign: 'right' }}>{err.text}</div>
                    {err.userSaid && (
                      <div style={{
                        marginTop: 5, padding: '4px 9px',
                        background: 'rgba(0,0,0,0.2)', borderRadius: 7,
                        color: 'rgba(255,255,255,0.33)', fontSize: '0.64rem',
                        borderRight: '2px solid rgba(220,38,38,0.4)', textAlign: 'right',
                      }}>
                        אמרת: &quot;{err.userSaid.length > 60 ? err.userSaid.slice(0, 60) + '…' : err.userSaid}&quot;
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={errorsEndRef} />
            </div>
          </div>

        </>)}

      </div>
    </div>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// Known female voice name fragments (cross-browser)
const FEMALE_VOICE_RE = /zira|susan|victoria|karen|samantha|fiona|moira|tessa|heera|veena|neerja|angelica|monica|paulina|m\xf3nica|julie|helena|hana|laura|ioana|milena|mariam|lekha|kanya|nanami|sin-ji|meijia|satu|yelena|kiri|kyoko|joana|catarina|luciana|female|woman/i;
const MALE_VOICE_RE = /david|mark|daniel|jorge|rodrigo|carlos|enrique|diego|thomas|stephan|yuri|fred|male|man/i;

function pickVoice(voices, lang, gender) {
  const exact = voices.filter(v => v.lang === lang);
  const fuzzy = voices.filter(v => v.lang.startsWith(lang.split('-')[0]));
  const pool = exact.length > 0 ? exact : fuzzy;

  if (gender === 'female') {
    // 1. female voice in exact language
    const inLang = pool.find(v => FEMALE_VOICE_RE.test(v.name));
    if (inLang) return inLang;
    // 2. any female voice across all voices (e.g. Zira en-US works for Hebrew pitch trick)
    const anyFemale = voices.find(v => FEMALE_VOICE_RE.test(v.name));
    if (anyFemale) return anyFemale;
    // 3. non-male in pool
    return pool.find(v => !MALE_VOICE_RE.test(v.name)) || pool[0] || null;
  }

  if (!pool.length) return null;
  return pool.find(v => MALE_VOICE_RE.test(v.name))
    || pool.find(v => !FEMALE_VOICE_RE.test(v.name))
    || pool[0];
}
