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

// The Firebase SDK (~150 KB gzip) is lazy-loaded: nothing here runs at startup.
// App + Firestore initialize on first real use (chat, action center, analytics),
// keeping the firebase chunk off the critical path.
import type { FirebaseApp } from 'firebase/app'
import type { Firestore } from 'firebase/firestore'

let appPromise: Promise<FirebaseApp> | null = null
export function getFirebaseApp(): Promise<FirebaseApp> {
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp }) => initializeApp(firebaseConfig))
  }
  return appPromise
}

let dbPromise: Promise<Firestore> | null = null
export function getDb(): Promise<Firestore> {
  if (!dbPromise) {
    dbPromise = Promise.all([getFirebaseApp(), import('firebase/firestore')])
      .then(([app, { getFirestore }]) => getFirestore(app))
  }
  return dbPromise
}

// Analytics is lazy-loaded — never blocks initial paint.
// Deferred until the first tracked event via dynamic import.
export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window === 'undefined' || !import.meta.env.PROD) return
  Promise.all([getFirebaseApp(), import('firebase/analytics')]).then(([app, { getAnalytics, logEvent }]) => {
    try {
      const analytics = getAnalytics(app)
      logEvent(analytics, eventName, eventParams)
    } catch { /* analytics unavailable */ }
  }).catch(() => {})
}
