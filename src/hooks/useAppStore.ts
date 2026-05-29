import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, getLocalFallbackMode, setLocalFallbackMode } from '../lib/db';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db as fdb } from '../lib/firebase';

const syncSettingToFirestore = (field: string, value: any) => {
  if (getLocalFallbackMode()) {
    return;
  }
  const fbUser = auth.currentUser;
  if (fbUser) {
    setDoc(doc(fdb, 'users', fbUser.uid), {
      settings: {
        [field]: value
      }
    }, { merge: true }).catch(err => {
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
        setLocalFallbackMode(true);
        window.dispatchEvent(new CustomEvent('nom030-db-quota-exhausted'));
      }
      console.warn(`Failed to sync ${field} setting to Firestore:`, err);
    });
  }
};

interface AppState {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  currentCompanyId: number | null;
  setCurrentCompanyId: (id: number | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  isAdminMode: boolean;
  setIsAdminMode: (admin: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      currentCompanyId: null,
      setCurrentCompanyId: (id) => {
        set({ currentCompanyId: id });
        syncSettingToFirestore('currentCompanyId', id);
      },
      activeTab: "companies",
      setActiveTab: (tab) => {
        set({ activeTab: tab });
        syncSettingToFirestore('activeTab', tab);
      },
      isOnline: navigator.onLine,
      setIsOnline: (online) => set({ isOnline: online }),
      isAdminMode: false,
      setIsAdminMode: (admin) => set({ isAdminMode: admin }),
    }),
    {
      name: 'nom030-auth-storage',
      partialize: (state) => ({ 
        currentUser: state.currentUser, 
        isAdminMode: state.isAdminMode,
        currentCompanyId: state.currentCompanyId,
        activeTab: state.activeTab
      }), // Persist session, company, and current tab between updates
    }
  )
);
