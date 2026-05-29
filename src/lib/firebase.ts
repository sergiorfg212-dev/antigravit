import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel, disableNetwork } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();

// Completely quiet internal Firebase Firestore background retry/warning logs
setLogLevel('silent');

// Disable network instantly if we are in local fallback mode to prevent quota/connection errors on startup
try {
  if (typeof window !== 'undefined' && localStorage.getItem('nom030_quota_exhausted_fallback') === 'true') {
    disableNetwork(db).catch(() => {});
    console.warn('[Firestore initialize] Network disabled on initialization due to quota exhausted fallback state.');
  }
} catch (e) {}
