import { getDb } from './firebase'

// Firestore is lazy-loaded via getDb()/dynamic import — see lib/firebase.ts.
// Each function pulls the SDK only when actually invoked.

export interface DraftAction {
  id: string
  district: string
  text: string
  status: 'draft' | 'approved' | 'dismissed'
  createdAt: number // ms since epoch or null
}

export async function saveDraftAction(districtName: string, text: string) {
  try {
    const [db, { collection, addDoc, serverTimestamp }] = await Promise.all([
      getDb(), import('firebase/firestore'),
    ])
    const docRef = await addDoc(collection(db, 'actions'), {
      district: districtName,
      text,
      status: 'draft',
      createdAt: serverTimestamp(),
    })
    return docRef.id
  } catch (e) {
    console.error('Error adding draft action: ', e)
    throw e
  }
}

export function subscribeToActions(onUpdate: (actions: DraftAction[]) => void) {
  let unsubscribe: (() => void) | null = null
  let cancelled = false

  Promise.all([getDb(), import('firebase/firestore')]).then(([db, fs]) => {
    if (cancelled) return
    const q = fs.query(
      fs.collection(db, 'actions'),
      fs.where('status', '==', 'draft'),
      fs.orderBy('createdAt', 'desc')
    )
    unsubscribe = fs.onSnapshot(q, (snapshot) => {
      const actions: DraftAction[] = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          district: data.district,
          text: data.text,
          status: data.status,
          // Fallback to Date.now() if serverTimestamp is still pending
          createdAt: data.createdAt?.toMillis() ?? Date.now()
        }
      })
      onUpdate(actions)
    }, (err) => {
      console.error('Error subscribing to actions:', err)
    })
  }).catch((err) => {
    console.error('Error initializing actions subscription:', err)
  })

  return () => { cancelled = true; unsubscribe?.() }
}

export async function updateActionStatus(id: string, status: 'approved' | 'dismissed') {
  try {
    const [db, { doc, updateDoc }] = await Promise.all([
      getDb(), import('firebase/firestore'),
    ])
    const docRef = doc(db, 'actions', id)
    await updateDoc(docRef, { status })
  } catch (e) {
    console.error('Error updating action status:', e)
    throw e
  }
}
