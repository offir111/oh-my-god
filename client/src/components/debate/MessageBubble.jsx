import React, { useRef } from 'react';

export default function MessageBubble({ msg, mySide }) {
  const isBeliever = msg.side === 'believer';
  const sideClass = isBeliever ? 'believer' : 'atheist';

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
        <div style={{ direction: 'rtl', textAlign: 'right' }}>{msg.content}</div>
      </div>
    </div>
  );
}

function VoiceBubble({ msg, sideClass }) {
  const audioRef = useRef(null);

  function play() {
    if (msg.isAIText) {
      const utter = new SpeechSynthesisUtterance(msg.content);
      utter.lang = 'he-IL';
      utter.rate = 0.95;
      speechSynthesis.speak(utter);
      return;
    }
    if (!msg.audioB64) return;
    const binary = atob(msg.audioB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play();
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
