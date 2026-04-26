import React, { useRef } from 'react';

export default function MessageBubble({ msg, mySide }) {
  const isMe = msg.side === mySide;
  const isBeliever = msg.side === 'believer';
  const color = isBeliever ? 'var(--believer)' : 'var(--atheist)';
  const dimColor = isBeliever ? 'var(--believer-dim)' : 'var(--atheist-dim)';

  if (msg.audioB64 || msg.isAIText) {
    return <VoiceBubble msg={msg} isMe={isMe} color={color} dimColor={dimColor} />;
  }

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
      <div style={{
        maxWidth: '72%',
        background: isMe ? dimColor : '#1e1e1e',
        border: `1px solid ${isMe ? color : '#333'}`,
        borderRadius: 14,
        padding: '12px 16px',
        color: '#fff',
        lineHeight: 1.6,
        fontSize: '0.97rem',
        animation: 'fadeIn 0.25s ease',
      }}>
        <div style={{ fontSize: '0.72rem', color, fontWeight: 700, marginBottom: 4 }}>
          {msg.side === 'believer' ? '🔴 מאמין' : '🟢 אתאיסט'}
          {msg.isAI && ' (AI)'}
        </div>
        {msg.content}
      </div>
    </div>
  );
}

function VoiceBubble({ msg, isMe, color, dimColor }) {
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
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
      <div style={{
        background: isMe ? dimColor : '#1e1e1e',
        border: `1px solid ${isMe ? color : '#333'}`,
        borderRadius: 14,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        animation: 'fadeIn 0.25s ease',
      }}>
        <div style={{ fontSize: '0.72rem', color, fontWeight: 700 }}>
          {msg.side === 'believer' ? '🔴 מאמין' : '🟢 אתאיסט'}
          {msg.isAI && ' (AI)'}
        </div>
        <button onClick={play} style={{
          background: color,
          border: 'none',
          borderRadius: '50%',
          width: 36, height: 36,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem', color: '#fff',
        }}>▶</button>
        <span style={{ color: '#888', fontSize: '0.8rem' }}>
          {msg.isAIText ? '🤖 AI' : `🎙️ ${msg.duration}s`}
        </span>
        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
