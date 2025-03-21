"use client";
import "@/renderer/stores/globalPolyfill";
import "@/resources/globals.css";
import Navbar from "../components/Navbar";
import { Toaster, toast } from "sonner";
import { LoadingBar } from "./LoadingBar";
import { useEffect, useRef, useState } from "react";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/renderer/stores/authStore";
import { LoginDialog } from "./LoginDialog";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { RoleModelImpl } from "../model/role";
import { IoFolderOutline } from "react-icons/io5";

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setLoading, setActiveLink } = useLoadingStore();
  const initialRender = useRef(true);
  const { isAuthenticated, logout } = useAuthStore();
  const { dbPath, isInitialized, initialize } = useSettingsStore();
  const [showLogin, setShowLogin] = useState(false);
  const [isCheckingRoles, setIsCheckingRoles] = useState(true);

  // Initialize settings store
  useEffect(() => {
    console.log("Initializing settings...");
    initialize().catch((error) => {
      console.error("Failed to initialize settings:", error);
      toast.error("Failed to initialize settings");
    });
  }, [initialize]);

  const handleSettingsRedirect = async () => {
    try {
      setLoading(true);
      setActiveLink("/settings");
      await router.push("/settings");
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth store with dbPath and check for roles
  useEffect(() => {
    const initializeAuth = async () => {
      // Wait for settings to be initialized
      if (!isInitialized) {
        console.log("Waiting for settings to initialize...");
        return;
      }

      console.log("Checking auth with dbPath:", dbPath);

      if (!dbPath) {
        setIsCheckingRoles(false);
        // If no dbPath, we need to allow access to settings
        if (pathname === "/settings") {
          return; // Don't show login for settings page when no dbPath
        }
      }

      if (isAuthenticated) {
        setIsCheckingRoles(false);
        return;
      }

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
  }, [dbPath, isAuthenticated, pathname, isInitialized]);

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
  if (showLogin && (!dbPath || pathname !== "/settings")) {
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

  // If no dbPath and not on settings page, show redirect message
  if (!dbPath && !pathname?.startsWith("/settings")) {
    return (
      <div className="min-h-screen bg-background font-sans flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <IoFolderOutline className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Database Path Not Set
          </h2>
          <p className="text-gray-500 mb-4">
            Please configure your database path in settings before continuing.
          </p>
          <button
            onClick={handleSettingsRedirect}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Settings
          </button>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <LoadingBar />
      <Navbar />
      <main className="max-w-12xl mx-auto pt-4 px-4">
        {children}
        <Toaster position="top-right" richColors />
      </main>
    </div>
  );
}
