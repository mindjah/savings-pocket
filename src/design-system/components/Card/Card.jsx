import React from 'react';

/**
 * Boucoup Card — generic surface. White, radius 16, hairline + soft shadow.
 */
export function Card({ children, padding = 16, className, style }) {
  return (
    <div className={className} style={{
      background: '#fff', border: '1px solid var(--border-hairline)',
      borderRadius: 16, boxShadow: '0px 6px 16px 0px rgba(0,0,0,0.08)',
      padding, boxSizing: 'border-box', ...style,
    }}>{children}</div>
  );
}

export default Card;
