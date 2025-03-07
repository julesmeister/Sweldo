'use client';

import { FC, HTMLAttributes, forwardRef, Ref } from 'react';
import { cn } from '@/renderer/lib/utils';

interface AddButtonProps extends HTMLAttributes<HTMLButtonElement> {
  icon?: string;
  text: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(
  ({ icon = 'employee', text, onClick, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative w-auto cursor-pointer overflow-hidden rounded-full border bg-background p-2 px-6 text-center font-semibold",
          className,
        )}
        onClick={onClick}
        {...props}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary transition-all duration-300 group-hover:scale-[100.8]"></div>
          <span className="inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
            {text}
          </span>
        </div>
        <div className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-primary-foreground opacity-0 transition-all duration-300 group-hover:-translate-x-5 group-hover:opacity-100">
          <span>{text}</span>
          <svg
            className="mr-2 -ml-1 h-5 w-5 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="white"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>
    );
  }
);

AddButton.displayName = 'AddButton';

export default AddButton;
