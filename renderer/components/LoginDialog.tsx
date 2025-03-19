import React, { useState, useEffect } from "react";
import { IoLockClosed, IoEyeOutline, IoEyeOffOutline } from "react-icons/io5";
import { useAuthStore } from "@/renderer/stores/authStore";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface LoginDialogProps {
  onSuccess?: () => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({ onSuccess }) => {
  const { dbPath } = useSettingsStore();
  const login = useAuthStore((state) => state.login);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setError(null);
    setIsLoading(true);

    try {
      const success = await login(pin);
      if (success) {
        toast.success("Login successful");
        if (onSuccess) onSuccess();
      } else {
        setError("Invalid PIN code");
        setPin("");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Invalid PIN code");
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-700 w-full max-w-md p-6">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-600/20 p-3 rounded-full">
            <IoLockClosed className="h-6 w-6 text-blue-500" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-100 text-center mb-6">
          Enter PIN Code
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPin ? "text" : "password"}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200"
              placeholder="Enter PIN"
              required
              minLength={4}
              maxLength={8}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              disabled={isLoading}
            >
              {showPin ? (
                <IoEyeOffOutline className="h-5 w-5" />
              ) : (
                <IoEyeOutline className="h-5 w-5" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 bg-blue-600 text-white rounded-md transition-all duration-200 ${
              isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
            }`}
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};
