import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangeState {
  dateRange: DateRange;
  setDateRange: (startDate: Date | null, endDate: Date | null) => void;
}

// Safe storage wrapper for Electron/Next.js environment
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(name);
      }
      return null;
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(name, value);
      }
    } catch (error) {
      console.warn('Failed to write to localStorage:', error);
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(name);
      }
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }
};

// Custom serializer/deserializer for dates
const dateTransform = {
  serialize: (state: any) => {
    const dateRange = state?.dateRange || { startDate: null, endDate: null };
    return {
      ...state,
      dateRange: {
        startDate: dateRange.startDate ? new Date(dateRange.startDate).toISOString() : null,
        endDate: dateRange.endDate ? new Date(dateRange.endDate).toISOString() : null,
      },
    };
  },
  deserialize: (state: any) => {
    console.log('Deserializing state:', state);
    const dateRange = state?.dateRange || { startDate: null, endDate: null };
    
    // Ensure we have valid dates or null
    let startDate = null;
    let endDate = null;
    
    try {
      if (dateRange.startDate) {
        startDate = new Date(dateRange.startDate);
        if (isNaN(startDate.getTime())) startDate = null;
      }
      
      if (dateRange.endDate) {
        endDate = new Date(dateRange.endDate);
        if (isNaN(endDate.getTime())) endDate = null;
      }
    } catch (error) {
      console.error('Error parsing dates:', error);
    }
    
    return {
      ...state,
      dateRange: { startDate, endDate },
    };
  },
};

export const useDateRangeStore = create<DateRangeState>()(
  persist(
    (set) => ({
      dateRange: {
        startDate: null,
        endDate: null,
      },
      setDateRange: (startDate: Date | null, endDate: Date | null) => {
        // Ensure we're working with valid Date objects
        const validStartDate = startDate ? new Date(startDate) : null;
        const validEndDate = endDate ? new Date(endDate) : null;
        
        // Only set if we have valid dates
        if ((validStartDate === null || !isNaN(validStartDate.getTime())) &&
            (validEndDate === null || !isNaN(validEndDate.getTime()))) {
          set({ dateRange: { startDate: validStartDate, endDate: validEndDate } });
        } else {
          console.error('Invalid date provided to setDateRange');
        }
      },
    }),
    {
      name: 'date-range-storage',
      storage: {
        getItem: (name) => {
          const str = safeStorage.getItem(name);
          if (!str) return null;
          try {
            return dateTransform.deserialize(JSON.parse(str));
          } catch (error) {
            console.error('Error parsing storage data:', error);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            safeStorage.setItem(name, JSON.stringify(dateTransform.serialize(value)));
          } catch (error) {
            console.error('Error serializing data:', error);
          }
        },
        removeItem: (name) => safeStorage.removeItem(name),
      },
    }
  )
);
