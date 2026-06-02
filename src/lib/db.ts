import { create } from 'zustand';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  disableNetwork,
  enableNetwork,
  getDocFromServer
} from 'firebase/firestore';
import { db as fdb, auth } from './firebase';
import { 
  convertTimestampsToDates, 
  makeFirebaseFriendly, 
  generateUniqueId, 
  handleFirestoreError, 
  OperationType 
} from './sync';

export interface User {
  id?: number;
  uid?: string;
  name: string;
  email: string;
  passwordHash: string;
  role?: 'admin' | 'user';
  isBlocked?: boolean;
  createdAt: Date;
}

export interface Company {
  id?: number;
  name: string;
  rfc: string;
  address: string;
  activity: string;
  workerCount: number;
  riskLevel: number;
  responsibleName: string;
  responsibleSignature?: string; // Base64
  businessLine?: string; // Giro de la empresa
  shifts?: string; // Turnos de trabajo
  studyDate?: Date; // Fecha de realización del estudio
  totalBuiltArea?: number; // Superficie total construida
  totalPlotArea?: number; // Superficie del predio
  propertyStatus?: 'owned' | 'rented' | 'leased' | 'borrowed' | 'other'; // Situación del predio
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accessibilityDescription?: string;
  infrastructureDescription?: string;
  surroundingHazardsDescription?: string;
  atlasRiesgosNotes?: string;
  localizationSketch?: string; // Base64 croquis
  logo?: string; // Base64
  letterhead?: string; // Base64 - Membrete/Encabezado
  coverBackground?: string; // Base64 - Imagen de fondo de la portada
  slogan?: string;
  processDescription?: string;
  processType?: 'text' | 'file' | 'diagram';
  processFileUrl?: string;
  surroundingHazardsMap?: string; // Base64
  rawMaterials?: string;
  machinery?: string;
  layoutUrl?: string; // Base64 or URL
  layoutAreas?: string; // JSON stringified areas or just text
  lastAccidentDate?: Date;
  totalHoursWorked?: number;
  avgWorkersExp?: number; // Average workers exposed for IMSS formula (N)
  stpsQuestionnaire?: string; // JSON string of questionnaire answers
  reportFullHTML?: string; // Complete HTML structure for Word WYSIWYG
  reportTarget?: string; // Goal of the report
  reportIntro?: string; // Introduction section of the report
  reportConclusions?: string; // Final conclusions of the report
  reportRecommendations?: string; // Safety recommendations of the report
  userId?: number | string; // Creator user id (could be string uid as well)
  creatorName?: string; // Creator display name
  createdAt: Date;
  updatedAt: Date;
}

