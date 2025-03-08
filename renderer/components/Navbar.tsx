"use client";
import Link from "next/link";
import "@/resources/fonts.css";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import DateSelector from "@/renderer/components/DateSelector";
import { useLoadingStore } from "@/renderer/stores/loadingStore";

// Define navigation links to avoid repetition
const navLinks = [
  { path: "/", label: "Employees" },
  { path: "/timesheet/", label: "Timesheet" },
  { path: "/payroll/", label: "Payroll" },
  { path: "/holidays/", label: "Holidays" },
  { path: "/leaves/", label: "Leaves" },
  { path: "/cashAdvances/", label: "Cash Advances" },
  { path: "/loans/", label: "Loans" },
  { path: "/settings/", label: "Settings" }
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { setLoading, activeLink, setActiveLink } = useLoadingStore();
  // Refs to track positions of nav items
  const navRefs = useRef<Record<string, HTMLAnchorElement>>({});
  // State to track the position and width of the active link
  const [highlighterStyle, setHighlighterStyle] = useState({
    left: 0,
    width: 0,
    display: 'none' // Initially hidden
  });

  useEffect(() => {
    // Ensure the active link is set when the component mounts
    setActiveLink(pathname);
  }, []); // Only run on mount

  useEffect(() => {
    // Update the active link whenever the pathname changes
    setActiveLink(pathname);
    
    // Update the highlighter position based on the active link
    updateHighlighterPosition(pathname);
  }, [pathname]); // Run whenever pathname changes

  const updateHighlighterPosition = (path: string) => {
    const activeElement = navRefs.current[path];
    if (activeElement) {
      const rect = activeElement.getBoundingClientRect();
      const containerRect = activeElement.parentElement?.getBoundingClientRect();
      
      setHighlighterStyle({
        left: rect.left - (containerRect?.left || 0),
        width: rect.width,
        display: 'block'
      });
    }
  };

  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    
    setLoading(true);
    updateHighlighterPosition(path);
    
    setTimeout(() => {
      setActiveLink(path);
      router.push(path);
      // Stop loading after navigation
      setTimeout(() => {
        setLoading(false);
      }, 100);
    }, 100);
  };

  // Helper function to store references to nav links
  const setNavRef = (path: string, el: HTMLAnchorElement | null) => {
    if (el && !navRefs.current[path]) {
      navRefs.current[path] = el;
      if (path === activeLink) {
        updateHighlighterPosition(path);
      }
    }
  };

  return (
    <nav className="bg-blue-600 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-12xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center flex-1">
            <div className="flex-shrink-0 flex items-center">
              <motion.span
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
                style={{ fontFamily: "Pacifico, sans-serif" }}
                className="text-3xl text-white drop-shadow-md"
              >
                Sweldo
              </motion.span>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:items-center sm:justify-between flex-1">
              <div className="flex space-x-8 relative">
                {/* The sliding background element */}
                <div 
                  className="absolute bg-blue-900 rounded-full transition-all duration-300 ease-in-out z-0"
                  style={{
                    left: `${highlighterStyle.left}px`,
                    width: `${highlighterStyle.width}px`,
                    height: '2rem',
                    transform: 'translateY(-50%)',
                    top: '50%',
                    display: highlighterStyle.display
                  }}
                />
                
                {/* Map through navigation links */}
                {navLinks.map(({ path, label }) => (
                  <Link
                    key={path}
                    href={path}
                    ref={(el) => setNavRef(path, el)}
                    className="text-blue-100 hover:text-white rounded-full px-4 py-1 transition-all duration-200 inline-flex items-center relative z-10"
                    onClick={() => handleLinkClick(path)}
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <DateSelector />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}