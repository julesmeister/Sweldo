"use client";
import Link from "next/link";
import "@/resources/fonts.css";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import DateSelector from "@/renderer/components/DateSelector";
import { useLoadingStore } from "@/renderer/stores/loadingStore";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { setLoading, activeLink, setActiveLink } = useLoadingStore();

  useEffect(() => {
    setActiveLink(pathname);
  }, [pathname]);

  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    console.log('Setting loading state to true');
    setLoading(true);
    setActiveLink(path);
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
              <div className="flex space-x-8">
                <Link
                  href="/"
                  className={`${
                    activeLink === "/"
                      ? "bg-blue-900 text-white rounded-full px-4 py-1"
                      : "text-blue-100 hover:bg-blue-900 hover:text-white rounded-full px-4 py-1"
                  } transition-all duration-200 inline-flex items-center`}
                  onClick={() => handleLinkClick("/")}
                >
                  Employees
                </Link>
                <Link
                  href="/timesheet"
                  className={`${
                    activeLink === "/timesheet"
                      ? "bg-blue-900 text-white rounded-full px-4 py-1"
                      : "text-blue-100 hover:bg-blue-900 hover:text-white rounded-full px-4 py-1"
                  } transition-all duration-200 inline-flex items-center`}
                  onClick={() => handleLinkClick("/timesheet")}
                >
                  Timesheet
                </Link>
                <Link
                  href="/payroll"
                  className={`${
                    activeLink === "/payroll"
                      ? "bg-blue-900 text-white rounded-full px-4 py-1"
                      : "text-blue-100 hover:bg-blue-900 hover:text-white rounded-full px-4 py-1"
                  } transition-all duration-200 inline-flex items-center`}
                  onClick={() => handleLinkClick("/payroll")}
                >
                  Payroll
                </Link>
                <Link
                  href="/holidays"
                  className={`${
                    activeLink === "/holidays"
                      ? "bg-blue-900 text-white rounded-full px-4 py-1"
                      : "text-blue-100 hover:bg-blue-900 hover:text-white rounded-full px-4 py-1"
                  } transition-all duration-200 inline-flex items-center`}
                  onClick={() => handleLinkClick("/holidays")}
                >
                  Holidays
                </Link>
                <Link
                  href="/leaves"
                  className={`${
                    activeLink === "/leaves"
                      ? "bg-blue-900 text-white rounded-full px-4 py-1"
                      : "text-blue-100 hover:bg-blue-900 hover:text-white rounded-full px-4 py-1"
                  } transition-all duration-200 inline-flex items-center`}
                  onClick={() => handleLinkClick("/leaves")}
                >
                  Leaves
                </Link>
                <Link
                  href="/cashAdvances"
                  className={`${
                    activeLink === "/cashAdvances"
                      ? "bg-blue-900 text-white rounded-full px-4 py-1"
                      : "text-blue-100 hover:bg-blue-900 hover:text-white rounded-full px-4 py-1"
                  } transition-all duration-200 inline-flex items-center`}
                  onClick={() => handleLinkClick("/cashAdvances")}
                >
                  Cash Advances
                </Link>
                <Link
                  href="/loans"
                  className={`${
                    activeLink === "/loans"
                      ? "bg-blue-900 text-white rounded-full px-4 py-1"
                      : "text-blue-100 hover:bg-blue-900 hover:text-white rounded-full px-4 py-1"
                  } transition-all duration-200 inline-flex items-center`}
                  onClick={() => handleLinkClick("/loans")}
                >
                  Loans
                </Link>
                <Link
                  href="/settings"
                  className={`${
                    activeLink === "/settings"
                      ? "bg-blue-900 text-white rounded-full px-4 py-1"
                      : "text-blue-100 hover:bg-blue-900 hover:text-white rounded-full px-4 py-1"
                  } transition-all duration-200 inline-flex items-center`}
                  onClick={() => handleLinkClick("/settings")}
                >
                  Settings
                </Link>
              </div>
              <DateSelector />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
