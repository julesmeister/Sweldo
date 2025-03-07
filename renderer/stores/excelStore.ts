import { create } from 'zustand';
import { ExcelData } from '../model/attendance';

interface ExcelStore {
  excelData: ExcelData | null;
  setExcelData: (data: ExcelData) => void;
}

export const useExcelStore = create<ExcelStore>((set) => ({
  excelData: null,
  setExcelData: (data) => set({ excelData: data }),
}));
