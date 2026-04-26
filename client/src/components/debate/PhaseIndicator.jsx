import React from 'react';

const PHASES = [
  { key: 'text',  label: '💬 טקסט' },
  { key: 'voice', label: '🎙️ קולי' },
  { key: 'live',  label: '📞 שיחה' },
];

export default function PhaseIndicator({ phase }) {
  const current = PHASES.findIndex(p => p.key === phase);

  return (
    <div style={styles.wrap}>
      {PHASES.map((p, i) => (
        <React.Fragment key={p.key}>
          <div style={{
            ...styles.step,
            background: i <= current ? (i === current ? '#fff' : '#555') : '#222',
            color: i === current ? '#000' : i < current ? '#aaa' : '#555',
            fontWeight: i === current ? 700 : 400,
            transform: i === current ? 'scale(1.08)' : 'scale(1)',
          }}>
            {p.label}
          </div>
          {i < PHASES.length - 1 && (
            <div style={{ ...styles.line, background: i < current ? '#555' : '#222' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '12px 0',
  },
  step: {
    padding: '6px 16px',
    borderRadius: 99,
    fontSize: '0.85rem',
    transition: 'all 0.3s',
    whiteSpace: 'nowrap',
  },
  line: {
    width: 30,
    height: 2,
    borderRadius: 1,
    transition: 'background 0.3s',
  },
};
