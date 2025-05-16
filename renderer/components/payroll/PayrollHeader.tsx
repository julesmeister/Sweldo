import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DateRangePicker } from "@/renderer/components/DateRangePicker";
import { Payroll } from "@/renderer/model/payroll";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useDateRangeStore } from "@/renderer/stores/dateRangeStore";
import { Check, ChevronDown } from "@/renderer/components/icons";
import { safeLocalStorageGetItem } from "@/renderer/lib/utils";
import { cn } from "@/renderer/lib/utils";
import { Button } from "@/renderer/components/ui/button";
import { isWebEnvironment, getCompanyName } from "@/renderer/lib/firestoreService";
import { collection, getDocs } from "firebase/firestore";
import { getFirestoreInstance } from "@/renderer/lib/firestoreService";
import { createPortal } from "react-dom";

interface PayrollHeaderProps {
    hasManageAccess: boolean;
}

interface PayrollPeriod {
    id: string;
    label: string;
    startDate: Date;
    endDate: Date;
}

// Helper function to parse Firestore Timestamps or date strings
const parseDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;

    // Firestore Timestamp object (with seconds and nanoseconds)
    if (typeof dateInput === 'object' && dateInput !== null && dateInput.seconds !== undefined && dateInput.nanoseconds !== undefined) {
        return new Date(dateInput.seconds * 1000);
    }
    // Already a Date object
    if (dateInput instanceof Date) {
        return dateInput;
    }
    // Date string or number (timestamp)
    try {
        const d = new Date(dateInput);
        if (!isNaN(d.getTime())) {
            return d;
        }
    } catch (e) {
        // Fall through if parsing fails
    }
    console.warn("[PayrollHeader] Could not parse date input:", dateInput);
    return null;
};

