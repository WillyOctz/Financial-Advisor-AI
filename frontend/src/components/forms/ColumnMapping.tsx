"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnMapping as ColumnMappingType } from "@/types/financial";
import * as XLSX from "xlsx";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Calendar,
  DollarSign,
  FileText,
  Tag,
} from "lucide-react";

interface ColumnMappingProps {
  file: File;
  onMappingComplete: (mapping: ColumnMappingType) => void;
}

const fieldConfig = [
  {
    key: "date" as keyof ColumnMappingType,
    label: "Date Column",
    icon: Calendar,
    color: "blue",
    description: "Transactions date or timestamp",
    keywords: ["date", "transaction date", "time", "when"],
  },
  {
    key: "description" as keyof ColumnMappingType,
    label: "Description Column",
    icon: FileText,
    color: "purple",
    description: "Transactions description or details",
    keywords: ["desc", "description", "transaction", "details", "merchant"],
  },
  {
    key: "amount" as keyof ColumnMappingType,
    label: "Amount Column",
    icon: DollarSign,
    color: "green",
    description: "Transactions amount or value",
    keywords: ["amount", "amt", "value", "price", "total", "sum"],
  },
  {
    key: "type" as keyof ColumnMappingType,
    label: "Type Column",
    icon: Tag,
    color: "orange",
    description: "Income or Expense indicator",
    keywords: ["type", "category", "transaction type", "income/expense"],
  },
];

