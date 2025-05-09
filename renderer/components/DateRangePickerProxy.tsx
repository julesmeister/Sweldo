import React, { useState, useEffect } from 'react';
import { useDateRangeStore } from '../stores/dateRangeStore';
import { format, addMonths } from 'date-fns';

interface DateRangePickerProxyProps {
    variant?: 'default' | 'timesheet';
    onRefresh?: () => void;
}

/**
 * This is a proxy component that renders a simple date range display
 * and dynamically loads the real DateRangePicker component only on the client side.
 * This prevents CSS import issues during the build process.
 */
export const DateRangePickerProxy: React.FC<DateRangePickerProxyProps> = (props) => {
    const { dateRange } = useDateRangeStore();
    const [ActualComponent, setActualComponent] = useState<React.ComponentType<any> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // Format date for display
    const formatDateDisplay = (date: Date | null) => {
        if (!date) return "";
        try {
            return format(date, "MMM d, yyyy");
        } catch (error) {
            console.error("Error formatting date:", error);
            return "";
        }
    };

    // Dynamically load the actual component only on the client side
    useEffect(() => {
        const loadComponent = async () => {
            try {
                // Dynamic import to avoid CSS bundling during build
                const module = await import('./DateRangePicker');
                setActualComponent(() => module.DateRangePicker);
                setHasError(false);
            } catch (error) {
                console.error('Failed to load DateRangePicker component:', error);
                setHasError(true);
            } finally {
                setIsLoading(false);
            }
        };

        if (typeof window !== 'undefined') {
            loadComponent();
        }
    }, []);

    // Render a simple placeholder during loading or on error
    const renderPlaceholder = () => (
        <div className="flex items-center w-full relative">
            <div className={`relative flex-1 flex items-center bg-gradient-to-r from-sky-50/50 via-blue-50/50 to-sky-50/50 rounded-xl px-1.5 border border-blue-100/50 ${hasError ? 'border-red-200' : ''}`}>
                <div className="flex-1 px-2 py-2.5 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <svg
                            className={`w-4 h-4 mr-2.5 ${hasError ? 'text-red-400' : 'text-blue-400'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                        <span className={`text-sm font-medium ${hasError ? 'text-red-400' : 'text-blue-400'}`}>
                            {dateRange?.startDate
                                ? formatDateDisplay(new Date(dateRange.startDate))
                                : hasError ? "Error loading" : "Start date"}
                        </span>
                    </div>

                    <svg
                        className={`w-5 h-5 ${hasError ? 'text-red-400' : 'text-blue-400'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                    </svg>

                    <div className="flex items-center space-x-2">
                        <svg
                            className={`w-4 h-4 mr-2.5 ${hasError ? 'text-red-400' : 'text-blue-400'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                        <span className={`text-sm font-medium ${hasError ? 'text-red-400' : 'text-blue-400'}`}>
                            {dateRange?.endDate
                                ? formatDateDisplay(new Date(dateRange.endDate))
                                : "End date"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );

    // If we're on the server, still loading, or encountered an error, render the placeholder
    if (!ActualComponent || hasError) {
        return renderPlaceholder();
    }

    // Wrap the actual component with error boundary
    try {
        // Render the actual component once loaded
        return <ActualComponent {...props} />;
    } catch (error) {
        console.error('Error rendering DateRangePicker:', error);
        return renderPlaceholder();
    }
}; 