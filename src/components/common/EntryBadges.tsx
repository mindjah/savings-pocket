import { RecurringIcon } from './RecurringIcon'
import { UpcomingIcon } from './UpcomingIcon'

interface Props {
  recurring?: boolean
  // Only meaningful when recurring is true: has this occurrence's date
  // already arrived (green) or is it still ahead (grey)?
  recurringHappened?: boolean
  upcoming?: boolean
  size?: number
  className?: string
}

// Small indicator icon shown next to (or on) an expense — recurring takes
// priority over upcoming (showing both together on the same date read as
// redundant/confusing), so a recurring expense's not-yet-due occurrence
// shows only the round-arrow, never the up-arrow too.
export function EntryBadges({ recurring, recurringHappened, upcoming, size = 12, className }: Props) {
  if (!recurring && !upcoming) return null
  return (
    <span className={`entry-badge-icons${className ? ` ${className}` : ''}`}>
      {recurring ? (
        // RecurringIcon is a thin ring shape (lots of hollow space) next to
        // UpcomingIcon's more solid glyph — both fill their own viewBox
        // equally, but the ring reads visibly smaller at the same nominal
        // size, so it's rendered a bit larger to look the same.
        <span style={{ color: recurringHappened ? 'var(--accent)' : undefined }}>
          <RecurringIcon size={Math.round(size * 1.25)} />
        </span>
      ) : (
        upcoming && <UpcomingIcon size={size} />
      )}
    </span>
  )
}
