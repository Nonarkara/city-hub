import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Firebase client config — these are client-side identifiers, not server secrets.
// Restrict the API key in Firebase console to hub.nonarkara.org + city-hub.pages.dev.
const firebaseConfig = {
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID     || 'unl-city-hub-dev-1',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID          || '1:839839755960:web:6bafacdd63cc43c132ce4d',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET  || 'unl-city-hub-dev-1.firebasestorage.app',
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY         || 'AIzaSyB1DcKIgXdjV5Q35fX6GnRyQj9R37yOziU',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN     || 'unl-city-hub-dev-1.firebaseapp.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_ID    || '839839755960',
}

export const app = initializeApp(firebaseConfig)
export const db  = getFirestore(app)

// Analytics is lazy-loaded — never blocks initial paint.
// Deferred until after first user interaction via dynamic import.
export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window === 'undefined' || !import.meta.env.PROD) return
  import('firebase/analytics').then(({ getAnalytics, logEvent }) => {
    try {
      const analytics = getAnalytics(app)
      logEvent(analytics, eventName, eventParams)
    } catch { /* analytics unavailable */ }
  }).catch(() => {})
}
