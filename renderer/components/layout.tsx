"use client";
import '@/renderer/stores/globalPolyfill';
import type { Metadata } from "next";
import "@/resources/globals.css";
import Navbar from "../components/Navbar";
import { Toaster } from 'sonner';
import { LoadingBar } from "./LoadingBar";
import { useEffect, useRef } from "react";
import { useLoadingStore } from '@/renderer/stores/loadingStore';
import { usePathname } from 'next/navigation';

// Removed next/font in favor of Tailwind's font-sans for Electron compatibility
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { setLoading } = useLoadingStore();
  const initialRender = useRef(true);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    // Only reset loading on subsequent route changes
    setLoading(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background font-sans">
      <LoadingBar />
      <Navbar />
      <main className="max-w-12xl mx-auto pt-14 px-4">
        {children}
        <Toaster position="top-right" richColors />
      </main>
    </div>
  );
}
