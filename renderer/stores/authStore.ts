import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Role, RoleModelImpl } from "../model/role";
import { decryptPinCode } from "../lib/encryption";
import { useSettingsStore } from "./settingsStore";
import { toast } from "sonner";

interface AuthState {
  currentRole: Role | null;
  isAuthenticated: boolean;
  accessCodes: string[];
  login: (pinCode: string) => Promise<boolean>;
  logout: () => void;
  hasAccess: (requiredCode: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentRole: null,
      isAuthenticated: false,
      accessCodes: [],

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

          // Try to find a role with matching PIN
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
            toast.success("Login successful!");
            set({
              currentRole: matchedRole,
              isAuthenticated: true,
              accessCodes: matchedRole.accessCodes,
            });
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
        toast.success("Logged out successfully");
        set({
          currentRole: null,
          isAuthenticated: false,
          accessCodes: [],
        });
      },

      hasAccess: (requiredCode: string) => {
        const { accessCodes } = get();
        const hasAccess = accessCodes.includes(requiredCode);
        if (!hasAccess) {
          toast.error("Access denied");
        }
        return hasAccess;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        currentRole: state.currentRole,
        isAuthenticated: state.isAuthenticated,
        accessCodes: state.accessCodes,
      }),
    }
  )
);
