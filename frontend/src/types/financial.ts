export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  month: string;
}

export interface AIAdviceResponse {
  advice: string;
  insights: string[];
  recommendation: string[];
  generated_at: string;
  financial_health_score?: number;
  key_metrics?: {
    savings_rate?: number;
    expense_to_income_ratio?: number;
    essential_spending_ratio?: number;
  };
  risk_assessment?: string[];
  improvement_oppurtunities?: string[];
}

export interface FinancialSummary {
  timeframe: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  top_expense_category: string;
  top_expense_amount: number;
  expense_breakdown: Record<string, number>;
  transaction_count: number;
  financial_health_score?: number;
  average_daily_spending?: number;
  discretionary_spending?: number;
  essential_spending?: number;
  spending_patterns?: {
    highest_spending_day?: [string, number];
    most_frequent_category?: [string, number];
    recurring_expenses?: string[];
    unusual_spending?: string[];
  };
  income_patterns?: {
    income_sources?: Record<string, number>;
    income_consistency?: string;
    average_monthly_income?: number;
  };
  date?: string;
}

export interface ForecastInsight {
  type: "info" | "warning" | "positive";
  title: string;
  description: string;
  details: string;
  action: string;
}

export interface AccuracyMetrics {
  mae: number;
  mape: number;
  rmse: number;
  mdape: number;
  coverage: number;
  interpretation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ForecastResponse {
  dates: string[];
  values: number[];
  confidence_upper: number[];
  confidence_lower: number[];
  historical_data?: {
    dates: string[];
    values: number[];
  };
  seasonality_patterns?: {
    weekly_seasonality: boolean;
    monthly_seasonality: boolean;
    yearly_seasonality: boolean;
    trend_strength: string;
    volatility_score: number;
    outlier_count: number;
  };
  forecast_insights?: ForecastInsight[];
  accuracy_metrics?: AccuracyMetrics;
  metadata?: {
    total_transactions: number;
    date_range: {
      start: string;
      end: string;
      days_covered: number;
    };
    category_distribution: Record<string, number>;
  };
  component_analysis?: {
    trend: number[];
    yearly?: number[];
    holidays?: number[];
  };
  visualizations?: {
    main_plot: string;
    seasonality_plot: string;
  };
  recommendations?: string[];
}

export interface ForecastScenario {
  baseline: ForecastResponse;
  optimistic: {
    values: number[];
    confidence_upper: number[];
    confidence_lower: number[];
  };
  pessimistic: {
    values: number[];
    confidence_upper: number[];
    confidence_lower: number[];
  };
  comparison: {
    optimistic_vs_baseline: number;
    pessimistic_vs_baseline: number; 
  }
}

export interface AIAdviceResponse {
  advice: string;
  insights: string[];
  recommendation: string[];
  generated_at: string;
}

export interface DocumentUploadResponse {
  message: string;
  document_id: number;
  transaction_count: number;
  chunk_count: number;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  type: string;
}

export interface Anomaly {
  transaction_id: number;
  date: string;
  amount: number;
  category: string;
  description: string;
  anomaly_score: number;
  risk_level: string;
  explanation: string;
  suggested_action: string;
}

export interface AnomalyDetectionResult {
  user_id: number;
  analysis_date: string;
  anomalies: Anomaly[];
  risk_score: number;
  risk_level: string;
  total_transactions_analyzed: number;
  anomaly_percentage: number;
  detection_methods_used: string[];
  window_days: number;
}

export interface RiskComponent {
  score: number;
  details: string;
}

export interface RiskAssessment {
  user_id: number;
  analysis_date: string;
  risk_score: number;
  risk_level: string;
  components: {
    anomaly_risk?: RiskComponent;
    volatility_risk?: RiskComponent;
    concentration_risk?: RiskComponent;
    income_stability_risk?: RiskComponent;
    emergency_fund_risk?: RiskComponent;
  };
  recommendations: string[];
  data_period_days: number;
  transactions_analyzed: number;
}

export interface FutureRisk {
  type: string;
  severity: string;
  description: string;
  timeline: string;
  mitigation: string;
}

export interface FutureRiskPrediction {
  user_id: number;
  horizon_months: number;
  analysis_date: string;
  current_risk_assessment: RiskAssessment;
  future_risks: FutureRisk[];
  summary: string;
}

export interface FinancialHealthCheck {
  user_id: number;
  analysis_date: string;
  overall_health: {
    score: number;
    status: string;
    risk_score: number;
  };
  anomaly_analysis: AnomalyDetectionResult;
  risk_assessment: RiskAssessment;
  future_risk_prediction: FutureRiskPrediction;
  priority_actions: string[];
  next_review_recommended: string;
}

