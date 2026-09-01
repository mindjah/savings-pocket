import * as React from 'react';
export interface GoalCardProps {
  pic?: string;
  title?: string;
  saved?: string;
  goal?: string;
  pct?: number;
  done?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export declare const GoalCard: React.FC<GoalCardProps>;
export default GoalCard;
