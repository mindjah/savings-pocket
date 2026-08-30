import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Category } from '../../db/types'
import { CATEGORY_COLORS } from '../../lib/constants'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { tCategoryArchiveHint, tDeleteCategoryConfirm } from '../../i18n/translations'

interface Props {
  onClose: () => void
}

interface EditCategoryModalProps {
  category: Category
  onSave: (name: string, color: string) => void
  onToggleArchive: () => void
  onDelete: () => Promise<boolean>
  onClose: () => void
}

function EditCategoryModal({ category, onSave, onToggleArchive, onDelete, onClose }: EditCategoryModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  const valid = name.trim().length > 0

  function submit() {
    if (!valid) return
    onSave(name.trim(), color)
    onClose()
  }

  function handleArchive() {
    onToggleArchive()
    onClose()
  }

  async function handleDelete() {
    const deleted = await onDelete()
    if (deleted) onClose()
  }

  return (
    <Modal title={t('Category')} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="editCatName">{t('Name')}</label>
        <input
          id="editCatName"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <div className="swatch-picker">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch-btn${color === c ? ' selected' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={`Pick color ${c}`}
          />
        ))}
      </div>
      <button className={`btn btn-block${valid ? ' btn-primary' : ''}`} onClick={submit} disabled={!valid} type="button">
        {t('Save')}
      </button>
      <div className="modal-actions" style={{ marginTop: 8 }}>
        <button className="btn" onClick={handleArchive} type="button">
          {category.archived ? t('Unarchive') : t('Archive')}
        </button>
        <button className="btn btn-danger" onClick={handleDelete} type="button">
          {t('Delete')}
        </button>
      </div>
    </Modal>
  )
}

export function CategoryManagerModal({ onClose }: Props) {
  const { t, lang } = useTranslation()
  const categories = useLiveQuery(
    async () => (await db.categories.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )
  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [editingId, setEditingId] = useState<number | null>(null)
  const toast = useToast()

  async function addCategory() {
    const trimmed = name.trim()
    if (!trimmed) return
    await db.categories.add({ name: trimmed, color, archived: false, createdAt: new Date().toISOString() })
    toast(t('Category added'))
    onClose()
  }

  async function toggleArchive(cat: Category) {
    if (!cat.id) return
    await db.categories.update(cat.id, { archived: !cat.archived })
  }

  // Returns whether the category was actually deleted — blocked (existing
  // spending entries) or declined at the confirm prompt both return false,
  // so the caller knows whether to keep the edit popup open.
  async function removeCategory(cat: Category): Promise<boolean> {
    if (!cat.id) return false
    const count = await db.spendingEntries.where('categoryId').equals(cat.id).count()
    if (count > 0) {
      alert(tCategoryArchiveHint(lang, cat.name, count))
      return false
    }
    if (!confirm(tDeleteCategoryConfirm(lang, cat.name))) return false
    await db.categories.delete(cat.id)
    return true
  }

  async function saveEdit(id: number, name: string, color: string) {
    await db.categories.update(id, { name, color })
    toast(t('Category updated'))
  }

  return (
    <>
      <Modal title={t('Manage categories')} onClose={onClose}>
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label htmlFor="catName">{t('New category')}</label>
            <input
              id="catName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g. Groceries')}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            />
          </div>
        </div>
        <div className="swatch-picker">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch-btn${color === c ? ' selected' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Pick color ${c}`}
            />
          ))}
        </div>
        <button className="btn btn-primary btn-block" onClick={addCategory} disabled={!name.trim()} type="button">
          {t('Add category')}
        </button>

        <div className="category-list">
          {categories?.map((cat) => (
            <button className="category-row as-button" key={cat.id} onClick={() => setEditingId(cat.id ?? null)} type="button">
              <span className="swatch" style={{ background: cat.color }} />
              <span style={{ flex: 1, opacity: cat.archived ? 0.5 : 1 }}>
                {cat.name} {cat.archived && <span className="muted">{t('(archived)')}</span>}
              </span>
            </button>
          ))}
          {categories?.length === 0 && (
            <div className="muted">{t('No categories yet — add your first one above.')}</div>
          )}
        </div>
      </Modal>

      {editingId != null &&
        (() => {
          const cat = categories?.find((c) => c.id === editingId)
          if (!cat) return null
          return (
            <EditCategoryModal
              category={cat}
              onSave={(name, color) => saveEdit(cat.id!, name, color)}
              onToggleArchive={() => toggleArchive(cat)}
              onDelete={() => removeCategory(cat)}
              onClose={() => setEditingId(null)}
            />
          )
        })()}
    </>
  )
}
