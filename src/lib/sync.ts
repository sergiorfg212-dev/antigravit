import { db as fdb, auth as fauth } from './firebase';
import { Timestamp } from 'firebase/firestore';

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: fauth.currentUser?.uid,
      email: fauth.currentUser?.email,
      emailVerified: fauth.currentUser?.emailVerified,
      isAnonymous: fauth.currentUser?.isAnonymous,
      tenantId: fauth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Convert firestore timestamps back to standard javascript Date objects
export function convertTimestampsToDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Timestamp) {
    return obj.toDate();
  }
  if (typeof obj.toDate === 'function') {
    return obj.toDate();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertTimestampsToDates);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[key] = convertTimestampsToDates(obj[key]);
  }
  return result;
}

// Convert standard Dates or local fields to be firebase friendly
export function makeFirebaseFriendly(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) {
    return Timestamp.fromDate(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(makeFirebaseFriendly);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'function' || obj[key] === undefined) {
      continue;
    }
    result[key] = makeFirebaseFriendly(obj[key]);
  }
  return result;
}

// Helper to determine the firestore document ID for any specific table item
export function getFirestoreDocId(table: string, id: any, userId: string): string {
  return `${userId}_${table}_${id}`;
}

// Generates a 12-digit safe integer ID that is monotonic/sequential-ish and highly unique
export function generateUniqueId(): number {
  const ts = Date.now() % 1000000000;
  const rand = Math.floor(Math.random() * 1000);
  return ts * 1000 + rand;
}

// Mocked pull operations for legacy backwards-compatibility imports
export async function pullAllFromFirestoreToDexie(userId: string): Promise<void> {
  console.log('[Direct Firestore Integration] Pull bypass. Listeners are already active.');
}

// Mocked push operations for legacy backwards-compatibility imports
export async function pushAllFromDexieToFirestore(userId: string): Promise<void> {
  console.log('[Direct Firestore Integration] Push bypass. All modifications write directly.');
}

// Mocked bidirectional sync resolver
export async function syncLocalStorageWithCloud(userId: string): Promise<{ pushedCount: number; pulledCount: number }> {
  console.log('[Direct Firestore Integration] Bidirectional sync bypassed because database writes directly to Firestore.');
  return { pushedCount: 0, pulledCount: 0 };
}
