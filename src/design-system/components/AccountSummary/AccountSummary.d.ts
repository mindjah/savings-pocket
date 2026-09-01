import * as React from 'react';
export interface AccountSummaryProps {
  label?: string;
  amount?: string;
  name?: string;
  /** Frozen-card indicator node (e.g. a snowflake icon); omit to hide the pill. */
  frozen?: React.ReactNode;
  cardNo?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare const AccountSummary: React.FC<AccountSummaryProps>;
export default AccountSummary;
