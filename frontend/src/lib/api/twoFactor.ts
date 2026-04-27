import { apiClient } from "./client";

// ---------2FA Types----------

export interface TwoFactorStatus {
  enabled: boolean;
  method: "app" | "email" | "sms" | null;
  remaining_backup_codes: number;
  phone_number?: string;
}

export interface TwoFactorSetupResponse {
  qr_code_url?: string;
  secret?: string;
  backup_codes: string[];
  method: "app" | "email" | "sms";
  verification_sent?: boolean;
  message?: string;
  phone_number?: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
  partial_token?: string;
  backup_code?: string;
}

export interface TwoFactorSetupRequest {
  method: "app" | "email" | "sms";
  phone_number?: string;
}

export interface TwoFactorDisableRequest {
  password: string;
}

export interface BackupCodesResponse {
  backup_codes: string[];
  message: string;
}

// ---------2FA API Service Frontend----------

export const twoFactorAPI = {
  // get 2fa current status
  async getStatus(): Promise<TwoFactorStatus> {
    const res = await apiClient.get("/2fa/status");
    return res.data;
  },

  // setup 2fa with preferred method
  async setup(
    method: "app" | "email" | "sms",
    phoneNumber?: string,
  ): Promise<TwoFactorSetupResponse> {
    const res = await apiClient.post("/2fa/setup", {
      method,
      phone_number: phoneNumber,
    });
    return res.data;
  },

  // verify setup and enable 2fa
  async verifySetup(
    code: string,
  ): Promise<{ message: string; method: string; enabled: boolean }> {
    const res = await apiClient.post("/2fa/verify-setup", {
      code,
    });
    return res.data;
  },

  // resend verification code during setup (for SMS/email)
  async resendSetupCode(): Promise<{ message: string; method: string }> {
    const res = await apiClient.post("/2fa/resend-setup-code");
    return res.data;
  },

  // disable 2FA (need password)
  async disable(
    password: string,
  ): Promise<{ message: string; enabled: boolean }> {
    const res = await apiClient.post("/2fa/disable", {
      password,
    });
    return res.data;
  },

  // generate a new backup code
  async generateBackupCodes(): Promise<BackupCodesResponse> {
    const res = await apiClient.post("/2fa/generate-backup-codes");
    return res.data;
  },

  // update phone number for SMS 2FA
  async updatePhone(
    phoneNumber: string,
  ): Promise<{
    message: string;
    phone_number: string;
    requires_verification: boolean;
  }> {
    const res = await apiClient.put("/2fa/update-phone", {
      phone_number: phoneNumber,
    });
    return res.data;
  },
};
