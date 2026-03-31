import { createStore } from '../create-store';
import type { UserProfile } from '@baishou/shared';

export interface UserProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
}

export interface UserProfileActions {
  loadProfile: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  pickAndSaveAvatar: () => Promise<void>;
  
  // 多身份卡体系 (Persona)
  setActivePersona: (personaId: string) => Promise<void>;
  addPersona: (personaId: string) => Promise<void>;
  removePersona: (personaId: string) => Promise<void>;
  renamePersona: (oldId: string, newId: string) => Promise<void>;
  duplicatePersona: (sourceId: string, newId: string) => Promise<void>;
  
  // 独立身份卡事实管理 (Facts) 作用于当前激活卡
  addFact: (key: string, value: string) => Promise<void>;
  removeFact: (key: string) => Promise<void>;
  updateAllFacts: (facts: Record<string, string>) => Promise<void>;
}

// 帮助函数封装 IPC 同步
const syncIpc = async (profile: UserProfile) => {
  if (typeof window !== 'undefined' && (window as any).api?.profile) {
    await (window as any).api.profile.saveProfile(profile);
  }
};

export const useUserProfileStore = createStore<UserProfileState & UserProfileActions>('UserProfileStore', (set, get: any) => ({
  profile: null,
  isLoading: false,

  loadProfile: async () => {
    set({ isLoading: true });
    try {
      if (typeof window !== 'undefined' && (window as any).api?.profile) {
        const profile = await (window as any).api.profile.getProfile();
        set({ profile });
      }
    } catch (e) {
      console.error('[UserProfileStore] Failed to load profile from IPC', e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateNickname: async (nickname: string) => {
    const { profile } = get() as UserProfileState;
    if (!profile) return;
    const newProfile = { ...profile, nickname };
    set({ profile: newProfile });
    await syncIpc(newProfile);
  },

  pickAndSaveAvatar: async () => {
    if (typeof window !== 'undefined' && (window as any).api?.profile) {
      const newPath = await (window as any).api.profile.pickAndSaveAvatar();
      if (newPath) {
        const { profile } = get() as UserProfileState;
        if (!profile) return;
        const newProfile = { ...profile, avatarPath: newPath };
        set({ profile: newProfile });
        await syncIpc(newProfile);
      }
    }
  },

  setActivePersona: async (personaId: string) => {
    const { profile } = get() as UserProfileState;
    if (!profile || !profile.personas[personaId]) return;
    const newProfile = { ...profile, activePersonaId: personaId };
    set({ profile: newProfile });
    await syncIpc(newProfile);
  },

  addPersona: async (personaId: string) => {
    const { profile } = get() as UserProfileState;
    if (!profile || profile.personas[personaId]) return;
    
    const newPersonas = { ...profile.personas };
    newPersonas[personaId] = { id: personaId, facts: {} };
    
    const newProfile = { ...profile, personas: newPersonas, activePersonaId: personaId };
    set({ profile: newProfile });
    await syncIpc(newProfile);
  },

  removePersona: async (personaId: string) => {
    const { profile } = get() as UserProfileState;
    if (!profile || !profile.personas[personaId]) return;
    
    const keys = Object.keys(profile.personas);
    if (keys.length <= 1) return; // 至少保留一张卡
    
    const newPersonas = { ...profile.personas };
    delete newPersonas[personaId];
    
    let newActiveId = profile.activePersonaId;
    if (newActiveId === personaId) {
      newActiveId = Object.keys(newPersonas)[0];
    }
    
    const newProfile = { ...profile, personas: newPersonas, activePersonaId: newActiveId };
    set({ profile: newProfile });
    await syncIpc(newProfile);
  },

  renamePersona: async (oldId: string, newId: string) => {
    const { profile } = get() as UserProfileState;
    if (!profile || !profile.personas[oldId] || profile.personas[newId] || oldId === newId) return;
    
    const facts = profile.personas[oldId].facts;
    const newPersonas = { ...profile.personas };
    delete newPersonas[oldId];
    newPersonas[newId] = { id: newId, facts };
    
    let newActiveId = profile.activePersonaId;
    if (newActiveId === oldId) {
      newActiveId = newId;
    }
    
    const newProfile = { ...profile, personas: newPersonas, activePersonaId: newActiveId };
    set({ profile: newProfile });
    await syncIpc(newProfile);
  },

  duplicatePersona: async (sourceId: string, newId: string) => {
    const { profile } = get() as UserProfileState;
    if (!profile || !profile.personas[sourceId] || profile.personas[newId]) return;
    
    const facts = { ...profile.personas[sourceId].facts };
    const newPersonas = { ...profile.personas };
    newPersonas[newId] = { id: newId, facts };
    
    const newProfile = { ...profile, personas: newPersonas, activePersonaId: newId };
    set({ profile: newProfile });
    await syncIpc(newProfile);
  },

  addFact: async (key: string, value: string) => {
    const { profile } = get() as UserProfileState;
    if (!profile) return;
    const activePersona = profile.personas[profile.activePersonaId];
    if (!activePersona) return;

    const newFacts = { ...activePersona.facts, [key]: value };
    const newPersonas = { ...profile.personas };
    newPersonas[profile.activePersonaId] = { ...activePersona, facts: newFacts };
    
    const newProfile = { ...profile, personas: newPersonas };
    set({ profile: newProfile });
    await syncIpc(newProfile);
  },

  removeFact: async (key: string) => {
    const { profile } = get() as UserProfileState;
    if (!profile) return;
    const activePersona = profile.personas[profile.activePersonaId];
    if (!activePersona) return;

    const newFacts = { ...activePersona.facts };
    delete newFacts[key];
    const newPersonas = { ...profile.personas };
    newPersonas[profile.activePersonaId] = { ...activePersona, facts: newFacts };
    
    const newProfile = { ...profile, personas: newPersonas };
    set({ profile: newProfile });
    await syncIpc(newProfile);
  },

  updateAllFacts: async (facts: Record<string, string>) => {
    const { profile } = get() as UserProfileState;
    if (!profile) return;
    const activePersona = profile.personas[profile.activePersonaId];
    if (!activePersona) return;

    const newPersonas = { ...profile.personas };
    newPersonas[profile.activePersonaId] = { ...activePersona, facts: { ...facts } };
    
    const newProfile = { ...profile, personas: newPersonas };
    set({ profile: newProfile });
    await syncIpc(newProfile);
  }
}));
