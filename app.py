import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime
from features_engineering.features import categorize_transaction

# SETTING UP THE PAGE

st.set_page_config(page_title="Financial Advisor AI", layout="wide")
st.title("💸 Financial Advisor AI")
st.markdown("Upload your financial transactions (CSV or Excel) to get insights and predictions.😃")

# file uploader widget
uploaded_file = st.file_uploader("Choose a file", type=["csv", "excel"])

if uploaded_file is not None:
    # checking the file type and read
    if uploaded_file.name.endswith('.csv'):
        df = pd.read_csv(uploaded_file)
    else:
        df = pd.read_excel(uploaded_file)

    # show the raw data
    st.subheader("Raw Data")
    st.dataframe(df)

    st.subheader("Map Your Columns")
    # Get the column names from the uploaded file
    file_columns=df.columns.tolist()

    # Let the user assign their columns to the required standard columns
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        date_col = st.selectbox("Date Column", options=file_columns, index=0)
    with col2:
        desc_col = st.selectbox("Description Column", options=file_columns, index=1)
    with col3:
        amount_col = st.selectbox("Amount Column", options=file_columns, index=2)
    with col4: 
        type_col = st.selectbox("Type Column (Income/Expense)", options=file_columns, index=3)

    # Rename the dataframe columns to a standard
    df_standard = df.rename(columns={
        date_col: 'Date',
        desc_col: 'Description',
        amount_col: 'Amount',
        type_col: 'Type'
    })

# DATA CLEANING

    #conver date to datetime and amount to numeric
    df_standard['Date'] = pd.to_datetime(df_standard['Date'], errors='coerce')
    df_standard['Amount'] = pd.to_numeric(df_standard['Amount'], errors='coerce')

    # drop rows where essential data is missing
    df_clean = df_standard.dropna(subset=['Date', 'Amount', 'Type'])

    # Create the category column by applying the categorize_function
    df_clean['Category'] = df_clean['Description'].apply(categorize_transaction)

    # create a month-year column for grouping
    df_clean['Month'] = df_clean['Date'].dt.to_period('ME')

    st.success("Data successfully cleaned and mapped")
    st.subheader("Data With Categories")
    st.dataframe(df_clean)

# VISUALIZATIONS

    st.header("📊 Financial Overview")

    # Time series bar chart : Income vs Expense overview
    st.subheader("Income vs Expense Over Time")

    # group by Month and Type, sum the amount
    df_time_series = df_clean.groupby(['Month', 'Type'])['Amount'].sum().reset_index()

    # Pivot the table to have income and expense are seperate columns
    df_pivot = df_time_series.pivot(index='Month', columns='Type', values='Amount').reset_index()
    df_pivot['Month'] = df_pivot['Month'].astype(str) # convert to better plotting with sns or such 

    fig_time = px.bar(df_pivot, x='Month', y=['Income', 'Expense'], barmode='group', title='Income and Expense per Month')
    st.plotly_chart(fig_time, use_container_width=True)

    # 3. Show key metrics
    st.subheader("Key Metrics")
    total_income = df_clean[df_clean['Type']=='Income']['Amount'].sum()
    total_expense = df_clean[df_clean['Type']=='Expense']['Amount'].sum()
    net_savings = total_income - total_expense
    savings_rate = (net_savings / total_income) * 100 if total_income > 0 else 0

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Income", f"${total_income:,.2f}")
    col2.metric("Total Expense", f"${total_expense:,.2f}")
    col3.metric("Net Savings", f"${net_savings:,.2f}")
    col4.metric("Savings Rate", f"${savings_rate:,.1f}%")

# FORECASTING
    st.header("🔮 Future Forecast")


    df_expenses_forecast = df_clean[df_clean['Type']=='Expense'].copy()
    df_expenses_forecast = df_expenses_forecast[['Date', 'Amount']].resample('M', on='Date').sum().reset_index()
    df_expenses_forecast.columns = ['ds', 'y'] # Rename for prophet
    
    if len(df_expenses_forecast) > 2: # need at least 3 data points
        from prophet import Prophet
        model = Prophet()
        model.fit(df_expenses_forecast)
        future = model.make_future_dataframe(periods=2, freq="M") # forecasting 2 months ahead
        forecast = model.predict(future)

        st.write("Forecast of Future Expenses")
        fig_forecast = model.plot(forecast)
        st.pyplot(fig_forecast) 
    else:
        st.warning("Need more than 2 months of data to generate forecast.")

# LLM Advisors (OpenAi)

    st.header("🤖 Ai Advisor Insights")

    # 1. generate the structured summary on the backend
    latest_month = df_clean['Month'].max()
    df_latest_month = df_clean[df_clean['Month'] == latest_month]

    income_latest = df_latest_month[df_latest_month['Type']=='Income']['Amount'].sum()
    expense_latest = df_latest_month[df_latest_month['Type']=='Expense']['Amount'].sum()

    # Get top expense category
    top_expense_category = df_latest_month[df_latest_month['Type']=='Expense'].groupby('Category')['Amount'].sum().idxmax()
    top_expense_value = df_latest_month[df_latest_month['Type']=='Expense'].groupby('Category')['Amount'].sum().max()

    #create the prompt with our computed facts
    financial_summary = f"""
    ### FINANCIAL SUMMARY FOR USER ###
    - Analysis Period : {latest_month}
    - Total Income : ${income_latest:,.2f}
    - Total Expense : ${expense_latest:,.2f}
    - Net Savings : ${income_latest - expense_latest:,.2f}
    - Top Expense Category : {top_expense_category} (${top_expense_value:,.2f})
    ### END OF SUMMARY ###
    """

    # instructions of the LLM prompt
    prompt = f"""
    {financial_summary}
    Based on the summary above, please act as a concise,analytical and wise financial advisor.
    Give the user 2-3 brief insights about their spending habits and at least two practical piece of advice for improving their savings for next month.
    Be specific and reference the numbers provided. Do not use markdown. Keep it to at least 3-4 or more but not more than 6 sentences total.
    """

    # generating the advice prompt above
    if st.button("Generate AI Advice"):
        import google.generativeai as genai
        import os
        from dotenv import load_dotenv
        load_dotenv()

        try:
            genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
            model = genai.GenerativeModel('gemini-2.0-flash')
            response = model.generate_content(prompt)

            ai_advice = response.text
            st.success(ai_advice)
        except Exception as e:
            st.error(f"Sorry, I couldn't generate advice right now. Because token is max usage or network error. Error: {e}")