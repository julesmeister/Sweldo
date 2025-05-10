"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoSyncOutline, IoCheckmarkCircleOutline, IoWarningOutline, IoHourglassOutline, IoReaderOutline } from 'react-icons/io5';
import { getLogs, SyncLogEntry } from '../model/SyncLogger'; // Adjusted path
import { isWebEnvironment } from '../lib/firestoreService';

const SyncStatusDropdown: React.FC = () => {
    const [isDesktop, setIsDesktop] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    useEffect(() => {
        setIsDesktop(!isWebEnvironment());
    }, []);

    const fetchLogs = useCallback(async () => {
        if (!isDesktop) return;
        setIsLoadingLogs(true);
        try {
            const logs = await getLogs(25); // Fetch last 25 logs
            // Timestamp is already a string as per SyncLogEntry, no processing needed here.
            setSyncLogs(logs);
        } catch (error) {
            console.error("Failed to fetch sync logs:", error);
            setSyncLogs([]); // Clear logs on error
        } finally {
            setIsLoadingLogs(false);
        }
    }, [isDesktop]);

    useEffect(() => {
        if (isDesktop && isOpen) {
            fetchLogs();
        }
    }, [isDesktop, isOpen, fetchLogs]);

    // Periodically refresh logs if the dropdown is open
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        if (isDesktop && isOpen) {
            intervalId = setInterval(fetchLogs, 15000); // Refresh every 15 seconds
        }
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isDesktop, isOpen, fetchLogs]);


    if (!isDesktop) {
        return null; // Don't render anything in web environment
    }

    const getStatusIconAndColor = (log: SyncLogEntry) => {
        switch (log.status) {
            case 'success':
                return { icon: <IoCheckmarkCircleOutline className="text-green-500" size={18} />, color: 'text-green-700' };
            case 'error':
                return { icon: <IoWarningOutline className="text-red-500" size={18} />, color: 'text-red-700' };
            case 'running':
                return { icon: <IoHourglassOutline className="text-yellow-500 animate-spin" size={18} />, color: 'text-yellow-700' };
            case 'info':
                return { icon: <IoReaderOutline className="text-blue-500" size={18} />, color: 'text-blue-700' };
            default:
                return { icon: <IoSyncOutline className="text-gray-500" size={18} />, color: 'text-gray-700' };
        }
    };

    return (
        <div
            className="relative mr-3"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button
                className="text-blue-100 hover:text-white p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
                aria-label="Sync Status"
                onClick={() => setIsOpen(!isOpen)} // Allow click to toggle as well
            >
                <IoSyncOutline size={22} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right z-20" // Added sm:w-96 for wider screens
                    >
                        <div className="rounded-xl bg-white shadow-2xl border border-gray-200/75 overflow-hidden">
                            <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-gray-800">Sync Activity</h3>
                                <button
                                    onClick={fetchLogs}
                                    className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                                    title="Refresh logs"
                                    disabled={isLoadingLogs}
                                >
                                    <IoSyncOutline size={16} className={`text-gray-500 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                {isLoadingLogs && syncLogs.length === 0 ? (
                                    <div className="text-xs text-gray-500 px-3 py-10 text-center flex flex-col items-center justify-center">
                                        <IoHourglassOutline className="text-yellow-500 animate-spin mb-2" size={24} />
                                        Loading logs...
                                    </div>
                                ) : !isLoadingLogs && syncLogs.length === 0 ? (
                                    <p className="text-xs text-gray-500 px-3 py-10 text-center">No sync activity yet.</p>
                                ) : (
                                    syncLogs.map(log => {
                                        const { icon, color } = getStatusIconAndColor(log);
                                        return (
                                            <div key={log.id} className="px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/75 transition-colors">
                                                <div className="flex items-start space-x-2.5">
                                                    <div className="flex-shrink-0 mt-0.5">{icon}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center mb-0.5">
                                                            <span className={`text-xs font-semibold ${color} capitalize`}>
                                                                {log.modelName} - {typeof log.operation === 'string' ? log.operation : 'N/A'}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                                                {/* Convert string timestamp to Date for formatting with Date and Time*/}
                                                                {new Date(log.timestamp).toLocaleString([], {
                                                                    year: 'numeric', month: 'short', day: '2-digit',
                                                                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                                    hour12: true // or false based on preference
                                                                })}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-gray-600 leading-snug whitespace-pre-wrap break-words">
                                                            {log.message}
                                                        </p>
                                                        {log.details && (
                                                            <details className="mt-1 text-[10px] text-gray-500">
                                                                <summary className="cursor-pointer hover:underline">Details</summary>
                                                                <pre className="mt-1 p-1.5 bg-gray-100 rounded text-[9px] max-h-20 overflow-auto custom-scrollbar- énergie-noir whitespace-pre-wrap break-all">
                                                                    {JSON.stringify(log.details, null, 2)}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="px-3 py-2 bg-gray-50/75 border-t border-gray-200/75">
                                <button
                                    onClick={() => alert("Viewing full log will be implemented soon!")}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center py-1 hover:bg-blue-50 rounded-md transition-colors"
                                >
                                    View Full Log
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SyncStatusDropdown; 