'use client';

import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { Holiday, createHolidayModel } from '@/renderer/model/holiday';
import { MagicCard } from './magicui/magic-card';
import { isWebEnvironment } from '@/renderer/lib/firestoreService';
import { loadHolidaysFirestore } from '@/renderer/model/holiday_firestore';
import { clearHolidayCache } from '@/renderer/lib/db';
import { IoReloadOutline } from 'react-icons/io5';
import { toast } from 'sonner';
import DecryptedText from '../styles/DecryptedText/DecryptedText';

export default function HolidayCalendar() {
  // Persistent refs to prevent data loss on rerenders
  const holidaysRef = useRef<Holiday[]>([]);
  const hasLoadedDataRef = useRef<boolean>(false);
  const loadAttemptedRef = useRef<boolean>(false);

  // State
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { dbPath, companyName } = useSettingsStore();
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  // Initialize date from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const month = localStorage.getItem("selectedMonth");
      const year = localStorage.getItem("selectedYear");

      setStoredMonth(month);
      setStoredYear(year);
    }
  }, []);

  // Parse dates
  const storedMonthInt = storedMonth ? parseInt(storedMonth, 10) + 1 : 0;
  let storedYearInt = storedYear ? parseInt(storedYear, 10) : new Date().getFullYear();
  if (!storedYear) {
    const currentYear = new Date().getFullYear().toString();
    if (typeof window !== 'undefined') {
      localStorage.setItem("selectedYear", currentYear);
    }
    storedYearInt = parseInt(currentYear, 10);
  }

  // Load holidays with better error handling and persistence
  const loadHolidays = async () => {
    // Prevent multiple loads
    if (isLoading || loadAttemptedRef.current) return;

    loadAttemptedRef.current = true;
    setIsLoading(true);

    try {
      if (isWebEnvironment()) {
        if (!companyName) {
          console.warn('[HolidayCalendar] Company name not set in web mode');
          setIsLoading(false);
          return;
        }

        // Attempt to load and cache holidays
        const data = await loadHolidaysFirestore(storedYearInt, storedMonthInt, companyName);

        // Always update the ref, only update state if we got data or don't have data yet
        if (data.length > 0) {
          holidaysRef.current = data;
          setHolidays(data);
          hasLoadedDataRef.current = true;
        }
      } else {
        if (!dbPath) {
          console.warn('[HolidayCalendar] Database path not set in desktop mode');
          setIsLoading(false);
          return;
        }

        const holidayModel = createHolidayModel(dbPath, storedYearInt, storedMonthInt);
        const loaded = await holidayModel.loadHolidays();

        // Always update the ref, only update state if we got data or don't have data yet
        if (loaded.length > 0) {
          holidaysRef.current = loaded;
          setHolidays(loaded);
          hasLoadedDataRef.current = true;
        }
      }
    } catch (error) {
      console.error('[HolidayCalendar] Error loading holidays:', error);
      // If we already have data, don't clear it on error
      if (holidaysRef.current.length > 0) {
        setHolidays(holidaysRef.current);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Alternative loading function that directly updates the state
  const reloadHolidays = async () => {
    toast('Reloading holidays...', { icon: '🔄' });
    setIsLoading(true);

    if (companyName && storedYearInt && storedMonthInt) {
      try {
        // First clear the cache
        await clearHolidayCache(companyName, storedYearInt, storedMonthInt);

        // Then fetch directly
        const data = await loadHolidaysFirestore(storedYearInt, storedMonthInt, companyName);

        // Always update both the ref and the state
        holidaysRef.current = data;
        setHolidays(data);
        hasLoadedDataRef.current = true;

        toast.success(`Reloaded ${data.length} holidays`);
      } catch (error) {
        console.error('[HolidayCalendar] Error reloading holidays:', error);
        toast.error('Failed to reload holidays');
      }
    } else {
      toast.error('Cannot reload - missing company, year or month data');
    }

    setIsLoading(false);
  };

  // Main effect to load data
  useEffect(() => {
    // Prevent multiple loading attempts from different renders
    if (loadAttemptedRef.current && hasLoadedDataRef.current && holidays.length > 0) {
      return;
    }

    // Reset load attempted on key dependency changes
    if (reloadCounter > 0 || (!loadAttemptedRef.current && (dbPath || companyName) && storedYearInt && storedMonthInt)) {
      loadAttemptedRef.current = false;
      loadHolidays();
    }
  }, [dbPath, companyName, storedYearInt, storedMonthInt, reloadCounter]);

  // Restore from ref if state is cleared but ref has data
  useEffect(() => {
    if (holidays.length === 0 && holidaysRef.current.length > 0 && hasLoadedDataRef.current) {
      setHolidays(holidaysRef.current);
    }
  }, [holidays]);

  return (
    <MagicCard className='p-0.5 rounded-lg' gradientSize={200} gradientColor="#9E7AFF" gradientOpacity={0.8} gradientFrom="#9E7AFF" gradientTo="#FE8BBB">
      <div className="overflow-hidden bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            <DecryptedText text={isWebEnvironment() && companyName ? `${companyName} Holidays` : "Holiday Calendar"} animateOn="view" revealDirection='start' sequential={true}/>
          </h2>
          {isWebEnvironment() && companyName && (
            <button
              type="button"
              onClick={reloadHolidays}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <IoReloadOutline className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Date Range</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Type</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading && holidays.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    Loading holidays...
                  </td>
                </tr>
              ) : holidays
                .filter((holiday) => {
                  const startDate = new Date(holiday.startDate);
                  const endDate = new Date(holiday.endDate);
                  return !isNaN(startDate.getTime()) && !isNaN(endDate.getTime());
                })
                .map((holiday) => {
                  const startDate = new Date(holiday.startDate);
                  const endDate = new Date(holiday.endDate);
                  return (
                    <tr
                      key={holiday.id}
                      className="hover:bg-gray-50"
                      style={{
                        backgroundColor: 'transparent',
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-b border-gray-200">
                        {holiday.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-200">
                        {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-200">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${holiday.type === 'Special' ? 'bg-purple-100 text-purple-800' : holiday.type === 'Regular' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {holiday.type === 'Special' ? 'Special Holiday' : holiday.type === 'Regular' ? 'Regular Holiday' : 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {!isLoading && holidays.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    {isWebEnvironment() && !companyName
                      ? "Please select a company to view holidays"
                      : "No holidays found for this month"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MagicCard>
  );
}
