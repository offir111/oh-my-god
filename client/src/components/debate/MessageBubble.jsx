import React, { useEffect, useRef, useState } from 'react';

const AI_PREVIEW_WORD_LIMIT = 40;

function getAiPreview(content) {
  const text = String(content || '');
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= AI_PREVIEW_WORD_LIMIT) {
    return { text, isTruncated: false };
  }
  return {
    text: words.slice(0, AI_PREVIEW_WORD_LIMIT).join(' '),
    isTruncated: true,
  };
}

export default function MessageBubble({ msg, mySide }) {
  const [expanded, setExpanded] = useState(false);
  const isBeliever = msg.side === 'believer';
  const sideClass = isBeliever ? 'believer' : 'atheist';
  const aiPreview = msg.isAI ? getAiPreview(msg.content) : { text: msg.content, isTruncated: false };
  const visibleContent = msg.isAI && !expanded ? aiPreview.text : msg.content;

  if (msg.audioB64 || msg.isAIText) {
    return <VoiceBubble msg={msg} sideClass={sideClass} />;
  }

  return (
    <div className="msg-row">
      <div className={`msg-bubble msg-bubble--${sideClass}`}>
        <div className="msg-bubble__meta">
          {msg.side === 'believer' ? 'מאמין' : 'אתאיסט'}
          {msg.isAI && ' · AI'}
        </div>
        <div style={{ direction: 'rtl', textAlign: 'right' }}>
          {visibleContent}
          {msg.isAI && aiPreview.isTruncated && !expanded && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  fontWeight: 900,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                המשך
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VoiceBubble({ msg, sideClass }) {
  const audioRef = useRef(null);

  useEffect(() => () => {
    if (audioRef.current?.dataset.url) URL.revokeObjectURL(audioRef.current.dataset.url);
  }, []);

  function play() {
    if (msg.isAIText) {
      const utter = new SpeechSynthesisUtterance(msg.content);
      utter.lang = 'he-IL';
      utter.rate = 0.95;
      speechSynthesis.speak(utter);
      return;
    }
    if (!msg.audioB64) return;
    try {
      const binary = atob(msg.audioB64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        if (audioRef.current.dataset.url) URL.revokeObjectURL(audioRef.current.dataset.url);
        audioRef.current.dataset.url = url;
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
      }
    } catch {
      // Ignore malformed audio payloads instead of breaking the debate screen.
    }
  }

  return (
    <div className="msg-voice-wrap">
      <div className={`msg-voice-bubble msg-voice-bubble--${sideClass}`}>
        <div className="msg-bubble__meta">
          {msg.side === 'believer' ? 'מאמין' : 'אתאיסט'}
          {msg.isAI && ' · AI'}
        </div>
        <button
          type="button"
          className={`msg-play-btn msg-play-btn--${sideClass}`}
          onClick={play}
          aria-label="השמע הודעה"
        >
          ▶
        </button>
        <span className="msg-voice-meta">
          {msg.isAIText ? 'AI' : `${msg.duration}s`}
        </span>
        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
