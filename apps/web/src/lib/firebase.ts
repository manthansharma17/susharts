import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { clientEnv } from './env.js';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const { apiKey, authDomain, projectId, appId } = clientEnv.firebase;
  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      'Firebase config is incomplete. Set VITE_FIREBASE_* variables in .env.local.',
    );
  }
  app = initializeApp({ apiKey, authDomain, projectId, appId });
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  return auth;
}
