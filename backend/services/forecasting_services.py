import pandas as pd
import numpy as np
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
from sqlalchemy.orm import Session
from backend.models.database import Transaction, TransactionType
from backend.models.schemas import ForecastResponse
from backend.db.redis_client import cache_forecast, get_cached_forecast
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
import plotly.graph_objects as go
import plotly.express as px
import json
import logging
from scipy import stats
import traceback

logger = logging.getLogger(__name__)

class ForecastingService:
    def __init__(self, db: Session):
        self.db = db
        self.holiday_effects = self._get_holiday_effects()

    def _get_holiday_effects(self) -> List[Dict]:
        """Define holiday effects for better forecasting"""
        holidays = []

        holiday_dates = {
            'New Year': '01-01',
            'Christmas': '12-25',
            'Thanksgiving': '11-25',  
            'Black Friday': '11-26',  
            'Cyber Monday': '11-29',
            'Valentine\'s Day': '02-14',
            'Easter': '04-01',  
            'July 4th': '07-04',
            'Labor Day': '09-02',  
            'Memorial Day': '05-27',  
        }

        for holiday, date_str in holiday_dates.items():
            holidays.append({
                'holiday': holiday,
                'ds': pd.to_datetime(f'2025-{date_str}'),
                'lower_window': -3,
                'upper_window': 3
            })
        
        return pd.DataFrame(holidays)
    

    def get_transaction_data(self, user_id: int, transaction_type: str = "expense") -> pd.DataFrame:
        """Get transaction data with additional metadata for enhanced forecasting"""

        # Convert string to Enum
        if transaction_type.lower() == "expense":
            trans_type = TransactionType.EXPENSE
        else:
            trans_type = TransactionType.INCOME

        transactions = self.db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.type == trans_type
        ).order_by(Transaction.date).all()

        if not transactions:
            raise ValueError(f"No {transaction_type} transactions found for user {user_id}")
        
        data = []
        metadata = {
            "total_transactions": len(transactions),
            "date_range": {},
            "category_distribution": {},
            "trend_analysis": {}
        }

        for transaction in transactions:
            date_without_tz = transaction.date.replace(tzinfo=None)
            data.append({
                'ds': date_without_tz,
                'y': abs(transaction.amount),
                'category': transaction.category or 'Uncategorized',
                'description': transaction.description or ''
            })

        df = pd.DataFrame(data)

        if df.empty:
            raise ValueError("No valid transaction data found")
        
        # Add metadata
        metadata['date_range']['start'] = df['ds'].min().strftime('%Y-%m-%d')
        metadata['date_range']['end'] = df['ds'].max().strftime('%Y-%m-%d')

        # Calculate days covered
        days_covered = (df['ds'].max() - df['ds'].min()).days
        metadata['date_range']['days_covered'] = days_covered

        # Category distribution
        if 'category' in df.columns:
            category_totals = df.groupby('category')['y'].sum()
            metadata['category_distribution'] = category_totals.to_dict()

        return df, metadata
    
    def detect_seasonality_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Detect seasonality patterns in the data"""
        patterns = {
            'weekly_seasonality': False,
            'monthly_seasonality': False,
            'yearly_seasonality': False,
            'trend_strength': 'unknown',
            'volatility_score': 0,
            'outlier_count': 0
        }

        if len(df) < 30: # need at least 30 days of data for seasonality detection
            return patterns
        
        try:
            # Resample to daily
            df_daily = df.set_index('ds').resample('D').sum().fillna(0)

            # Check for weekly patterns
            if len(df_daily) >= 14:
                weekly_avg = df_daily['y'].rolling(7).mean()
                patterns['weekly_seasonality'] = bool(weekly_avg.std() > weekly_avg.mean() * 0.1)

            # Check for monthly patterns
            if len(df_daily) >= 60:
                monthly_avg = df_daily['y'].rolling(30).mean()
                patterns['monthly_seasonality'] = bool(monthly_avg.std() > monthly_avg.mean() * 0.1)

            if len(df_daily) >= 90:
                x = np.arange(len(df_daily))
                y = df_daily['y'].values
                slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

                if abs(slope) > std_err * 2: # Significant Trend
                    patterns['trend_strength'] = 'increasing' if slope > 0 else 'decreasing'
                else:
                    patterns['trend_strength'] = 'stable'

                # Volatility (coeffecient of variation)
                patterns['volatility_score'] = float(df_daily['y'].std() / df_daily['y'].mean() if df_daily['y'].mean() > 0 else 0)

                # Outlier detection
                Q1 = df_daily['y'].quantile(0.25)
                Q3 = df_daily['y'].quantile(0.75)
                IQR = Q3 - Q1
                outliers = df_daily[(df_daily['y'] < (Q1 - 1.5 * IQR)) | (df_daily['y'] > (Q3 + 1.5 * IQR))]
                patterns['outlier_count'] = int(len(outliers))


        except Exception as e:
            print(f"⚠️ Seasonality detection error: {e}")

        return patterns
    
    def forecast_expenses(self, user_id: int, periods: int = 6) -> ForecastResponse:
        """Generate enhanced expense forecasts with detailed insights"""

        # Check cache first
        cache_key = f"forecast_enhanced_{user_id}_{periods}"
        cached_forecast = get_cached_forecast(cache_key)
        if cached_forecast:
            return ForecastResponse(**cached_forecast)
        
        try:
            # Insert with metadata to enhance it
            df, metadata = self.get_transaction_data(user_id, "expense")

            if len(df) < 3:
                raise ValueError("Need at least 3 data points for forecasting")
            
            # Detect seasonality patterns
            seasonality_patterns = self.detect_seasonality_patterns(df)
            
            # Ensure proper datetime and handle data
            df['ds'] = pd.to_datetime(df['ds'])
            df = df.sort_values('ds')

            # Store original categories before aggregation
            original_categories = []
            if 'category' in df.columns:
                original_categories = [cat for cat in df['category'].unique() if pd.notna(cat)]
                print(f"Found categories: {original_categories}")

            # resampling to monthly data 
            df_monthly = df.set_index('ds').resample('M').sum().reset_index()

            if len(df_monthly) < 3:
                raise ValueError(f"Only {len(df_monthly)} months of data available. Need at least 3 months for forecasting.")
            
            # Create and fit model (enhanced the model)
            model = Prophet(
                yearly_seasonality=seasonality_patterns.get('yearly_seasonality', True),
                weekly_seasonality=seasonality_patterns.get('weekly_seasonality', False),
                daily_seasonality=False,
                holidays=self.holiday_effects,
                seasonality_mode='multiplicative',
                changepoint_prior_scale=0.05,
                changepoint_range=0.8
            )

            # Add additional reggressors if available - using original daily data
            if 'category' in df.columns and len(original_categories) > 0:
                # Create category dummy variable in daily data
                for category in original_categories:
                    df[f'category_{category}'] = (df['category'] == category).astype(int)
                    model.add_regressor(f"category_{category}")

                
                # also add to monthly dataframe for training
                for category in original_categories:
                    # aggregate category presence at monthly level
                    category_series = df.set_index('ds')[f'category_{category}'].resample('M').mean()
                    category_series = category_series.reindex(df_monthly['ds'].values)
                    category_series = category_series.fillna(0)
                    
                    df_monthly[f'category_{category}'] = category_series.values

            model.fit(df_monthly)

            # Creating future dataframe 
            future = model.make_future_dataframe(periods=periods, freq='M', include_history=True)

            # Add regressors to future dataframe
            if 'category' in df.columns and len(original_categories) > 0:
                # Use average category distribution for future predictions
                for category in original_categories:
                    # use average category presence from historical data
                    avg_presence = df[f'category_{category}'].mean()
                    future[f'category_{category}'] = avg_presence

            # Generate forecast
            forecast = model.predict(future)

            # Generate insights
            insights = self._generate_forecast_insights(
                df_monthly, forecast, seasonality_patterns, metadata, periods
            )

            # Calculate forecast accuracy metrics
            accuracy_metrics = self._calculate_forecast_accuracy(df_monthly, model)

            # Generate visualization
            visualizations = self._create_forecast_visualizations(df_monthly, forecast, insights)

            response_data = ForecastResponse(
                dates=forecast['ds'].dt.strftime('%Y-%m').tolist()[-periods:],
                values=forecast['yhat'].round(2).tolist()[-periods:],
                confidence_upper=forecast['yhat_upper'].round(2).tolist()[-periods:],
                confidence_lower=forecast['yhat_lower'].round(2).tolist()[-periods:],
                historical_data={
                    'dates': df_monthly['ds'].dt.strftime('%Y-%m').tolist(),
                    'values': df_monthly['y'].tolist()
                },
                seasonality_patterns=seasonality_patterns,
                forecast_insights=insights,
                accuracy_metrics=accuracy_metrics,
                metadata=metadata,
                component_analysis={
                    'trend': forecast['trend'].tolist()[-periods:],
                    'yearly': forecast['yearly'].tolist()[-periods:] if 'yearly' in forecast.columns else None,
                    'holidays': forecast['holidays'].tolist()[-periods:] if 'holidays' in forecast.columns else None
                },
                visualizations=visualizations,
                recommendations=self._generate_forecast_recommendations(insights, accuracy_metrics)
            )

            # cache the result
            cache_forecast(cache_key, response_data.dict())

            return response_data
        
        except Exception as e:
            print(f"❌ Forecasting error: {e}")
            traceback.print_exc()
            raise ValueError(f"Forecasting failed: {str(e)}")
        
    def _generate_forecast_insights(self, historical: pd.DataFrame, forecast: pd.DataFrame, seasonality: Dict, metadata: Dict, periods: int) -> List[Dict[str, Any]]:
        """Generate detailed insights from forecast"""
        insights = []

        # historical vs forecast comparison
        avg_historical = historical['y'].mean()
        avg_forecast = forecast['yhat'].tail(periods).mean()

        if avg_historical > 0:
            percentage_change = ((avg_forecast - avg_historical) / avg_historical) * 100

            if percentage_change > 10:
                insights.append({
                    'type': 'warning',
                    'title': 'Significant Increase Expected',
                    'description': f'Forecast shows a {percentage_change:.1f}% increase in average monthly expenses',
                    'details': f'Historical average: ${avg_historical:.2f}, Forecast average: ${avg_forecast:.2f}',
                    'action': 'Review spending habits and budget accordingly'
                })
            elif percentage_change < -10:
                insights.append({
                    'type': 'positive',
                    'title': 'Expenses Decreasing',
                    'description': f'Forecast shows a {abs(percentage_change):.1f}% decrease in average monthly expenses',
                    'details': f'Historical average: ${avg_historical:.2f}, Forecast average: ${avg_forecast:.2f}',
                    'action': 'Consider allocating saved funds to investments'
                })

        # Seasonality insights
        if seasonality.get('weekly_seasonality'):
            insights.append({
                'type': 'info',
                'title': 'Weekly Spending Patterns Detected',
                'description': 'Your spending shows clear weekly patterns',
                'details': 'Consider optimizing daily spending based on these patterns',
                'action': 'Review day-by-day spending analysis'
            })

        if seasonality.get('trend_strength') != 'stable':
            insights.append({
                'type': 'info' if seasonality['trend_strength'] == 'decreasing' else 'warning',
                'title': f'Clear {seasonality["trend_strength"].title()} Trend',
                'description': f'Your expenses show a {seasonality["trend_strength"]} trend over time',
                'details': seasonality['trend_strength'],
                'action': 'Adjust budget to account for this long-term trend'
            })

        # Volatility insight
        if seasonality.get('volatility_score', 0) > 0.5:
            insights.append({
                'type': 'warning',
                'title': 'High Spending Volatility',
                'description': 'Your spending shows high month-to-month variation',
                'details': f'Volatility score: {seasonality["volatility_score"]:.2f}',
                'action': 'Create more stable spending plan'
            })

        # Confidence interval width insight
        confidence_widths = []
        for i in range(periods):
            width = forecast['yhat_upper'].iloc[-periods + i] - forecast['yhat_lower'].iloc[-periods + i]
            confidence_widths.append(width / forecast['yhat'].iloc[-periods + i] if forecast['yhat'].iloc[-periods + i] > 0 else 0)
            avg_confidence_width = np.mean(confidence_widths) * 100

            if avg_confidence_width > 50:
                insights.append({
                    'type': 'warning',
                    'title': 'Low Forecast Confidence',
                    'description': f'Forecast confidence interval is wide (±{avg_confidence_width:.1f}%)',
                    'details': 'This indicates high uncertainty in predictions',
                    'action': 'Collect more historical data for better accuracy'
                })

            return insights
        
    def _calculate_forecast_accuracy(self, historical: pd.DataFrame, model: Prophet) -> Dict[str, float]:
        """Calculate forecast accuracy metrics using cross-validation"""
        if len(historical) < 6:
            logger.info("Insufficient data for cross validation, returning estimates")
            return {
                'mae': 0.0, 'mape': 0.0, 'rmse': 0.0,
                'mdape': 0.0, 'coverage': 0.0,
                'interpretation': 'Insufficient data for accuracy metrics',
                'confidence': 'low'
            }
        
        try:
            # Perform cross-validation
            df_cv = cross_validation(model, initial='180 days', period='30 days', horizon='90 days')

            # Calculate performance metrics
            df_p = performance_metrics(df_cv)

            accuracy_metrics = {
                'mae': float(df_p['mae'].mean()),
                'mape': float(df_p['mape'].mean()),
                'rmse': float(df_p['rmse'].mean()),
                'mdape': float(df_p['mdape'].mean()),
                'coverage': float(df_p['coverage'].mean())
            }

            # Interpret accuracy
            if accuracy_metrics['mape'] < 10:
                accuracy_metrics['interpretation'] = 'Excellent'
                accuracy_metrics['confidence'] = 'high'
            elif accuracy_metrics['mape'] < 20:
                accuracy_metrics['interpretation'] = 'Good'
                accuracy_metrics['confidence'] = 'medium'
            elif accuracy_metrics['mape'] < 30:
                accuracy_metrics['interpretation'] = 'Fair'
                accuracy_metrics['confidence'] = 'medium'
            else:
                accuracy_metrics['interpretation'] = 'Poor'
                accuracy_metrics['confidence'] = 'low'

            return accuracy_metrics
        
        except Exception as e:
            print(f"⚠️ Accuracy calculation error: {e}")
            return {
                'mae': 0,
                'mape': 0,
                'rmse': 0,
                'mdape': 0,
                'coverage': 0,
                'interpretation': 'Unknown',
                'confidence': 'low'
            }
        
    def _create_forecast_visualizations(self, historical: pd.DataFrame, forecast: pd.DataFrame, insights: List) -> Dict[str, str]:
        """Create interactive visualizations for the forecast"""
        try:
            # Create main forecast plot
            fig = go.Figure()

            # Add historical data
            fig.add_trace(go.Scatter(
                x=historical['ds'],
                y=historical['y'],
                mode='lines+markers',
                name='Historical',
                line=dict(color='blue', width=2),
                marker=dict(size=6)
            ))

            # Add forecast 
            fig.add_trace(go.Scatter(
                x=forecast['ds'],
                y=forecast['yhat'],
                mode='lines',
                name='Forecast',
                line=dict(color='red', width=3, dash='dash')
            ))

            # Add confidence interval
            fig.add_trace(go.Scatter(
                x=forecast['ds'].tolist() + forecast['ds'].tolist()[::-1],
                y=forecast['yhat_upper'].tolist() + forecast['yhat_lower'].tolist()[::-1],
                fill='toself',
                fillcolor='rgba(255, 0, 0, 0.2)',
                line=dict(color='rgba(255,255,255,0)'),
                hoverinfo="skip",
                showlegend=True,
                name='Confidence Interval'
            ))

            # Update layout
            fig.update_layout(
                title='Expense Forecast with Historical Comparison',
                xaxis_title='Date',
                yaxis_title='Amount ($)',
                hovermode='x unified',
                template='plotly_white'
            )

            # Create seasonality plot
            seasonality_fig = px.line(
                x=forecast['ds'],
                y=forecast['trend'],
                title='Underlying Trend Component'
            )
            
            return {
                'main_plot': fig.to_json(),
                'seasonality_plot': seasonality_fig.to_json()
            }
        
        except Exception as e:
            print(f"⚠️ Visualization creation error: {e}")
            return {}
        
    def _generate_forecast_recommendations(self, insights: List, accuracy_metrics: Dict) -> List[str]:
        """Generate actionable recommendations based on forecast insights"""
        recommendations = []

        # Based on accuracy
        if accuracy_metrics.get('confidence') == 'low':
            recommendations.append(
                "Collect at least 6 more months of data to improve forecast accuracy"
            )

        # Based on insights
        for insight in insights:
            if insight['type'] == 'warning' and 'increase' in insight['title'].lower():
                recommendations.append(
                    "Review discretionary spending categories to prepare for expected expense increases"
                )

            if insight['type'] == 'warning' and 'volatility' in insight['title'].lower():
                recommendations.append(
                    "Create an emergency fund to cover 3 months of expenses for volatile periods"
                )

        recommendations.extend([
            "Monitor actual spending vs forecast monthly and adjust as needed",
            "Set up budget alerts for months where forecast exceeds historical average by 20%",
            "Consider creating separate savings buckets for anticipated large expenses"
        ])

        return recommendations[:5] # Limit to top 5 recommendations
    
    def forecast_multiple_scenarios(self, user_id: int, periods: int = 6) -> Dict[str, Any]:
        """Generate multiple forecast scenarios (optimistic, pessimistic, baseline)"""
        try:
            df, metadata = self.get_transaction_data(user_id, "expense")

            if len(df) < 3:
                raise ValueError("Need at least 3 data points for scenario analysis")
            
            # Baseline Scenario
            baseline = self.forecast_expenses(user_id, periods)

            # Optimistic scenario (lower expense)
            optimistic_model = Prophet(
                yearly_seasonality=True,
                changepoint_prior_scale=0.01, # less sensitive to changes
                seasonality_mode="multiplicative"
            )
            df_monthly = df.set_index('ds').resample('M').sum().reset_index()
            optimistic_model.fit(df_monthly)
            future = optimistic_model.make_future_dataframe(periods=periods, freq='M')
            optimistic_forecast = optimistic_model.predict(future)

            pessimistic_model = Prophet(
                yearly_seasonality=True,
                changepoint_prior_scale=0.1, # More sensitive to changes
                seasonality_mode="additive"
            )
            pessimistic_model.fit(df_monthly)
            pessimistic_forecast = pessimistic_model.predict(future)

            scenarios = {
                'baseline': baseline,
                'optimistic': {
                    'values': optimistic_forecast['yhat'].tail(periods).tolist(),
                    'confidence_upper': optimistic_forecast['yhat_upper'].tail(periods).tolist(),
                    'confidence_lower': optimistic_forecast['yhat_lower'].tail(periods).tolist()
                },
                'pessimistic': {
                    'values': pessimistic_forecast['yhat'].tail(periods).tolist(),
                    'confidence_upper': pessimistic_forecast['yhat_upper'].tail(periods).tolist(),
                    'confidence_lower': pessimistic_forecast['yhat_lower'].tail(periods).tolist()
                }
            }

            # Calculate scenarios differences
            scenarios['comparison'] = {
                'optimistic_vs_baseline': np.mean([
                    (optimistic_forecast['yhat'].iloc[-i] - baseline.values[-i]) / baseline.values[-i] * 100
                    for i in range(1, periods+1) if baseline.values[-i] > 0
                ]),
                'pessimistic_vs_baseline': np.mean([
                    (pessimistic_forecast['yhat'].iloc[-i] - baseline.values[-i]) / baseline.values[-i] * 100
                    for i in range(1, periods+1) if baseline.values[-i] > 0
                ])
            }

            return scenarios
        
        except Exception as e:
            print(f"❌ Scenario forecasting error: {e}")
            raise ValueError(f"Scenario analysis failed: {str(e)}")

