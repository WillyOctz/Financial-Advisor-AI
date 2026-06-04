import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants, keyframes } from "framer-motion";
import { useAnalysis } from "@/lib/hooks/useAnalysis";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Shield,
  Brain,
  Eye,
  Zap,
  Activity,
} from "lucide-react";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency } from "@/lib/utils/currency";

interface PredictiveFormProps {
  userId: number;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
} satisfies Variants;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
} satisfies Variants;

const tabContentVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2,
    },
  },
} satisfies Variants;

const PredictiveForm: React.FC<PredictiveFormProps> = ({ userId }) => {
  const {
    anomalies,
    riskAssessment,
    futureRisks,
    healthCheck,
    fetchAnomalies,
    fetchRiskAssessment,
    fetchFutureRisks,
    fetchHealthCheck,
    isLoading,
    error,
  } = useAnalysis();

  const [activeTab, setActiveTab] = useState("overview");
  const [mounted, setMounted] = useState(false);
  const { currency } = useCurrency();

  useEffect(() => {
    if (userId) {
      fetchHealthCheck(userId);
      fetchAnomalies(userId);
      fetchRiskAssessment(userId);
      fetchFutureRisks(userId);
    }
  }, [
    userId,
    fetchHealthCheck,
    fetchAnomalies,
    fetchRiskAssessment,
    fetchFutureRisks,
  ]);

  const getRiskColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
        return {
          bg: "bg-red-500",
          light: "bg-red-100",
          text: "text-red-700",
          border: "border-red-200",
          glow: "shadow-red-500/50",
        };
      case "HIGH":
        return {
          bg: "bg-orange-500",
          light: "bg-orange-100",
          text: "text-orange-700",
          border: "border-orange-200",
          glow: "shadow-orange-500/50",
        };
      case "MEDIUM":
        return {
          bg: "bg-yellow-500",
          light: "bg-yellow-100",
          text: "text-yellow-700",
          border: "border-yellow-200",
          glow: "shadow-yellow-500/50",
        };
      case "LOW":
        return {
          bg: "bg-blue-500",
          light: "bg-blue-100",
          text: "text-blue-700",
          border: "border-blue-200",
          glow: "shadow-blue-500/50",
        };
      case "MINIMAL":
        return {
          bg: "bg-green-500",
          light: "bg-green-100",
          text: "text-green-700",
          border: "border-green-200",
          glow: "shadow-green-500/50",
        };
      default:
        return {
          bg: "bg-gray-500",
          light: "bg-gray-100",
          text: "text-gray-700",
          border: "border-gray-200",
          glow: "shadow-gray-500/50",
        };
    }
  };

  const formatDescriptionWithCurrency = (description: string): string => {
    const dollarRegex = /\$([0-9,]+(?:\.[0-9]{2})?)/g;

    return description.replace(dollarRegex, (match, amount) => {
      const numericAmount = parseFloat(amount.replace(/,/g, ""));

      return formatCurrency(numericAmount, currency);
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <motion.div
          className="relative"
          animate={{ rotate: 360 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          <motion.div
            className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full"
            animate={{
              rotate: -360,
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </motion.div>
        <motion.p
          className="mt-6 text-slate-600 font-medium"
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          Analyzing financial patterns...
        </motion.p>
        <p className="text-sm text-slate-500 mt-2">This may take a moment</p>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-linear-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-xl p-6 shadow-lg"
      >
        <div className="flex items-center gap-4">
          <motion.div
            animate={{
              rotate: [0, -10, 10, -10, 0],
            }}
            transition={{
              duration: 0.5,
              repeat: 3,
            }}
          >
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
          </motion.div>
          <div>
            <h3 className="text-red-900 font-bold text-lg">Analyze Error</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <p className="text-red-600 text-sm mt-2">
              Please try refreshing the page
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const overallStatus = healthCheck?.overall_health?.status || "UNKNOWN";
  const statusColors = getRiskColor(overallStatus);

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health Score Card */}
        <motion.div variants={cardVariants} whileHover={{ scale: 1.02 }}>
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all bg-linear-to-br from-slate-100 to-blue-100 overflow-hidden group">
            {/* Decorative Element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <CardHeader className="pb-2 relative z-10">
              <div className="flex items-center gap-2">
                <motion.div
                  className="p-2 bg-linear-to-br from-blue-500 to-cyan-500 rounded-lg"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <Shield className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <CardTitle className="text-lg">Financial Health</CardTitle>
                  <CardDescription>Overall Assessment</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative z-10">
              <div className="space-y-4">
                <div className="text-center">
                  <motion.div
                    className="text-5xl font-bold text-slate-900"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      delay: 0.2,
                    }}
                  >
                    {healthCheck?.overall_health?.score || 0}
                    <span className="text-lg font-normal text-slate-500 ml-1">
                      /100
                    </span>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Badge
                      className={`mt-3 px-4 py-1 ${statusColors.bg} text-white shadow-lg ${statusColors.glow}`}
                    >
                      {overallStatus}
                    </Badge>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1, delay: 0.6 }}
                  className="origin-left"
                >
                  <Progress
                    value={healthCheck?.overall_health?.score || 0}
                    className="h-3"
                  />
                </motion.div>

                <p className="text-sm text-slate-600 text-center">
                  Next review:{" "}
                  {healthCheck?.next_review_recommended || "90 Days"}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Anomalies Card */}
        <motion.div variants={cardVariants} whileHover={{ scale: 1.02 }}>
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all bg-linear-to-br from-white to-amber-50 overflow-hidden group">
            {/* Decorative Element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-amber-400 to-orange-400 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <CardHeader className="pb-2 relative z-10">
              <div className="flex items-center gap-2">
                <motion.div
                  className="p-2 bg-linear-to-br from-amber-500 to-orange-500 rounded-lg"
                  animate={
                    anomalies?.anomalies && anomalies.anomalies.length > 0
                      ? {
                          scale: [1, 1.1, 1],
                        }
                      : {}
                  }
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                >
                  <Eye className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <CardTitle className="text-lg">Anomaly Detection</CardTitle>
                  <CardDescription>Unusual transactions</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative z-10">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Detected</span>
                  <motion.span
                    className="font-bold text-2xl text-slate-900"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                  >
                    {anomalies?.anomalies?.length || 0}
                  </motion.span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Risk Level</span>
                  <Badge
                    className={`${getRiskColor(anomalies?.risk_level || "").bg} text-white shadow-lg`}
                  >
                    {anomalies?.risk_level || "UNKNOWN"}
                  </Badge>
                </div>

                {anomalies?.anomalies && anomalies.anomalies.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Alert
                      className={`mt-2 ${getRiskColor(anomalies.risk_level).light} border-0`}
                    >
                      <AlertTriangle
                        className={`h-4 w-4 ${getRiskColor(anomalies.risk_level).text}`}
                      />
                      <AlertTitle
                        className={getRiskColor(anomalies.risk_level).text}
                      >
                        Anomalies Found
                      </AlertTitle>
                      <AlertDescription className="text-xs text-slate-600">
                        Review {anomalies.anomalies.length} unusual transaction
                        {anomalies.anomalies.length > 1 ? "s" : ""}
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                ) : (
                  <Alert className="mt-2 bg-green-50 border-0">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-700">
                      All Clear
                    </AlertTitle>
                    <AlertDescription className="text-xs text-green-600">
                      No Anomalies Detected
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Future Risks Card */}
        <motion.div variants={cardVariants} whileHover={{ scale: 1.02 }}>
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all bg-linear-to-br from-white to-purple-50 overflow-hidden group">
            {/* Decorative Element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <CardHeader className="pb-2 relative z-10">
              <div className="flex items-center gap-2">
                <motion.div
                  className="p-2 bg-linear-to-br from-purple-500 to-pink-500 rounded-lg"
                  animate={{
                    rotateY: [0, 180, 360],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Brain className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <CardTitle className="text-lg">Future Risks</CardTitle>
                  <CardDescription>AI Predictions</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative z-10">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Identified</span>
                  <motion.span
                    className="font-bold text-2xl text-slate-900"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                  >
                    {futureRisks?.future_risks?.length || 0}
                  </motion.span>
                </div>

                {futureRisks?.future_risks &&
                futureRisks.future_risks.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Alert className="mt-2 bg-amber-50 border-0">
                      <motion.div
                        className="mb-2"
                        animate={{
                          scale: [1, 1.2, 1],
                        }}
                      >
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      </motion.div>
                      <AlertTitle className="text-amber-700 mb-0.5">
                        Monitor Closely
                      </AlertTitle>
                      <AlertDescription className="text-xs text-amber-600">
                        {futureRisks.future_risks.length} potential risk
                        {futureRisks.future_risks.length > 1 ? "s" : ""}{" "}
                        detected
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                ) : (
                  <Alert className="mt-2 bg-green-50 border-0">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-700">
                      Looking Good
                    </AlertTitle>
                    <AlertDescription className="text-xs text-green-600">
                      No significant risks predicted
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed analysis tab */}
      <motion.div variants={cardVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full bg-slate-100 p-1 rounded-xl gap-1">
            {[
              { value: "overview", label: "Overview", icon: Activity },
              { value: "anomalies", label: "Anomalies", icon: Eye },
              { value: "risks", label: "Risk Assessment", icon: Shield },
              { value: "future", label: "Future Risks", icon: Zap },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-white data-[state=active]:shadow-lg rounded-lg transition-all text-sm md:text-base"
              >
                <tab.icon className="w-4 h-4 mr-1 md:mr-2 hidden sm:block" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            {/* Overview tab */}
            <TabsContent value="overview" className="mt-10">
              <motion.div
                key="overview"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="border-0 shadow-xl">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-600" />
                      Priority Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {healthCheck?.priority_actions &&
                    healthCheck.priority_actions.length > 0 ? (
                      <ul className="space-y-3">
                        {healthCheck.priority_actions.map((action, index) => (
                          <motion.li
                            key={index}
                            className="flex items-start gap-3 p-4 rounded-xl bg-linear-to-r from-slate-50 to-transparent hover:from-blue-50 transition-colors group"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ x: 4 }}
                          >
                            <motion.div
                              className="flex shrink-0 mt-1"
                              whileHover={{ rotate: 360 }}
                              transition={{ duration: 0.6 }}
                            >
                              <AlertTriangle className="h-5 w-5 text-amber-500" />
                            </motion.div>
                            <span className="text-slate-700 group-hover:text-slate-900 transition-colors">
                              {action}
                            </span>
                          </motion.li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <p className="text-slate-600">
                          No priority actions needed
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Anomalies tab */}
            <TabsContent value="anomalies" className="mt-10">
              <motion.div
                key="anomalies"
                variants={tabContentVariants}
                initial="initial"
                animate="visible"
                exit="exit"
              >
                <Card className="border-0 shadow-xl">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-amber-600" />
                      Anomalous Transactions
                    </CardTitle>
                    <CardDescription>
                      {anomalies?.total_transactions_analyzed || 0} transactions
                      analyzed over {anomalies?.window_days || 90} days
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {anomalies?.anomalies && anomalies.anomalies.length > 0 ? (
                      <div className="space-y-4">
                        {anomalies.anomalies.map((anomaly, index) => {
                          const riskColors = getRiskColor(anomaly.risk_level);
                          return (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <Alert
                                className={`${riskColors.light} ${riskColors.border} border-l-4 hover:shadow-lg transition-shadow`}
                              >
                                <div className="flex items-start gap-3">
                                  <motion.div
                                    animate={
                                      anomaly.risk_level === "CRITICAL" ||
                                      anomaly.risk_level === "HIGH"
                                        ? { scale: [1, 1.2, 1] }
                                        : {}
                                    }
                                    transition={{
                                      duration: 2,
                                      repeat: Infinity,
                                    }}
                                  >
                                    <AlertTriangle
                                      className={`h-5 w-5 ${riskColors.text}`}
                                    />
                                  </motion.div>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                      <AlertTitle
                                        className={`text-lg ${riskColors.text}`}
                                      >
                                        ${anomaly.amount.toFixed(2)} -{" "}
                                        {anomaly.category}
                                      </AlertTitle>
                                      <Badge
                                        className={`${riskColors.bg} text-white shadow-md`}
                                      >
                                        {anomaly.risk_level}
                                      </Badge>
                                    </div>
                                    <AlertDescription>
                                      <p className="text-sm text-slate-700 mb-2">
                                        {anomaly.description}
                                      </p>
                                      <p className="text-xs text-slate-500 mb-3">
                                        {anomaly.explanation}
                                      </p>
                                      <div
                                        className={`p-3 ${riskColors.light} rounded-lg`}
                                      >
                                        <p className="text-sm font-medium text-slate-700">
                                          💡 Suggested:{" "}
                                          {anomaly.suggested_action}
                                        </p>
                                      </div>
                                    </AlertDescription>
                                  </div>
                                </div>
                              </Alert>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <motion.div
                        className="text-center py-12"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <motion.div
                          animate={{
                            y: [0, -10, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                          }}
                        >
                          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                        </motion.div>
                        <p className="text-slate-600 text-lg font-medium">
                          No anomalies detected
                        </p>
                        <p className="text-slate-500 text-sm mt-2">
                          Your transactions look normal.
                        </p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Risk assessment tab */}
            <TabsContent value="risks" className="mt-10">
              <motion.div
                key="risks"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="border-0 shadow-xl">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      Risk Assessment Breakdown
                    </CardTitle>
                    <CardDescription>
                      Overall Risk Score: {riskAssessment?.risk_score || 0}/100
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      {riskAssessment?.components &&
                        Object.entries(riskAssessment.components).map(
                          ([key, component], index) => (
                            <motion.div
                              key={key}
                              className="space-y-3 p-4 rounded-xl bg-linear-to-r from-slate-50 to-transparent hover:from-blue-50 transition-colors"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-slate-900 capitalize text-lg">
                                  {key.replace(/_/g, " ")}
                                </span>
                                <motion.span
                                  className="font-bold text-2xl text-blue-600"
                                  initial={{ opacity: 0, scale: 0 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{
                                    delay: index * 0.1 + 0.2,
                                    type: "spring",
                                  }}
                                >
                                  {component.score}/25
                                </motion.span>
                              </div>
                              <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{
                                  duration: 1,
                                  delay: index * 0.1 + 0.3,
                                }}
                                className="origin-left"
                              >
                                <Progress
                                  value={(component.score / 25) * 100}
                                  className="h-3"
                                />
                              </motion.div>
                              <p className="text-sm text-slate-600 leading-relaxed">
                                {component.details}
                              </p>
                            </motion.div>
                          ),
                        )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Future Risks Tab */}
            <TabsContent value="future" className="mt-10">
              <motion.div
                key="future"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="border-0 shadow-xl">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-purple-600" />
                      Future Risk Predictions
                    </CardTitle>
                    <CardDescription>
                      AI Forecast: {futureRisks?.horizon_months || 6} months
                      ahead
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {futureRisks?.future_risks &&
                    futureRisks.future_risks.length > 0 ? (
                      <div className="space-y-4">
                        {futureRisks.future_risks.map((risk, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <Alert
                              className={`${
                                risk.severity === "HIGH"
                                  ? "bg-red-50 border-red-200 border-l-4"
                                  : risk.severity === "MEDIUM"
                                    ? "bg-amber-50 border-amber-200 border-l-4"
                                    : "bg-blue-50 border-blue-200 border-l-4"
                              } hover:shadow-lg transition-shadow`}
                            >
                              <div className="flex items-start gap-3">
                                <TrendingUp
                                  className={`h-5 w-5 ${
                                    risk.severity === "HIGH"
                                      ? "text-red-600"
                                      : risk.severity === "MEDIUM"
                                        ? "text-amber-600"
                                        : "text-blue-600"
                                  }`}
                                />
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-2">
                                    <AlertTitle
                                      className={`text-lg ${
                                        risk.severity === "HIGH"
                                          ? "text-red-700"
                                          : risk.severity === "MEDIUM"
                                            ? "text-amber-700"
                                            : "text-blue-700"
                                      }`}
                                    >
                                      {risk.type.replace(/_/g, " ")}
                                    </AlertTitle>
                                    <Badge
                                      className={`${
                                        risk.severity === "HIGH"
                                          ? "bg-red-500"
                                          : risk.severity === "MEDIUM"
                                            ? "bg-amber-500"
                                            : "bg-blue-500"
                                      } text-white shadow-md`}
                                    >
                                      {risk.severity}
                                    </Badge>
                                  </div>
                                  <AlertDescription>
                                    <p className="text-sm text-slate-700 mb-3">
                                      {formatDescriptionWithCurrency(risk.description)}
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                                        <p className="text-xs text-slate-500 mb-1">
                                          Timeline
                                        </p>
                                        <p className="text-sm font-medium text-slate-700">
                                          {risk.timeline}
                                        </p>
                                      </div>
                                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                                        <p className="text-xs text-slate-500 mb-1">
                                          Mitigation
                                        </p>
                                        <p className="text-sm font-medium text-slate-700">
                                          {risk.mitigation}
                                        </p>
                                      </div>
                                    </div>
                                  </AlertDescription>
                                </div>
                              </div>
                            </Alert>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <motion.div
                        className="text-center py-12"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <motion.div
                          animate={{
                            rotate: [0, 10, -10, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                          }}
                        >
                          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                        </motion.div>
                        <p className="text-slate-600 text-lg font-medium">
                          No significant risks predicted
                        </p>
                        <p className="text-slate-500 text-sm mt-2">
                          Your financial future looks stable!
                        </p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </motion.div>
    </motion.div>
  );
};

export default PredictiveForm;
