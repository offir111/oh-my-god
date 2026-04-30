import React from 'react';

const PHASES = [
  { key: 'text', label: 'טקסט' },
  { key: 'voice', label: 'קולי' },
  { key: 'live', label: 'שיחה' },
];

export default function PhaseIndicator({ phase }) {
  const current = PHASES.findIndex(p => p.key === phase);

  return (
    <div className="phase-ind" role="list" aria-label="שלבי הדיון">
      {PHASES.map((p, i) => (
        <React.Fragment key={p.key}>
          <div
            role="listitem"
            className={
              'phase-ind__step' +
              (i === current ? ' phase-ind__step--active' : '') +
              (i < current ? ' phase-ind__step--done' : '')
            }
          >
            <span aria-hidden="true">{i === 0 ? '💬' : i === 1 ? '🎙️' : '📞'} </span>
            {p.label}
          </div>
          {i < PHASES.length - 1 && (
            <div
              className={'phase-ind__line' + (i < current ? ' phase-ind__line--done' : '')}
              aria-hidden="true"
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
