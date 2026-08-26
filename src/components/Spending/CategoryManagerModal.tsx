import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Category } from '../../db/types'
import { CATEGORY_COLORS } from '../../lib/constants'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'

interface Props {
  onClose: () => void
}

export function CategoryManagerModal({ onClose }: Props) {
  const categories = useLiveQuery(
    async () => (await db.categories.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )
  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const toast = useToast()

  async function addCategory() {
    const trimmed = name.trim()
    if (!trimmed) return
    await db.categories.add({ name: trimmed, color, archived: false, createdAt: new Date().toISOString() })
    toast('Category added')
    onClose()
  }

  async function toggleArchive(cat: Category) {
    if (!cat.id) return
    await db.categories.update(cat.id, { archived: !cat.archived })
  }

  async function removeCategory(cat: Category) {
    if (!cat.id) return
    const count = await db.spendingEntries.where('categoryId').equals(cat.id).count()
    if (count > 0) {
      alert(`"${cat.name}" has ${count} spending entries. Archive it instead of deleting so history stays intact.`)
      return
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return
    await db.categories.delete(cat.id)
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id ?? null)
    setEditName(cat.name)
    setEditColor(cat.color)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit() {
    if (editingId == null) return
    const trimmed = editName.trim()
    if (!trimmed) return
    await db.categories.update(editingId, { name: trimmed, color: editColor })
    toast('Category updated')
    setEditingId(null)
  }

  return (
    <Modal title="Manage categories" onClose={onClose}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label htmlFor="catName">New category</label>
          <input
            id="catName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries"
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
        Add category
      </button>

      <div className="category-list">
        {categories?.map((cat) =>
          editingId === cat.id ? (
            <div
              className="category-row"
              key={cat.id}
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
            >
              <div className="form-group">
                <label htmlFor={`editCatName-${cat.id}`}>Name</label>
                <input
                  id={`editCatName-${cat.id}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                />
              </div>
              <div className="swatch-picker">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch-btn${editColor === c ? ' selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setEditColor(c)}
                    aria-label={`Pick color ${c}`}
                  />
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={cancelEdit} type="button">
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={saveEdit} disabled={!editName.trim()} type="button">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="category-row" key={cat.id}>
              <span className="swatch" style={{ background: cat.color }} />
              <span style={{ flex: 1, opacity: cat.archived ? 0.5 : 1 }}>
                {cat.name} {cat.archived && <span className="muted">(archived)</span>}
              </span>
              <div className="icon-btn-row">
                <button className="btn btn-ghost btn-icon" onClick={() => startEdit(cat)} type="button">
                  ✎
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => toggleArchive(cat)} type="button">
                  {cat.archived ? '↺' : '🗄'}
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => removeCategory(cat)} type="button">
                  🗑
                </button>
              </div>
            </div>
          ),
        )}
        {categories?.length === 0 && <div className="muted">No categories yet — add your first one above.</div>}
      </div>
    </Modal>
  )
}
