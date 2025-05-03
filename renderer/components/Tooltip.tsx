import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      let top = 0;
      let left = 0;

      switch (position) {
        case "top":
          top = triggerRect.top + scrollY - tooltipRect.height - 8;
          left =
            triggerRect.left +
            scrollX +
            triggerRect.width / 2 -
            tooltipRect.width / 2;
          break;
        case "bottom":
          top = triggerRect.bottom + scrollY + 8;
          left =
            triggerRect.left +
            scrollX +
            triggerRect.width / 2 -
            tooltipRect.width / 2;
          break;
        case "left":
          top =
            triggerRect.top +
            scrollY +
            triggerRect.height / 2 -
            tooltipRect.height / 2;
          left = triggerRect.left + scrollX - tooltipRect.width - 8;
          break;
        case "right":
          top =
            triggerRect.top +
            scrollY +
            triggerRect.height / 2 -
            tooltipRect.height / 2;
          left = triggerRect.right + scrollX + 8;
          break;
      }

      top = Math.max(top, scrollY + 8);
      left = Math.max(left, scrollX + 8);

      setTooltipPosition({ top, left });
    }
  }, [isVisible, position]);

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

  const tooltipClassName = `bg-white text-gray-700 text-sm px-3 py-2 rounded-md shadow-lg border border-gray-200 whitespace-normal transition-opacity duration-200 ease-in-out`;

  // Define border COLOR classes based on position
  const arrowBorderClasses = {
    top: "border-b-gray-200 border-r-gray-200 border-t-transparent border-l-transparent", // Pointing down
    bottom:
      "border-t-gray-200 border-l-gray-200 border-b-transparent border-r-transparent", // Pointing up
    left: "border-t-gray-200 border-r-gray-200 border-b-transparent border-l-transparent", // Pointing right
    right:
      "border-b-gray-200 border-l-gray-200 border-t-transparent border-r-transparent", // Pointing left
  };

  // Define positioning for the arrow relative to the tooltip body
  const arrowRelativePositions = {
    top: "top-[90%] left-1/2 transform -translate-x-1/2 -mt-[1px]",
    bottom: "bottom-[100%] left-1/2 transform -translate-x-1/2 -mb-[1px]",
    left: "left-[100%] top-1/2 transform -translate-y-1/2 -ml-[1px]",
    right: "right-[100%] top-1/2 transform -translate-y-1/2 -mr-[1px]",
  };

  // Combine classes: basic shape, rotation, background, base border, dynamic border colors, dynamic position
  const arrowClassName = `absolute w-3 h-3 transform rotate-45 bg-white border ${
    arrowBorderClasses[position] || arrowBorderClasses.bottom
  } ${arrowRelativePositions[position]}`;

  const tooltipContent = isVisible ? (
    <div
      ref={tooltipRef}
      className={`fixed z-[9999]`}
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        width: width,
      }}
    >
      <div className="relative">
        <div className={tooltipClassName}>{content}</div>
        <div className={arrowClassName} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        className="relative inline-block"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>

      {tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  );
};
