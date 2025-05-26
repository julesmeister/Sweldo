import React, { useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";

interface BaseFormDialogProps {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (event: React.FormEvent) => void;
    children: React.ReactNode;
    position?: {
        top: number;
        left: number;
        showAbove?: boolean;
        caretLeft?: number;
    } | null;
    submitText?: string;
    isSubmitting?: boolean;
    isBottomSheet?: boolean;
    maxWidth?: string;
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
    isBottomSheet = true,
    maxWidth = "100%",
}) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
            document.body.style.overflow = 'hidden';
            // Delay setting visible to allow the animation to work
            setTimeout(() => {
                setIsVisible(true);
            }, 10);
        } else {
            setIsVisible(false);
            // Wait for animation to complete before removing from DOM
            setTimeout(() => {
                setIsAnimating(false);
                document.body.style.overflow = '';
            }, 300);
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Bottom sheet implementation
    if (isBottomSheet) {
        if (!isAnimating && !isOpen) return null;

        return (
            <>
                {/* Overlay */}
                <div
                    className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${isVisible ? 'bg-opacity-50' : 'bg-opacity-0'
                        }`}
                    onClick={onClose}
                />

                {/* Bottom Sheet */}
                <div
                    className={`fixed bottom-0 left-0 right-0 z-50 bg-white shadow-lg transition-transform duration-300 ease-out mx-auto ${isVisible ? 'translate-y-0' : 'translate-y-full'
                        }`}
                    style={{ maxWidth: maxWidth, width: "100%", margin: "0 auto" }}
                >
                    {/* Header - with background color */}
                    <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 border-b border-t border-gray-200 bg-gray-800">
                        <h2 className="text-lg font-medium text-white">{title}</h2>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-gray-400 transition-colors duration-200"
                            aria-label="Close dialog"
                        >
                            <IoClose size={24} />
                        </button>
                    </div>

                    {/* Form Content */}
                    <div className="px-4 sm:px-6 md:px-8 py-3 max-h-[calc(80vh-100px)] overflow-y-auto base-form-dialog-content">
                        {children}
                    </div>

                    {/* Footer */}
                    <div className="px-4 sm:px-6 md:px-8 py-3 border-t border-gray-200 bg-gray-50">
                        <div className="flex flex-row space-x-3 w-full max-w-7xl mx-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onSubmit}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Submitting..." : submitText}
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Legacy popup dialog implementation (kept for backward compatibility)
    if (!isOpen) return null;

    const defaultTop = window.innerHeight / 2 - 200;
    const defaultLeft = window.innerWidth / 2 - 425;

    const currentPosition = position || {
        top: defaultTop,
        left: defaultLeft,
        showAbove: false,
        caretLeft: 425,
    };

    return (
        <div
            className="absolute bg-gray-900 rounded-lg shadow-xl border border-gray-700"
            style={{
                position: "absolute",
                top: currentPosition.top,
                left: currentPosition.left,
                width: "850px",
                transform: currentPosition.showAbove ? "translateY(-100%)" : "none",
                maxHeight: "calc(100vh - 100px)",
                zIndex: 50,
            }}
        >
            {/* Caret */}
            {currentPosition.caretLeft !== undefined && (
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
                            ? { borderTop: "8px solid rgb(17, 24, 39)" }
                            : { borderBottom: "8px solid rgb(17, 24, 39)" }),
                    }}
                    className="absolute"
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-700 rounded-t-lg">
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                <button
                    onClick={onClose}
                    className="text-white hover:text-gray-300 transition-colors duration-200"
                    aria-label="Close dialog"
                >
                    <IoClose size={24} />
                </button>
            </div>

            {/* Form Content */}
            <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto base-form-dialog-content">
                {children}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 rounded-b-lg">
                <div className="flex flex-row space-x-3 w-full">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
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