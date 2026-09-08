import type { MoneyType, PocketIconKind } from '../../db/types'
import { CashIcon } from './CashIcon'
import { CardIcon } from './CardIcon'

interface Props {
  // A pocket's own chosen icon, when set — falls back to its Cash/Account
  // type (matching pre-existing pockets from before this icon choice
  // existed) when it isn't.
  icon?: PocketIconKind
  fallbackType: MoneyType
  size?: number
}

export function PocketIcon({ icon, fallbackType, size = 24 }: Props) {
  const resolved = icon ?? fallbackType
  if (resolved === 'cash') return <CashIcon size={size} />
  if (resolved === 'card') return <CardIcon size={size} />
  // FontAwesome icons are sized via font-size (not a width/height prop like
  // the SVG icons above) — without setting it explicitly here, these were
  // inheriting whatever ambient font-size their container happened to have,
  // rendering noticeably smaller than the other two.
  if (resolved === 'pig') return <i className="fa-solid fa-piggy-bank" style={{ fontSize: size }} aria-hidden="true" />
  return <i className="fa-solid fa-vault" style={{ fontSize: size }} aria-hidden="true" />
}
