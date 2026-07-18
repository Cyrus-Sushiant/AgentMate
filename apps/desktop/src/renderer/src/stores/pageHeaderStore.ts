import { useEffect } from 'react';
import { create } from 'zustand';

interface PageHeaderState {
  title: string;
  subtitle?: string;
  setHeader: (title: string, subtitle?: string) => void;
  clearHeader: () => void;
}

export const usePageHeaderStore = create<PageHeaderState>((set) => ({
  title: '',
  subtitle: undefined,
  setHeader: (title, subtitle) => set({ title, subtitle }),
  clearHeader: () => set({ title: '', subtitle: undefined }),
}));

export function usePageHeader(title: string, subtitle?: string): void {
  const setHeader = usePageHeaderStore((s) => s.setHeader);
  const clearHeader = usePageHeaderStore((s) => s.clearHeader);

  useEffect(() => {
    setHeader(title, subtitle);
    return () => clearHeader();
  }, [title, subtitle, setHeader, clearHeader]);
}
