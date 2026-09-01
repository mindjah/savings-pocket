import React from 'react';

/**
 * Boucoup AccountListItem — a row: leading tinted icon, title/subtitle, trailing amount.
 * Mirrors the Figma Account List Item / Transactions Item families (Type · State).
 */
export function AccountListItem({ icon, tint = 'var(--brand-accent)', iconColor = 'var(--brand-primary)', title = 'Item', sub, amount, positive, trailing, onClick, className, style }) {
  return (
    <div className={className} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14, background: '#fff',
      border: '1px solid var(--border-hairline)', borderRadius: 16, padding: '14px 16px',
      boxShadow: '0px 4px 12px 0px rgba(16,16,16,0.06)', cursor: onClick ? 'pointer' : 'default', boxSizing: 'border-box', ...style,
    }}>
      {icon && <span style={{ width: 44, height: 44, borderRadius: '50%', background: tint, color: iconColor, display: 'grid', placeItems: 'center', fontSize: 17, flex: 'none' }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, lineHeight: '24px', color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: '19px', color: 'var(--grey-600)' }}>{sub}</div>}
      </div>
      {trailing ?? (amount && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: positive ? 'var(--green-500)' : 'var(--fg-1)', whiteSpace: 'nowrap' }}>{amount}</span>)}
    </div>
  );
}

export default AccountListItem;
