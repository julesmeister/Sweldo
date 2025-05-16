"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DateSelector from "@/renderer/components/DateSelector";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import SyncStatusDropdown from "@/renderer/components/SyncStatusDropdown";

// Define navigation links with categories
const navLinks = [
  { path: "/", label: "Employees" },
  { path: "/timesheet/", label: "Timesheet" },
  { path: "/payroll/", label: "Payroll" },
  { path: "/holidays/", label: "Holidays" },
  { path: "/leaves/", label: "Leaves" },
  { path: "/cashAdvances/", label: "Cash Advances" },
  { path: "/shorts/", label: "Deductions" },
  { path: "/loans/", label: "Loans" },
  { path: "/statistics/", label: "Stats" },
  { path: "/settings/", label: "Settings" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { setLoading, activeLink, setActiveLink } = useLoadingStore();
  const [visibleLinks, setVisibleLinks] = useState<number>(5);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<Record<string, HTMLAnchorElement>>({});
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [highlighterStyle, setHighlighterStyle] = useState({
    left: 0,
    width: 0,
    display: "none",
  });
  const [isDesktop, setIsDesktop] = useState(false);

  // State to track client-side mount
  const [hasMounted, setHasMounted] = useState(false);

  // Effect to set hasMounted to true after component mounts
  useEffect(() => {
    setHasMounted(true);
    // Check if running in Electron (desktop)
    setIsDesktop(typeof window !== 'undefined' && !!(window as any).electron);
  }, []);

  // Click outside handler for the More dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setIsMoreMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Calculate visible links based on container width
  useEffect(() => {
    // Only calculate if mounted and ref exists
    if (!hasMounted || !navContainerRef.current) return;

    const calculateVisibleLinks = () => {
      if (!navContainerRef.current) return;

      const containerWidth = navContainerRef.current.offsetWidth;
      const linkWidth = 120; // Approximate width of each link
      const datePickerWidth = 200; // Approximate width of date picker
      const availableWidth = containerWidth - datePickerWidth;

      const calculatedVisibleLinks = Math.floor(availableWidth / linkWidth);
      setVisibleLinks(
        Math.min(Math.max(calculatedVisibleLinks, 3), navLinks.length)
      );
    };

    calculateVisibleLinks();
    window.addEventListener("resize", calculateVisibleLinks);

    return () => {
      window.removeEventListener("resize", calculateVisibleLinks);
    };
  }, [hasMounted]);

  useEffect(() => {
    // Ensure refs are available and component mounted before updating highlighter
    if (!hasMounted) return;
    setActiveLink(pathname);
    updateHighlighterPosition(pathname);
  }, [pathname, hasMounted, activeLink]);

  const updateHighlighterPosition = (path: string) => {
    // Ensure refs are available before accessing them
    if (!hasMounted || !navRefs.current || !navRefs.current[path]) {
      setHighlighterStyle({ left: 0, width: 0, display: "none" });
      return;
    }
    const activeElement = navRefs.current[path];
    // Only show highlighter if the active link is visible (not in dropdown)
    if (
      activeElement &&
      navLinks.findIndex((link) => link.path === path) < visibleLinks
    ) {
      const rect = activeElement.getBoundingClientRect();
      const containerRect =
        activeElement.parentElement?.getBoundingClientRect();

      setHighlighterStyle({
        left: rect.left - (containerRect?.left || 0),
        width: rect.width,
        display: "block",
      });
    } else {
      // Hide highlighter if active link is in dropdown
      setHighlighterStyle({
        left: 0,
        width: 0,
        display: "none",
      });
    }
  };

  const handleLinkClick = (path: string) => {
    if (path === pathname) return;

    setLoading(true);
    updateHighlighterPosition(path);
    setIsMobileMenuOpen(false);
    setIsMoreMenuOpen(false);

    setTimeout(() => {
      setActiveLink(path);
      router.push(path);
      setTimeout(() => {
        setLoading(false);
      }, 100);
    }, 100);
  };

  const toggleMoreMenu = () => {
    setIsMoreMenuOpen(!isMoreMenuOpen);
  };

  const setNavRef = (path: string, el: HTMLAnchorElement | null) => {
    // Ensure component is mounted before setting refs
    if (!hasMounted || !el) return;
    if (el && !navRefs.current[path]) {
      navRefs.current[path] = el;
      if (path === activeLink) {
        updateHighlighterPosition(path);
      }
    }
  };

  return (
    <nav className="bg-gradient-to-r from-blue-700 to-blue-600 fixed top-0 left-0 right-0 z-50 shadow-md">
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

            {/* Desktop Navigation */}
            <div
              ref={navContainerRef}
              className="hidden md:ml-8 md:flex md:items-center md:justify-between flex-1"
            >
              {/* Navigation Links Container */}
              <div className="flex space-x-1 relative">
                {/* The sliding background element */}
                <div
                  className="absolute bg-blue-800 rounded-full transition-all duration-300 ease-in-out z-0"
                  style={{
                    left: `${highlighterStyle.left}px`,
                    width: `${highlighterStyle.width}px`,
                    height: "2rem",
                    transform: "translateY(-50%)",
                    top: "50%",
                    display: highlighterStyle.display,
                  }}
                />

                {/* Visible navigation links */}
                {navLinks.slice(0, visibleLinks).map(({ path, label }) => {
                  const isActive = pathname === path;
                  return (
                    <Link
                      key={path}
                      href={path}
                      ref={(el) => setNavRef(path, el)}
                      className={`text-blue-100 hover:text-white rounded-full px-4 py-1 transition-all duration-200 inline-flex items-center relative z-10 ${isActive ? "font-semibold" : ""
                        }`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleLinkClick(path);
                      }}
                    >
                      {label}
                    </Link>
                  );
                })}

                {/* Click dropdown for remaining links */}
                {visibleLinks < navLinks.length && (
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      className="text-blue-100 hover:text-white rounded-full px-4 py-1 transition-all duration-200 inline-flex items-center relative z-10"
                      onClick={toggleMoreMenu}
                    >
                      More
                      <svg
                        className={`ml-1.5 h-3.5 w-3.5 transition-transform duration-300 ease-out ${isMoreMenuOpen ? "rotate-180" : ""
                          }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Click dropdown menu */}
                    <AnimatePresence>
                      {isMoreMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute left-0 mt-1"
                        >
                          <div className="w-[180px] p-2 rounded-xl bg-white shadow-xl shadow-blue-900/10 border border-gray-200 transform-gpu">
                            {navLinks
                              .slice(visibleLinks)
                              .map(({ path, label }, index) => {
                                const isActive = pathname === path;
                                return (
                                  <Link
                                    key={path}
                                    href={path}
                                    className={`
                                    relative flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-200
                                    ${isActive
                                        ? "text-blue-600 bg-blue-50"
                                        : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                                      }
                                  `}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleLinkClick(path);
                                    }}
                                  >
                                    {label}
                                    {isActive && (
                                      <motion.div
                                        layoutId="menuActiveIndicator"
                                        className="ml-2 w-1.5 h-1.5 rounded-full bg-blue-600"
                                        transition={{
                                          type: "spring",
                                          bounce: 0.3,
                                          duration: 0.5,
                                        }}
                                      />
                                    )}
                                  </Link>
                                );
                              })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Right side items container: Sync Dropdown and Date Selector */}
              <div className="flex items-center ml-auto pl-4">
                {/* Sync Status Dropdown (Desktop Only) */}
                {isDesktop && <SyncStatusDropdown />}

                {/* Date Selector for Desktop View */}
                <DateSelector />
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-800 focus:outline-none"
              >
                <span className="sr-only">Open main menu</span>
                <svg
                  className={`h-6 w-6 transition-transform duration-200 ${isMobileMenuOpen ? "rotate-90" : ""
                    }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-blue-800"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map(({ path, label }) => (
                <Link
                  key={path}
                  href={path}
                  className={`block px-4 py-2 text-base font-medium rounded-md ${pathname === path
                    ? "bg-blue-700 text-white"
                    : "text-blue-100 hover:bg-blue-700 hover:text-white"
                    }`}
                  onClick={() => handleLinkClick(path)}
                >
                  {label}
                </Link>
              ))}
              <div className="pt-4 pb-3 border-t border-blue-700">
                <DateSelector />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