export const ColumnMapping: React.FC<ColumnMappingProps> = ({
  file,
  onMappingComplete,
}) => {
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMappingType>({
    date: "",
    description: "",
    amount: "",
    type: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [autoDetected, setAutoDetected] = useState<
    Set<keyof ColumnMappingType>
  >(new Set());
  const [previewData, setPreviewData] = useState<any[]>([]);

  useEffect(() => {
    const readFileHeaders = async () => {
      setIsLoading(true);

      try {
        let headers: string[] = [];
        let preview: any[] = [];

        if (file.name.toLowerCase().endsWith(".csv")) {
          // Handle CSV type file
          const text = await file.text();
          const lines = text.split("\n");
          const firstline = lines[0];

          // strip surrounding quotes in each cell
          headers = firstline
            .split(",")
            .map((h) => h.trim().replace(/^["'"]|["'"]$/g, ""));

          // get preview data and strip quotes
          preview = lines.slice(1, 4).map((line) => {
            const values = line
              .split(",")
              .map((v) => v.trim().replace(/^["'"]|["'"]$/g, ""));
            return Object.fromEntries(
              headers.map((header, index) => [header, values[index] ?? ""]),
            );
          });
        } else if (
          file.name.toLowerCase().endsWith(".xlsx") ||
          file.name.toLowerCase().endsWith(".xls")
        ) {
          // Handle Excel type file
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { 
            type: "array",
            cellDates: true, 
          });

          // Get the first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Convert to JSON with headers
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length > 0) {
            // Get the first row which should be headers
            const firstRow = jsonData[0] as any[];

            // Safely process headers
            headers = firstRow
              .filter(
                (cell) => cell !== null && cell !== undefined && cell !== "",
              )
              .map((cell) => String(cell).trim())
              .filter((header) => header.length > 0);

            // helper function for format cell for readable preview
            const formatCell = (value: any): string => {
              if (value === null || value === undefined) return "";
              // xlsx format return JS date 
              if (value instanceof Date) {
                const y = value.getFullYear();
                const m = String(value.getMonth() + 1).padStart(2, "0");
                const d = String(value.getDate()).padStart(2, "0");
                return `${y}-${m}-${d}`
              }
              return String(value);
            }

            // get the preview data
            preview = jsonData.slice(1, 4).map((row: any) => {
              return Object.fromEntries(
                headers.map((header, index) => [header, row[index] || ""]),
              );
            });
          }
        }

        setColumns(headers);
        setPreviewData(preview);

        // Auto detect with tracking
        const detected = new Set<keyof ColumnMappingType>();
        const autoMapping: ColumnMappingType = {
          date: "",
          description: "",
          amount: "",
          type: "",
        };

        fieldConfig.forEach((field) => {
          const match = headers.find(
            (h) =>
              h &&
              field.keywords.some((keyword) =>
                h.toLocaleLowerCase().includes(keyword),
              ),
          );

          if (match) {
            autoMapping[field.key] = match;
            detected.add(field.key);
          } else if (headers.length > 0) {
            // fallback to position
            const fallbackIndex = [
              "date",
              "description",
              "amount",
              "type",
            ].indexOf(field.key);

            if (headers[fallbackIndex]) {
              autoMapping[field.key] = headers[fallbackIndex];
            }
          }
        });

        setMapping(autoMapping);
        setAutoDetected(detected);
      } catch (error) {
        console.error("❌ Error reading file:");
        alert(
          `Error reading file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    readFileHeaders();
  }, [file]);

  const handleMappingChange = (
    field: keyof ColumnMappingType,
    value: string,
  ) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
    // remove from auto-detected if manually changed
    if (autoDetected.has(field) && value !== mapping[field]) {
      setAutoDetected((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onMappingComplete(mapping);
  };

  const isFormValid = () => {
    return Object.values(mapping).every((value) => value !== "");
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center space-y-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="relative"
            >
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full" />
              <motion.div
                className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full"
                animate={{ rotate: -360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900 mb-1">
                Reading File
              </p>
              <p className="text-sm text-slate-600">{file.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle empty columns
  if (columns.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="p-8 text-center">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 3 }}
            >
              <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            </motion.div>
            <h3 className="text-xl font-bold text-red-900 mb-2">
              Could not read file headers
            </h3>
            <p className="text-red-700 mb-4">
              Please ensure the file has a header row and is in CSV or Excel
              format.
            </p>
            <p className="text-sm text-red-600 mb-6">File: {file.name}</p>
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border-0 shadow-2xl overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-linear-to-br from-blue-600 via-purple-600 to-cyan-600 p-6">
          <div className="flex items-center gap-3 mb-2">
            <motion.div
              animate={{
                rotate: [0, 360],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
            <CardTitle className="text-white text-2xl font-bold">
              Map Your Columns
            </CardTitle>
          </div>
          <p className="text-blue-100">
            Match your file columns with the required files • {columns.length}{" "}
            columns detected
          </p>
        </div>

        <CardContent className="p-6">
          {/* Auto detection column notice */}
          {autoDetected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 " />
                <p className="text-sm font-semibold text-green-900">
                  Auto detected {autoDetected.size} field
                  {autoDetected.size > 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-xs text-green-700 mt-1">
                Smart matching found: {Array.from(autoDetected).join(", ")}
              </p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Field Mappings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {fieldConfig.map((field, index) => {
                const Icon = field.icon;
                const isAutoDetected = autoDetected.has(field.key);

                return (
                  <motion.div
                    key={field.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group"
                  >
                    <div
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        mapping[field.key]
                          ? `border-${field.color}-300 bg-${field.color}-50`
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {/* Auto detected badge */}
                      {isAutoDetected && (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          className="absolute -top-2 -right-2 z-10"
                        >
                          <div className="bg-green-500 text-white rounded-full p-1.5 shadow-lg">
                            <Sparkles className="w-3 h-3" />
                          </div>
                        </motion.div>
                      )}

                      <div className="flex items-start gap-3 mb-3">
                        <motion.div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            mapping[field.key]
                              ? `bg-${field.color}-500 text-white`
                              : "bg-slate-100 text-slate-400"
                          }`}
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                        >
                          <Icon className="w-5 h-5" />
                        </motion.div>
                        <div className="flex-1">
                          <label className="block text-sm font-bold text-slate-900 mb-1">
                            {field.label}
                          </label>
                          <p className="text-xs text-slate-600">
                            {field.description}
                          </p>
                        </div>
                      </div>

                      <select
                        value={mapping[field.key]}
                        onChange={(e) =>
                          handleMappingChange(field.key, e.target.value)
                        }
                        className={`w-full px-3 py-2.5 border-2 rounded-lg font-medium
                          focus:ring-2 focus:ring-${field.color}-500 focus:border-${field.color}-500
                          transition-all ${
                            mapping[field.key]
                              ? `border-${field.color}-300 bg-white`
                              : "border-slate-300 bg-slate-50"
                          }`}
                        required
                      >
                        {columns.map((column, idx) => (
                          <option key={`${field.key}-${idx}-${column}`}>
                            {column}
                          </option>
                        ))}
                      </select>

                      {/* Preview Data */}
                      {mapping[field.key] && previewData.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 pt-3 border-t border-slate-200"
                        >
                          <p className="text-xs font-semibold text-slate-600 mb-2">
                            Preview:
                          </p>
                          <div className="space-y-1">
                            {previewData.slice(0, 2).map((row, idx) => (
                              <div
                                key={idx}
                                className="text-xs bg-white px-2 py-1 rounded border border-slate-200 truncate"
                              >
                                {row[mapping[field.key]] || (
                                  <span className="text-slate-400 italic">
                                    empty
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                type="submit"
                disabled={!isFormValid()}
                className={`w-full h-14 text-lg font-bold shadow-lg transition-all ${
                  isFormValid()
                    ? "bg-linear-to-r from-blue-600 via-purple-600 to-cyan-600 hover:shadow-xl hover:scale-[1.02]"
                    : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                <span>Process File</span>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};