export interface Diagnosis {
  id?: number;
  companyId: number;
  title: string;
  date: Date;
  type: 'general' | 'area' | 'process';
  areaName?: string;
  status: 'draft' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Finding {
  id?: number;
  companyId: number;
  diagnosisId: number;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'very_high';
  status: 'pending' | 'in_progress' | 'completed';
  responsible: string;
  commitmentDate: Date;
  evidenceUrls: string[];
  nomReference: string[]; 
  category: 'unsafe_condition' | 'physical_agent' | 'chemical_agent' | 'biological_agent' | 'hazard' | 'regulatory_requirement';
  correctiveAction?: string;
  riskMethod?: 'fine' | 'matrix';
  riskScore?: number;
  riskProbability?: number;
  riskSeverity?: number;
  riskExposure?: number;
  riskConsequence?: number;
  possibleConsequence?: string;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskAssessment {
  id?: number;
  companyId: number;
  diagnosisId: number;
  findingId?: number;
  processName: string;
  activity: string;
  hazard: string;
  category?: string;
  method: 'fine' | 'matrix';
  probability?: number;
  severity?: number;
  consequence?: number;
  exposure?: number;
  likelihood?: number;
  riskLevel: number; 
  priority: 'low' | 'medium' | 'high' | 'very_high';
  controls: string;
  responsible: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafetyAction {
  id?: number;
  companyId: number;
  diagnosisId?: number;
  findingId?: number;
  title: string;
  description: string;
  type: 'preventive' | 'corrective';
  responsible: string;
  priority: 'low' | 'medium' | 'high';
  startDate: Date;
  endDate: Date;
  progress: number; // 0-100
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  evidenceUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistItem {
  id?: number;
  companyId: number;
  diagnosisId: number;
  nomCode: string;
  requirement: string;
  compliance: 'compliance' | 'non_compliance' | 'partial' | 'not_applicable';
  comments: string;
  evidenceUrls: string[];
  updatedAt: Date;
}

export interface LegalMatrixRequirement {
  id?: number;
  companyId: number;
  authority: string; // STPS, PC, IMSS, SEMARNAT, etc.
  nomCode: string;
  requirement: string;
  applies: boolean | null;
  executionDate?: Date;
  validityMonths?: number;
  expirationDate?: Date;
  notes?: string;
  updatedAt: Date;
}

export interface SafetyProgramItem {
  id?: number;
  companyId: number;
  nomSection: '7.1.a' | '7.1.b' | '7.1.c' | '7.1.d' | '7.1.e';
  findingId?: number;
  hazardId?: number;
  action: string;
  category?: string;
  referenceNorm?: string;
  responsible: string;
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'completed';
  beforeEvidenceUrl?: string;
  afterEvidenceUrl?: string;
  progress?: number;
  updatedAt: Date;
}

export interface AccidentRecord {
  id?: number;
  companyId: number;
  year: number;
  month: number;
  accidentCount: number;
  incidentCount: number;
  daysLost: number;
  description?: string;
  updatedAt: Date;
}

export interface AccidentEvent {
  id?: number;
  companyId: number;
  date: Date;
  type: 'accident' | 'illness' | 'near_miss' | 'professional_illness' | 'work_risk' | 'commuting_risk';
  daysLost: number;
  permanentDisabilityPercentage?: number;
  isDeath?: boolean;
  description: string;
  workerName?: string;
  department?: string;
  treatment?: string;
  totalCost?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurroundingHazard {
  id?: number;
  companyId: number;
  hazardType: string;
  source: string;
  distance: string; 
  probability: number;
  impact: number;
  riskLevel: number;
  mitigationMeasures: string;
  evidenceUrls?: string[];
  updatedAt: Date;
}

export interface EvidenceLog {
  id?: number;
  companyId: number;
  entryType: 'progress' | 'training';
  date: Date;
  title: string;
  fileUrl?: string;
  fileName?: string;
  progressPercentage?: number;
  status?: 'pending' | 'in_progress' | 'completed';
  role?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Global in-memory cache definitions for zustand reactivity matching Firestore list snapshots
export interface DbState {
  version: number;
  companies: Company[];
  diagnoses: Diagnosis[];
  findings: Finding[];
  riskAssessments: RiskAssessment[];
  safetyActions: SafetyAction[];
  checklistItems: ChecklistItem[];
  legalMatrix: LegalMatrixRequirement[];
  safetyProgram: SafetyProgramItem[];
  accidentRecords: AccidentRecord[];
  accidentEvents: AccidentEvent[];
  surroundingHazards: SurroundingHazard[];
  evidences: EvidenceLog[];
  users: User[];
  setCollection: (name: string, data: any[]) => void;
  incrementVersion: () => void;
}

export const useDbStore = create<DbState>((set) => ({
  version: 1,
  companies: [],
  diagnoses: [],
  findings: [],
  riskAssessments: [],
  safetyActions: [],
  checklistItems: [],
  legalMatrix: [],
  safetyProgram: [],
  accidentRecords: [],
  accidentEvents: [],
  surroundingHazards: [],
  evidences: [],
  users: [],
  setCollection: (name, data) => set((state) => ({ [name]: data, version: state.version + 1 })),
  incrementVersion: () => set((state) => ({ version: state.version + 1 })),
}));

// Manage actual active listeners unsubscribers
let activeUnsubscribers: (() => void)[] = [];

const LOCAL_STORAGE_PREFIX = 'nom030_fallback_';
let isLocalFallbackMode = false;

// Check if already fell back previously in this browser
try {
  if (localStorage.getItem('nom030_quota_exhausted_fallback') === 'true') {
    isLocalFallbackMode = true;
    console.warn('[DB Fallback] Initialized directly in local fallback storage mode.');
    try {
      disableNetwork(fdb).catch(() => {});
    } catch (e) {}
  }
} catch (e) {}

export function getLocalFallbackMode() {
  return isLocalFallbackMode;
}

export function getActiveUserId(): string {
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('nom030_use_local_only') === 'true') {
      return 'local_user_uid';
    }
  } catch (e) {}
  return 'anonymous_user';
}

export function setLocalFallbackMode(active: boolean) {
  if (isLocalFallbackMode !== active) {
    isLocalFallbackMode = active;
    if (active) {
      console.warn('[DB Fallback] Firestore is in local-only fallback mode (quota exceeded or offline). Data is saved to localStorage.');
      try {
        localStorage.setItem('nom030_quota_exhausted_fallback', 'true');
      } catch (e) {}

      // Stop all active background listeners/observers instantly to stop retries and quota complaints
      try {
        unsubscribeFirestoreListeners();
      } catch (e) {
        console.warn('Failed to unsubscribe on fallback:', e);
      }

      try {
        disableNetwork(fdb).then(() => {
          console.log('[Firestore] Network disabled on client to save quota.');
        }).catch((err) => {
          console.warn('[Firestore] Failed to disable network:', err);
        });
      } catch (err) {
        console.warn('[Firestore] Error while disabling network:', err);
      }
    } else {
      try {
        localStorage.removeItem('nom030_quota_exhausted_fallback');
      } catch (e) {}
      try {
        enableNetwork(fdb).then(() => {
          console.log('[Firestore] Network enabled on client.');
        }).catch((err) => {
          console.warn('[Firestore] Failed to enable network:', err);
        });
      } catch (err) {
        console.warn('[Firestore] Error while enabling network:', err);
      }
    }
  }
}

/**
 * Subscribes to real-time onSnapshot listeners from Firestore collections
 * and populates the reactive useDbStore.
 */
export async function initializeFirestoreListeners(userId: string, email: string) {
  // Clear any existing active subscription listeners to avoid leakages
  activeUnsubscribers.forEach((unsub) => {
    try {
      unsub();
    } catch (e) {}
  });
  activeUnsubscribers = [];

  const isAdmin = email.toLowerCase().trim() === 'sergio.rfg212@gmail.com';
  console.log(`[Firestore Real-time] Hooking up snapshot listeners. Mode: ${isAdmin ? 'Admin (Universal)' : 'Technical Advisor (Isolated)'}`);

  const collectionsList = [
    'companies',
    'diagnoses',
    'findings',
    'riskAssessments',
    'safetyActions',
    'checklistItems',
    'legalMatrix',
    'safetyProgram',
    'accidentRecords',
    'accidentEvents',
    'surroundingHazards',
    'evidences',
    'users'
  ];

  // Migrate any 'anonymous_user' fallback data to the active userId if needed
  if (userId && userId !== 'anonymous_user') {
    collectionsList.forEach((tableName) => {
      try {
        const anonKey = `${LOCAL_STORAGE_PREFIX}${tableName}_anonymous_user`;
        const anonData = localStorage.getItem(anonKey);
        if (anonData) {
          const userKey = `${LOCAL_STORAGE_PREFIX}${tableName}_${userId}`;
          const userData = localStorage.getItem(userKey);
          
          let mergedItems = JSON.parse(anonData);
          if (userData) {
            const existingItems = JSON.parse(userData);
            if (Array.isArray(existingItems) && Array.isArray(mergedItems)) {
              existingItems.forEach((item: any) => {
                const exists = mergedItems.some((m: any) => m.id === item.id);
                if (!exists) {
                  mergedItems.push(item);
                }
              });
            }
          }
          
          localStorage.setItem(userKey, JSON.stringify(mergedItems));
          localStorage.removeItem(anonKey);
          console.log(`[DB Migration] Migrated/Merged ${tableName} from anonymous_user to ${userId}`);
        }
      } catch (e) {
        console.warn(`[DB Migration Error] Failed to migrate ${tableName}:`, e);
      }
    });
  }

  // Load from local storage baseline first so user doesn't see blank arrays in cold loads
  collectionsList.forEach((tableName) => {
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${tableName}_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const datesCorrected = parsed.map((item: any) => {
          const newItem = { ...item };
          for (const key of Object.keys(newItem)) {
            if (typeof newItem[key] === 'string' && (key.endsWith('At') || key.endsWith('Date') || key === 'commitmentDate')) {
              const parsedDate = Date.parse(newItem[key]);
              if (!isNaN(parsedDate)) {
                newItem[key] = new Date(parsedDate);
              }
            }
          }
          return newItem;
        });
        const storeKey = tableName === 'legalMatrix' ? 'legalMatrix' : tableName;
        useDbStore.getState().setCollection(storeKey, datesCorrected);
        console.log(`[DB Local Baseline] Loaded ${datesCorrected.length} records for ${tableName}`);
      }
    } catch (e) {
      console.warn(`[DB Local Baseline Error] Failed to read cached baseline for ${tableName}:`, e);
    }
  });

  if (isLocalFallbackMode) {
    console.warn('[Firestore Real-time] Bypassing onSnapshot subscriptions. Local offline mode is active due to quota limits.');
    return;
  }

  // Proactive Connection/Quota test probe before subscribing to avoid registering 13 listeners en masse
  try {
    await getDocFromServer(doc(fdb, 'users', userId));
    console.log('[Firestore Connection Probe] Quota check passed, subscribing to snapshots.');
  } catch (err: any) {
    const errMsg = (err?.message || String(err)).toLowerCase();
    const errCode = (err?.code || String(err?.code || '')).toLowerCase();
    if (
      errMsg.includes('quota') || 
      errMsg.includes('resource-exhausted') || 
      errMsg.includes('exhausted') || 
      errMsg.includes('quota_exceeded') ||
      errCode.includes('quota') ||
      errCode.includes('resource-exhausted') ||
      errCode.includes('quota_exceeded')
    ) {
      console.warn('[Firestore] Quota check failed on init. Engaging offline fallback mode immediately.');
      setLocalFallbackMode(true);
      window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
      return;
    }
  }

  if (isLocalFallbackMode) {
    return;
  }

  collectionsList.forEach((tableName) => {
    if (isLocalFallbackMode) {
      return;
    }
    let q: any;
    const colRef = collection(fdb, tableName);
    
    if (tableName === 'users') {
      if (isAdmin) {
        q = colRef;
      } else {
        q = query(colRef, where('uid', '==', userId));
      }
    } else {
      if (isAdmin) {
        q = colRef;
      } else {
        q = query(colRef, where('userId', '==', userId));
      }
    }

    const unsub = onSnapshot(q, (snapshot: any) => {
      const items: any[] = [];
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data();
        const datesCorrected = convertTimestampsToDates(data);
        items.push(datesCorrected);
      });
      // Store in memory using Zustand hook. Normalize key legalMatrix
      const storeKey = tableName === 'legalMatrix' ? 'legalMatrix' : tableName;
      
      // Merge snapshot items with local backups that may not yet exist in Firestore due to write failures
      const stored = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${tableName}_${userId}`);
      let finalItems = [...items];
      if (stored) {
        try {
          const parsedLocal = JSON.parse(stored);
          parsedLocal.forEach((localItem: any) => {
            const existsInCloud = items.some(cloudItem => cloudItem.id === localItem.id);
            if (!existsInCloud) {
              const localCorrected = { ...localItem };
              for (const key of Object.keys(localCorrected)) {
                if (typeof localCorrected[key] === 'string' && (key.endsWith('At') || key.endsWith('Date') || key === 'commitmentDate')) {
                  const parsedDate = Date.parse(localCorrected[key]);
                  if (!isNaN(parsedDate)) {
                    localCorrected[key] = new Date(parsedDate);
                  }
                }
              }
              finalItems.push(localCorrected);
            }
          });
        } catch (e) {
          console.warn(`[DB Merge Warning] ${tableName}`, e);
        }
      }

      useDbStore.getState().setCollection(storeKey, finalItems);
      console.log(`[Firestore snapshot] ${tableName} synced: cloud=${items.length}, total=${finalItems.length}`);
    }, (err: any) => {
      console.warn(`[Firestore snapshot] Realtime snapshot query failed for ${tableName}:`, err);
      const errMsg = (err?.message || String(err)).toLowerCase();
      const errCode = (err?.code || String(err?.code || '')).toLowerCase();
      if (
        errMsg.includes('quota') || 
        errMsg.includes('resource-exhausted') || 
        errMsg.includes('exhausted') || 
        errMsg.includes('quota_exceeded') ||
        errCode.includes('quota') ||
        errCode.includes('resource-exhausted') ||
        errCode.includes('quota_exceeded')
      ) {
        const wasFallback = isLocalFallbackMode;
        if (!wasFallback) {
          setLocalFallbackMode(true);
          window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
        }
        // Always unsubscribe active snapshot listeners immediately to halt repetitive retry connections
        activeUnsubscribers.forEach((cancel) => {
          try {
            cancel();
          } catch (cancelErr) {
            console.warn('[Firestore] Error while calling cancel subscription:', cancelErr);
          }
        });
        activeUnsubscribers = [];
      }
    });

    if (!isLocalFallbackMode) {
      activeUnsubscribers.push(unsub);
    }
  });
}

/**
 * Remove any active listener subscriptions.
 */
export function unsubscribeFirestoreListeners() {
  activeUnsubscribers.forEach((unsub) => unsub());
  activeUnsubscribers = [];
  console.log('[Firestore Real-time] Unsubscribed from all collections.');
}

/**
 * Clear memory state on user logout.
 */
export function clearLocalCache() {
  const store = useDbStore.getState();
  const tables = [
    'companies', 'diagnoses', 'findings', 'riskAssessments', 'safetyActions',
    'checklistItems', 'legalMatrix', 'safetyProgram', 'accidentRecords',
    'accidentEvents', 'surroundingHazards', 'evidences', 'users'
  ];
  tables.forEach((tableName) => {
    store.setCollection(tableName, []);
  });
  console.log('[Database Layer] All dynamic memory cached tables successfully wiped.');
}

/**
 * Direct write helper to set state on Firebase Firestore
 */
async function saveDoc(tableName: string, obj: any) {
  const userId = getActiveUserId();

  if (obj && obj.id === undefined) {
    obj.id = generateUniqueId();
  }

  const docCopy = { ...obj };
  if (tableName !== 'users') {
    docCopy.userId = userId;
  }
  docCopy.updatedAt = new Date();

  // Pick suitable doc identifier
  const docId = tableName === 'users' ? (obj.uid || String(obj.id)) : String(obj.id);

  // Update memory store immediately for fast responsive UI updates
  const storeKey = tableName === 'legalMatrix' ? 'legalMatrix' : tableName;
  const currentStoreItems = (useDbStore.getState() as any)[storeKey] as any[] || [];
  const existingIndex = currentStoreItems.findIndex(item => item.id === obj.id || (item.uid && item.uid === obj.uid));
  
  let updatedItems = [...currentStoreItems];
  if (existingIndex >= 0) {
    updatedItems[existingIndex] = { ...updatedItems[existingIndex], ...docCopy };
  } else {
    updatedItems.push(docCopy);
  }
  useDbStore.getState().setCollection(storeKey, updatedItems);

  // Archive to localStorage
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${tableName}_${userId}`, JSON.stringify(updatedItems));
  } catch (lsErr) {
    console.error('[DB localStorage backup error]:', lsErr);
  }

  if (isLocalFallbackMode) {
    console.log(`[DB Fallback] Saved ${tableName} document ${docId} to local fallback.`);
    return obj.id;
  }

  try {
    const prepared = makeFirebaseFriendly(docCopy);
    await setDoc(doc(fdb, tableName, docId), prepared);
    return obj.id;
  } catch (err: any) {
    const errMsg = (err?.message || String(err)).toLowerCase();
    const errCode = (err?.code || String(err?.code || '')).toLowerCase();
    if (
      errMsg.includes('quota') || 
      errMsg.includes('resource-exhausted') || 
      errMsg.includes('exhausted') || 
      errMsg.includes('quota_exceeded') ||
      errCode.includes('quota') ||
      errCode.includes('resource-exhausted') ||
      errCode.includes('quota_exceeded')
    ) {
      if (!isLocalFallbackMode) {
        setLocalFallbackMode(true);
        window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
      }
      console.warn(`[DB Fallback Mode Activated] Saving ${tableName}/${docId} fell back locally.`);
      return obj.id;
    } else {
      handleFirestoreError(err, OperationType.WRITE, `${tableName}/${docId}`);
    }
  }
}

export interface DBCollection<T> {
  add: (obj: T) => Promise<any>;
  put: (obj: T) => Promise<any>;
  update: (id: any, changes: Partial<T>) => Promise<number>;
  delete: (id: any) => Promise<void>;
  get: (id: any) => Promise<T | undefined>;
  toArray: () => Promise<T[]>;
  clear: () => Promise<void>;
  bulkAdd: (items: T[]) => Promise<any>;
  bulkPut: (items: T[]) => Promise<any>;
  bulkDelete: (keys: any[]) => Promise<void>;
  where: (key: string) => {
    equals: (value: any) => {
      toArray: () => Promise<T[]>;
      first: () => Promise<T | undefined>;
      count: () => Promise<number>;
      filter: (predicate: (item: T) => boolean) => any;
      reverse: () => {
        sortBy: (field: string) => Promise<T[]>;
        toArray: () => Promise<T[]>;
      };
      sortBy: (field: string) => Promise<T[]>;
    };
  };
}

// Generate Firestore backed collections for every table
function createCollection<T extends { id?: any; uid?: string }>(tableName: string): DBCollection<T> {
  const getItems = () => {
    const storeKey = tableName === 'legalMatrix' ? 'legalMatrix' : tableName;
    return (useDbStore.getState() as any)[storeKey] as T[] || [];
  };

  return {
    add: async (obj: T) => {
      return await saveDoc(tableName, obj);
    },
    put: async (obj: T) => {
      return await saveDoc(tableName, obj);
    },
    update: async (id: any, changes: Partial<T>) => {
      const items = getItems();
      const existing = items.find(item => item.id === id || (item.uid && item.uid === id));
      if (!existing) {
        console.warn(`[Firestore write error] Document with key ${id} not found in collection ${tableName}`);
        return 0;
      }
      const merged = { ...existing, ...changes };
      await saveDoc(tableName, merged);
      return 1;
    },
    delete: async (id: any) => {
      const items = getItems();
      const existingItem = items.find(item => item.id === id || (item.uid && item.uid === id));
      const docId = existingItem?.uid || String(id);

      const nextItems = items.filter(item => !(item.id === id || (item.uid && item.uid === id)));
      const storeKey = tableName === 'legalMatrix' ? 'legalMatrix' : tableName;
      useDbStore.getState().setCollection(storeKey, nextItems);

      const userId = getActiveUserId();
      try {
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${tableName}_${userId}`, JSON.stringify(nextItems));
      } catch (lsErr) {
        console.error('[DB localStorage delete error]:', lsErr);
      }

      if (isLocalFallbackMode) {
        return;
      }

      try {
        await deleteDoc(doc(fdb, tableName, docId));
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (errMsg.includes('quota') || errMsg.includes('resource-exhausted') || errMsg.includes('exhausted') || errMsg.includes('QUOTA_EXCEEDED')) {
          if (!isLocalFallbackMode) {
            setLocalFallbackMode(true);
            window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
          }
          console.warn('[DB Fallback] Deleting from Firestore failed. Keeping local change.');
        } else {
          handleFirestoreError(err, OperationType.DELETE, `${tableName}/${docId}`);
        }
      }
    },
    get: async (id: any) => {
      const items = getItems();
      return items.find(item => item.id === id || (item.uid && item.uid === id));
    },
    toArray: async () => {
      return getItems();
    },
    clear: async () => {
      const storeKey = tableName === 'legalMatrix' ? 'legalMatrix' : tableName;
      useDbStore.getState().setCollection(storeKey, []);
      const userId = getActiveUserId();
      try {
        localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${tableName}_${userId}`);
      } catch (e) {}

      if (isLocalFallbackMode) {
        return;
      }

      // Deletes all items of this collection owned by this user
      const items = getItems();
      for (const item of items) {
        const docId = item.uid || String(item.id);
        try {
          await deleteDoc(doc(fdb, tableName, docId));
        } catch (e) {
          console.warn(`[database clear] Failed to clear document ${docId} on table ${tableName}:`, e);
        }
      }
    },
    bulkAdd: async (items: T[]) => {
      const addedIds = [];
      for (const item of items) {
        const id = await saveDoc(tableName, item);
        addedIds.push(id);
      }
      return addedIds;
    },
    bulkPut: async (items: T[]) => {
      const addedIds = [];
      for (const item of items) {
        const id = await saveDoc(tableName, item);
        addedIds.push(id);
      }
      return addedIds;
    },
    bulkDelete: async (keys: any[]) => {
      const storeKey = tableName === 'legalMatrix' ? 'legalMatrix' : tableName;
      const items = getItems();
      const nextItems = items.filter(item => !keys.includes(item.id) && !(item.uid && keys.includes(item.uid)));
      useDbStore.getState().setCollection(storeKey, nextItems);

      const userId = getActiveUserId();
      try {
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${tableName}_${userId}`, JSON.stringify(nextItems));
      } catch (lsErr) {
        console.error('[DB localStorage delete error]:', lsErr);
      }

      if (isLocalFallbackMode) {
        return;
      }

      for (const id of keys) {
        const existingItem = items.find(item => item.id === id || (item.uid && item.uid === id));
        const docId = existingItem?.uid || String(id);
        try {
          await deleteDoc(doc(fdb, tableName, docId));
        } catch (e) {
          console.warn(`[database bulkDelete] Failed to delete document ${docId} on table ${tableName}:`, e);
        }
      }
    },
    where: (key: string) => {
      return {
        equals: (value: any) => {
          const items = getItems();
          const filtered = items.filter(item => {
            const itemVal = (item as any)[key];
            if (key === 'companyId' || key === 'findingId' || key === 'diagnosisId' || key === 'userId') {
              return String(itemVal) === String(value);
            }
            return itemVal === value;
          });

          const buildQueryResult = (resItems: T[]): any => ({
            toArray: (): Promise<T[]> => Promise.resolve(resItems),
            first: (): Promise<T | undefined> => Promise.resolve(resItems[0]),
            count: (): Promise<number> => Promise.resolve(resItems.length),
            filter: (predicate: (item: T) => boolean) => {
              const nextFiltered = resItems.filter(predicate);
              return buildQueryResult(nextFiltered);
            },
            reverse: () => {
              const reversed = [...resItems].reverse();
              return {
                sortBy: (field: string): Promise<T[]> => {
                  const sorted = [...reversed].sort((a, b) => {
                    const valA = (a as any)[field];
                    const valB = (b as any)[field];
                    if (valA < valB) return -1;
                    if (valA > valB) return 1;
                    return 0;
                  });
                  return Promise.resolve(sorted);
                },
                toArray: (): Promise<T[]> => Promise.resolve(reversed),
              };
            },
            sortBy: (field: string): Promise<T[]> => {
              const sorted = [...resItems].sort((a, b) => {
                const valA = (a as any)[field];
                const valB = (b as any)[field];
                if (valA < valB) return -1;
                if (valA > valB) return 1;
                return 0;
              });
              return Promise.resolve(sorted);
            }
          });

          return buildQueryResult(filtered);
        }
      };
    }
  };
}

export const db = {
  users: createCollection<User>('users'),
  companies: createCollection<Company>('companies'),
  diagnoses: createCollection<Diagnosis>('diagnoses'),
  findings: createCollection<Finding>('findings'),
  riskAssessments: createCollection<RiskAssessment>('riskAssessments'),
  safetyActions: createCollection<SafetyAction>('safetyActions'),
  checklistItems: createCollection<ChecklistItem>('checklistItems'),
  legalMatrix: createCollection<LegalMatrixRequirement>('legalMatrix'),
  safetyProgram: createCollection<SafetyProgramItem>('safetyProgram'),
  accidentRecords: createCollection<AccidentRecord>('accidentRecords'),
  accidentEvents: createCollection<AccidentEvent>('accidentEvents'),
  surroundingHazards: createCollection<SurroundingHazard>('surroundingHazards'),
  evidences: createCollection<EvidenceLog>('evidences'),
  table: (name: string) => {
    return (db as any)[name];
  }
};
