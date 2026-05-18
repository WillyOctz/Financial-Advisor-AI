import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Save, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "../../../contexts/AuthContexts";

interface ProfileFormProps {
  onSuccess?: () => void;
}

export default function ProfileForm({ onSuccess }: ProfileFormProps) {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasChange, setHasChange] = useState(false);

  // check if there are unsaved changes
  useEffect(() => {
    const changed =
      firstName !== (user?.first_name || "") ||
      lastName !== (user?.last_name || "");
    setHasChange(changed);
  }, [firstName, lastName, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // validate
      if (!firstName.trim()) {
        setError("First name cannot be empty");
        setIsLoading(false);
        return;
      }

      if (!lastName.trim()) {
        setError("Last name cannot be empty");
        setIsLoading(false);
        return;
      }

      // send request update
      await apiClient.patch("/users/profile", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      // refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      setSuccess(true);
      setHasChange(false);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Failed to update profile. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFirstName(user?.first_name || "");
    setLastName(user?.last_name || "");
    setError(null);
    setSuccess(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Profile Settings</h2>
        <p className="text-slate-400">Update your personal information</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            First Name
          </label>
          <Input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="John"
            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
            disabled={isLoading}
            maxLength={100}
          />
        </div>

        {/* Last name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Last Name
          </label>
          <Input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Carl"
            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
            disabled={isLoading}
            maxLength={100}
          />
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2"
          >
            <X className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Success message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-green-400 shrink-0" />
            <p className="text-sm text-green-400">
              Profile updated successfully!
            </p>
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={isLoading || !hasChange}
            className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>

          {hasChange && (
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isLoading}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <X className="w-4 h-4 mr-2" />
            </Button>
          )}
        </div>
      </form>
    </motion.div>
  );
}
