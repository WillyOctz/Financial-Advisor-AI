"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { SingleUploadView } from "@/components/forms/SingleUploadView";
import { MultiUploadView } from "@/components/forms/MultiUploadView";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Files, FileUp, ChevronDown, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";

type UploadMode = "single" | "multiple";

export default function UploadPage() {
  const [uploadMode, setUploadMode] = useState<UploadMode>("single");

  const templateData = [
    ["Date", "Description", "Amount", "Category"],
    ["2025-01-10", "Salary", "6000", "income"],
    ["2025-01-11", "Amazon Purchase", "55", "expense"],
    ["2025-01-12", "McDonalds", "77", "expense"],
  ];

  const downloadCSVTemplate = () => {
    const csvContent = templateData
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

  const downloadExcelTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wscols = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
    ws["!cols"] = wscols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
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
    link.download = "financial_data_template.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Upload Financial Data
              </h1>
              <p className="text-gray-600 mt-2">
                Upload your transaction documents in .csv or .excel formats
              </p>
            </div>

            {/* Upload Mode Toggle Button */}
            {/*<div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                {uploadMode === "single" ? "Single File" : "Multiple Files"}
              </span>
              <button
                onClick={() =>
                  setUploadMode(uploadMode === "single" ? "multiple" : "single")
                }
                className={`
                  relative inline-flex h-10 w-48 items-center rounded-full 
                  transition-colors focus:outline-none focus:ring-2 
                  focus:ring-blue-500 focus:ring-offset-2
                  ${uploadMode === "single" ? "bg-blue-600" : "bg-purple-600"}
                `}
              >
                <span
                  className={`
                    absolute left-1 flex items-center justify-center
                    transition-transform duration-300 ease-in-out
                    ${
                      uploadMode === "single"
                        ? "translate-x-0"
                        : "translate-x-22"
                    }
                  `}
                >
                  <span className="flex h-8 w-20 items-center justify-center rounded-full bg-white shadow-sm">
                    {uploadMode === "single" ? (
                      <FileUp className="h-4 w-4 text-blue-600 mr-1" />
                    ) : (
                      <Files className="h-4 w-4 text-purple-600 mr-1" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        uploadMode === "single"
                          ? "text-blue-600"
                          : "text-purple-600"
                      }`}
                    >
                      {uploadMode === "single" ? "Single" : "Multi"}
                    </span>
                  </span>
                </span>
                <span className="sr-only">Toggle upload mode</span>
              </button>
            </div>*/}
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
                    Choose your preferred format for the template file
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

          {/* Dynamic View Rendering */}
          <div className="transition-all duration-300 ease-in-out">
            <MultiUploadView/>
          </div>

          {/* Mode Switch Hint */}
          {/*<div className="text-center text-sm text-gray-500 mt-4">
            <button
              onClick={() =>
                setUploadMode(uploadMode === "single" ? "multiple" : "single")
              }
              className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              Switch to{" "}
              {uploadMode === "single" ? "multiple files" : "single file"}{" "}
              upload
            </button>
          </div>*/}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
