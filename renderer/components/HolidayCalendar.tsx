'use client';

import { useState } from 'react';
import { MagicCard } from './magicui/magic-card';

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'regular' | 'special';
}

export default function HolidayCalendar() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  return (
    <MagicCard className='p-0.5 rounded-lg' gradientSize={200} gradientColor="#9E7AFF" gradientOpacity={0.8} gradientFrom="#9E7AFF" gradientTo="#FE8BBB">
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Holidays</h2>
      <div className="space-y-4">
        {holidays.map((holiday) => (
          <div
            key={holiday.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div>
              <p className="font-medium text-gray-900">{holiday.name}</p>
              <p className="text-sm text-gray-500">{holiday.date}</p>
            </div>
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                holiday.type === 'regular'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {holiday.type === 'regular' ? 'Regular Holiday' : 'Special Holiday'}
            </span>
          </div>
        ))}
        {holidays.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="text-gray-400 text-2xl">📅</div>
            <p className="text-center text-gray-500 font-medium">
              No holidays for the selected month
            </p>
          </div>
        )}
      </div>
    </div>
    </MagicCard>
  );
}
