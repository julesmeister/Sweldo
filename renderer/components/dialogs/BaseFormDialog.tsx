import React from "react";
import { IoClose } from "react-icons/io5";

interface BaseFormDialogProps {
    title: string;
    isOpen: boolean; // Or maybe this is controlled by the parent always
    onClose: () => void;
    onSubmit: (event: React.FormEvent) => void;
    children: React.ReactNode;
    position?: {
        top: number;
        left: number;
        showAbove?: boolean;
        caretLeft?: number; // Added for consistency with existing forms
    } | null;
    submitText?: string;
    isSubmitting?: boolean;
    // Additional props for dialog width, max-height etc. can be added if needed
    dialogWidth?: string;
    dialogMaxHeight?: string;
}

const BaseFormDialog: React.FC<BaseFormDialogProps> = ({
    title,
    isOpen,
    onClose,
    onSubmit,
    children,
    position,
    submitText = "Submit",
    isSubmitting = false,
    dialogWidth = "850px", // Default width like in ShortsForm
    dialogMaxHeight = "calc(100vh - 100px)", // Default max height
}) => {
    if (!isOpen) {
        return null;
    }

    // Default positioning if none is provided (can be refined)
    const defaultTop = window.innerHeight / 2 - 200; // Approximate half height
    const defaultLeft = window.innerWidth / 2 - parseInt(dialogWidth) / 2;

    const currentPosition = position || {
        top: defaultTop,
        left: defaultLeft,
        showAbove: false,
        caretLeft: parseInt(dialogWidth) / 2,
    };


    return (
        // Outer div for potential overlay and centering, if not absolutely positioned directly
        // For now, assuming direct absolute positioning as per existing forms
        <div
            className="absolute bg-gray-900 rounded-lg shadow-xl border border-gray-700"
            style={{
                position: "absolute",
                top: currentPosition.top,
                left: currentPosition.left,
                width: dialogWidth,
                transform: currentPosition.showAbove ? "translateY(-100%)" : "none",
                maxHeight: dialogMaxHeight,
                zIndex: 50, // Ensure it's above overlays if any
            }}
        >
            {/* Caret */}
            {currentPosition.caretLeft !== undefined && ( // Only show caret if caretLeft is defined
                <div
                    style={{
                        position: "absolute",
                        left: currentPosition.caretLeft,
                        [currentPosition.showAbove ? "bottom" : "top"]: currentPosition.showAbove
                            ? "-8px"
                            : "-8px",
                        width: 0,
                        height: 0,
                        borderLeft: "8px solid transparent",
                        borderRight: "8px solid transparent",
                        ...(currentPosition.showAbove
                            ? { borderTop: "8px solid rgb(17, 24, 39)" } // Assuming dark theme caret color from ShortsForm
                            : { borderBottom: "8px solid rgb(17, 24, 39)" }),
                    }}
                    className="absolute" // Keep this for potential Tailwind utility conflicts or clarity
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 rounded-t-lg">
                <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-300 transition-colors duration-200"
                    aria-label="Close dialog"
                >
                    <IoClose size={24} />
                </button>
            </div>

            {/* Form Content - passed as children */}
            {/* The actual <form> tag will be part of the children, managed by the specific form component */}
            <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto base-form-dialog-content">
                {children}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 rounded-b-lg">
                <div className="flex flex-row space-x-3 w-full">
                    <button
                        type="button" // Important: type="button" to prevent form submission if inside a <form> in children
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="button" // Changed to button, actual submit is handled by onSubmit passed to the form within children
                        onClick={onSubmit} // This button directly triggers the passed onSubmit
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Submitting..." : submitText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BaseFormDialog; 