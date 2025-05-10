import React from 'react';

interface Option {
    value: string;
    label: string;
}

interface OptionSelectorProps {
    options: Option[];
    selectedValue: string;
    onChange: (value: string) => void;
    columns?: number;
    className?: string;
    label?: string;
    name?: string;
}

const OptionSelector: React.FC<OptionSelectorProps> = ({
    options,
    selectedValue,
    onChange,
    columns = 2,
    className = '',
    label,
}) => {
    const gridClassName = {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
        5: 'grid-cols-5',
    }[columns] || 'grid-cols-2';

    return (
        <div className={`w-full ${className}`}>
            {label && <label className="block text-sm font-medium text-gray-300 mb-2.5">{label}</label>}
            <div className={`grid ${gridClassName} gap-3`}>
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={`
                            flex items-center w-full px-4 py-3 rounded-lg 
                            border transition-all duration-200 ease-in-out 
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
                            ${selectedValue === option.value
                                ? 'bg-gray-700 border-blue-500 ring-2 ring-blue-500'
                                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                            }
                        `}
                    >
                        <div className="flex-shrink-0 w-5 h-5 mr-3 rounded-full border-2 flex items-center justify-center transition-all duration-200 ease-in-out 
                            ${selectedValue === option.value ? 'border-blue-500 bg-blue-500' : 'border-gray-500 group-hover:border-gray-400'}">
                            {selectedValue === option.value && (
                                <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                        </div>
                        <span className={`text-sm font-medium ${selectedValue === option.value ? 'text-blue-300' : 'text-gray-300 group-hover:text-gray-100'}`}>
                            {option.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default OptionSelector; 