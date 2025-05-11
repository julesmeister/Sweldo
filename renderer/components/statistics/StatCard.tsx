import React from 'react';
import { IoArrowUpOutline, IoArrowDownOutline } from 'react-icons/io5';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: string;
    trendUp?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon,
    trend,
    trendUp,
}) => (
    <div className="bg-white bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2710%27%20height%3D%2710%27%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%3E%3Cpath%20d%3D%27M-1%201%20l2-2%20M0%2010%20l10-10%20M9%2011%20l2-2%27%20stroke%3D%27rgba(0%2C0%2C0%2C0.04)%27%20stroke-width%3D%270.5%27%2F%3E%3C%2Fsvg%3E')] rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-full opacity-20 -mr-12 -mt-12"></div>
        <div className="flex items-center justify-between relative z-10">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                    {value}
                </p>
                {trend && (
                    <div className="flex items-center mt-2">
                        <span
                            className={`text-sm font-medium ${trendUp ? "text-green-600" : "text-red-600"
                                }`}
                        >
                            {trend}
                        </span>
                        {trendUp ? (
                            <IoArrowUpOutline className="w-4 h-4 text-green-600 ml-1" />
                        ) : (
                            <IoArrowDownOutline className="w-4 h-4 text-red-600 ml-1" />
                        )}
                    </div>
                )}
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-full text-white shadow-md">
                {icon}
            </div>
        </div>
    </div>
); 