import React, { useState } from 'react';

interface MonthPickerProps {
  selectedMonth: Date | null;
  onMonthChange: (date: Date) => void;
}

export function MonthPicker({ selectedMonth, onMonthChange }: MonthPickerProps) {
  const [currentYear, setCurrentYear] = useState(selectedMonth?.getFullYear() || new Date().getFullYear());
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleMonthClick = (monthIndex: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling up
    const newDate = new Date(currentYear, monthIndex);
    onMonthChange(newDate);
  };

  const handleYearChange = (increment: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling up
    setCurrentYear(prev => prev + increment);
  };

  // Add click handler to prevent clicks from bubbling up
  const handlePickerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="w-64 bg-white rounded-lg shadow-lg z-50" onClick={handlePickerClick}>
      <div className="flex items-center justify-between p-2 border-b">
        <button
          onClick={(e) => handleYearChange(-1, e)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium">{currentYear}</span>
        <button
          onClick={(e) => handleYearChange(1, e)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1 p-2">
        {months.map((month, index) => {
          const isSelected = selectedMonth
            ? selectedMonth.getMonth() === index && selectedMonth.getFullYear() === currentYear
            : false;
          
          return (
            <button
              key={month}
              onClick={(e) => handleMonthClick(index, e)}
              className={`p-2 text-sm rounded ${
                isSelected
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              {month.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
