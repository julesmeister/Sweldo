"use client";
import "@/renderer/stores/globalPolyfill";
import "@/resources/globals.css";
import Navbar from "../components/Navbar";
import { Toaster, toast } from "sonner";
import { LoadingBar } from "./LoadingBar";
import { useEffect, useRef, useState } from "react";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/renderer/stores/authStore";
import { LoginDialog } from "./LoginDialog";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { RoleModelImpl } from "../model/role";

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { setLoading } = useLoadingStore();
  const initialRender = useRef(true);
  const { isAuthenticated, logout, setDbPath } = useAuthStore();
  const { dbPath } = useSettingsStore();
  const [showLogin, setShowLogin] = useState(false);
  const [isCheckingRoles, setIsCheckingRoles] = useState(true);

  // Initialize auth store with dbPath and check for roles
  useEffect(() => {
    const initializeAuth = async () => {
      if (!dbPath) {
        setIsCheckingRoles(false);
        return;
      }

      if (isAuthenticated) {
        setIsCheckingRoles(false);
        return;
      }

      console.log("Setting dbPath in auth store:", dbPath);
      setDbPath(dbPath);

      // Check if any roles exist
      try {
        const roleModel = new RoleModelImpl(dbPath);
        const roles = await roleModel.getRoles();
        setShowLogin(roles.length > 0 && !isAuthenticated);
      } catch (error) {
        console.error("Error checking roles:", error);
        toast.error("Error checking roles");
      } finally {
        setIsCheckingRoles(false);
      }
    };

    initializeAuth();
  }, [dbPath, isAuthenticated]); // Add isAuthenticated to dependencies to properly handle auth state changes

  const [lastActivity, setLastActivity] = useState(Date.now());

  // Handle session timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSession = () => {
      const now = Date.now();
      if (now - lastActivity >= SESSION_TIMEOUT) {
        toast.info("Session expired due to inactivity");
        logout();
        setShowLogin(true);
      }
    };

    const interval = setInterval(checkSession, 1000); // Check every second
    return () => clearInterval(interval);
  }, [isAuthenticated, lastActivity, logout]);

  // Track user activity
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => setLastActivity(Date.now());

    // Track various user activities
    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("mousedown", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("scroll", updateActivity);
    window.addEventListener("touchstart", updateActivity);

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("mousedown", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("scroll", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
    };
  }, [isAuthenticated]);

  // Update authentication state when isAuthenticated changes
  useEffect(() => {
    setShowLogin(!isAuthenticated);
  }, [isAuthenticated]);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    // Only reset loading on subsequent route changes
    setLoading(false);
  }, [pathname]);

  // Show loading state while checking roles
  if (isCheckingRoles) {
    return (
      <div className="min-h-screen bg-background font-sans flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Show login dialog when authentication is required
  if (showLogin) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Toaster position="top-right" richColors />
        <LoginDialog
          onSuccess={() => {
            console.log("Login successful");
            setShowLogin(false);
          }}
        />
      </div>
    );
  }

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
