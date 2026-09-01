import React from 'react';

/**
 * Boucoup AccountSummary — the flat-indigo balance card from the home hub.
 * bg #4451A2, radius 20. Nunito ExtraBold balance, lavender label.
 * Mirrors the Figma Account Summary family (View).
 */
export function AccountSummary({
  label = 'Available Balance', amount = '10,000.00', name = 'Member Savings *8754',
  frozen, cardNo = '2345', className, style,
}) {
  const [whole, dec = '00'] = String(amount).split('.');
  return (
    <div className={className} style={{
      background: 'var(--brand-primary)', borderRadius: 20, padding: 24, color: '#fff', position: 'relative', ...style,
    }}>
      {frozen && (
        <span style={{
          position: 'absolute', top: 24, right: 24, display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--brand-secondary)', borderRadius: 999, padding: '4px 12px',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
        }}>{frozen} *{cardNo}</span>
      )}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 14, lineHeight: '20px', letterSpacing: '0.1px', color: 'var(--brand-accent)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '1px', lineHeight: '44px', margin: '2px 0 4px' }}>
        <span style={{ fontSize: 24 }}>$</span><span style={{ fontSize: 32 }}>{whole}</span><span style={{ fontSize: 20 }}>.{dec}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, lineHeight: '28px' }}>{name}</div>
    </div>
  );
}

export default AccountSummary;
