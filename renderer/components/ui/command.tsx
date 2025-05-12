'use client';

import React from 'react';
import { cn } from '@/renderer/lib/utils';

// Command Component
export function Command({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'flex h-full w-full flex-col overflow-hidden rounded-md bg-background',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

// Command Input
interface CommandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onValueChange?: (value: string) => void;
}

export function CommandInput({
    className,
    onValueChange,
    ...props
}: CommandInputProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onValueChange?.(e.target.value);
    };

    return (
        <div className="flex items-center border-b px-3">
            <input
                className={cn(
                    'flex h-10 w-full rounded-md bg-transparent py-3 px-2 text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50',
                    className
                )}
                onChange={handleChange}
                {...props}
            />
        </div>
    );
}

// Command List
export function CommandList({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('overflow-y-auto overflow-x-hidden', className)}
            {...props}
        >
            {children}
        </div>
    );
}

// Command Empty
export function CommandEmpty({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'py-6 px-2 text-center text-sm text-gray-500',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

// Command Group
export function CommandGroup({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('overflow-hidden p-1 text-gray-700', className)}
            {...props}
        >
            {children}
        </div>
    );
}

// Command Item
interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
    onSelect?: () => void;
    value?: string;
}

export function CommandItem({
    className,
    onSelect,
    children,
    value,
    ...props
}: CommandItemProps) {
    return (
        <div
            className={cn(
                'relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                className
            )}
            onClick={onSelect}
            {...props}
        >
            {children}
        </div>
    );
} 