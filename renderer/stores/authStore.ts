import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Role, RoleModelImpl } from "../model/role";
import { decryptPinCode } from "../lib/encryption";
import { useSettingsStore } from "./settingsStore";
import { toast } from "sonner";

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

interface AuthState {
  currentRole: Role | null;
  isAuthenticated: boolean;
  accessCodes: string[];
  lastActivity: number;
  login: (pinCode: string) => Promise<boolean>;
  logout: () => void;
  hasAccess: (requiredCode: string) => boolean;
  checkSession: () => boolean;
  updateLastActivity: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentRole: null,
      isAuthenticated: false,
      accessCodes: [],
      lastActivity: Date.now(),

      checkSession: () => {
        const { lastActivity, isAuthenticated, logout } = get();
        if (!isAuthenticated) return false;

        const now = Date.now();
        const isSessionValid = now - lastActivity < SESSION_TIMEOUT;

        if (!isSessionValid && isAuthenticated) {
          logout();
          return false;
        }

        return isSessionValid;
      },

      updateLastActivity: () => {
        set({ lastActivity: Date.now() });
      },

      login: async (pinToMatch: string) => {
        const dbPath = useSettingsStore.getState().dbPath;

        if (!dbPath) {
          toast.error("No database path set in settings");
          return false;
        }

        if (!pinToMatch) {
          toast.error("No PIN code provided");
          return false;
        }

        try {
          const roleModel = new RoleModelImpl(dbPath);
          const roles = await roleModel.getRoles();

          if (roles.length === 0) {
            toast.error("No roles found. Please create an admin role first.");
            return false;
          }

          const matchedRole = roles.find((role) => {
            try {
              const decryptedPin = decryptPinCode(role.pinCode);
              return decryptedPin === pinToMatch;
            } catch (error) {
              console.error("Error decrypting PIN:", error);
              return false;
            }
          });

          if (matchedRole) {
            set({
              currentRole: matchedRole,
              isAuthenticated: true,
              accessCodes: matchedRole.accessCodes,
              lastActivity: Date.now(),
            });
            toast.success("Login successful!");
            return true;
          }

          toast.error("Invalid PIN code");
          return false;
        } catch (error) {
          toast.error("Login error", {
            description:
              error instanceof Error ? error.message : "Unknown error occurred",
          });
          return false;
        }
      },

      logout: () => {
        set({
          currentRole: null,
          isAuthenticated: false,
          accessCodes: [],
          lastActivity: 0,
        });
      },

      hasAccess: (requiredCode: string) => {
        const { accessCodes, checkSession } = get();
        if (!checkSession()) {
          return false;
        }
        return accessCodes.includes(requiredCode);
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        currentRole: state.currentRole,
        isAuthenticated: state.isAuthenticated,
        accessCodes: state.accessCodes,
        lastActivity: state.lastActivity,
      }),
    }
  )
);
