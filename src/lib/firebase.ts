// Firebase client config — these are client-side identifiers, not server secrets.
// Restrict the API key in Firebase console to hub.nonarkara.org + city-hub.pages.dev.
//
// The hardcoded fallback is the DEV project — fine for local development, but a
// production build missing its VITE_FIREBASE_* env vars must NOT silently write
// to the dev project. In that case firebaseConfig is null and every entry point
// below rejects; callers (db.ts, trackEvent) already catch and degrade.
const DEV_CONFIG = {
  projectId:         'unl-city-hub-dev-1',
  appId:             '1:839839755960:web:6bafacdd63cc43c132ce4d',
  storageBucket:     'unl-city-hub-dev-1.firebasestorage.app',
  apiKey:            'AIzaSyB1DcKIgXdjV5Q35fX6GnRyQj9R37yOziU',
  authDomain:        'unl-city-hub-dev-1.firebaseapp.com',
  messagingSenderId: '839839755960',
}

const firebaseConfig = (() => {
  const env = {
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID     as string | undefined,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID          as string | undefined,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET  as string | undefined,
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY         as string | undefined,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN     as string | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_ID    as string | undefined,
  }
  if (env.projectId && env.apiKey) return env
  if (import.meta.env.PROD) {
    console.warn('[firebase] VITE_FIREBASE_* env vars missing in production build — Firebase disabled (not falling back to dev project)')
    return null
  }
  return DEV_CONFIG
})()

// The Firebase SDK (~150 KB gzip) is lazy-loaded: nothing here runs at startup.
// App + Firestore initialize on first real use (chat, action center, analytics),
// keeping the firebase chunk off the critical path.
import type { FirebaseApp } from 'firebase/app'
import type { Firestore } from 'firebase/firestore'

let appPromise: Promise<FirebaseApp> | null = null
export function getFirebaseApp(): Promise<FirebaseApp> {
  if (!firebaseConfig) {
    return Promise.reject(new Error('Firebase not configured (VITE_FIREBASE_* missing)'))
  }
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
