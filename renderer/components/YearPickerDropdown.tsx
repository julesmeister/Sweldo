import React, { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { IoCalendarOutline } from "react-icons/io5"; // Or a generic chevron

interface YearPickerDropdownProps {
    selectedYear: number;
    onSelectYear: (year: number) => void;
    years: number[];
    className?: string;
}

export const YearPickerDropdown: React.FC<YearPickerDropdownProps> = ({
    selectedYear,
    onSelectYear,
    years,
    className = "",
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const [mounted, setMounted] = useState(false);

    const updatePosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 5,
                left: rect.left + window.scrollX,
                width: rect.width, // Match trigger width
            });
        }
    };

    const toggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen) {
            updatePosition();
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                isOpen &&
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleReposition = () => {
            if (isOpen) {
                updatePosition();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleReposition, true);
        window.addEventListener("resize", handleReposition);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleReposition, true);
            window.removeEventListener("resize", handleReposition);
        };
    }, [isOpen]);

    const dropdownMenu = useMemo(() => {
        if (!isOpen || !mounted) return null;

        const menu = (
            <div
                ref={dropdownRef}
                className="fixed shadow-xl border border-gray-200/80 bg-white rounded-lg overflow-hidden"
                style={{
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                    width: `${dropdownPosition.width}px`, // Set width
                    zIndex: 9999, // High z-index
                }}
            >
                <div className="py-1 w-full overflow-y-auto max-h-[200px] scrollbar-thin">
                    {years.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">
                            No years available
                        </div>
                    ) : (
                        years.map((year) => (
                            <div
                                key={year}
                                className={`mx-1 px-3 py-1.5 text-sm cursor-pointer rounded-md transition-all duration-150 ${year === selectedYear
                                    ? "bg-blue-500 text-white"
                                    : "hover:bg-gray-100 text-gray-700"
                                    }`}
                                onClick={() => {
                                    onSelectYear(year);
                                    setIsOpen(false);
                                }}
                            >
                                <div className="flex items-center justify-center">
                                    <span className="font-medium">{year}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );

        return createPortal(menu, document.body);
    }, [
        years,
        selectedYear,
        onSelectYear,
        isOpen,
        mounted,
        dropdownPosition,
    ]);

    return (
        <div className={`inline-block ${className}`}>
            <div
                ref={triggerRef}
                className="flex items-center justify-between cursor-pointer border border-gray-300 rounded-full pl-3 pr-1.5 py-1 bg-white hover:bg-gray-50 transition-colors shadow-sm w-full" // Changed to rounded-full, adjusted padding
                onClick={toggleDropdown}
                style={{ minWidth: '80px' }} // Ensure a minimum width
            >
                <span className="text-gray-700 text-sm font-medium mr-1.5">
                    {selectedYear}
                </span>
                {/* Updated div for circular background arrow */}
                <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full">
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""
                            }`}
                    >
                        <path
                            d="M7 10L12 15L17 10"
                            stroke="white" // Changed stroke to white
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </div>
            {dropdownMenu}
        </div>
    );
};

export default YearPickerDropdown; 