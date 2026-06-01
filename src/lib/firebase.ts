import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, logEvent } from 'firebase/analytics'

// Firebase client config — these are client-side identifiers, not server secrets.
// They are intentionally public (Firebase SDK requires them in the browser).
// IMPORTANT: restrict the API key in Firebase console to hub.nonarkara.org and
// city-hub.pages.dev to prevent quota abuse from other origins.
const firebaseConfig = {
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID     || 'unl-city-hub-dev-1',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID          || '1:839839755960:web:6bafacdd63cc43c132ce4d',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET  || 'unl-city-hub-dev-1.firebasestorage.app',
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY         || 'AIzaSyB1DcKIgXdjV5Q35fX6GnRyQj9R37yOziU',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN     || 'unl-city-hub-dev-1.firebaseapp.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_ID    || '839839755960',
}

export const app       = initializeApp(firebaseConfig)
export const db        = getFirestore(app)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null

export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  if (analytics) logEvent(analytics, eventName, eventParams)
}