export const PayrollHeader: React.FC<PayrollHeaderProps> = ({
    hasManageAccess,
}) => {
    const { dbPath } = useSettingsStore();
    const { setDateRange } = useDateRangeStore();
    const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

    // Load payroll periods directly from Firestore without employee selection
    const loadAllPayrollPeriods = async () => {
        setLoading(true);
        try {
            // Get the current year from local storage or use current year
            const storedYear = safeLocalStorageGetItem("selectedYear");
            const year = storedYear ? parseInt(storedYear, 10) : new Date().getFullYear();
            console.log(`[PayrollHeader] Loading all payroll periods for year ${year}`);

            const periods: PayrollPeriod[] = [];

            if (isWebEnvironment()) {
                const companyName = await getCompanyName();
                console.log(`[PayrollHeader] Loading periods for company: ${companyName}`);

                const db = getFirestoreInstance();
                const payrollsRef = collection(db, `companies/${companyName}/payrolls`);
                const querySnapshot = await getDocs(payrollsRef);

                console.log(`[PayrollHeader] Found ${querySnapshot.size} total payroll documents`);

                // Process all documents
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    console.log(`[PayrollHeader] Processing document ID: ${doc.id}`);
                    if (data && data.payrolls && Array.isArray(data.payrolls)) {
                        // Process each payroll entry in this document
                        data.payrolls.forEach((payroll: any, index: number) => {
                            console.log(`[PayrollHeader] Document ${doc.id}, Payroll entry ${index}:`, JSON.stringify(payroll));
                            try {
                                const startDate = parseDate(payroll.startDate);
                                const endDate = parseDate(payroll.endDate);

                                if (startDate && endDate) {
                                    console.log(`[PayrollHeader] Parsed dates - Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);

                                    // Check if year matches
                                    if (startDate.getFullYear() === year || endDate.getFullYear() === year) {
                                        const startFormatted = startDate.toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric"
                                        });
                                        const endFormatted = endDate.toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric"
                                        });

                                        const label = `${startFormatted} - ${endFormatted}`;
                                        console.log(`[PayrollHeader] Generated label: ${label}`);

                                        periods.push({
                                            id: payroll.id || doc.id, // Use payroll.id if available, else doc.id as fallback
                                            startDate,
                                            endDate,
                                            label
                                        });
                                    } else {
                                        console.log(`[PayrollHeader] Year mismatch: StartDateYear=${startDate.getFullYear()}, EndDateYear=${endDate.getFullYear()}, TargetYear=${year}`);
                                    }
                                } else {
                                    console.log(`[PayrollHeader] Skipped payroll entry due to invalid or missing startDate or endDate:`, JSON.stringify(payroll));
                                }
                            } catch (parseError) {
                                console.error(`[PayrollHeader] Error processing payroll date for entry:`, JSON.stringify(payroll), parseError);
                            }
                        });
                    } else {
                        console.log(`[PayrollHeader] Document ${doc.id} has no payrolls array or invalid data.`);
                    }
                });
                console.log(`[PayrollHeader] Raw periods collected (before deduplication): ${periods.length} items`, JSON.stringify(periods));
            } else {
                // For desktop mode, use the existing Payroll.getAvailablePayrollPeriods method
                try {
                    const desktopPeriods = await Payroll.getAvailablePayrollPeriods(dbPath || "web", year);
                    periods.push(...desktopPeriods);
                    console.log(`[PayrollHeader] Desktop periods collected (before deduplication): ${periods.length} items`, JSON.stringify(periods));
                } catch (error) {
                    console.error("[PayrollHeader] Error loading payroll periods in desktop mode:", error);
                }
            }

            // Remove duplicates based on date range
            const uniquePeriods = periods.reduce((acc, current) => {
                const key = `${current.startDate.getTime()}-${current.endDate.getTime()}`;
                if (!acc.some(item => `${item.startDate.getTime()}-${item.endDate.getTime()}` === key)) {
                    acc.push(current);
                }
                return acc;
            }, [] as PayrollPeriod[]);

            // Sort by date (most recent first)
            const sortedPeriods = uniquePeriods.sort((a, b) =>
                b.startDate.getTime() - a.startDate.getTime()
            );

            console.log(`[PayrollHeader] Found ${sortedPeriods.length} unique payroll periods`);
            setPayrollPeriods(sortedPeriods);
        } catch (error) {
            console.error("[PayrollHeader] Error loading payroll periods:", error);
        } finally {
            setLoading(false);
        }
    };

    // Load payroll periods when component mounts
    useEffect(() => {
        loadAllPayrollPeriods();
    }, [dbPath]);

    // Handler for selecting a payroll period
    const handleSelectPeriod = (period: PayrollPeriod) => {
        setSelectedPeriod(period);
        setIsOpen(false);

        // Update the date range in the store
        setDateRange(period.startDate, period.endDate);
    };

    // Set up portal
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Handle click outside
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

        // Update position on scroll or resize
        const handleReposition = () => {
            if (isOpen) {
                updatePosition();
            }
        };

        document.addEventListener("click", handleClickOutside);
        window.addEventListener("scroll", handleReposition, true);
        window.addEventListener("resize", handleReposition);

        return () => {
            document.removeEventListener("click", handleClickOutside);
            window.removeEventListener("scroll", handleReposition, true);
            window.removeEventListener("resize", handleReposition);
        };
    }, [isOpen]);

    // Update dropdown position based on trigger position
    const updatePosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 5,
                left: rect.left + window.scrollX,
            });
        }
    };

    // Handle opening/closing the dropdown
    const toggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen) {
            updatePosition();
        }
        setIsOpen(!isOpen);
    };

    // Dropdown menu rendered in portal
    const dropdownMenu = useMemo(() => {
        if (!isOpen || !mounted) return null;

        const menu = (
            <div
                ref={dropdownRef}
                className="fixed shadow-2xl border border-gray-200 bg-white rounded-xl overflow-hidden w-[380px]"
                style={{
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                    zIndex: 9999,
                }}
            >
                <div className="py-2 w-full overflow-y-auto max-h-[320px] scrollbar-thin">
                    {loading ? (
                        <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                            <span className="ml-2 text-sm text-gray-600">Loading payroll periods...</span>
                        </div>
                    ) : payrollPeriods.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">
                            No payroll periods found
                        </div>
                    ) : (
                        payrollPeriods.map((period) => (
                            <div
                                key={period.id}
                                className={`mx-2 px-3 py-2.5 text-sm cursor-pointer rounded-lg transition-all duration-200 ${period.id === selectedPeriod?.id
                                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm"
                                    : "hover:bg-blue-50 hover:text-blue-700"
                                    }`}
                                onClick={() => handleSelectPeriod(period)}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{period.label}</span>
                                    <Check
                                        className={cn(
                                            "ml-4 h-4 w-4",
                                            selectedPeriod?.id === period.id
                                                ? "opacity-100"
                                                : "opacity-0"
                                        )}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );

        // Use portal to render outside of any containing elements that might have overflow: hidden
        return createPortal(menu, document.body);
    }, [
        payrollPeriods,
        selectedPeriod?.id,
        isOpen,
        mounted,
        dropdownPosition,
        loading,
    ]);

    return (
        <div className="flex-1 flex items-start justify-between gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                            <svg
                                className="w-3.5 h-3.5 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                            <span className="text-[13px] font-medium text-gray-600">
                                Date Range Picker
                            </span>
                        </div>
                        <span className="text-[11px] text-gray-500">
                            Select date range for payroll
                        </span>
                    </div>
                </div>
                <DateRangePicker />
            </div>

            {/* Payroll Periods Dropdown */}
            <div className="flex flex-col relative">
                <div className="flex items-center gap-1.5">
                    <svg
                        className="w-3.5 h-3.5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                    </svg>
                    <span className="text-[13px] font-medium text-gray-600">
                        Available Payrolls
                    </span>
                </div>
                <span className="text-[11px] text-gray-500">
                    Select from existing payroll periods
                </span>

                <div
                    ref={triggerRef}
                    onClick={toggleDropdown}
                    className="relative mt-1"
                >
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isOpen}
                        className="w-[350px] justify-between text-sm text-gray-700"
                    >
                        {selectedPeriod ? selectedPeriod.label : "Select payroll period..."}
                        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`} />
                    </Button>
                </div>
                {dropdownMenu}
            </div>
        </div>
    );
}; 