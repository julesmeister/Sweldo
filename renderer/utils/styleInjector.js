/**
 * CSS-in-JS utility to inject styles at runtime for web mode
 * This bypasses the Next.js CSS loader issues entirely
 */
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

export function injectStyles() {
  if (typeof document === "undefined" || !isWebEnvironment()) {
    return;
  }

  // Only inject if not already injected
  if (document.getElementById("injected-styles")) {
    return;
  }

  // Create style element for fonts
  const fontStyle = document.createElement("style");
  fontStyle.id = "font-styles";
  fontStyle.textContent = `
    @font-face {
      font-family: 'Pacifico';
      src: url('/fonts/Pacifico.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(fontStyle);

  // Create style element for base styles
  const baseStyle = document.createElement("style");
  baseStyle.id = "injected-styles";
  baseStyle.textContent = `
    :root {
      --font-sans: var(--font-geist-sans);
      --font-mono: var(--font-geist-mono);
      --background: oklch(1 0 0);
      --foreground: oklch(0.145 0 0);
      --card: oklch(1 0 0);
      --card-foreground: oklch(0.145 0 0);
      --popover: oklch(1 0 0);
      --popover-foreground: oklch(0.145 0 0);
      --primary: oklch(0.205 0 0);
      --primary-foreground: oklch(0.985 0 0);
      --secondary: oklch(0.97 0 0);
      --secondary-foreground: oklch(0.205 0 0);
      --muted: oklch(0.97 0 0);
      --muted-foreground: oklch(0.556 0 0);
      --accent: oklch(0.97 0 0);
      --accent-foreground: oklch(0.205 0 0);
      --destructive: oklch(0.577 0.245 27.325);
      --destructive-foreground: oklch(0.577 0.245 27.325);
      --border: oklch(0.922 0 0);
      --input: oklch(0.922 0 0);
      --ring: oklch(0.708 0 0);
      --radius: 0.625rem;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: var(--background);
      color: var(--foreground);
      margin: 0;
      padding: 0;
    }
    
    button, input, select, textarea {
      font-family: inherit;
    }
    
    a {
      color: inherit;
      text-decoration: none;
    }
    
    * {
      box-sizing: border-box;
      border-color: var(--border);
      outline: none;
    }
    
    /* Basic utility classes */
    .text-white { color: white; }
    .font-bold { font-weight: bold; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .rounded { border-radius: 0.25rem; }
    .bg-blue-600 { background-color: #2563eb; }
    .hover\\:bg-blue-500:hover { background-color: #3b82f6; }

    /* MagicUI critical styles */
    .rounded-inherit {
      border-radius: inherit !important;
    }

    /* Ensure borders respect parent border-radius */
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-2xl { border-radius: 1rem; }
    .rounded-3xl { border-radius: 1.5rem; }
    
    /* Animation keyframes for MagicUI */
    @keyframes shine {
      0% { background-position: 0% 0%; }
      50% { background-position: 100% 100%; }
      to { background-position: 0% 0%; }
    }

    .animate-shine {
      animation: shine var(--duration, 14s) infinite linear;
    }

    /* Fix for MagicCard inner element border-radius inheritance */
    .group.relative > div,
    .group.relative > div > div,
    .group.relative > motion.div {
      border-radius: inherit;
    }

    /* Custom scrollbar styles from timesheet.tsx */
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(75, 85, 99, 0.1);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(75, 85, 99, 0.5);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(75, 85, 99, 0.7);
    }

    /* Modern minimal scrollbar styling */
    .scrollbar-thin::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
      background: transparent;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
      background-color: rgba(156, 163, 175, 0.3);
      border-radius: 9999px;
      transition: all 0.2s ease;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
      background-color: rgba(156, 163, 175, 0.5);
    }
    /* Hide scrollbar for Chrome, Safari and Opera when not hovering */
    .scrollbar-thin {
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
    }
    /* Show scrollbar on hover */
    .scrollbar-thin:hover {
      scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
    }
    /* Firefox */
    .scrollbar-thin {
      scrollbar-width: thin;
    }

    /* Timesheet-specific styles to fix cross-environment rendering issues */
    /* Fix for table to ensure consistent borders */
    .timesheet-table {
      border-collapse: separate !important;
      border-spacing: 0 !important;
    }
    
    .timesheet-table tr {
      border-bottom: 1px solid #e5e7eb;
    }
    
    .timesheet-table tr:first-child {
      border-top: 1px solid #e5e7eb;
    }
    
    /* Fix specifically for the day column with sticky positioning */
    .timesheet-day-cell {
      position: sticky !important;
      left: 0 !important;
      z-index: 10 !important;
      /* Use box shadow instead of borders for better sticky behavior */
      box-shadow: inset 0 1px 0 #e5e7eb, inset 0 -1px 0 #e5e7eb !important;
    }
    
    /* Sunday-specific styling */
    .timesheet-day-cell.sunday {
      background-color: #fef3c7 !important; /* Yellow-100 equivalent */
    }
    
    /* Weekday styling */
    .timesheet-day-cell.weekday {
      background-color: white !important;
    }
    
    /* CompensationDialog styling fixes for web mode */
    /* Clear button (×) styling */
    .clear-button {
      position: absolute !important;
      right: 10px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      color: rgba(156, 163, 175, 0.7) !important;
      cursor: pointer !important;
      font-size: 16px !important;
      z-index: 10 !important;
      background: transparent !important;
      border: none !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 20px !important;
      height: 20px !important;
      border-radius: 50% !important;
      transition: all 0.2s !important;
    }
    
    .clear-button:hover {
      color: rgba(107, 114, 128, 1) !important;
      background-color: rgba(229, 231, 235, 0.4) !important;
    }
    
    /* Input field styling in dark dialog mode */
    .compensation-dialog input,
    .compensation-dialog select,
    .compensation-dialog textarea {
      background-color: rgba(209, 213, 219, 0.1) !important;
      border: 1px solid rgba(75, 85, 99, 0.2) !important;
      color: white !important;
      border-radius: 0.375rem !important;
      padding: 0.5rem 0.75rem !important;
      width: 100% !important;
      transition: border-color 0.15s ease-in-out !important;
      font-size: 0.875rem !important;
    }
    
    .compensation-dialog input:focus,
    .compensation-dialog select:focus,
    .compensation-dialog textarea:focus {
      border-color: rgba(99, 102, 241, 0.5) !important;
      outline: none !important;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25) !important;
    }
    
    .compensation-dialog input:disabled,
    .compensation-dialog select:disabled,
    .compensation-dialog textarea:disabled {
      background-color: rgba(209, 213, 219, 0.05) !important;
      color: rgba(209, 213, 219, 0.7) !important;
      cursor: not-allowed !important;
    }
    
    .compensation-dialog input::placeholder {
      color: rgba(156, 163, 175, 0.7) !important;
    }
    
    /* Form field container positioning */
    .compensation-dialog .form-field {
      position: relative !important;
      margin-bottom: 1rem !important;
    }
    
    /* Label styling */
    .compensation-dialog label {
      display: block !important;
      margin-bottom: 0.5rem !important;
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      color: rgba(229, 231, 235, 0.9) !important;
    }
    
    /* Toggle switch styling */
    .compensation-dialog .toggle-switch {
      position: relative !important;
      display: inline-block !important;
      width: 36px !important;
      height: 20px !important;
      margin-right: 10px !important;
    }
    
    .compensation-dialog .toggle-switch input {
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
    }
    
    .compensation-dialog .toggle-slider {
      position: absolute !important;
      cursor: pointer !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background-color: rgba(75, 85, 99, 0.4) !important;
      transition: .4s !important;
      border-radius: 34px !important;
    }
    
    .compensation-dialog .toggle-slider:before {
      position: absolute !important;
      content: "" !important;
      height: 16px !important;
      width: 16px !important;
      left: 2px !important;
      bottom: 2px !important;
      background-color: white !important;
      transition: .4s !important;
      border-radius: 50% !important;
    }
    
    .compensation-dialog input:checked + .toggle-slider {
      background-color: rgb(79, 70, 229) !important;
    }
    
    .compensation-dialog input:checked + .toggle-slider:before {
      transform: translateX(16px) !important;
    }

    /* React DatePicker essential styles */
    .react-datepicker-wrapper {
      display: inline-block;
      position: relative;
      width: 100%;
    }
    
    .react-datepicker {
      font-family: inherit;
      font-size: 0.8rem;
      background-color: #fff;
      color: #000;
      border: 1px solid #aeaeae;
      border-radius: 0.3rem;
      display: inline-block;
      position: relative;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    .react-datepicker__triangle {
      position: absolute;
      left: 50px;
    }
    
    .react-datepicker__header {
      text-align: center;
      background-color: #f7f7f7;
      border-bottom: 1px solid #aeaeae;
      border-top-left-radius: 0.3rem;
      border-top-right-radius: 0.3rem;
      padding: 8px 0;
    }
    
    .react-datepicker__current-month {
      font-weight: bold;
      font-size: 0.944rem;
      margin-top: 0;
      margin-bottom: 8px;
    }
    
    .react-datepicker__day-names {
      margin-bottom: -8px;
      display: flex;
    }
    
    .react-datepicker__day-name {
      color: #000;
      width: 1.9rem;
      line-height: 1.6rem;
      margin: 0.166rem;
      display: inline-block;
      text-align: center;
    }
    
    .react-datepicker__month {
      margin: 0.4rem;
      text-align: center;
    }
    
    .react-datepicker__week {
      white-space: nowrap;
      display: flex;
    }
    
    .react-datepicker__day {
      color: #000;
      display: inline-block;
      width: 1.9rem;
      line-height: 1.9rem;
      text-align: center;
      margin: 0.166rem;
      border-radius: 0.3rem;
      cursor: pointer;
    }
    
    .react-datepicker__day:hover {
      background-color: #f0f0f0;
    }
    
    .react-datepicker__day--selected,
    .react-datepicker__day--in-selecting-range,
    .react-datepicker__day--in-range {
      background-color: #2563eb;
      color: #fff;
    }
    
    .react-datepicker__day--keyboard-selected {
      background-color: #3b82f6;
      color: #fff;
    }
    
    .react-datepicker__day--disabled {
      color: #ccc;
      cursor: default;
    }
    
    .react-datepicker__day--disabled:hover {
      background-color: transparent;
    }
    
    .react-datepicker__navigation {
      align-items: center;
      background: none;
      display: flex;
      justify-content: center;
      text-align: center;
      cursor: pointer;
      position: absolute;
      top: 8px;
      padding: 0;
      border: none;
      z-index: 1;
      height: 32px;
      width: 32px;
    }
    
    .react-datepicker__navigation--previous {
      left: 8px;
    }
    
    .react-datepicker__navigation--next {
      right: 8px;
    }
    
    .react-datepicker__navigation-icon {
      position: relative;
      width: 0;
      height: 0;
      border-style: solid;
      display: block;
      margin: auto;
    }
    
    .react-datepicker__navigation-icon--previous {
      border-width: 8px 8px 8px 0;
      border-color: transparent #000 transparent transparent;
    }
    
    .react-datepicker__navigation-icon--next {
      border-width: 8px 0 8px 8px;
      border-color: transparent transparent transparent #000;
    }
  `;
  document.head.appendChild(baseStyle);

  // Create a link element for Tailwind
  const tailwindLink = document.createElement("link");
  tailwindLink.id = "tailwind-styles";
  tailwindLink.rel = "stylesheet";
  tailwindLink.href =
    "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";
  document.head.appendChild(tailwindLink);

  console.log("Styles injected successfully");
}
