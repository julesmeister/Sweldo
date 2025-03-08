'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { Holiday, createHolidayModel } from '@/renderer/model/holiday';
import { MagicCard } from './magicui/magic-card';

export default function HolidayCalendar() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const { dbPath } = useSettingsStore();
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const month = localStorage.getItem("selectedMonth");
      const year = localStorage.getItem("selectedYear");

      setStoredMonth(month);
      setStoredYear(year);
    }
  }, []);

  const storedMonthInt = storedMonth ? parseInt(storedMonth, 10) + 1 : 0;
  let storedYearInt = storedYear ? parseInt(storedYear, 10) : new Date().getFullYear();
  if (!storedYear) {
    const currentYear = new Date().getFullYear().toString();
    if (typeof window !== 'undefined') {
      localStorage.setItem("selectedYear", currentYear);
    }
    storedYearInt = parseInt(currentYear, 10);
  }

  useEffect(() => {
    const loadHolidays = async () => {
      if (!dbPath) {
        console.warn('[HolidayCalendar] Database path not set');
        return;
      }

      try {
        const holidayModel = createHolidayModel(dbPath, storedYearInt, storedMonthInt);
        const loadedHolidays = await holidayModel.loadHolidays();
        setHolidays(loadedHolidays);
      } catch (error) {
        console.error('[HolidayCalendar] Error loading holidays:', error);
        setHolidays([]);
      }
    };

    loadHolidays();
  }, [dbPath, storedYearInt, storedMonthInt]);

  return (
    <MagicCard className='p-0.5 rounded-lg' gradientSize={200} gradientColor="#9E7AFF" gradientOpacity={0.8} gradientFrom="#9E7AFF" gradientTo="#FE8BBB">
      <div className="overflow-hidden bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Holidays</h2>
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
              {holidays
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
                        backgroundColor: holiday.type === 'Special' ? '#f0f7ff' : 'transparent',
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
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            holiday.type === 'Special' ? 'bg-purple-100 text-purple-800' : holiday.type === 'Regular' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {holiday.type === 'Special' ? 'Special Holiday' : holiday.type === 'Regular' ? 'Regular Holiday' : 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    No holidays found for this month
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
