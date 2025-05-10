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
            {label && <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>}
            <div className={`grid ${gridClassName} gap-2`}>
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={`
              flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 border
              ${selectedValue === option.value
                                ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                                : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}
            `}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default OptionSelector; 