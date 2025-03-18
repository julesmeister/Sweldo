import path from "path";
import { encryptPinCode, decryptPinCode } from "../lib/encryption";

export interface Role {
  id: string;
  name: string;
  pinCode: string;
  accessCodes: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

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

export class RoleModelImpl implements RoleModel {
  private rolesPath: string;

  constructor(public dbPath: string) {
    // Ensure the path includes SweldoDB
    const basePath = path.join(dbPath, "SweldoDB");
    this.rolesPath = path.join(basePath, "roles.csv");
  }

  private async ensureRolesFile(): Promise<void> {
    try {
      const exists = await window.electron.fileExists(this.rolesPath);
      if (!exists) {
        // Create directory if it doesn't exist
        await window.electron.ensureDir(path.dirname(this.rolesPath));
        // Create file with headers
        const headers =
          "id,name,pinCode,accessCodes,description,createdAt,updatedAt\n";
        await window.electron.writeFile(this.rolesPath, headers);
      }
    } catch (error) {
      console.error("[RoleModel] Error ensuring roles file:", error);
      throw error;
    }
  }

  async getRoles(): Promise<Role[]> {
    try {
      await this.ensureRolesFile();
      const content = await window.electron.readFile(this.rolesPath);
      const lines = content.split("\n");
      const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

      if (nonEmptyLines.length <= 1) {
        return []; // Return empty array if only headers exist
      }

      const roles = nonEmptyLines.slice(1).map((line) => {
        const fields = line.split(",");
        return {
          id: fields[0],
          name: fields[1],
          pinCode: fields[2], // The PIN is already encrypted in the CSV
          accessCodes: fields[3].split("|").filter((code) => code.length > 0),
          description: fields[4] || undefined,
          createdAt: new Date(fields[5]),
          updatedAt: new Date(fields[6]),
        } as Role;
      });

      return roles;
    } catch (error) {
      console.error("[RoleModel] Error getting roles:", error);
      throw error;
    }
  }

  async createRole(
    role: Omit<Role, "id" | "createdAt" | "updatedAt">
  ): Promise<Role> {
    try {
      await this.ensureRolesFile();
      const roles = await this.getRoles();

      const encryptedPinCode = encryptPinCode(role.pinCode);

      const newRole: Role = {
        ...role,
        id: crypto.randomUUID(),
        pinCode: encryptedPinCode, // Store encrypted PIN
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Read existing content and append the new role
      const existingContent = await window.electron.readFile(this.rolesPath);
      const newContent =
        existingContent +
        `${newRole.id},${newRole.name},${
          newRole.pinCode
        },${newRole.accessCodes.join("|")},${
          newRole.description || ""
        },${newRole.createdAt.toISOString()},${newRole.updatedAt.toISOString()}\n`;
      await window.electron.writeFile(this.rolesPath, newContent);

      // Return the role with decrypted PIN for immediate use
      return {
        ...newRole,
        pinCode: role.pinCode,
      };
    } catch (error) {
      console.error("[RoleModel] Error creating role:", error);
      throw error;
    }
  }

  async updateRole(
    id: string,
    roleUpdate: Partial<Omit<Role, "id" | "createdAt" | "updatedAt">>
  ): Promise<Role> {
    try {
      const roles = await this.getRoles();
      const roleIndex = roles.findIndex((r) => r.id === id);

      if (roleIndex === -1) {
        throw new Error(`[RoleModel] Role with id ${id} not found`);
      }

      // If a new PIN is provided, encrypt it
      const pinCode = roleUpdate.pinCode
        ? encryptPinCode(roleUpdate.pinCode)
        : roles[roleIndex].pinCode;

      const updatedRole: Role = {
        ...roles[roleIndex],
        ...roleUpdate,
        pinCode,
        updatedAt: new Date(),
      };

      roles[roleIndex] = updatedRole;

      // Rewrite the entire file
      const content =
        "id,name,pinCode,accessCodes,description,createdAt,updatedAt\n" +
        roles
          .map(
            (role) =>
              `${role.id},${role.name},${role.pinCode},${role.accessCodes.join(
                "|"
              )},${
                role.description || ""
              },${role.createdAt.toISOString()},${role.updatedAt.toISOString()}`
          )
          .join("\n") +
        "\n";

      await window.electron.writeFile(this.rolesPath, content);

      // Return the role with decrypted PIN for immediate use
      return {
        ...updatedRole,
        pinCode: roleUpdate.pinCode || decryptPinCode(updatedRole.pinCode),
      };
    } catch (error) {
      console.error("[RoleModel] Error updating role:", error);
      throw error;
    }
  }

  async deleteRole(id: string): Promise<void> {
    try {
      const roles = await this.getRoles();
      const filteredRoles = roles.filter((role) => role.id !== id);

      if (filteredRoles.length === roles.length) {
        throw new Error(`[RoleModel] Role with id ${id} not found`);
      }

      const content =
        "id,name,pinCode,accessCodes,description,createdAt,updatedAt\n" +
        filteredRoles
          .map(
            (role) =>
              `${role.id},${role.name},${role.pinCode},${role.accessCodes.join(
                "|"
              )},${
                role.description || ""
              },${role.createdAt.toISOString()},${role.updatedAt.toISOString()}`
          )
          .join("\n") +
        "\n";

      await window.electron.writeFile(this.rolesPath, content);
    } catch (error) {
      console.error("[RoleModel] Error deleting role:", error);
      throw error;
    }
  }
}
