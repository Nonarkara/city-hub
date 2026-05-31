import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export async function saveDraftAction(districtName: string, text: string) {
  try {
    const docRef = await addDoc(collection(db, 'actions'), {
      district: districtName,
      text,
      status: 'draft',
      createdAt: serverTimestamp(),
    })
    console.log('Action drafted with ID: ', docRef.id)
    return docRef.id
  } catch (e) {
    console.error('Error adding draft action: ', e)
    throw e
  }
}
