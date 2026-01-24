const DB_NAME = 'healthreport'
const STORE_NAME = 'report-cache'

let dbPromise: Promise<IDBDatabase> | null = null

const openDb = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return dbPromise
}

export const idbStorage = {
  async getItem(name: string) {
    const db = await openDb()
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(name)
      request.onsuccess = () => resolve((request.result as string) ?? null)
      request.onerror = () => reject(request.error)
    })
  },
  async setItem(name: string, value: string) {
    const db = await openDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(value, name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },
  async removeItem(name: string) {
    const db = await openDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },
}
