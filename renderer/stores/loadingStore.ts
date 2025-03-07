import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  activeLink: string;
  setActiveLink: (link: string) => void;
}

export const useLoadingStore = create<LoadingState>()((set) => ({
  isLoading: false,
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  activeLink: '',
  setActiveLink: (link: string) => set({ activeLink: link }),
}));
