import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timedelta
import logging
import joblib, hashlib
from backend.models.database import Transaction
from backend.services.forecasting_services import ForecastingService
from scipy import stats
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import json

logger = logging.getLogger(__name__)

class PredictiveAnalysisService:
    """Simple predictive analysis method for financial data"""
    
    def __init__(self, db: Session):
        self.db = db
        
    def detect_anomalies(self, user_id: int, window_days: int = 90) -> Dict[str, Any]:
        """Detecting anomaly transactions using different methods"""
        
        try:
            # get the recent transactions
            cutoff_date = datetime.now() - timedelta(days=window_days)
            
            transactions = self.db.query(Transaction).filter(
                Transaction.user_id == user_id,
                Transaction.date >= cutoff_date,
                Transaction.type == "EXPENSE"
            ).all()
            
            # transactions data less than 10 will return 0
            if len(transactions) < 10:
                return {
                    "anomalies": [],
                    "risk_scores": 0,
                    "message": "Insufficient data for anomaly detection",
                    "total_transactions": len(transactions)
                }
                
            # preparing data...
            data = []
            for txn in transactions:
                data.append({
                    'id': txn.id,
                    'date': txn.date,
                    'amount': abs(txn.amount),
                    'category': txn.category or 'Unknown',
                    'description': txn.description or '',
                    'amount_log': np.log1p(abs(txn.amount))
                })
                
            df = pd.DataFrame(data)
            
            # method 1 : Statistical z-score 
            df['z-score'] = self.calculate_zscore(df['amount'])
            
            # method 2 : Isolation forest 
            isolation_anomalies = self.isolation_forest_detection(df[['amount_log']])
            df['isolation_score'] = isolation_anomalies
            
            # method 3 : category-based anomalies
            category_anomalies = self.detect_category_anomalies(df)
            df['category_anomaly'] = category_anomalies
            
            # method 4 : Temporal anomalies
            temporal_anomalies = self.detect_temporal_anomalies(df)
            df['temporal_anomaly'] = temporal_anomalies
            
            # Combine the scores and flag anomalies
            df['anomaly_score'] = (
                (df['z-score'].abs() > 3).astype(int) * 0.4 + df['isolation_score'] * 0.3 + df['category_anomaly'] * 0.2 + df['temporal_anomaly'] * 0.1
            )
            
            # Flag anomalies (score > 0.5)
            df['is_anomaly'] = df['anomaly_score'] > 0.5
            
            # Get anomalous transactions
            anomalies_df = df[df['is_anomaly']].sort_values('anomaly_score', ascending=False)
            
            # Build the response
            anomalies = []
            for _, row in anomalies_df.head(10).iterrows():
                explanation = self.explain_anomaly(row, df)
                
                anomalies.append({
                    'transaction_id': int(row['id']),
                    'date': row['date'].isoformat() if hasattr(row['date'], 'isoformat') else str(row['date']),
                    'amount': float(row['amount']),
                    'category': row['category'],
                    'description': row['description'][:100],
                    'anomaly_score': float(row['anomaly_score']),
                    'risk_level': self.determine_risk_level(row['anomaly_score']),
                    'explanation': explanation,
                    'suggested_action': self.suggest_anomaly_action(row, df)
                })
                
            # Calculate overall risk scores (0-100)
            risk_score = min(100, int((len(anomalies) / len(df)) * 100 * 2))
            
            return {
                "anomalies": anomalies,
                "risk_score": risk_score,
                "risk_level": self.risk_level_from_score(risk_score),
                "total_transactions_analyzed": len(df),
                "anomaly_percentage": float(len(anomalies) / len(df) * 100),
                "detection_methods_used": ["z-score", "isolation_forest", "category_analysis", "temporal_analysis"],
                "window_days": window_days
            }
            
        except Exception as e:
            logger.error(f"Anomaly detection failed: {e}")
            return {
                "anomalies": [],
                "risk_score": 0,
                "error": str(e),
                "total_transactions": 0
            }
            
    def calculate_zscore(self, amounts: pd.Series) -> pd.Series:
        """Calculate z-scores for amount anomaly detection"""
        
        mean = amounts.mean()
        std = amounts.std()
        
        if std == 0:
            return pd.Series([0] * len(amounts), index=amounts.index)
        
        return (amounts - mean) / std
    
    def isolation_forest_detection(self, features: pd.DataFrame, contamination: float = 0.1) -> pd.Series:
        """Use isolation forest for anomaly detection"""
        try:
            data_hash = hashlib.md5(pd.util.hash_pandas_object(features).values).hexdigest()[:8]
            cache_key = f"iso_forest_{data_hash}"
            
            # check redis cache for already trained model
            cached_predictions = self.cache.get('anomaly', cache_key) if hasattr(self, 'cache') else None
            if cached_predictions:
                return pd.Series(cached_predictions)
            
            # scale features
            scaler = StandardScaler()
            scaled_features = scaler.fit_transform(features)
            
            # train isolation forest
            iso_forest = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=100
            )
            
            predictions = iso_forest.fit_predict(scaled_features)
            
            # cache the result
            if hasattr(self, 'cache'):
                self.cache.set('anomaly', cache_key, predictions.tolist())
            
            # convert the anomaly scores to only have 1: normal and -1: anomaly
            return pd.Series(predictions == -1, index=features.index)
        
        except Exception as e:
            logger.error(f"Isolation Forest failed: {e}")
            return pd.Series([0] * len(features), index=features.index)
        
    def detect_category_anomalies(self, df: pd.DataFrame) -> pd.Series:
        """Detect anomalies based on user spending patterns"""
        anomalies = pd.Series([0] * len(df), index=df.index)
        
        if len(df) < 20:
            return anomalies
        
        # calculate the average spending per category
        category_stats = df.groupby('category')['amount'].agg(['mean', 'std']).fillna(0)
        
        for idx, row in df.iterrows():
            category = row['category']
            amount = row['amount']
            
            if category in category_stats.index:
                cat_mean = category_stats.loc[category, 'mean']
                cat_std = category_stats.loc[category, 'std']
                
                if cat_std > 0:
                    # flag if amount is > 3 standard deviations from category 'mean'
                    z_score = (amount - cat_mean) / cat_std
                    if abs(z_score) > 3:
                        anomalies[idx] = 1
                        
        return anomalies
    
    def detect_temporal_anomalies(self, df: pd.DataFrame) -> pd.Series:
        """Detect anomalies based on timing patterns"""
        
        anomalies = pd.Series([0] * len(df), index=df.index)
        
        if len(df) < 30:
            return anomalies
        
        # Convert dates to day of week and hour (if available)
        df['day_of_week'] = df['date'].dt.dayofweek
        df['day_of_month'] = df['date'].dt.day
        
        # simple detection
        day_counts = df['day_of_week'].value_counts()
        if len(day_counts) > 0:
            most_common_day = day_counts.idxmax()
            
            for idx, row in df.iterrows():
                if row['day_of_week'] != most_common_day:
                    # check if amount is also unusual
                    if row['z_score'] > 2:
                        anomalies[idx] = 1
                        
        return anomalies
    
    def explain_anomaly(self, anomaly_row: pd.Series, all_data: pd.DataFrame) -> str:
        """Generate human-readable explanation for anomaly"""
        
        explanations = []
        
        amount = anomaly_row['amount']
        category = anomaly_row['category']
        
        # Amount-based explanation
        avg_amount = all_data['amount'].mean()
        if amount > avg_amount * 3:
            explanations.append(f"mount (${amount:.2f}) is more than 3x the average transaction (${avg_amount:.2f})")
        
        # Category-based explanation
        if category != 'Unknown':
            cat_data = all_data[all_data['category'] == category]
            if len(cat_data) > 0:
                cat_avg = cat_data['amount'].mean()
                if amount > cat_avg * 2:
                    explanations.append(f"Much higher than typical {category} spending (${cat_avg:.2f})")
                    
        # z-score explanation
        if abs(anomaly_row['z_score']) > 3:
            explanations.append(f"Statistically significant outlier (Z-score > 3)")
            
        # temporal explanation
        if anomaly_row['temporal_anomaly'] == 1:
            explanations.append("Unusual pattern detected across multiple factors")
            
        return ". ".join(explanations) + "-"
    
    def determine_risk_level(self, anomaly_score: float) -> str:
        """Determine risk level from anomaly score"""
        if anomaly_score >= 0.8:
            return "HIGH"
        elif anomaly_score >= 0.6:
            return "MEDIUM"
        elif anomaly_score >= 0.4:
            return "LOW"
        else:
            return "MINIMAL"
        
    def risk_level_from_score(self, risk_score: int) -> str:
        if risk_score >= 70:
            return "HIGH"
        elif risk_score >= 40:
            return "MEDIUM"
        elif risk_score >= 20:
            return "LOW"
        else:
            return "MINIMAL"
        
    def suggest_anomaly_action(self, anomaly_row: pd.Series, all_data: pd.DataFrame) -> str:
        """Suggest action for anomalous tranasaction"""
        category = anomaly_row['category']
        amount = anomaly_row['amount']
        
        # Category-specific suggestions
        category_suggestions = {
            'Food': "Review grocery receipts for this transaction",
            'Dining': "Consider reducing restaurant visits",
            'Entertainment': "Evaluate subscription services",
            'Shopping': "Check if this was a necessary purchase",
            'Transportation': "Review fuel or ride-sharing usage",
            'Housing': "Verify rent/mortgage payment amount",
            'Utilities': "Check for billing errors",
            'Healthcare': "Confirm medical expense",
            'Income': "Verify deposit source",
            'Transfer': "Review transfer details"
        }
        
        if category in category_suggestions:
            suggestion = category_suggestions[category]
        else:
            suggestion = "Review this transaction for accuracy"
            
        # add amount-based suggestion
        avg_amount = all_data['amount'].mean()
        if amount > avg_amount * 5:
            suggestion += ". Consider setting spending alerts for large transactions."
            
        return suggestion
    
    def calculate_financial_risk_score(self, user_id: int) -> Dict[str, Any]:
        """Calculate comprehensive financial score that combines anomalies with forecasting"""
        
        try:
            transactions = self.db.query(Transaction).filter(
                Transaction.user_id == user_id,
                Transaction.date >= datetime.now() - timedelta(days=365)
            ).all()
            
            if len(transactions) < 30:
                return {
                    "risk_score": 0,
                    "risk_level": "INSUFFICIENT_DATA",
                    "components": {},
                    "recommendations": ["Need more transaction history for the accurate risk assessment"]
                }
            
            # Calculate various risk components    
            components = {}
            
            # 1. Anomaly Risk (Scoring: 0-25 points)
            anomaly_result = self.detect_anomalies(user_id)
            anomaly_risk_score = anomaly_result.get('risk_score', 0)
            anomaly_risk = min(25, anomaly_risk_score * 0.25)
            components['anomaly_risk'] = {
                'score': anomaly_risk,
                'details': f"Found {len(anomaly_result['anomalies'])} anomalous transactions"
            }
            
            # 2. Volatility Risk (Scoring: 0-20 points)
            volatility_risk = self.calculate_volatility_risk(transactions)
            components['volatility_risk'] = {
                'score': volatility_risk,
                'details': "Based on spending consistency"
            }
            
            # 3. Category Concentration Risk (0-15 points)
            concentration_risk = self.calculate_concentration_risk(transactions)
            components['concentration_risk'] = {
                'score': concentration_risk,
                'details': "Based on spending consistency"
            }
            
            # 4. Income stability risk (0-20 points)
            income_stability_risk = self.calculate_income_stability_risk(user_id)
            components['income_stability_risk'] = {
                'score': income_stability_risk,
                'details': "Based on income consistency"
            }
            
            # 5. Emergency fund risk (0-20 points)
            emergency_fund_risk = self.calculate_emergency_fund_risk(user_id, transactions)
            components['emergency_fund_risk'] = {
                'score': emergency_fund_risk,
                'details': "Based on savings and expense patterns"
            }
            
            # calculate total risk score (0-100)
            total_risk_score = sum(comp['score'] for comp in components.values())
            
            # determine risk level
            risk_level = self.determine_overall_risk_level(total_risk_score)
            
            # generate general recommendations
            recommendations = self.generate_risk_recommendations(components, total_risk_score)
            
            return {
                "risk_score": int(total_risk_score),
                "risk_level": risk_level,
                "components": components,
                "recommendations": recommendations,
                "analysis_date": datetime.now().isoformat(),
                "data_period_days": 365,
                "transactions_analyzed": len(transactions)
            }
            
        except Exception as e:
            logger.error(f"Risk calculation failed: {e}")
            return {
                "risk_score": 0,
                "risk_level": "ERROR",
                "error": str(e)
            }
            
    def calculate_volatility_risk(self, transactions: List) -> float:
        """Calculate risk based on spending volatility"""
        
        if len(transactions) < 10:
            return 0
        
        # Get monthly spending
        monthly_data = {}
        for txn in transactions:
            if txn.type == 'EXPENSE':
                month_key = txn.date.strftime('%Y-%m')
                monthly_data.setdefault(month_key, 0)
                monthly_data[month_key] += abs(txn.amount)
                
        if len(monthly_data) < 3:
            return 0
        
        # calculate coeffecient of variation
        amounts = list(monthly_data.values())
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        
        if mean_amount == 0:
            return 0
        
        cv = std_amount / mean_amount
        
        # convert to risk score (0-20)
        if cv > 0.5:
            return 20
        elif cv > 0.3:
            return 15
        elif cv > 0.2:
            return 10
        elif cv > 0.1:
            return 5
        else:
            return 0
        
    def calculate_concentration_risk(self, transactions: List) -> float:
        """Calculate risk based on spending concentration"""
            
        expenses = [t for t in transactions if t.type == 'EXPENSE']
        
        if len(expenses) < 10:
            return 0
        
        # calculate category distribution
        category_totals = {}
        for txn in expenses:
            category = txn.category or 'Unknown'
            category_totals[category] = category_totals.get(category, 0) + abs(txn.amount)
            
        total_expenses = sum(category_totals.values())
        
        if total_expenses == 0:
            return 0
        
        # calculate herfidahl index (measure of concentration)
        hhi = sum((amount / total_expenses) ** 2 for amount in category_totals.values())
        
        # convert to risk score (0-15)
        if hhi > 0.5:
            return 15
        elif hhi > 0.3:
            return 10
        elif hhi > 0.2:
            return 5
        else:
            return 0
        
    def calculate_income_stability_risk(self, user_id: int) -> float:
        """Calculate risk based on income stability"""
        
        income_transactions = self.db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.type == 'INCOME',
            Transaction.date >= datetime.now() - timedelta(days=180)
        ).all()
        
        if len(income_transactions) < 3:
            return 10
        
        # check for regular income pattern
        amounts = [abs(txn.amount) for txn in income_transactions]
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        
        if mean_amount == 0:
            return 15
        
        cv = std_amount / mean_amount
        
        # convert to risk score (0-20)
        if cv > 0.5:
            return 20
        elif cv > 0.3:
            return 15
        elif cv > 0.2:
            return 10
        elif cv > 0.1:
            return 5
        else:
            return 0
        
    def calculate_emergency_fund_risk(self, user_id: int, transactions: List) -> float:
        """Calculate risk based on emergency fund adequacy"""
        
        # get the monthly expenses
        monthly_expenses = {}
        for txn in transactions:
            if txn.type == 'EXPENSE':
                month_key = txn.date.strftime('%Y-%m')
                monthly_expenses.setdefault(month_key, 0)
                monthly_expenses[month_key] += abs(txn.amount)
                
        if not monthly_expenses:
            return 15
        
        avg_monthly_expense = np.mean(list(monthly_expenses.values()))
        
        # get savings/income ratio
        income_transactions = [t for t in transactions if t.type == 'INCOME']
        if income_transactions:
            total_income = sum(abs(t.amount) for t in income_transactions)
            total_expenses = sum(abs(t.amount) for t in transactions if t.type == 'EXPENSE')
            
            if total_income > 0:
                savings_rate = (total_income - total_expenses) / total_income
                
                if savings_rate < 0:
                    return 20
                elif savings_rate < 0.1:
                    return 15
                elif savings_rate < 0.2:
                    return 10
                elif savings_rate < 0.3:
                    return 5
                else:
                    return 0
                
        return 10
    
    def determine_overall_risk_level(self, risk_score: float) -> str:
        """Determine overall risk level"""
        
        if risk_score >= 70:
            return "CRITICAL"
        elif risk_score >= 50:
            return "HIGH"
        elif risk_score >= 30:
            return "MODERATE"
        elif risk_score >= 15:
            return "LOW"
        else:
            return "MINIMAL"
        
    def generate_risk_recommendations(self, components: Dict, total_score: float) -> List[str]:
        """Generate personalized risk mitigation recommendations"""
        recommendations = []
        
        # general recommendations based on overall scores
        if total_score >= 70:
            recommendations.append("CRITICAL: Immediate financial review recommended. Consider consulting a financial advisor.")
            recommendations.append("Focus on reducing high-risk spending categories immediately.")
        elif total_score >= 50:
            recommendations.append("HIGH RISK: Develop a detailed budget and track expenses daily.")
            recommendations.append("Build emergency fund to cover at least 1 month of expenses.")
        
        # component-specific recommendations
        if components.get('anomaly_risk', {}).get('score', 0) > 10:
            recommendations.append("Review anomalous transactions and set up spending alerts.")
            
        if components.get('volatility_risk', {}).get('score', 0) > 10:
            recommendations.append("Work on stabilizing monthly expenses for better predictability.")
            
        if components.get('concentration_risk', {}).get('score', 0) > 5:
            recommendations.append("Diversify spending across more categories to reduce concentration risk.")
            
        if components.get('income_stability_risk', {}).get('score', 0) > 10:
            recommendations.append("Consider additional income streams to improve financial stability.")
            
        if components.get('emergency_fund_risk', {}).get('score', 0) > 10:
            recommendations.append("Prioritize building a 3-month emergency fund.")
                
                
        return recommendations[:5]
    
    def predict_future_risks(self, user_id: int, horizon_months: int = 6) -> Dict[str, Any]:
        """Predict potential future financial risks based on current pattern"""
        try:
            
            # get the current risk assessment 
            current_risk = self.calculate_financial_risk_score(user_id)
            
            # get expense forecast
            forecasting = ForecastingService(self.db)
            forecast_result = forecasting.forecast_expenses(user_id, periods=horizon_months)
            
            # analyze forecast for future risks
            future_risks = []
            
            # check for increasing expense trend
            forecast_values = forecast_result.values
            if forecast_values and len(forecast_values) >= 3:
                trend = np.polyfit(range(len(forecast_values)), forecast_values, 1)[0]
                
                if trend > 0:
                    future_risks.append({
                        'type': 'INCREASING_EXPENSES',
                        'severity': 'MEDIUM' if trend < forecast_values[0] * 0.1 else 'HIGH',
                        'description': f'Expenses projected to increase by ${trend:.2f} per month',
                        'timeline': 'Next 3-6 months',
                        'mitigation': 'Review discretionary spending and create stricter budget'
                    })
                    
            # check for volatility in forecast
            forecast_std = np.std(forecast_values) if len(forecast_values) > 1 else 0
            forecast_mean = np.mean(forecast_values) if forecast_values else 0
            
            if forecast_mean > 0 and forecast_std / forecast_mean > 0.3:
                future_risks.append({
                    'type': 'HIGH_VOLATILITY',
                    'severity': 'MEDIUM',
                    'description': 'High month-to-month expense variability predicted',
                    'timeline': 'Next 6 months',
                    'mitigation': 'Create variable expense buffer in budget'
                })
                
            # combine with current state risks for comprehensive view
            return {
                'current_risk_assessment': current_risk,
                'future_risks': future_risks,
                'forecast_horizon_months': horizon_months,
                'analysis_date': datetime.now().isoformat(),
                'summary': self.summarize_future_risks(future_risks, current_risk)
            }
            
        except Exception as e:
            logger.error(f"Future risk prediction failed: {e}")
            return {
                'error': str(e),
                'future_risks': [],
                'current_risk_assessment': None
            }
            
    def summarize_future_risks(self, future_risks: List[Dict], current_risk: Dict) -> str:
        """Generate summary of future risks"""
        if not future_risks:
            if current_risk.get('risk_level') in ['CRITICAL', 'HIGH']:
                return "Current high risk requires immediate attention before considering future projections."
            
            return "No significant future risks detected based on current patterns."
        
        high_risks = [r for r in future_risks if r['severity'] == 'HIGH']
        medium_risks = [r for r in future_risks if r['severity'] == 'MEDIUM']
        
        summary_parts = []
        
        if high_risks:
            summary_parts.append(f"{len(high_risks)} high-risk trends detected requiring immediate attention.")
            
        if medium_risks:
            summary_parts.append(f"{len(medium_risks)} medium-risk trends to monitor.")
            
        if current_risk.get('risk_score', 0) > 50:
            summary_parts.append("Current financial health increases vulnerability to future risks.")
            
        return " ".join(summary_parts) if summary_parts else "Risks manageable with proactive planning."
            
            
            
                
        
        
        
    
    