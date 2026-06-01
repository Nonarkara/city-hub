import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export interface DraftAction {
  id: string
  district: string
  text: string
  status: 'draft' | 'approved' | 'dismissed'
  createdAt: number // ms since epoch or null
}

export async function saveDraftAction(districtName: string, text: string) {
  try {
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
  const q = query(
    collection(db, 'actions'),
    where('status', '==', 'draft'),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
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
}

export async function updateActionStatus(id: string, status: 'approved' | 'dismissed') {
  try {
    const docRef = doc(db, 'actions', id)
    await updateDoc(docRef, { status })
  } catch (e) {
    console.error('Error updating action status:', e)
    throw e
  }
}
