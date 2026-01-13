## FINANCIAL ADVISOR AI PRODUCTION GRADE LEVEL Version 2.0

## Getting started to test 

## First

Activate the python virtual environment (Available for Python version 3.3+) in the main directory C:\(your-directory)\Machine Learning Financial Advisor AI and type the python -m venv venv, to create the venv folder and the virtual environment

## Second

Install the required package of modules for both backend (requirements.txt in the backend folder) and frontend to be able to use it,
for backend just type pip install -r requirements.txt
for frontend you can just install all of the dependencies in the package.json by typing npm i (all the dependencies) or npx i (all the dependencies)

## Third

create the .env file in the C:\(your-directory)\Machine Learning Financial Advisor AI and fill it in the same way as in the core\config.py file
and create the .env for frontend folder to use the local backend host server which is http://localhost:8000/api/v1

## Fourth

for backend use command uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 to activate it
for frontend change the directory to frontend and type npm run dev to run it

## Lastly 

have your docker or docker desktop to install redis and qdrant to activate it, since redis is used for second database mainly caching as of now.

## IMAGE PREVIEW

![alt text](image.png)

![alt text](image-1.png)

![alt text](image-2.png)


**⚠️ PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED**

This repository contains proprietary source code. No license is granted
for any use, modification, or distribution without written permission.

© 2025 Willy Octz