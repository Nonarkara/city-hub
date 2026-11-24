import { expect, test } from '@playwright/test'
import { createRequire } from 'node:module'
import { deleteApp, initializeApp } from 'firebase/app'
import { doc, getFirestore, terminate } from 'firebase/firestore'

test('Firestore resolves the patched gRPC dependency', () => {
  const require = createRequire(import.meta.url)
  const firestoreRequire = createRequire(require.resolve('@firebase/firestore'))
  expect(firestoreRequire('@grpc/grpc-js/package.json').version).toBe('1.13.6')
  expect(typeof firestoreRequire('@grpc/grpc-js').credentials.createSsl).toBe('function')
})

test('Firestore can construct a local document without credentials or network writes', async () => {
  const app = initializeApp({ projectId: 'example-cityhub-offline' }, 'dependency-smoke')
  const db = getFirestore(app)
  try {
    expect(doc(db, 'smoke', 'offline').path).toBe('smoke/offline')
  } finally {
    await terminate(db)
    await deleteApp(app)
  }
})
