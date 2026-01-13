"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TransactionTable } from "@/components/forms/TransactionsTable";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function TransactionsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <TransactionTable />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
