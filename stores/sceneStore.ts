'use client';
import { create } from 'zustand';

interface StandaloneSceneState {
  organs: Record<string, any>;
  background: 'dark' | 'light' | 'studio';
  selectedId: string | null;
  select: (id: string | null) => void;
}

export const useSceneStore = create<StandaloneSceneState>((set) => ({
  organs: {},
  background: 'dark',
  selectedId: null,
  select: (selectedId) => set({ selectedId }),
}));
