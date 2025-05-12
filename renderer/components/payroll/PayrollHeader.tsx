import React, { useState, useEffect } from 'react';
import { DateRangePicker } from "@/renderer/components/DateRangePicker";
import { Payroll } from "@/renderer/model/payroll";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useDateRangeStore } from "@/renderer/stores/dateRangeStore";
import { Check, ChevronDown } from "@/renderer/components/icons";
import { safeLocalStorageGetItem } from "@/renderer/lib/utils";
import { cn } from "@/renderer/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/renderer/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/renderer/components/ui/command";
import { Button } from "@/renderer/components/ui/button";
import { isWebEnvironment, getCompanyName } from "@/renderer/lib/firestoreService";
import { collection, getDocs } from "firebase/firestore";
import { getFirestoreInstance } from "@/renderer/lib/firestoreService";

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
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

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
        setOpen(false);

        // Update the date range in the store
        setDateRange(period.startDate, period.endDate);
    };

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

                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="mt-1 w-[350px] justify-between text-sm"
                        >
                            {selectedPeriod ? selectedPeriod.label : "Select payroll period..."}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[380px] p-0 z-50">
                        <Command>
                            <CommandList className="max-h-[300px]">
                                {loading ? (
                                    <CommandEmpty>Loading...</CommandEmpty>
                                ) : payrollPeriods.length === 0 ? (
                                    <CommandEmpty>No payroll periods found.</CommandEmpty>
                                ) : (
                                    <CommandGroup>
                                        {payrollPeriods.map((period) => (
                                            <CommandItem
                                                key={period.id}
                                                value={period.label}
                                                onSelect={() => handleSelectPeriod(period)}
                                                className="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                            >
                                                <span>{period.label}</span>
                                                <Check
                                                    className={cn(
                                                        "ml-4 h-4 w-4",
                                                        selectedPeriod?.id === period.id
                                                            ? "opacity-100"
                                                            : "opacity-0"
                                                    )}
                                                />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}; 