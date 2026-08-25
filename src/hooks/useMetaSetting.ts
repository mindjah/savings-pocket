import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export function useMetaSetting<T>(key: string, defaultValue: T) {
  const value = useLiveQuery(async () => {
    const rec = await db.meta.get(key)
    return rec ? (rec.value as T) : defaultValue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function setValue(next: T) {
    await db.meta.put({ key, value: next })
  }

  return [value ?? defaultValue, setValue] as const
}
