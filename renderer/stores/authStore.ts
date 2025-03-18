import { create } from "zustand";
import { Role, RoleModelImpl } from "../model/role";
import { decryptPinCode } from "../lib/encryption";

interface AuthState {
  currentRole: Role | null;
  isAuthenticated: boolean;
  accessCodes: string[];
  dbPath: string | null;
  setDbPath: (path: string) => void;
  login: (pinCode: string) => Promise<boolean>;
  logout: () => void;
  hasAccess: (requiredCode: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentRole: null,
  isAuthenticated: false,
  accessCodes: [],
  dbPath: null,

  setDbPath: (path: string) => {
    console.log("Setting dbPath in auth store:", path);
    set({ dbPath: path });
  },

  login: async (pinToMatch: string) => {
    const { dbPath } = get();
    console.log("Login attempt with dbPath:", dbPath);

    if (!dbPath) {
      console.error("No dbPath set in auth store");
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
}));
