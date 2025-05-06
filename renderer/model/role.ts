import path from "path";
import { encryptPinCode, decryptPinCode } from "../lib/encryption";
import { Role as OldRole, RoleModelImpl as OldRoleModelImpl } from "./role_old"; // Import old implementation for fallback
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";
import {
  getRolesFirestore,
  createRoleFirestore,
  updateRoleFirestore,
  deleteRoleFirestore,
} from "./role_firestore";

// --- Interfaces --- //

// Keep original Role interface
export interface Role extends OldRole {}

// Keep original RoleModel interface
export interface RoleModel {
  dbPath: string;
  getRoles(): Promise<Role[]>;
  createRole(role: Omit<Role, "id" | "createdAt" | "updatedAt">): Promise<Role>;
  updateRole(
    id: string,
    role: Partial<Omit<Role, "id" | "createdAt" | "updatedAt">>
  ): Promise<Role>;
  deleteRole(id: string): Promise<void>;
}

// JSON Structure
interface RoleJsonStructure {
  roles: Role[];
}

// --- Implementation --- //

export class RoleModelImpl implements RoleModel {
  private rolesJsonPath: string;
  private oldModel: OldRoleModelImpl; // Instance of the old CSV model for fallback

  constructor(public dbPath: string) {
    const basePath = path.join(dbPath, "SweldoDB");
    this.rolesJsonPath = path.join(basePath, "roles.json");
    this.oldModel = new OldRoleModelImpl(dbPath); // Instantiate old model
    // console.log(
    //   `[RoleModel] Initialized with dbPath: ${dbPath}, rolesJsonPath: ${this.rolesJsonPath}`
    // );
  }

  private async readJsonFile(): Promise<RoleJsonStructure | null> {
    // console.log(
    //   `[RoleModel] readJsonFile: Attempting to read ${this.rolesJsonPath}`
    // );
    try {
      const fileExists = await window.electron.fileExists(this.rolesJsonPath);
      if (!fileExists) {
        // console.log(
        //   `[RoleModel] readJsonFile: File not found ${this.rolesJsonPath}`
        // );
        return null;
      }

      const content = await window.electron.readFile(this.rolesJsonPath);
      if (!content || content.trim() === "") {
        // console.log(
        //   `[RoleModel] readJsonFile: File is empty ${this.rolesJsonPath}`
        // );
        return { roles: [] }; // Return empty structure if file is empty
      }

      const data = JSON.parse(content) as RoleJsonStructure;
      // console.log(
      //   `[RoleModel] readJsonFile: Successfully read and parsed ${this.rolesJsonPath}, found ${data.roles.length} roles before date conversion.`
      // );

      // Convert date strings back to Date objects
      data.roles.forEach((role) => {
        role.createdAt = new Date(role.createdAt);
        role.updatedAt = new Date(role.updatedAt);
      });

      return data;
    } catch (error) {
      console.error("[RoleModel] Error reading roles JSON file:", error);
      // Handle potential JSON parsing errors or other read issues
      // Depending on requirements, might return null, empty, or throw
      return null;
    }
  }

  private async writeJsonFile(data: RoleJsonStructure): Promise<void> {
    try {
      // console.log(
      //   `[RoleModel] writeJsonFile: Attempting to write to ${this.rolesJsonPath}, data with ${data.roles.length} roles.`
      // );
      await window.electron.ensureDir(path.dirname(this.rolesJsonPath));
      // Ensure dates are ISO strings before saving
      const dataToSave = JSON.parse(JSON.stringify(data)); // Deep clone
      dataToSave.roles.forEach((role: any) => {
        role.createdAt =
          role.createdAt instanceof Date
            ? role.createdAt.toISOString()
            : role.createdAt;
        role.updatedAt =
          role.updatedAt instanceof Date
            ? role.updatedAt.toISOString()
            : role.updatedAt;
      });
      await window.electron.writeFile(
        this.rolesJsonPath,
        JSON.stringify(dataToSave, null, 2)
      );
      // console.log(
      //   `[RoleModel] writeJsonFile: Successfully wrote to ${this.rolesJsonPath}`
      // );
    } catch (error) {
      console.error("[RoleModel] Error writing roles JSON file:", error);
      throw error;
    }
  }

  async getRoles(): Promise<Role[]> {
    // console.log("[RoleModel] getRoles: Attempting to get roles.");
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        // console.log(
        //   "[RoleModel] getRoles: Web environment detected, using Firestore."
        // );
        const companyName = await getCompanyName();
        const firestoreRoles = await getRolesFirestore(companyName);
        // console.log(
        //   `[RoleModel] getRoles: Fetched ${firestoreRoles.length} roles from Firestore.`
        // );
        return firestoreRoles;
      }

