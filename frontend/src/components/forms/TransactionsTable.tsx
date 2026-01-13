"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  Calendar,
  RefreshCw,
  FileText,
  Database,
} from "lucide-react";
import { useTransactionHistory } from "@/lib/hooks/useTransactionsHistory";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TransactionTable() {
  const {
    loading,
    error,
    getTransactionHistory,
    getExtractedDocuments,
    exportTransactions,
  } = useTransactionHistory();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // state filter
  const [filters, setFilters] = useState({
    source: "transactions" as "transactions",
    year: new Date().getFullYear(),
    month: null as number | null,
    type: "all",
    category: null as string | null,
    search: "",
    page: 1,
    per_page: 50,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  });

  const [searchInput, setSearchInput] = useState("");

  const monthOptions = [
    { value: "all", label: "All Months" },
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const sourceOptions = [
    { value: "transactions", label: "Transactions", icon: DollarSign },
  ];

  // Loading the extracted data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load the filtered data
  useEffect(() => {
    loadTransactionData();
  }, [
    filters.source,
    filters.year,
    filters.month,
    filters.type,
    filters.category,
    filters.search,
    filters.page,
  ]);

  const loadInitialData = async () => {
    try {
      // Need to be implemented of years and categories in backend API
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
      setAvailableYears(years);

      // Initial data load
      await loadTransactionData();
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  };

  const loadTransactionData = async () => {
    try {
      const data = await getTransactionHistory({
        source: filters.source,
        year: filters.year,
        month: filters.month || undefined,
        type: filters.type,
        category: filters.category || undefined,
        search: filters.search,
        page: filters.page,
        per_page: filters.per_page,
      });

      if (data) {
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
        setPagination(data.pagination || pagination);

        // Extract the unique categories from transactions API
        const uniqueCategories = Array.from(
          new Set(
            data.transactions?.map((t: any) => t.category).filter(Boolean) || []
          )
        ) as string[];

        if (uniqueCategories.length > 0) {
          setCategories(uniqueCategories);
        }
      }
    } catch (error) {
      console.error("Error loading transaction data:", error);
    }
  };

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange({ search: searchInput });
  };

  const handleClearFilters = () => {
    setFilters({
      source: "transactions",
      year: new Date().getFullYear(),
      month: null,
      type: "all",
      category: null,
      search: "",
      page: 1,
      per_page: 50,
    });
    setSearchInput("");
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleExport = async () => {
    try {
      await exportTransactions(filters.year);
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  };

  const handleRefresh = () => {
    loadTransactionData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const clearError = () => {
    // Implement the error state later
    handleRefresh();
  };

  if (error) {
    return (
      <Card className="mt-6">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-2">
            <Button onClick={clearError} variant="outline">
              Clear Error
            </Button>
            <Button onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Financial Transactions
        </h2>
        <p className="text-gray-600">
          View and manage your financial transactions from all sources
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Source</label>
                <Select
                  value={filters.source}
                  onValueChange={(value: "transactions") =>
                    handleFilterChange({ source: value })
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Year</label>
                <Select
                  value={filters.year.toString()}
                  onValueChange={(value) =>
                    handleFilterChange({ year: parseInt(value) })
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Month</label>
                <Select
                  value={filters.month?.toString() || "all"}
                  onValueChange={(value) =>
                    handleFilterChange({
                      month: value === "all" ? null : parseInt(value),
                    })
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select
                  value={filters.type}
                  onValueChange={(value) => handleFilterChange({ type: value })}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Category
                </label>
                <Select
                  value={filters.category || "all"}
                  onValueChange={(value) =>
                    handleFilterChange({
                      category: value === "all" ? null : value,
                    })
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search categories or description"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearchSubmit(e)}
                  className="px-5"
                  disabled={loading}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Search
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearFilters}
                  disabled={loading}
                >
                  Clear
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Income
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary.total_income)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Expenses
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary.total_expenses)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Transactions
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {summary.transaction_count}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Income: {summary.income_count} • Expense:{" "}
                    {summary.expense_count}
                  </p>
                </div>
                <Database className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {loading
                ? "Loading..."
                : `Showing ${transactions.length} of ${pagination.total} transactions`}
              {filters.source !== "transactions" && (
                <span className="ml-2">
                  • Source:{" "}
                  {sourceOptions.find((s) => s.value === filters.source)?.label}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No transactions found
              </h3>
              <p className="text-gray-500">
                Try adjusting your filters or upload your first document
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Source</TableHead>
                      <TableHead className="w-[120px]">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[150px]">Category</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow
                        key={transaction.id}
                        className="hover:bg-gray-50"
                      >
                        <TableCell className="font-medium">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              transaction.source === "extracted"
                                ? "bg-purple-100 text-purple-800"
                                : transaction.source === "transactions"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {transaction.source === "extracted" && "Extracted"}
                            {transaction.source === "transactions" &&
                              "Transaction"}
                            {transaction.source === "all" && "All"}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {new Date(transaction.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="truncate max-w-xs">
                              {transaction.description}
                            </p>
                            {transaction.raw_text && (
                              <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                                Raw: {transaction.raw_text.substring(0, 50)}...
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              transaction.category
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {transaction.category || "Uncategorized"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              transaction.type === "INCOME"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {transaction.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span
                            className={
                              transaction.type === "INCOME"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {formatCurrency(transaction.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.total_pages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                  <div className="text-sm text-gray-500">
                    Page {pagination.page} of {pagination.total_pages}
                    <span className="mx-2">•</span>
                    {pagination.total} total transactions
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.has_prev || loading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center">
                      {Array.from(
                        { length: Math.min(5, pagination.total_pages) },
                        (_, i) => {
                          let pageNum;
                          if (pagination.total_pages <= 5) {
                            pageNum = i + 1;
                          } else if (pagination.page <= 3) {
                            pageNum = i + 1;
                          } else if (
                            pagination.page >=
                            pagination.total_pages - 2
                          ) {
                            pageNum = pagination.total_pages - 4 + i;
                          } else {
                            pageNum = pagination.page - 2 + i;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={
                                pagination.page === pageNum
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              className="w-10"
                              onClick={() => handlePageChange(pageNum)}
                              disabled={loading}
                            >
                              {pageNum}
                            </Button>
                          );
                        }
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.has_next || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
