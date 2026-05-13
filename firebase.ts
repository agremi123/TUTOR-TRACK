
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Set persistence to browserLocalPersistence (default behavior) for better stability
// setPersistence(auth, inMemoryPersistence).catch(err => console.error('Persistence error:', err));

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Normal login provider
export const googleLoginProvider = new GoogleAuthProvider();

// Calendar provider (with extra scopes and consent prompt)
export const googleCalendarProvider = new GoogleAuthProvider();
// Use the broad 'calendar' scope to allow creating/listing calendars.
googleCalendarProvider.addScope('https://www.googleapis.com/auth/calendar');
googleCalendarProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleCalendarProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
googleCalendarProvider.setCustomParameters({ prompt: 'consent' });

// Auth helpers
export const loginWithGoogle = () => signInWithPopup(auth, googleLoginProvider);
export const logout = () => signOut(auth);

export { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  Timestamp,
  writeBatch
};
