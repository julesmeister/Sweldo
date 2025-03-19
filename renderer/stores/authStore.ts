import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Role, RoleModelImpl } from "../model/role";
import { decryptPinCode } from "../lib/encryption";
import { useSettingsStore } from "./settingsStore";

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
        console.log("Login attempt with dbPath:", dbPath);

        if (!dbPath) {
          console.error("No dbPath set in settings store");
          return false;
        }

        if (!pinToMatch) {
          console.error("No PIN code provided");
          return false;
        }

        try {
          console.log("Initializing RoleModel with dbPath:", dbPath);
          const roleModel = new RoleModelImpl(dbPath);
          const roles = await roleModel.getRoles();
          console.log("Found roles:", roles.length);

          // Try to find a role with matching PIN
          const matchedRole = roles.find((role) => {
            try {
              const decryptedPin = decryptPinCode(role.pinCode);
              console.log("Comparing PINs:", {
                storedPinLength: decryptedPin.length,
                enteredPinLength: pinToMatch.length,
              });
              return decryptedPin === pinToMatch;
            } catch (error) {
              console.error("Error decrypting PIN:", error);
              return false;
            }
          });

          console.log("Matched role:", matchedRole ? "found" : "not found");

          if (matchedRole) {
            set({
              currentRole: matchedRole,
              isAuthenticated: true,
              accessCodes: matchedRole.accessCodes,
            });
            return true;
          }

          return false;
        } catch (error) {
          console.error("[AuthStore] Login error:", error);
          return false;
        }
      },

      logout: () => {
        console.log("Logging out...");
        set({
          currentRole: null,
          isAuthenticated: false,
          accessCodes: [],
        });
      },

      hasAccess: (requiredCode: string) => {
        const { accessCodes } = get();
        return accessCodes.includes(requiredCode);
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
