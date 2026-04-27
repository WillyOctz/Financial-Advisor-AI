"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { motion } from "framer-motion";
import { useAnalysis } from "@/lib/hooks/useAnalysis";
import { useUser } from "@/lib/hooks/useUser";
import { AdviceGenerator } from "@/components/forms/AdviceGenerator";
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
        <motion.div className="mt-1">
          {/* AI Advice Section */}
          <AdviceGenerator
            onGenerateAdvice={handleGenerateAdvice}
            advice={advice}
            isLoading={isLoading}
            error={error}
            userId={userId}
            financialHealthScore={summary?.financial_health_score}
          />
        </motion.div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
