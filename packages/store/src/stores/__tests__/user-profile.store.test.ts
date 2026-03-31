import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUserProfileStore } from '../user-profile.store';
import { UserProfile } from '@baishou/shared';

describe('useUserProfileStore', () => {
  const mockBaseProfile: UserProfile = {
    nickname: 'TestUser',
    avatarPath: null,
    activePersonaId: 'P1',
    personas: {
      'P1': { id: 'P1', facts: { 'Role': 'Dev' } }
    }
  };

  beforeEach(() => {
    (global as any).window = {
      api: {
        profile: {
          getProfile: vi.fn(),
          saveProfile: vi.fn(),
          pickAndSaveAvatar: vi.fn()
        }
      }
    };
    
    useUserProfileStore.setState({
      profile: null,
      isLoading: false
    });
  });

  it('should initialize empty profile', () => {
    const state = useUserProfileStore.getState();
    expect(state.profile).toBeNull();
  });

  it('should load profile via IPC', async () => {
    (global as any).window.api.profile.getProfile.mockResolvedValue(mockBaseProfile);
    
    await useUserProfileStore.getState().loadProfile();
    expect(useUserProfileStore.getState().profile?.nickname).toBe('TestUser');
  });

  describe('Direct fields mutations', () => {
    beforeEach(() => {
      useUserProfileStore.setState({ profile: mockBaseProfile });
    });

    it('should update nickname', async () => {
      await useUserProfileStore.getState().updateNickname('NewName');
      expect(useUserProfileStore.getState().profile?.nickname).toBe('NewName');
      expect((global as any).window.api.profile.saveProfile).toHaveBeenCalled();
    });

    it('should call pickAndSaveAvatar and wait for path', async () => {
      (global as any).window.api.profile.pickAndSaveAvatar.mockResolvedValue('/new/img.png');
      await useUserProfileStore.getState().pickAndSaveAvatar();
      expect(useUserProfileStore.getState().profile?.avatarPath).toBe('/new/img.png');
    });
  });

  describe('Personas management', () => {
    beforeEach(() => {
      useUserProfileStore.setState({ profile: JSON.parse(JSON.stringify(mockBaseProfile)) });
    });

    it('should add new persona', async () => {
      await useUserProfileStore.getState().addPersona('P2');
      const profile = useUserProfileStore.getState().profile!;
      expect(profile.personas['P2']).toBeDefined();
      expect(profile.activePersonaId).toBe('P2');
    });

    it('should remove persona but never less than 1', async () => {
      await useUserProfileStore.getState().removePersona('P1');
      expect(Object.keys(useUserProfileStore.getState().profile!.personas).length).toBe(1); // Denied
      
      await useUserProfileStore.getState().addPersona('P2');
      await useUserProfileStore.getState().removePersona('P1');
      const profile = useUserProfileStore.getState().profile!;
      expect(Object.keys(profile.personas).length).toBe(1);
      expect(profile.personas['P2']).toBeDefined();
      expect(profile.activePersonaId).toBe('P2'); // switch fallback
    });

    it('should rename persona successfully', async () => {
      await useUserProfileStore.getState().renamePersona('P1', 'P-Renamed');
      const profile = useUserProfileStore.getState().profile!;
      expect(profile.personas['P-Renamed'].facts).toEqual({ 'Role': 'Dev' });
      expect(profile.personas['P1']).toBeUndefined();
      expect(profile.activePersonaId).toBe('P-Renamed'); // auto sync
    });

    it('should duplicate persona successfully', async () => {
      await useUserProfileStore.getState().duplicatePersona('P1', 'P2-Copy');
      const profile = useUserProfileStore.getState().profile!;
      expect(profile.personas['P2-Copy'].facts).toEqual({ 'Role': 'Dev' });
      expect(profile.activePersonaId).toBe('P2-Copy');
    });
  });

  describe('Facts management', () => {
    beforeEach(() => {
      useUserProfileStore.setState({ profile: JSON.parse(JSON.stringify(mockBaseProfile)) });
    });

    it('should add fact', async () => {
      await useUserProfileStore.getState().addFact('Age', '18');
      expect(useUserProfileStore.getState().profile!.personas['P1'].facts['Age']).toBe('18');
    });

    it('should remove fact', async () => {
      await useUserProfileStore.getState().removeFact('Role');
      expect(useUserProfileStore.getState().profile!.personas['P1'].facts['Role']).toBeUndefined();
    });

    it('should update all facts', async () => {
      await useUserProfileStore.getState().updateAllFacts({ 'New': 'Fact' });
      expect(useUserProfileStore.getState().profile!.personas['P1'].facts).toEqual({ 'New': 'Fact' });
    });
  });
});
