"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShineBorder } from "@/renderer/components/magicui/shine-border"; // Updated import for ShineBorder component
import create from "zustand";
import { MagicCard } from "./magicui/magic-card";

interface DateSelectorState {
  selectedMonth: number;
  selectedYear: number;
  isOpen: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
  setIsOpen: (isOpen: boolean) => void;
  setTimeoutId: (timeoutId: ReturnType<typeof setTimeout> | null) => void;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
}

// Modified Zustand store
const useStore = create<DateSelectorState>((set) => ({
  selectedMonth: new Date().getMonth(),
  selectedYear: new Date().getFullYear(),
  isOpen: false,
  timeoutId: null,
  setIsOpen: (isOpen) => set({ isOpen }),
  setTimeoutId: (timeoutId) => set({ timeoutId }),
  setSelectedMonth: (month) => {
    localStorage.setItem("selectedMonth", month.toString());
    set({ selectedMonth: month });
  },
  setSelectedYear: (year) => {
    localStorage.setItem("selectedYear", year.toString());
    set({ selectedYear: year });
  },
}));

// Export the store so it can be used in other components
export { useStore as useDateSelectorStore };

export default function DateSelector() {
  const {
    selectedMonth,
    selectedYear,
    isOpen,
    timeoutId,
    setIsOpen,
    setTimeoutId,
    setSelectedMonth,
    setSelectedYear,
  } = useStore();

  // Effect to hydrate state from localStorage after mounting
  useEffect(() => {
    const storedMonth = localStorage.getItem("selectedMonth");
    if (storedMonth !== null) {
      setSelectedMonth(parseInt(storedMonth));
    }

    const storedYear = localStorage.getItem("selectedYear");
    if (storedYear !== null) {
      setSelectedYear(parseInt(storedYear));
    }
    // Run only once on mount
  }, []);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const years = Array.from(
    { length: new Date().getFullYear() - 2024 + 1 },
    (_, i) => 2024 + i
  );

  const handleMouseLeave = () => {
    const id = setTimeout(() => setIsOpen(false), 300); // Delay of 300ms
    setTimeoutId(id);
  };

  const handleMouseEnter = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsOpen(true);
  };

  return (
    <div
      className="relative inline-block text-left"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={` rounded-lg px-3 py-1 text-sm font-medium  ${
          isOpen
            ? "bg-white text-black"
            : "text-white hover:bg-white hover:text-black"
        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500 transition-all duration-200 `}
      >
        <button className="inline-flex items-end flex-col text-left leading-none">
          <span className="text-sm">
            {years[selectedYear - 2024] || "2025"}
          </span>{" "}
          {/* Display the selected year or a default text */}
          <span
            className="text-lg font-bold pb-1"
            style={{ lineHeight: "0.8" }}
          >
            {months[selectedMonth]}
          </span>{" "}
          {/* Display the selected month in larger font */}
        </button>
      </div>
      {isOpen && (
        <div className="relative">
          <div className="absolute right-0 z-10 mt-2 w-60 rounded-md shadow-lg bg-white">
            <div
              className="grid grid-cols-2 gap-2 p-2 max-h-[200px]"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="options-menu"
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Month
                </label>
                <div className="overflow-y-auto max-h-[150px] rounded-md border border-gray-200">
                  {months.map((month, index) => (
                    <button
                      key={index}
                      className={`block w-full text-left px-3 py-2 text-sm ${
                        selectedMonth === index
                          ? "bg-gray-100 text-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                      onClick={() => {
                        setSelectedMonth(index);
                      }}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Year
                </label>
                <div className="overflow-y-auto max-h-[150px] rounded-md border border-gray-200">
                  {years
                    .slice()
                    .reverse()
                    .map((year) => (
                      <button
                        key={year}
                        className={`block w-full text-left px-3 py-2 text-sm ${
                          selectedYear === year
                            ? "bg-gray-100 text-blue-600"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedYear(year)}
                      >
                        {year}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
