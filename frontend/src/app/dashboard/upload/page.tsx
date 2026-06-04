"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { MultiUploadView } from "@/components/forms/MultiUploadView";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  Download,
  FileText,
  FileSpreadsheet,
  Code,
  Sparkles,
  Info,
  CheckCircle2,
  ArrowRight,
  Zap,
  CheckCircle,
  Circle,
} from "lucide-react";
import * as XLSX from "xlsx";

type UploadMode = "single" | "multiple";

export default function UploadPage() {
  const [showGuide, setShowGuide] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("single");

  // mount animation
  React.useEffect(() => {
    setMounted(false);
  }, []);

  const templateDataUSD = [
    ["Date", "Description", "Amount", "Type"],
    ["2025-01-10", "Salary", "$6,000.00", "Income"],
    ["2025-01-11", "Amazon Purchase", "$55.50", "Expense"],
    ["2025-01-12", "McDonalds", "$12.99", "Expense"],
    ["2025-01-13", "Freelance Payment", "$450.00", "Income"],
  ];

  const templateDataIDR = [
    ["Date", "Description", "Amount", "Type"],
    ["2025-01-10", "Gaji Bulanan", "Rp 87.250.000", "Income"],
    ["2025-01-11", "Belanja Online", "Rp 850.000", "Expense"],
    ["2025-01-12", "Makan Siang", "Rp 150.000", "Expense"],
    ["2025-01-13", "Freelance", "Rp 7.500.000", "Income"],
  ]

  const downloadCSVTemplateUSD = () => {
    const csvContent = templateDataUSD
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "financial_data_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const downloadCSVTemplateIDR = () => {
    const csvContent = templateDataIDR
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "financial_data_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const downloadExcelTemplateUSD = () => {
    const ws = XLSX.utils.aoa_to_sheet(templateDataUSD);
    const wscols = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
    ws["!cols"] = wscols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "financial_data_template.xlsx");
  };

  const downloadExcelTemplateIDR = () => {
    const ws = XLSX.utils.aoa_to_sheet(templateDataIDR);
    const wscols = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
    ws["!cols"] = wscols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "financial_data_template.xlsx");
  };

  /*const downloadJSONTemplate = () => {
    const jsonData = templateData.slice(1).map((row) => ({
      Date: row[0],
      Description: row[1],
      Amount: row[2],
      Type: row[3],
    }));
    const jsonContent = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "financial_data_template.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };*/

  // templates options with icons and descriptions
  const templates = [
    {
      name: "CSV (USD Format)",
      description: "Simple text format",
      icon: FileText,
      color: "blue",
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 to-cyan-30",
      onclick: downloadCSVTemplateUSD,
    },
    {
      name: "CSV (IDR Format)",
      description: "Simple text format",
      icon: FileText,
      color: "red",
      gradient: "from-red-500 to-rose-500",
      bgGradient: "from-red-50 to-rose-50",
      onclick: downloadCSVTemplateIDR,
    },
    {
      name: "Excel (USD Format)",
      description: "Microsoft Excel format",
      icon: FileSpreadsheet,
      color: "emerald",
      gradient: "from-emerald-500 to-teal-500",
      bgGradient: "from-emerald-50 to-teal-50",
      onclick: downloadExcelTemplateUSD,
    },
    {
      name: "Excel (IDR Format)",
      description: "Microsoft Excel format",
      icon: FileSpreadsheet,
      color: "yellow",
      gradient: "from-yellow-500 to-gold-500",
      bgGradient: "from-yellow-50 to-gold-50",
      onclick: downloadExcelTemplateIDR,
    },
  ];

  // upload steps for visual guide
  const steps = [
    {
      number: 1,
      title: "Download Template",
      description: "Choose your preferred format along with your preferred currency",
      icon: Download,
    },
    {
      number: 2,
      title: "Fill your data",
      description: "Add your financial data from the provided documents",
      icon: FileText,
    },
    {
      number: 3,
      title: "Upload File",
      description: "Drag and drop or click to upload the filled documents",
      icon: Upload,
    },
  ];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative bg-linear-to-br from-slate-900 via-blue-900 to-slate-900 rounded-3xl p-8 md:p-12 overflow-hidden shadow-2xl"
          >
            {/* Animated background elements */}
            <div className="absolute inset-0 opacity-20">
              <motion.div
                className="absolute top-0 right-0 w-96 h-96 bg-linear-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl"
                animate={{
                  scale: [1, 1.2, 1],
                  x: [0, 50, 0],
                  y: [0, 30, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="absolute bottom-0 left-0 w-96 h-96 bg-linear-to-tr from-purple-400 to-pink-400 rounded-full blur-3xl"
                animate={{
                  scale: [1.2, 1, 1.2],
                  x: [0, -30, 0],
                  y: [0, -50, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
              />
            </div>

            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  className="p-3 bg-white/10 backdrop-blur-sm rounded-xl"
                  whileHover={{ scale: 1.1, rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <Upload className="w-6 h-6 text-white" />
                </motion.div>
                <span className="text-blue-300 text-sm font-medium tracking-wide uppercase">
                  Data Import Center
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Upload Your Financial Data
              </h1>
              <p className="text-xl text-slate-200 max-w-3xl mb-6">
                Import your transactions in CSV or Excel format.
              </p>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6 mt-8">
                {[
                  { label: "Supported Formats", value: "3", icon: FileText },
                  { label: "Max File Size", value: "10MB", icon: Zap },
                  //{ label: "Processing Time", value: "< 30s", icon: Sparkles },
                ].map((stat, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <stat.icon className="w-5 h-5 text-blue-300" />
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {stat.value}
                      </div>
                      <div className="text-xs text-slate-300">{stat.label}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Process Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-9 mt-4"
          >
            {steps.map((step, index) => (
              <motion.div
                key={index}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow overflow-hidden group">
                  {/* Number badge */}
                  <div className="absolute top-4 right-4">
                    <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
                      {step.number}
                    </div>
                  </div>

                  <CardContent className="p-6">
                    <motion.div
                      className="w-12 h-12 bg-linear-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                    >
                      <step.icon className="w-6 h-6 text-blue-600" />
                    </motion.div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-slate-6000 text-sm">
                      {step.description}
                    </p>
                  </CardContent>

                  {/* Connector arrow */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-7 transform -translate-y-1/2 z-10">
                      <ArrowRight className="w-6 h-6 text-blue-400" />
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Template download section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4"
          >
            <Card className="border-0 shadow-xl overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Download className="w-6 h-6 text-blue-600" />
                      <h2 className="text-2xl font-bold text-slate-900">
                        Download Template
                      </h2>
                    </div>
                    <p className="text-slate-600">
                      Choose your preferred format and fill in your financial
                      data
                    </p>
                  </div>

                  <motion.button
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Info className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {showGuide ? "Hide" : "Show"} Guide
                    </span>
                  </motion.button>
                </div>

                {/* Template Format Guide */}
                <AnimatePresence>
                  {showGuide && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-6 bg-blue-50 rounded-xl p-6 border border-blue-100"
                    >
                      <h3 className="font-semibold text-blue-900 mb-3">
                        Guide For Excel:
                      </h3>
                      <div className="flex flex-col mb-3 gap-3">
                        <p>Make sure to format ONLY the Amount cells to Text format!</p>
                        <p>How: Block all the Amount cell then left click to choose Format Cells and choose Text.</p>
                        <p>Fill your Amount with the same sample of the downloaded prefered format Amount.</p>
                      </div>
                      <h3 className="font-semibold text-blue-900 mb-3">
                        Required Columns:
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          {
                            name: "Date",
                            example: "2025-01-10",
                            required: true,
                          },
                          {
                            name: "Description",
                            example: "Groceries Week 2",
                            required: true,
                          },
                          { name: "Amount", example: "$76.99 or Rp 27.000", required: true },
                          {
                            name: "Category",
                            example: "Income/Expense",
                            required: true,
                          },
                        ].map((col, index) => (
                          <motion.div
                            key={index}
                            className="flex items-start gap-3"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <CheckCircle className="w-5 h-5 rhink-0 mt-0.5 text-emerald-500" />
                            <div>
                              <div className="font-medium text-slate-900">
                                {col.name}
                                {col.required && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                              </div>
                              <div className="text-sm text-slate-600">
                                e.g., {col.example}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Template Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {templates.map((template, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      whileHover="hover"
                    >
                      <motion.button
                        onClick={template.onclick}
                        className="w-full group relative overflow-hidden rounded-2xl p-6 bg-linear-to-br bg-white border-2 border-slate-200 hover:border-transparent transition-all shadow-lg hover:shadow-2xl"
                        variants={{
                          hover: { scale: 1.05, y: -8 },
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 200,
                        }}
                      >
                        {/* Background Gradient (appear on hover) */}
                        <div
                          className={`absolute inset-0 bg-linear-to-br ${template.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity`}
                        />

                        {/* Content */}
                        <div className="relative z-10">
                          {/* Icon */}
                          <motion.div
                            className={`w-16 h-16 mx-auto mb-4 bg-linear-to-br ${template.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl`}
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                          >
                            <template.icon className="w-8 h-8 text-white" />
                          </motion.div>

                          {/* Name */}
                          <h3 className="text-xl font-bold text-slate-900 mb-2">
                            {template.name}
                          </h3>

                          {/* Description */}
                          <p className="text-sm text-slate-600 mb-4">
                            {template.description}
                          </p>

                          {/* Download Button */}
                          <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                          </div>
                        </div>

                        {/* Glow Effect */}
                        <div
                          className={`absolute inset-0 bg-linear-to-br ${template.gradient} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity`}
                        ></div>
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Upload Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-4"
          >
            <MultiUploadView/>
          </motion.div>

          {/* Help Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-5"
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="w-12 h-12 bg-linear-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                  <Info className="w-6 h-6 text-white"/>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 mb-2">
                  Need Help Getting Started?
                </h3>
                <p className="text-amber-700 text-sm mb-4">
                  Download a template, fill in your transaction data, and upload it
                  here.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
