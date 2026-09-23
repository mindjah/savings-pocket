import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { pad2 } from '../../lib/format'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { tPlanCopyName } from '../../i18n/translations'
import { PlanEditorModal, PlanEditorScreen } from './PlanEditorModal'

interface Props {
  onClose: () => void
}

// Shared by both entry points below — a bottom sheet on mobile (opened from
// Spending's Manage menu) and a full desktop-sidebar page (see NavBar's
// desktopOnly tabs). Same content and state either way; only the
// surrounding chrome (Modal vs. a plain .view page) differs.
function PlanningInner({
  onClose,
  asScreen,
  onDirtyChange,
}: {
  onClose?: () => void
  asScreen?: boolean
  // Desktop-only (see App.tsx): lets the nav bar warn before switching away
  // from this page while it has unsaved changes — either the not-yet-created
  // new plan name here, or (once a plan is open) that plan editor's own.
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { t, lang } = useTranslation()
  const toast = useToast()
  const plans = useLiveQuery(() => db.plans.toArray(), []) ?? []
  const sortedPlans = [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const [newName, setNewName] = useState('')
  const [copyFromPlanId, setCopyFromPlanId] = useState<number | null>(null)
  const [openPlanId, setOpenPlanId] = useState<number | null>(null)

  // Only meaningful while the plan list itself is showing — once a plan is
  // open, PlanEditorScreen reports its own dirty state directly instead.
  useEffect(() => {
    if (!asScreen || openPlanId != null) return
    onDirtyChange?.(newName.trim() !== '')
    return () => onDirtyChange?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newName, asScreen, openPlanId])

  async function createPlan() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const now = new Date()
    const nowIso = now.toISOString()
    // Always the real current month, even when copying an older plan's line
    // items — appliesMonth is about what THIS plan is compared against, not
    // a property of the plan it was copied from.
    const appliesMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`

    let id!: number
    await db.transaction('rw', db.plans, db.plannedIncome, db.plannedExpenses, async () => {
      id = await db.plans.add({ name: trimmed, createdAt: nowIso, updatedAt: nowIso, appliesMonth })
      if (copyFromPlanId != null) {
        const [incomeRows, expenseRows] = await Promise.all([
          db.plannedIncome.where('planId').equals(copyFromPlanId).toArray(),
          db.plannedExpenses.where('planId').equals(copyFromPlanId).toArray(),
        ])
        if (incomeRows.length > 0) {
          await db.plannedIncome.bulkAdd(
            incomeRows.map(({ id: _oldId, ...row }) => ({ ...row, planId: id, createdAt: nowIso, updatedAt: nowIso })),
          )
        }
        if (expenseRows.length > 0) {
          await db.plannedExpenses.bulkAdd(
            expenseRows.map(({ id: _oldId, ...row }) => ({ ...row, planId: id, createdAt: nowIso, updatedAt: nowIso })),
          )
        }
      }
    })

    setNewName('')
    setCopyFromPlanId(null)
    toast(t('Plan created'))
    setOpenPlanId(id)
  }

  const body = (
    <>
      <p className="muted" style={{ marginTop: -4 }}>
        {t(
          'A sandbox to see what you can afford this month — separate from your real pockets and spending until it actually happens. Save multiple named plans to compare.',
        )}
      </p>

      <label className="section-subheader">{t('Existing plans')}</label>
      {sortedPlans.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🗂️</span>
          {t('No plans yet. Create one below to start sketching out a month.')}
        </div>
      ) : (
        <div className="category-list">
          {sortedPlans.map((p) => (
            <button className="menu-row" key={p.id} type="button" onClick={() => setOpenPlanId(p.id ?? null)}>
              <span style={{ flex: 1 }}>{p.name}</span>
              <span className="muted">›</span>
            </button>
          ))}
        </div>
      )}

      {sortedPlans.length > 0 && (
        <div className="form-group">
          <label htmlFor="copyFromPlan">{t('Copy from')}</label>
          <select
            id="copyFromPlan"
            value={copyFromPlanId ?? ''}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : null
              setCopyFromPlanId(value)
              // Only when the name is still untouched — never overwrite
              // something the user already typed themselves.
              if (value != null && !newName.trim()) {
                const source = sortedPlans.find((p) => p.id === value)
                if (source) setNewName(tPlanCopyName(lang, source.name))
              }
            }}
          >
            <option value="">{t('Start empty')}</option>
            {sortedPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            {t("Copies that plan's income and planned expenses as a starting point — this month's own totals, not that plan's.")}
          </p>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="newPlanName">{t('New plan name')}</label>
        <input
          id="newPlanName"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createPlan()}
          placeholder={t('e.g. Typical month')}
        />
      </div>
      <button className="btn btn-primary btn-block" onClick={createPlan} disabled={!newName.trim()} type="button">
        {t('Create plan')}
      </button>
    </>
  )

  if (asScreen) {
    return (
      <div className="view boucoup-scope">
        {openPlanId != null ? (
          <PlanEditorScreen
            planId={openPlanId}
            onClose={() => setOpenPlanId(null)}
            onDirtyChange={onDirtyChange}
          />
        ) : (
          body
        )}
      </div>
    )
  }

  return (
    <>
      <Modal wide title={t('Planning sandbox')} onClose={onClose!} hasUnsavedChanges={newName.trim() !== ''}>
        {body}
      </Modal>

      {openPlanId != null && <PlanEditorModal planId={openPlanId} onClose={() => setOpenPlanId(null)} />}
    </>
  )
}

export function PlanningModal({ onClose }: Props) {
  return <PlanningInner onClose={onClose} />
}

// Desktop-only full page (see NavBar) — same content as PlanningModal,
// laid out like Spending/Savings/Settings instead of as a bottom sheet.
export function PlanningScreen({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  return <PlanningInner asScreen onDirtyChange={onDirtyChange} />
}
