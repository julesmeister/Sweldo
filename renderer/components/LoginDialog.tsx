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
  const { login, checkSession } = useAuthStore();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const router = useRouter();

  // Check if session is still valid
  useEffect(() => {
    if (checkSession()) {
      onSuccess?.();
    }
  }, [checkSession, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setError(null);
    setIsLoading(true);

    try {
      const success = await login(pin);
      if (success) {
        // Only call onSuccess if login was successful
        onSuccess?.();
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
    <div className="fixed inset-0 flex items-center justify-center z-50 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black">
        <div className="absolute inset-0">
          {/* Radial gradient overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,0.4),rgba(0,0,0,0.8))] animate-pulse"></div>

          {/* Animated blobs with enhanced colors */}
          <div className="absolute top-0 left-0 w-[40rem] h-[40rem] bg-blue-500/30 rounded-full mix-blend-screen filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-purple-500/30 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-[40rem] h-[40rem] bg-pink-500/30 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-4000"></div>

          {/* Additional subtle blobs for more depth */}
          <div className="absolute top-1/2 left-1/4 w-[30rem] h-[30rem] bg-indigo-500/20 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-1000"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[25rem] h-[25rem] bg-cyan-500/20 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-3000"></div>
        </div>
      </div>

      {/* Login Dialog */}
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700/50 w-full max-w-md p-6 relative z-10">
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
              className="w-full px-4 py-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200"
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
