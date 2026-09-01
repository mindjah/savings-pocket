import * as React from 'react';
export interface CardProps {
  children?: React.ReactNode;
  padding?: number | string;
  className?: string;
  style?: React.CSSProperties;
}
export declare const Card: React.FC<CardProps>;
export default Card;
