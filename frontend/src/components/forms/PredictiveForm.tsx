import React, { useState, useEffect } from "react";
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
  CheckCheck,
} from "lucide-react";

interface PredictiveFormProps {
  userId: number;
}

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            Analyzing financial patterns...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
        return "bg-red-500";
      case "HIGH":
        return "bg-orange-500";
      case "MEDIUM":
        return "bg-yellow-500";
      case "LOW":
        return "bg-blue-500";
      case "MINIMAL":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health Score Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Financial Health</CardTitle>
            <CardDescription>Overall Assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold">
                  {healthCheck?.overall_health?.score || 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    /100
                  </span>
                </div>
                <Badge
                  className={`mt-2 ${getRiskColor(
                    healthCheck?.overall_health?.status || ""
                  )}`}
                >
                  {healthCheck?.overall_health?.status || "UNKNOWN"}
                </Badge>
              </div>
              <Progress
                value={healthCheck?.overall_health?.score || 0}
                className="h-2"
              />
              <p className="text-sm text-muted-foreground text-center">
                Next review: {healthCheck?.next_review_recommended || "90 days"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Anomalies Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Anomaly Detection</CardTitle>
            <CardDescription>Unusual transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Detected</span>
                <span className="font-semibold">
                  {anomalies?.anomalies?.length || 0} transactions
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Risk Level</span>
                <Badge className={getRiskColor(anomalies?.risk_level || "")}>
                  {anomalies?.risk_level || "UNKNOWN"}
                </Badge>
              </div>
              {anomalies?.anomalies && anomalies.anomalies.length > 0 && (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Anomalous Found</AlertTitle>
                  <AlertDescription className="text-xs">
                    Review {anomalies.anomalies.length} anomalous transactions
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Future Risks card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Future Risks</CardTitle>
            <CardDescription>Predicted concerns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Identified</span>
                <span className="font-semibold">
                  {futureRisks?.future_risks.length || 0} risks
                </span>
              </div>
              {futureRisks?.future_risks &&
              futureRisks.future_risks.length > 0 ? (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Monitor Closely</AlertTitle>
                  <AlertDescription className="text-xs">
                    {futureRisks.future_risks.length} potential risks detected
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="default">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Good News</AlertTitle>
                  <AlertDescription className="text-xs">
                    No Significant future risks detected
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="risks">Risk Assessment</TabsTrigger>
          <TabsTrigger value="future">Future Prevention</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Priority Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {healthCheck?.priority_actions?.map((action, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-1 text-yellow-500" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anomalous Transactions</CardTitle>
              <CardDescription>
                {anomalies?.total_transactions_analyzed || 0} transactions
                analyzed over {anomalies?.window_days || 90} days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anomalies?.anomalies && anomalies.anomalies.length > 0 ? (
                <div className="space-y-4">
                  {anomalies.anomalies.map((anomaly, index) => (
                    <Alert key={index} variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <div className="ml-2">
                        <AlertTitle className="flex justify-between">
                          <span>
                            ${anomaly.amount.toFixed(2)} - {anomaly.category}
                          </span>
                          <Badge className={getRiskColor(anomaly.risk_level)}>
                            {anomaly.risk_level}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription>
                          <p className="text-sm">{anomaly.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {anomaly.explanation}
                          </p>
                          <p className="text-xs font-medium mt-2">
                            Suggested: {anomaly.suggested_action}
                          </p>
                        </AlertDescription>
                      </div>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No anomalies detected in your recent transactions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="space-y-4" value="risks">
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment Breakdown</CardTitle>
              <CardDescription>
                Overall Risk Score: {riskAssessment?.risk_score || 0}/100
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {riskAssessment?.components &&
                  Object.entries(riskAssessment.components).map(
                    ([key, component]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium capitalize">
                            {key.replace("_"," ")}
                          </span>
                          <span className="font-bold">
                            {component.score}/25
                          </span>
                        </div>
                        <Progress
                          value={(component.score / 25) * 100}
                          className="h-2"
                        />
                        <p className="text-sm text-muted-foreground">
                          {component.details}
                        </p>
                      </div>
                    )
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="future" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Future Risks Prediction</CardTitle>
              <CardDescription>
                Horizon: {futureRisks?.horizon_months || 6} months
              </CardDescription>
            </CardHeader>
            <CardContent>
              {futureRisks?.future_risks &&
              futureRisks.future_risks.length > 0 ? (
                <div className="space-y-4">
                  {futureRisks.future_risks.map((risk, index) => (
                    <Alert
                      key={index}
                      variant={
                        risk.severity === "HIGH"
                          ? "destructive"
                          : risk.severity === "MEDIUM"
                          ? "warning"
                          : "default"
                      }
                    >
                      <TrendingUp className="h-4 w-4" />
                      <div className="ml-2">
                        <AlertTitle className="flex justify-between">
                          <span>{risk.type.replace("_", " ")}</span>
                          <Badge
                            variant={
                              risk.severity === "HIGH"
                                ? "destructive"
                                : risk.severity === "MEDIUM"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {risk.severity}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription>
                          <p className="text-sm">{risk.description}</p>
                          <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                            <div>
                              <span className="font-medium">Timeline:</span>{" "}
                              {risk.timeline}
                            </div>
                            <div>
                              <span className="font-medium">Action:</span>{" "}
                              {risk.mitigation}
                            </div>
                          </div>
                        </AlertDescription>
                      </div>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>
                    No significant future risks predicted based on current
                    patterns
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PredictiveForm;
