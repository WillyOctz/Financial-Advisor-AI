"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileUpload } from "@/components/forms/FileUpload";
import { ColumnMapping } from "@/components/forms/ColumnMapping";
import { useUpload } from "@/lib/hooks/useUpload";
import { ColumnMapping as ColumnMappingType } from "@/types/financial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  AlertCircle,
  Upload,
  Download,
  ChevronDown,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/lib/hooks/useUser";
import * as XLSX from "xlsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function UploadPage() {
  const [currentStep, setCurrentStep] = useState<
    "upload" | "mapping" | "complete"
  >("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const {
    isUploading,
    uploadError,
    uploadedTransactions,
    uploadDocument,
    clearUpload,
  } = useUpload();
  const { user } = useUser();

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setCurrentStep("mapping");
  };

  const handleMappingComplete = async (mapping: ColumnMappingType) => {
    if (selectedFile) {
      const userId = user?.id ? Number(user.id) : 0;
      await uploadDocument(selectedFile, userId, mapping);
      setCurrentStep("complete");
    }
  };

  const handleNewUpload = () => {
    setSelectedFile(null);
    setCurrentStep("upload");
    clearUpload();
  };

  const templateData = [
    ["Date", "Description", "Amount", "Category"],
    ["2025-01-10", "Salary", "6000", "income"],
    ["2025-01-11", "Amazon Purchase", "55", "expense"],
    ["2025-01-12", "McDonalds", "77", "expense"],
    ["2025-01-13", "Coffee Shop", "35", "expense"],
  ];

  const downloadCSVTemplate = () => {
    // Convert to CSV
    const csvContent = templateData
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    // Create and download file
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

  const downloadExcelTemplate = () => {
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(templateData);

    const wscols = [
      { wch: 15 }, // Date
      { wch: 30 }, // Description
      { wch: 15 }, // Amount
      { wch: 15 }, // Type
    ];
    ws["!cols"] = wscols;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    // Download Excel file
    XLSX.writeFile(wb, "financial_data_template.xlsx");
  };

  const downloadJSONTemplate = () => {
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
    link.download = "financiall_data_template.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Upload Financial Data
            </h1>
            <p className="text-gray-600 mt-2">
              Upload your bank statements or trasaction history for analysis
              with .excel or .csv formats.
            </p>
          </div>

          {/* Template Download Section */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">
                    Download Template
                  </h3>
                  <p className="text-blue-700 text-sm">
                    Choose your preferred format to download for the template
                    file
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={downloadCSVTemplate}>
                      <div className="flex items-center">
                        <div className="w-8 h-8 flex items-center justify-center bg-blue-100 rounded mr-2">
                          <span className="text-xs font-bold text-blue-700">
                            CSV
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">CSV Format</div>
                          <div className="text-xs text-gray-500">
                            Simple Text Format
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadExcelTemplate}>
                      <div className="flex items-center">
                        <div className="w-8 h-8 flex items-center justify-center bg-green-100 rounded mr-2">
                          <span className="text-xs font-bold text-green-700">
                            XLSX
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">Excel Format</div>
                          <div className="text-xs text-gray-500">
                            Microsoft Excel
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadJSONTemplate}>
                      <div className="flex items-center">
                        <div className="w-8 h-8 flex items-center justify-center bg-purple-100 rounded mr-2">
                          <span className="text-xs font-bold text-purple-700">
                            JSON
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">JSON Format</div>
                          <div className="text-xs text-gray-500">
                            For Developers
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          {/* Upload Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {/* Step 1 */}
              <div
                className={`flex items-center ${
                  currentStep === "upload" ? "text-blue-600" : "text-gray-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    currentStep === "upload"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-300"
                  }`}
                >
                  1
                </div>
                <span className="ml-2 font-medium">Upload File</span>
              </div>

              <div className="w-12 h-0.5 bg-gray-300"></div>

              {/* Step 2 */}
              <div
                className={`flex items-center ${
                  currentStep === "mapping" ? "text-blue-600" : "text-gray-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    currentStep === "mapping"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-300"
                  }`}
                >
                  2
                </div>
                <span className="ml-2 font-medium">Map Columns</span>
              </div>

              <div className="w-12 h-0.5 bg-gray-300"></div>

              {/* Step 3 */}
              <div
                className={`flex items-center ${
                  currentStep === "complete"
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    currentStep === "complete"
                      ? "border-green-600 bg-green-50"
                      : "border-gray-300"
                  }`}
                >
                  {currentStep === "complete" ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    3
                  )}
                </div>
                <span className="ml-2 font-medium">Complete</span>
              </div>
            </div>
          </div>

          {/* Step Content */}
          <div className="max-w-4xl mx-auto">
            {currentStep === "upload" && (
              <FileUpload onFileSelect={handleFileSelect} />
            )}

            {currentStep === "mapping" && selectedFile && (
              <ColumnMapping
                file={selectedFile}
                onMappingComplete={handleMappingComplete}
              />
            )}

            {currentStep === "complete" && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-6 text-center">
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-900 mb-2">
                    Upload Successfull!
                  </h3>
                  <p className="text-green-700 mb-4">
                    Successfully processed {uploadedTransactions.length}{" "}
                    transactions.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={handleNewUpload} variant="outline">
                      Upload Another File
                    </Button>
                    <Button>
                      <a href="/dashboard/analysis">View Analysis</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
