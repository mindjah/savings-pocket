import * as React from 'react';
export interface AccountListItemProps {
  icon?: React.ReactNode;
  tint?: string;
  iconColor?: string;
  title?: string;
  sub?: string;
  amount?: string;
  positive?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
export declare const AccountListItem: React.FC<AccountListItemProps>;
export default AccountListItem;
