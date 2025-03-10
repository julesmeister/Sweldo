import React, { useState, useEffect, useRef } from 'react';
import { EmploymentType } from '@/renderer/model/settings';
import { FaCheck } from 'react-icons/fa'; // Import check icon from react-icons

interface EditableCellProps {
  value: string | number | null;
  column: { key: string };
  rowData: any;
  onSave: (value: string | number, rowData: any) => Promise<void>;
  employmentTypes: EmploymentType[];
  onClick?: (event: React.MouseEvent) => void;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  column,
  rowData,
  onSave,
  employmentTypes,
  onClick,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [editValue, setEditValue] = useState<string>(value?.toString() || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const tdRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    setEditValue(value?.toString() || '');
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (!isEditing) {
      setIsHovered(false);
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    if (onClick) {
      onClick(event);
    }
    if (isHovered) {
      setIsEditing(true);
    }
  };

  const handleBlur = async () => {
    setIsEditing(false);
    setIsHovered(false);
    if (editValue !== value?.toString()) {
      try {
        await onSave(editValue, rowData);
      } catch (error) {
        console.error('Failed to save:', error);
        setEditValue(value?.toString() || ''); // Reset to original value on error
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setIsHovered(false);
      setEditValue(value?.toString() || '');
    }
  };

  const getTimeValidation = () => {
    if (column.key === 'timeIn' || column.key === 'timeOut') {
      const employmentType = employmentTypes.find(type => type.type === rowData.employmentType);
      if (employmentType) {
        return {
          type: 'time',
          min: '00:00',
          max: '23:59',
          step: 300, // 5 minutes
        };
      }
    }
    return {};
  };


  const formatTime = (time: string | null): string => {
    if (!time) return "-";
    const parts = time.split(':');
    if (parts.length !== 2) return "-";
    
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    
    if (isNaN(hours) || isNaN(minutes)) return "-";
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12; // Convert 0 to 12
    return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <td
      ref={tdRef}
      className={`${
        column.key === 'day'
          ? 'sticky left-0 z-10 bg-white'
          : ''
      } px-6 py-4 whitespace-nowrap text-sm ${
        column.key === 'day' ? 'font-medium text-gray-900' : 'text-gray-500'
      } relative group cursor-pointer transition-colors duration-200 ${
        isHovered ? 'bg-gray-50' : ''
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {isEditing ? (
        <div className="flex items-center">
        <input
          ref={inputRef}
          type={column.key.toLowerCase().includes('time') ? 'time' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full p-1 border rounded bg-white"
          {...getTimeValidation()}
        />
        <FaCheck
          className="ml-2 cursor-pointer text-green-500"
          onClick={handleBlur} // Assuming handleBlur saves the value
        />
      </div>
      ) : (
        <>
          <span>{column.key.includes('time') ? formatTime(value as string) : (value || '-')}</span>
          {isHovered && !isEditing && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-600 transition-opacity">
              <span className="text-xs text-white">Click to edit</span>
            </div>
          )}
        </>
      )}
    </td>
  );
};
