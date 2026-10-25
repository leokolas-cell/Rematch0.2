import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocFromServer,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { getUserRankInfo, type LeaderboardEntry } from './game/rules';

export const FIREBASE_SERVICE_NAME = 'TIKI TAKA 0.2 • GLOBAL CLUB CLOUD';
export const FIREBASE_COLLECTION_NAME = 'tiki_taka_club_standings';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function subscribeToAuthChanges(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogleForLeaderboard(): Promise<User | null> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export interface LocalProfileForSync {
  name: string;
  iconType: 'preset' | 'photo';
  presetIcon: string;
  photoDataUrl: string | null;
  rankedWins: number;
  rankedMatches: number;
  balance: number;
}

export async function syncProfileToFirestoreLeaderboard(
  profile: LocalProfileForSync
): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  const uid = currentUser.uid;
  const path = `${FIREBASE_COLLECTION_NAME}/${uid}`;
  const cleanName = (profile.name || currentUser.displayName || 'Striker').trim().slice(0, 16) || 'Striker';
  const safeWins = Math.max(0, Math.min(1000000, Math.floor(profile.rankedWins || 0)));
  const safeMatches = Math.max(0, Math.min(1000000, Math.floor(profile.rankedMatches || 0)));
  const safeBalance = Math.max(0, Math.min(1000000000, Math.floor(profile.balance || 0)));
  const safeIconType: 'preset' | 'photo' =
    profile.iconType === 'photo' && profile.photoDataUrl && profile.photoDataUrl.length <= 120000
      ? 'photo'
      : 'preset';

  const photoStr =
    safeIconType === 'photo' && profile.photoDataUrl
      ? profile.photoDataUrl.slice(0, 120000)
      : currentUser.photoURL
        ? currentUser.photoURL.slice(0, 120000)
        : '';

  const baseFields = {
    uid,
    name: cleanName,
    iconType: safeIconType,
    presetIcon: (profile.presetIcon || '#10').slice(0, 16),
    photoDataUrl: photoStr,
    rankedWins: safeWins,
    rankedMatches: safeMatches,
    balance: safeBalance,
    isPublic: true,
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = doc(db, FIREBASE_COLLECTION_NAME, uid);
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      await updateDoc(docRef, baseFields);
    } else {
      await setDoc(docRef, {
        ...baseFields,
        createdAt: serverTimestamp(),
      });
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

export function subscribeToOnlineLeaderboard(
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (info: FirestoreErrorInfo) => void
): Unsubscribe {
  const path = FIREBASE_COLLECTION_NAME;
  const q = query(
    collection(db, FIREBASE_COLLECTION_NAME),
    where('isPublic', '==', true),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const entries: LeaderboardEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data || data.isPublic !== true) return;
        const hasPhoto =
          (data.iconType === 'photo' || Boolean(data.photoDataUrl)) &&
          typeof data.photoDataUrl === 'string' &&
          data.photoDataUrl.length > 0;
        const wins = Math.max(0, Number(data.rankedWins) || 0);
        const rankInfo = getUserRankInfo(wins);
        entries.push({
          uid: String(data.uid || docSnap.id),
          name: String(data.name || data.displayName || 'Player').slice(0, 16),
          iconType: hasPhoto ? 'photo' : 'preset',
          presetIcon: String(data.presetIcon || '#10'),
          photoDataUrl: hasPhoto ? String(data.photoDataUrl) : null,
          rankedWins: wins,
          rankedMatches: Math.max(0, Number(data.rankedMatches) || 0),
          balance: Math.max(0, Number(data.balance) || 0),
          rankName: rankInfo.name,
          rankTierIndex: rankInfo.index,
          updatedAt: Date.now(),
        });
      });
      onUpdate(entries);
    },
    (error) => {
      const info = handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(info);
    }
  );
}

export async function deleteProfileFromFirestoreLeaderboard(): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;
  const uid = currentUser.uid;
  const path = `${FIREBASE_COLLECTION_NAME}/${uid}`;
  try {
    await deleteDoc(doc(db, FIREBASE_COLLECTION_NAME, uid));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    return false;
  }
}

