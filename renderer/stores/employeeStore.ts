import create from 'zustand';

interface EmployeeStore {
  selectedEmployeeId: string | null;
  setSelectedEmployeeId: (id: string | null) => void;
}

export const useEmployeeStore = create<EmployeeStore>((set) => ({
  selectedEmployeeId: null,
  setSelectedEmployeeId: (id) => set({ selectedEmployeeId: id }),
}));