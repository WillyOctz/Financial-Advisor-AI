"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnMapping as ColumnMappingType } from "@/types/financial";
import * as XLSX from "xlsx";

interface ColumnMappingProps {
  file: File;
  onMappingComplete: (mapping: ColumnMappingType) => void;
}

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

  useEffect(() => {
    const readFileHeaders = async () => {
      setIsLoading(true);

      try {
        let headers: string[] = [];

        if (file.name.toLowerCase().endsWith(".csv")) {
          // Handle CSV type file
          const text = await file.text();
          const firstline = text.split("\n")[0];
          headers = firstline.split(",").map((header) => header.trim());
        } else if (
          file.name.toLowerCase().endsWith(".xlsx") ||
          file.name.toLowerCase().endsWith(".xls")
        ) {
          // Handle Excel type file
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array" });

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
              .filter((cell) => {
                // Filter out null, undefined, and empty values
                return cell !== null && 
                       cell !== undefined && 
                       cell !== "" && 
                       !(typeof cell === "number" && isNaN(cell));
              })
              .map((cell) => {
                // Convert to string safely
                if (cell === null || cell === undefined) return "";
                return String(cell).trim();
              })
              .filter(header => header.length > 0); // Remove empty strings
          }
        } else {
          console.error("❌ Unsupported file type:", file.name);
          alert(
            `Unsupported file type: ${file.name}. Please upload CSV or Excel files.`,
          );
          return;
        }

        // Log for debugging
        
        setColumns(headers);

        // Auto detect common column names with safety checks
        const autoMapping: ColumnMappingType = {
          date:
            headers.find(
              (h) => h && (
                h.toLowerCase().includes("date") ||
                h.toLowerCase().includes("transaction date")
              )
            ) || (headers.length > 0 ? headers[0] : ""),

          description:
            headers.find(
              (h) => h && (
                h.toLowerCase().includes("desc") ||
                h.toLowerCase().includes("description") ||
                h.toLowerCase().includes("transaction") ||
                h.toLowerCase().includes("details")
              )
            ) || (headers.length > 1 ? headers[1] : ""),

          amount:
            headers.find(
              (h) => h && (
                h.toLowerCase().includes("amount") ||
                h.toLowerCase().includes("amt") ||
                h.toLowerCase().includes("value") ||
                h.toLowerCase().includes("price") ||
                h.toLowerCase().includes("total")
              )
            ) || (headers.length > 2 ? headers[2] : ""),

          type:
            headers.find(
              (h) => h && (
                h.toLowerCase().includes("type") ||
                h.toLowerCase().includes("category") ||
                h.toLowerCase().includes("transaction type") ||
                h.toLowerCase().includes("income/expense")
              )
            ) || (headers.length > 3 ? headers[3] : ""),
        };

        setMapping(autoMapping);
      } catch (error) {
        console.error("❌ Error reading file:", error);
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onMappingComplete(mapping);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Reading file: {file.name}...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle empty columns
  if (columns.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-red-600 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Could not read file headers
          </h3>
          <p className="text-gray-600">
            Please ensure the file has a header row and is in CSV or Excel
            format.
          </p>
          <p className="text-sm text-gray-500 mt-2">File: {file.name}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map Your Columns</CardTitle>
        <p className="text-sm text-gray-600">
          Please map your file columns to the required fields
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Column
              </label>
              <select
                value={mapping.date}
                onChange={(e) => handleMappingChange("date", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Column</option>
                {columns.map((column, index) => (
                  <option key={`date-${index}-${column}`} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description Column
              </label>
              <select
                value={mapping.description}
                onChange={(e) =>
                  handleMappingChange("description", e.target.value)
                }
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select column</option>
                {columns.map((column, index) => (
                  <option key={`desc-${index}-${column}`} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount Column
              </label>
              <select
                value={mapping.amount}
                onChange={(e) => handleMappingChange("amount", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select column</option>
                {columns.map((column, index) => (
                  <option key={`amount-${index}-${column}`} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type Column (Income/Expense)
              </label>
              <select
                value={mapping.type}
                onChange={(e) => handleMappingChange("type", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select column</option>
                {columns.map((column, index) => (
                  <option key={`type-${index}-${column}`} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" className="w-full">
            Process File
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};