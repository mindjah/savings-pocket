import React from 'react';

/**
 * Boucoup GoalCard — savings goal with optional photo header + purple progress.
 * Mirrors the Figma Goal card family (Property 1 · Picture).
 */
export function GoalCard({ pic, title = 'New Goal', saved = '$0.00', goal = '$100.00', pct = 0, done = false, className, style }) {
  return (
    <div className={className} style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0px 6px 16px 0px rgba(0,0,0,0.08)', ...style }}>
      {pic && <div style={{ height: 120, backgroundImage: `url(${pic})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
      <div style={{ background: done ? 'var(--lavender)' : '#fff', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, lineHeight: '30px', letterSpacing: '1px', color: 'var(--purple-deep)' }}>{title}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="var(--purple-deep)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '12px 0 8px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--purple-deep)' }}>{saved} saved</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: done ? 'var(--green-500)' : 'var(--purple-deep)' }}>{done ? 'Reached!' : `Goal is ${goal}`}</span>
        </div>
        <div style={{ height: 6, borderRadius: 12, background: done ? '#fff' : 'var(--grey-200)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 12, background: 'var(--gradient-goal)' }} />
        </div>
      </div>
    </div>
  );
}

export default GoalCard;
