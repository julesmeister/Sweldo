import React, { useState } from "react";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  width?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = "top",
  width = "auto",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
  };

  const arrowPositions = {
    top: "bottom-[-6px] left-1/2 transform -translate-x-1/2",
    bottom: "top-[-6px] left-1/2 transform -translate-x-1/2",
    left: "right-[-6px] top-1/2 transform -translate-y-1/2",
    right: "left-[-6px] top-1/2 transform -translate-y-1/2",
  };

  const tooltipClassName = `bg-gray-900 text-white text-sm px-4 py-2 rounded-md shadow-lg whitespace-normal transition-opacity duration-200 ease-in-out`;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute ${positions[position]} z-50`}>
          <div className="relative" style={{ width }}>
            <div className={tooltipClassName}>{content}</div>
            <div
              className={`absolute w-3 h-3 transform rotate-45 bg-gray-900 ${arrowPositions[position]}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
