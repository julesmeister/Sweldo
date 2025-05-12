'use client';

import * as React from 'react';
import { cn } from '@/renderer/lib/utils';

interface PopoverProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

interface PopoverTriggerProps {
    asChild?: boolean;
    children: React.ReactNode;
}

interface PopoverContentProps {
    className?: string;
    children: React.ReactNode;
}

// Simple Context to manage open state
const PopoverContext = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
}>({
    open: false,
    setOpen: () => { },
});

export function Popover({ open, onOpenChange, children }: PopoverProps) {
    const [internalOpen, setInternalOpen] = React.useState(open || false);

    const setOpen = React.useCallback((value: boolean) => {
        setInternalOpen(value);
        onOpenChange?.(value);
    }, [onOpenChange]);

    // Sync internal state with prop
    React.useEffect(() => {
        if (open !== undefined && open !== internalOpen) {
            setInternalOpen(open);
        }
    }, [open, internalOpen]);

    return (
        <PopoverContext.Provider value={{ open: internalOpen, setOpen }}>
            {children}
        </PopoverContext.Provider>
    );
}

export function PopoverTrigger({ asChild, children }: PopoverTriggerProps) {
    const { open, setOpen } = React.useContext(PopoverContext);

    if (asChild) {
        return React.cloneElement(children as React.ReactElement, {
            onClick: (e: React.MouseEvent) => {
                setOpen(!open);
                (children as React.ReactElement).props.onClick?.(e);
            },
        });
    }

    return (
        <button onClick={() => setOpen(!open)}>
            {children}
        </button>
    );
}

export function PopoverContent({ className, children }: PopoverContentProps) {
    const { open } = React.useContext(PopoverContext);

    if (!open) return null;

    return (
        <div
            className={cn(
                'absolute z-50 w-full rounded-md border border-border bg-background p-4 shadow-md outline-none animate-in fade-in-80',
                className
            )}
            style={{
                top: 'calc(100% + 4px)',
                left: 0
            }}
        >
            {children}
        </div>
    );
} 