"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/lib/hooks/useAnalysis";
import { useUser } from "@/lib/hooks/useUser";
import { AdviceGenerator } from "@/components/forms/AdviceGenerator";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function AIAdvicePage() {
  const { summary, advice, isLoading, error, generateAdvice } =
    useAnalysis();
  const { user } = useUser();
  const userId = user?.id ? Number(user.id) : 0;

  const handleGenerateAdvice = async (customPrompt?: string) => {
    if (userId) {
      await generateAdvice(userId, customPrompt);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="">
          {/* AI Advice Section (this need to be changed) */}
          <AdviceGenerator
            onGenerateAdvice={handleGenerateAdvice}
            advice={advice}
            isLoading={isLoading}
            error={error}
            userId={userId}
            financialHealthScore={summary?.financial_health_score}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
