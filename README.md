## Financial Advisor AI

An intelligent financial analysis platform that transforms raw financial documents into actionable insights, forecasts, and personalized AI-driven advice.

## Overview

Financial Advisor AI is a full-stack application designed to help users:

- Upload financial documents (.csv, .xlsx)
- Analyze income, expenses, and financial health
- Generate forecasts and predictive insights
- Visualize data through interactive dashboards
- Receive guidance from an AI-powered financial advisor

This project combines data processing, machine learning, and LLM-based advisory into a single platform.

## Key Features

- Document ingestion & processing (CSV, Excel)
- Financial analytics (income, expenses, savings, health score)
- Forecasting & predictive analysis
- AI financial advisor (LLM-powered)
- Caching & performance optimization (Redis)
- Authentication (JWT-based)
- Cloud storage integration (Supabase)
- Scalable backend with batch processing

## Tech Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- Redis (caching)

### Frontend
- React/Next.js

### AI / ML
- Primary: Grok
- Fallback: Gemini
- Embeddings: Huggingface

### Infrastructure
- Supabase(document embeddings storage)
- Docker
- Sentry (error & performance monitor)

## ⚙️ Getting Started

### 1. Clone the repository
git clone https://github.com/WillyOctz/Financial-Advisor-AI.git
cd Financial-Advisor-AI

### 2. Backend Setup
python -m venv venv
venv\Scripts\activate   # for Windows
source venv/bin/activate   # for Mac/Linux

pip install -r backend/requirements.txt

### 3. Frontend Setup
cd frontend
npm install

### 4. Environment Variables
Create .env files:

Backend .env:
Follow the structure of the main.py:
/(main directory)/.env -> (not inside the backend folder but root folder, you can change it in the main.py to make it readable in backend)

Frontend .env:
/(main directory)/frontend/.env -> NEXT_PUBLIC_API_URL=http://localhost:8000

## Run The Application
Start Backend:
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

Start Frontend:
cd frontend
npm run dev


## Others
Make Sure to run the Docker if you have it too!for Redis and pgvector!

