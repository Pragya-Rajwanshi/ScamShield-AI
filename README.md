# 🛡️ ScamShield AI

**An AI-Powered Scam Detection System**

ScamShield AI is a web-based application designed to help users identify potentially fraudulent messages, suspicious screenshots, and unsafe URLs. It uses text analysis and OCR technology to detect common scam patterns and provides risk assessments to promote safer digital interactions.

## ✨ Features

- **Text Analysis:** Analyze suspicious messages and identify potential scam indicators.
- **Screenshot Analysis:** Extract text from screenshots using Optical Character Recognition (OCR) and analyze it for scam patterns.
- **URL Analysis:** Analyze URLs for potential security risks.
- **Risk Assessment:** Generate risk scores and categorize results into different risk levels.
- **Analysis History:** Access previously analyzed results.

## 🛠️ Tech Stack

**Frontend**
- React.js
- Vite
- JavaScript
- CSS
- Tesseract.js

**Backend**
- Python
- FastAPI
- SQLAlchemy
- SQLite

## 📂 Project Structure

```text
ScamShield-AI/
│
├── backend/
│   ├── app/
│   │   └── main.py
│   ├── database.py
│   ├── models.py
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Python
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
cd Scamshield-AI-main
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

The backend will run at `http://localhost:8000`.

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed in your terminal to access the application.

## 🔍 How It Works

1. The user submits a suspicious message, screenshot, or URL.
2. The application extracts or processes the submitted content.
3. The backend analyzes the content for potential scam indicators.
4. A risk score and risk category are generated.
5. The analysis result is displayed to the user.

## 🎯 Objective

The objective of ScamShield AI is to improve digital awareness and help users recognize potential online scams through an accessible and easy-to-use platform.

## ⚠️ Disclaimer

ScamShield AI is an educational scam-awareness tool. Its results are indicative and should not be treated as a guarantee that any message or URL is safe.

## 👩‍💻 Developer

Developed as a project focused on AI-powered cybersecurity awareness.