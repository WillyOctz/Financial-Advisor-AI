"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
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
  TrendingUp,
  TrendingDown,
  Filter,
  X,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useTransactionHistory } from "@/lib/hooks/useTransactionsHistory";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency } from "@/lib/utils/currency";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} satisfies Variants;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 12,
    },
  },
} satisfies Variants;

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
  hover: {
    y: -5,
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10,
    },
  },
} satisfies Variants;

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      type: "spring",
      stiffness: 100,
      damping: 12,
    },
  }),
  hover: {
    scale: 1.01,
    backgroundColor: "rgba(99, 102, 241, 0.05)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10,
    },
  },
} satisfies Variants;

const filterPanelVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: {
      duration: 0.3,
      ease: "easeInOut",
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.2,
      ease: "easeInOut",
    },
  },
} satisfies Variants;

export function TransactionTable() {
  const {
    loading,
    error,
    getTransactionHistory,
    getExtractedDocuments,
    exportTransactions,
  } = useTransactionHistory();
  const { currency } = useCurrency();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

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
            data.transactions?.map((t: any) => t.category).filter(Boolean) ||
              [],
          ),
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

  const clearError = () => {
    // Implement the error state later
    handleRefresh();
  };

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="mt-6 border-red-200 bg-red-50/50">
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
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Transaction History
            </h1>
            <p className="text-gray-500 mt-1">
              Track and manage all your financial transactions
            </p>
          </div>
          <motion.div
            className="flex gap-2"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="border-indigo-200 hover:bg-indigo-50"
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            variants={filterPanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Card className="overflow-hidden border-indigo-100 bg-linear-to-br from-indigo-50/50 to-purple-50/50">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="lg:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Search :
                    </label>
                    <form onSubmit={handleSearchSubmit} className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search transactions..."
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          className="w-full border-gray-200 focus:border-indigo-300 focus:ring-indigo-200"
                        />
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 mt-0.5"
                      >
                        Search
                      </Button>
                    </form>
                  </div>

                  {/* Year */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Year:
                    </label>
                    <Select
                      value={filters.year.toString()}
                      onValueChange={(value) =>
                        handleFilterChange({ year: parseInt(value) })
                      }
                    >
                      <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200">
                        <SelectValue />
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

                  {/* Month */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Month
                    </label>
                    <Select
                      value={filters.month?.toString() || "all"}
                      onValueChange={(value) =>
                        handleFilterChange({
                          month: value === "all" ? null : parseInt(value),
                        })
                      }
                    >
                      <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((month) => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Type
                    </label>
                    <Select
                      value={filters.type}
                      onValueChange={(value) =>
                        handleFilterChange({ type: value })
                      }
                    >
                      <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="INCOME">Income</SelectItem>
                        <SelectItem value="EXPENSE">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Category
                    </label>
                    <Select
                      value={filters.category || "all"}
                      onValueChange={(value) =>
                        handleFilterChange({
                          category: value === "all" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200">
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

                  {/* Clear Filters */}
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={handleClearFilters}
                      className="w-full border-gray-200 hover:bg-gray-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      {summary && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={containerVariants}
        >
          {/* Total Income Card */}
          <motion.div variants={cardVariants} whileHover="hover">
            <Card className="overflow-hidden border-0 bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-emerald-100">
                      Total income
                    </p>
                    <motion.p
                      className="text-3xl font-bold"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 10,
                        delay: 0.2,
                      }}
                    >
                      {formatCurrency(summary.total_income, currency)}
                    </motion.p>
                    <div className="flex items-center gap-1 text-xs text-emerald-100">
                      <TrendingUp className="h-3 w-3" />
                      <span>{summary.income_count} transactions</span>
                    </div>
                  </div>
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <ArrowUpRight className="h-6 w-6" />
                    </div>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Total Expense Card */}
          <motion.div variants={cardVariants} whileHover="hover">
            <Card className="overflow-hidden border-0 bg-linear-to-br from-rose-500 to-pink-600 text-white shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-rose-100">
                      Total Expense
                    </p>
                    <motion.p
                      className="text-3xl font-bold"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 10,
                        delay: 0.3,
                      }}
                    >
                      {formatCurrency(summary.total_expenses, currency)}
                    </motion.p>
                    <div className="flex items-center gap-1 text-xs text-rose-100">
                      <TrendingDown className="h-3 w-3" />
                      <span>{summary.expense_count} transactions</span>
                    </div>
                  </div>
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <ArrowDownRight className="h-6 w-6" />
                    </div>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Total Transactions Card */}
          <motion.div variants={cardVariants} whileHover="hover">
            <Card className="overflow-hidden border-0 bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-indigo-100">
                      Total Transactions
                    </p>
                    <motion.p
                      className="text-3xl font-bold"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 10,
                        delay: 0.4,
                      }}
                    >
                      {summary.transaction_count}
                    </motion.p>
                    <div className="flex items-center gap-2 text-xs text-indigo-100">
                      <span>Income: {summary.income_count}</span>
                      <span>•</span>
                      <span>Expense: {summary.expense_count}</span>
                    </div>
                  </div>
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <Database className="h-6 w-6" />
                    </div>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Transactions Table */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-indigo-100 shadow-lg">
          <CardHeader className="bg-linear-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Transactions
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {loading
                    ? "Loading..."
                    : `Showing ${transactions.length} of ${pagination.total} transactions`}
                </p>
              </div>
              <div className="flex gap-2">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="border-indigo-200 hover:bg-indigo-50"
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={loading}
                    className="border-indigo-200 hover:bg-indigo-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </motion.div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <motion.div
                className="flex flex-col justify-center items-center py-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Loader2 className="h-12 w-12 text-indigo-500" />
                </motion.div>
                <p className="mt-4 text-gray-500">Loading transactions...</p>
              </motion.div>
            ) : transactions.length === 0 ? (
              <motion.div
                className="text-center py-20"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 10,
                    delay: 0.1,
                  }}
                >
                  <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                </motion.div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Transactions Found
                </h3>
                <p className="text-gray-500">
                  Try adjusting your filters or upload your first document
                </p>
              </motion.div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                        <TableHead className="w-[100px] font-semibold text-gray-700">
                          Source
                        </TableHead>
                        <TableHead className="w-[120px] font-semibold text-gray-700">
                          Date
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          Description
                        </TableHead>
                        <TableHead className="w-[150px] font-semibold text-gray-700">
                          Category
                        </TableHead>
                        <TableHead className="w-[100px] font-semibold text-gray-700">
                          Type
                        </TableHead>
                        <TableHead className="w-[120px] text-right font-semibold text-gray-700">
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="wait">
                        {transactions.map((transaction, i) => (
                          <motion.tr
                            key={transaction.id}
                            custom={i}
                            variants={tableRowVariants}
                            initial="hidden"
                            animate="visible"
                            whileHover="hover"
                            className="border-b border-gray-100"
                          >
                            <TableCell className="font-medium">
                              <motion.span
                                className={`
                                  inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                    transaction.source === "extracted"
                                      ? "bg-purple-100 text-purple-700"
                                      : transaction.source === "transactions"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-gray-100 text-gray-700"
                                  }`}
                                whileHover={{ scale: 1.05 }}
                              >
                                {/* {transaction.source === "extracted" && "Extracted" }
                                {transaction.source === "all" && "All"} */}
                                {transaction.source === "transactions" &&
                                  "Transaction"}
                              </motion.span>
                            </TableCell>
                            <TableCell className="font-medium text-gray-900">
                              {new Date(transaction.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="truncate max-w-xs font-medium text-gray-900">
                                  {transaction.description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <motion.span
                                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                  transaction.category
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                                whileHover={{ scale: 1.05 }}
                              >
                                {transaction.category || "Uncategorized"}
                              </motion.span>
                            </TableCell>
                            <TableCell>
                              <motion.span
                                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                  transaction.type === "INCOME"
                                    ? "bg-emerald-100 text-emerald-500"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                                whileHover={{ scale: 1.05 }}
                              >
                                {transaction.type}
                              </motion.span>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              <motion.span
                                className={
                                  transaction.type === "INCOME"
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                }
                                whileHover={{ scale: 1.05 }}
                              >
                                {formatCurrency(transaction.amount, currency)}
                              </motion.span>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination.total_pages > 1 && (
                  <motion.div
                    className="flex flex-col sm:flex-row justify-between items-center p-6 bg-gray-50/50 border-t border-gray-100 gap-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="text-sm text-gray-600">
                      Page {pagination.page} of {pagination.total_pages}
                      <span className="mx-2">•</span>
                      {pagination.total} total transactions
                    </div>

                    <div className="flex gap-2">
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={!pagination.has_prev || loading}
                          className="border-gray-200"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                      </motion.div>
                      <div className="flex items-center gap-1">
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
                              <motion.div
                                key={pageNum}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Button
                                  variant={
                                    pagination.page === pageNum
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  className={`
                                    w-10 ${
                                      pagination.page === pageNum
                                        ? "bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                        : "border-gray-200"
                                    }`}
                                  onClick={() => handlePageChange(pageNum)}
                                  disabled={loading}
                                >
                                  {pageNum}
                                </Button>
                              </motion.div>
                            );
                          },
                        )}
                      </div>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={!pagination.has_next || loading}
                          className="border-gray-200"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
