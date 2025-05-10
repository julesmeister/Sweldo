import React, { ChangeEvent } from 'react';

// Props for common HTML input attributes that we might want to pass through
interface NativeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'name'> {
    // We'll handle onChange, value, name specifically
}
interface NativeSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'name'> { }
interface NativeTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'name'> { }


interface FormFieldProps {
    label: string;
    name: string; // Used for form state management and as the input's name attribute
    value: string | number | readonly string[] | undefined;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'password'; // Added password
    options?: Array<{ value: string | number; label: string }>; // For select type
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean; // Different from disabled, value is still submitted
    prefix?: React.ReactNode; // For icons or text like '₱'
    suffix?: React.ReactNode; // For icons or text
    error?: string | null; // For displaying validation errors
    className?: string; // For additional styling on the wrapper
    inputClassName?: string; // For additional styling specifically on the input/select/textarea
    labelClassName?: string; // For additional styling on the label
    // Allow passing down other native HTML attributes
    inputProps?: NativeInputProps;
    selectProps?: NativeSelectProps;
    textareaProps?: NativeTextareaProps;
    rows?: number; // Specifically for textarea
}

const FormField: React.FC<FormFieldProps> = ({
    label,
    name,
    value,
    onChange,
    type = 'text',
    options = [],
    placeholder,
    required = false,
    disabled = false,
    readOnly = false,
    prefix,
    suffix,
    error,
    className = '',
    inputClassName = '',
    labelClassName = '',
    inputProps,
    selectProps,
    textareaProps,
    rows,
}) => {
    const baseInputStyles = `block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600`;
    const disabledStyles = `disabled:bg-gray-700/50 disabled:text-gray-500 disabled:cursor-not-allowed`;
    const readOnlyStyles = readOnly ? `bg-gray-700/50 text-gray-400 cursor-default` : ''; // Slightly different for readOnly

    const effectiveInputClassName = `${baseInputStyles} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-7' : ''} ${disabled ? disabledStyles : ''} ${readOnlyStyles} ${inputClassName}`;

    const renderInput = () => {
        switch (type) {
            case 'select':
                return (
                    <select
                        id={name}
                        name={name}
                        value={value}
                        onChange={onChange}
                        required={required}
                        disabled={disabled || readOnly} // readOnly effectively disables select too
                        className={`${effectiveInputClassName} [color-scheme:dark]`}
                        style={{
                            paddingRight: '1.5rem',
                            backgroundPosition: 'right 0.55rem center',
                            // The background-image for the arrow is still expected from global CSS
                        }}
                        {...selectProps}
                    >
                        {placeholder && <option value="">{placeholder}</option>}
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                );
            case 'textarea':
                return (
                    <textarea
                        id={name}
                        name={name}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled}
                        readOnly={readOnly}
                        rows={rows || 3} // Default rows for textarea
                        className={`${baseInputStyles.replace('h-10', '')} ${disabled ? disabledStyles : ''} ${readOnlyStyles} ${inputClassName} p-3`} // Remove fixed height, add padding
                        {...textareaProps}
                    />
                );
            case 'date':
                return (
                    <input
                        id={name}
                        type={type}
                        name={name}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled}
                        readOnly={readOnly}
                        className={`${effectiveInputClassName} [color-scheme:dark]`}
                        {...inputProps}
                    />
                );
            default: // text, number, password etc.
                return (
                    <input
                        id={name}
                        type={type}
                        name={name}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled}
                        readOnly={readOnly}
                        className={effectiveInputClassName}
                        {...inputProps}
                    />
                );
        }
    };

    return (
        <div className={`mb-4 ${className}`}>
            <label htmlFor={name} className={`block text-sm font-medium text-gray-300 mb-1 ${labelClassName}`}>
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
                {prefix && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        {prefix}
                    </div>
                )}
                {renderInput()}
                {suffix && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                        {suffix}
                    </div>
                )}
            </div>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
};

export default FormField; 