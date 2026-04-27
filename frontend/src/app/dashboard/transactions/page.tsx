"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TransactionTable } from "@/components/forms/TransactionsTable";
import ProtectedRoute from "@/components/ProtectedRoute";

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
} satisfies Variants;

export default function TransactionsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <motion.div
          className="space-y-6"
          variants={pageVariants}
          initial="hidden"
          animate="visible"
        >
          <TransactionTable />
        </motion.div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