      // Desktop mode - use existing implementation
      // console.log(
      //   "[RoleModel] getRoles: Desktop environment, attempting to read JSON."
      // );
      const jsonData = await this.readJsonFile();

      if (jsonData) {
        // console.log(
        //   `[RoleModel] getRoles: Successfully loaded ${jsonData.roles.length} roles from JSON.`
        // );
        // Return roles with decrypted PINs
        return jsonData.roles.map((role) => ({
          ...role,
          pinCode: decryptPinCode(role.pinCode),
        }));
      } else {
        // Fallback to CSV if JSON doesn't exist or failed to load
        // console.warn(
        //   "[RoleModel] roles.json not found or invalid, falling back to roles.csv"
        // );
        const csvRoles = await this.oldModel.getRoles();
        // Decrypt PINs from CSV data as well
        const decryptedCsvRoles = csvRoles.map((role) => ({
          ...role,
          pinCode: decryptPinCode(role.pinCode),
        }));
        // console.log(
        //   `[RoleModel] getRoles: Loaded and decrypted ${decryptedCsvRoles.length} roles from CSV fallback.`
        // );
        return decryptedCsvRoles;
      }
    } catch (error) {
      console.error("[RoleModel] Error getting roles (JSON/CSV):", error);
      throw error;
    }
  }

  async createRole(
    roleInput: Omit<Role, "id" | "createdAt" | "updatedAt">
  ): Promise<Role> {
    // console.log(
    //   "[RoleModel] createRole: Attempting to create role with input:",
    //   roleInput
    // );
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        // console.log(
        //   "[RoleModel] createRole: Web environment detected, using Firestore."
        // );
        const companyName = await getCompanyName();
        const createdRole = await createRoleFirestore(roleInput, companyName);
        // console.log(
        //   "[RoleModel] createRole: Role created via Firestore:",
        //   createdRole
        // );
        return createdRole;
      }

      // Desktop mode - use existing implementation
      // console.log(
      //   "[RoleModel] createRole: Desktop environment, creating role in JSON."
      // );
      const jsonData = (await this.readJsonFile()) ?? { roles: [] }; // Start with empty if file doesn't exist
      const encryptedPinCode = encryptPinCode(roleInput.pinCode);

      const newRole: Role = {
        ...roleInput,
        id: crypto.randomUUID(),
        pinCode: encryptedPinCode, // Store encrypted
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jsonData.roles.push(newRole);
      await this.writeJsonFile(jsonData);
      // console.log(
      //   "[RoleModel] createRole: Role created and saved to JSON:",
      //   newRole
      // );

      // Return the role with the original (decrypted) PIN for immediate use
      const returnRole = {
        ...newRole,
        pinCode: roleInput.pinCode,
      };
      // console.log(
      //   "[RoleModel] createRole: Returning role (with decrypted PIN):",
      //   returnRole
      // );
      return returnRole;
    } catch (error) {
      console.error("[RoleModel] Error creating role:", error);
      throw error;
    }
  }

  async updateRole(
    id: string,
    roleUpdate: Partial<Omit<Role, "id" | "createdAt" | "updatedAt">>
  ): Promise<Role> {
    // console.log(
    //   `[RoleModel] updateRole: Attempting to update role ID ${id} with data:`,
    //   roleUpdate
    // );
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        // console.log(
        //   `[RoleModel] updateRole: Web environment detected, using Firestore for role ID ${id}.`
        // );
        const companyName = await getCompanyName();
        const updatedRole = await updateRoleFirestore(
          id,
          roleUpdate,
          companyName
        );
        // console.log(
        //   `[RoleModel] updateRole: Role ID ${id} updated via Firestore:`,
        //   updatedRole
        // );
        return updatedRole;
      }

      // Desktop mode - use existing implementation
      // console.log(
      //   `[RoleModel] updateRole: Desktop environment, updating role ID ${id} in JSON.`
      // );
      const jsonData = await this.readJsonFile();
      if (!jsonData) {
        throw new Error("[RoleModel] Roles data file not found for update.");
      }

      const roleIndex = jsonData.roles.findIndex((r) => r.id === id);
      if (roleIndex === -1) {
        throw new Error(`[RoleModel] Role with id ${id} not found for update.`);
      }

      const existingRole = jsonData.roles[roleIndex];

      // Encrypt new PIN if provided
      const encryptedPinCode = roleUpdate.pinCode
        ? encryptPinCode(roleUpdate.pinCode)
        : existingRole.pinCode;

      const updatedRoleData: Role = {
        ...existingRole,
        ...roleUpdate,
        pinCode: encryptedPinCode,
        updatedAt: new Date(),
      };

      jsonData.roles[roleIndex] = updatedRoleData;
      await this.writeJsonFile(jsonData);
      // console.log(
      //   `[RoleModel] updateRole: Role ID ${id} updated and saved to JSON:`,
      //   updatedRoleData
      // );

      // Return the role with decrypted PIN for immediate use
      const returnRole = {
        ...updatedRoleData,
        pinCode: roleUpdate.pinCode || decryptPinCode(updatedRoleData.pinCode),
      };
      // console.log(
      //   `[RoleModel] updateRole: Returning role ID ${id} (with decrypted PIN):`,
      //   returnRole
      // );
      return returnRole;
    } catch (error) {
      console.error("[RoleModel] Error updating role:", error);
      throw error;
    }
  }

  async deleteRole(id: string): Promise<void> {
    // console.log(`[RoleModel] deleteRole: Attempting to delete role ID ${id}.`);
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        // console.log(
        //   `[RoleModel] deleteRole: Web environment detected, using Firestore for role ID ${id}.`
        // );
        const companyName = await getCompanyName();
        await deleteRoleFirestore(id, companyName);
        // console.log(
        //   `[RoleModel] deleteRole: Role ID ${id} deletion processed via Firestore.`
        // );
        return;
      }

      // Desktop mode - use existing implementation
      // console.log(
      //   `[RoleModel] deleteRole: Desktop environment, deleting role ID ${id} from JSON.`
      // );
      const jsonData = await this.readJsonFile();
      if (!jsonData) {
        console.warn(
          `[RoleModel] Roles data file not found for deleting role ${id}. Assuming already deleted or never existed.`
        );
        return; // Or throw error depending on desired behavior
      }

      const initialLength = jsonData.roles.length;
      jsonData.roles = jsonData.roles.filter((role) => role.id !== id);

      if (jsonData.roles.length === initialLength) {
        // Optionally, check CSV as fallback? For now, assume if not in JSON, it's gone.
        console.warn(
          `[RoleModel] Role with id ${id} not found in JSON for deletion.`
        );
        // Consider throwing an error if strict confirmation is needed
        // throw new Error(`[RoleModel] Role with id ${id} not found for deletion.`);
        return;
      }

      await this.writeJsonFile(jsonData);
      // console.log(
      //   `[RoleModel] deleteRole: Role ID ${id} removed from JSON data, file rewritten.`
      // );
    } catch (error) {
      console.error("[RoleModel] Error deleting role:", error);
      throw error;
    }
  }

  // --- Migration Function --- //

  static async migrateCsvToJson(
    dbPath: string,
    onProgress?: (message: string) => void
  ): Promise<void> {
    // Skip migration in web mode since it's only relevant for desktop operation
    // console.log("[RoleModel] migrateCsvToJson: Starting migration process.");
    if (isWebEnvironment()) {
      onProgress?.("Skipping Roles migration in web mode.");
      // console.log(
      //   "[RoleModel] migrateCsvToJson: Web environment, skipping migration."
      // );
      return;
    }

    onProgress?.("Starting Roles CSV to JSON migration...");
    const rolesJsonPath = path.join(dbPath, "SweldoDB", "roles.json");
    const oldModel = new OldRoleModelImpl(dbPath);

    try {
      // Skip if JSON already exists
      if (await window.electron.fileExists(rolesJsonPath)) {
        onProgress?.(
          `Roles JSON file already exists at ${rolesJsonPath}, skipping.`
        );
        return;
      }

      onProgress?.("Loading roles from CSV...");
      // Load roles using the OLD model (which reads CSV)
      // Note: getRoles in old model returns roles with *encrypted* PINs already
      const rolesFromCsv = await oldModel.getRoles();

      if (rolesFromCsv.length === 0) {
        onProgress?.(
          "No roles found in CSV or CSV empty. Creating empty JSON file."
        );
        const emptyData: RoleJsonStructure = { roles: [] };
        await RoleModelImpl.prototype.writeJsonFile.call(
          { rolesJsonPath, dbPath },
          emptyData
        );
        onProgress?.("Empty roles.json file created.");
        return;
      }

      onProgress?.(
        `Found ${rolesFromCsv.length} roles in CSV. Converting to JSON...`
      );
      const jsonData: RoleJsonStructure = {
        roles: rolesFromCsv, // PINs are already encrypted from oldModel.getRoles()
      };

      // Write the new JSON file (using instance method with adjusted 'this' context or static helpers)
      // Using prototype.call to use the instance write method with correct path context
      await RoleModelImpl.prototype.writeJsonFile.call(
        { rolesJsonPath, dbPath },
        jsonData
      );

      onProgress?.(
        `Successfully converted roles.csv to roles.json at ${rolesJsonPath}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.(`Roles migration failed: ${message}`);
      console.error("Roles Migration Error:", error);
      throw new Error(`Roles migration failed: ${message}`);
    }
  }
}

// Factory function
export const createRoleModel = (dbPath: string): RoleModel => {
  return new RoleModelImpl(dbPath);
};
