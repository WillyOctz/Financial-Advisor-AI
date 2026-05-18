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

- Key Features
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
- React / Next.js
- Framer motion

### AI / ML
- Primary LLM: Grok
- Fallback LLM: Gemini
- Embeddings: HuggingFace

### Infrastructure
- Supabase (cloud storage)
- Docker (optional services)
- Vercel (frontend deployment)
- Huggingface Spaces (backend deployment)
- Redis Upstash (caching) 

## ⚙️ Getting Started (Local Setup)

1. Clone the Repository
git clone https://github.com/WillyOctz/Financial-Advisor-AI.git
cd Financial-Advisor-AI

2. Backend Setup
python -m venv venv
venv\Scripts\activate   # Windows
source venv/bin/activate  # Mac/Linux

pip install -r backend/requirements.txt

3. Frontend Setup
cd frontend
npm install

4. Environment Variables

Create .env files:

Backend .env
Follow structure from:

backend/core/config.py
Frontend .env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

5. Run the Application
Start Backend
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
Start Frontend
cd frontend
npm run dev

6. Optional Services

Run with Docker:
Redis (required for caching)
Qdrant (optional for future vector DB)