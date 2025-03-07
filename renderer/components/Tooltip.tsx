import React, { useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-4',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-4',
    left: 'right-full top-1/2 -translate-y-1/2 mr-4',
    right: 'left-full top-1/2 -translate-y-1/2 ml-4',
  };

  const arrowPositions = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-gray-800',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-b-gray-800',
    left: 'right-[-6px] top-1/2 -translate-y-1/2 border-l-gray-800',
    right: 'left-[-6px] top-1/2 -translate-y-1/2 border-r-gray-800',
  };

  const tooltipClassName = `bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg min-w-[500px] whitespace-normal`;

  return (
    <div className="relative inline-block" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      {children}
      {isVisible && (
        <div className={`absolute ${positions[position]} z-50`}>
          <div className="relative">
            <div className={tooltipClassName}>
              {content}
            </div>
            <div className={`absolute w-3 h-3 transform rotate-45 bg-gray-800 ${arrowPositions[position]}`} />
          </div>
        </div>
      )}
    </div>
  );
};
