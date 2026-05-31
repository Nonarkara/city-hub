import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, logEvent } from 'firebase/analytics'

const firebaseConfig = {
  projectId: "unl-city-hub-dev-1",
  appId: "1:839839755960:web:6bafacdd63cc43c132ce4d",
  storageBucket: "unl-city-hub-dev-1.firebasestorage.app",
  apiKey: "AIzaSyB1DcKIgXdjV5Q35fX6GnRyQj9R37yOziU",
  authDomain: "unl-city-hub-dev-1.firebaseapp.com",
  messagingSenderId: "839839755960",
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// Initialize Analytics only in browser environment
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null

export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  if (analytics) {
    logEvent(analytics, eventName, eventParams)
  }
}
