import { useEffect, useState } from "react";
import "./App.css";
import ScreenshotAnalyzer from "./ScreenshotAnalyzer.jsx";
import URLAnalyzer from "./URLAnalyzer";

function App() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(() => {
  try {
    const savedHistory = localStorage.getItem("scamshield_history");
    return savedHistory ? JSON.parse(savedHistory) : [];
  } catch {
    return [];
  }
});

useEffect(() => {
  localStorage.setItem("scamshield_history", JSON.stringify(history));
}, [history]);
  // ================= STATISTICS =================

  const stats = {
  total: history.length,

  highRisk: history.filter(
    (item) => Number(item.risk_score) >= 70
  ).length,

  suspicious: history.filter(
    (item) =>
      Number(item.risk_score) >= 40 &&
      Number(item.risk_score) < 70
  ).length,

  safe: history.filter(
    (item) => Number(item.risk_score) < 40
  ).length,
};


  // ================= SAMPLE MESSAGES =================

  const sampleMessages = {
    bank:
      "URGENT! Your bank account is blocked. Click this link immediately to verify your account and enter your password, OTP and UPI PIN or your account will be permanently closed.",

    upi:
      "Congratulations! You have received a cashback of ₹5000. Verify your UPI account immediately by entering your OTP and UPI PIN.",

    safe:
      "Hi, your appointment with the doctor is confirmed for tomorrow at 10 AM. Please arrive 10 minutes early.",
  };
  
const addToHistory = (data, analyzedMessage) => {
  const newEntry = {
    id: Date.now() + Math.random(),
    message: analyzedMessage,
    risk_score: Number(data.risk_score) || 0,
    verdict: data.verdict || "Unknown",
    categories: Array.isArray(data.detected_categories)
      ? data.detected_categories
      : [],
    time: new Date().toLocaleString(),
  };

  setHistory((prev) => [newEntry, ...prev]);
};


  // ================= ANALYZE MESSAGE =================

  const analyzeMessage = async () => {
    if (!message.trim()) {
      setError("Please enter a message to analyze.");
      setResult(null);
      return;
    }

    setLoading(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/analyze-text",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: message,
          }),
        }
      );

      // Check backend response
      if (!response.ok) {
        throw new Error(
          `Backend request failed with status ${response.status}`
        );
      }

      // Convert response to JSON
      const data = await response.json();

      console.log("Backend Response:", data);

      // Store result
      setResult(data);

      // ================= ADD TO HISTORY =================

      addToHistory(data, message);

      // ================= UPDATE STATISTICS =================

      const score = Math.min(
        100,
        Math.max(0, Number(data.risk_score) || 0)
      );

    } catch (error) {
      console.error("Error:", error);

      setError(
        "Unable to connect to the ScamShield AI backend. Please make sure the FastAPI server is running on port 8000."
      );

      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // ================= CLEAR MESSAGE =================

  const clearMessage = () => {
    setMessage("");
    setResult(null);
    setError("");
  };

  // ================= LOAD SAMPLE =================

  const loadSample = (type) => {
    setMessage(sampleMessages[type]);
    setResult(null);
    setError("");
  };

  // ================= RISK SCORE =================

  const riskScore = Math.min(
    100,
    Math.max(0, Number(result?.risk_score) || 0)
  );

  // ================= RISK LEVEL =================

  const riskLevel =
    riskScore >= 70
      ? "high"
      : riskScore >= 40
      ? "medium"
      : "low";

  // ================= RETURN =================

  return (
    <div className="app">

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <header className="navbar">
        <h1>🛡️ ScamShield AI</h1>

        <span>
          AI-Powered Scam Detection
        </span>
      </header>


      {/* =====================================================
          HERO SECTION
      ===================================================== */}

      <section className="hero">
        <div className="hero-content">

          <div className="hero-badge">
            🛡️ Intelligent Scam Detection
          </div>

          <h2>
            Stay Safe From
            <span> Online Scams</span>
          </h2>

          <p>
            Analyze suspicious messages and identify potential
            scams using intelligent risk detection technology.
          </p>

          {/* HERO BUTTONS */}

          <div className="hero-buttons">

            <button
              type="button"
              className="hero-btn"
              onClick={() =>
                document
                  .getElementById("analyzer")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            >
              🔍 Analyze a Message
            </button>

            <button
              type="button"
              className="hero-secondary-btn"
              onClick={() =>
                document
                  .getElementById("how-it-works")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            >
              How It Works ↓
            </button>

          </div>
        </div>
      </section>


      {/* =====================================================
          STATISTICS
      ===================================================== */}

      <section className="stats-section">

        {/* TOTAL */}

        <div className="stat-card">
          <div className="stat-icon">
            📊
          </div>

          <div>
            <h3>{stats.total}</h3>
            <p>Total Analyzed</p>
          </div>
        </div>


        {/* HIGH RISK */}

        <div className="stat-card high-stat">
          <div className="stat-icon">
            🚨
          </div>

          <div>
            <h3>{stats.highRisk}</h3>
            <p>High Risk</p>
          </div>
        </div>


        {/* SUSPICIOUS */}

        <div className="stat-card medium-stat">
          <div className="stat-icon">
            ⚠️
          </div>

          <div>
            <h3>{stats.suspicious}</h3>
            <p>Suspicious</p>
          </div>
        </div>


        {/* SAFE */}

        <div className="stat-card safe-stat">
          <div className="stat-icon">
            ✅
          </div>

          <div>
            <h3>{stats.safe}</h3>
            <p>Safe Messages</p>
          </div>
        </div>

      </section>


      {/* =====================================================
          MAIN ANALYZER
      ===================================================== */}

      <main
        className="container"
        id="analyzer"
      >

        {/* ===================================================
            ANALYZER CARD
        =================================================== */}

        <section className="card">

          <h2>
            🔍 Analyze Suspicious Message
          </h2>

          <p className="analyzer-subtitle">
            Paste a suspicious SMS, email, WhatsApp message,
            or payment-related message below.
          </p>


          {/* =================================================
              TEXTAREA
          ================================================= */}

          <textarea
            placeholder="Paste your suspicious message here..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError("");
            }}
          />


          {/* =================================================
              SAMPLE MESSAGES
          ================================================= */}

          <div className="sample-section">

            <p className="sample-title">
              Try a sample message:
            </p>

            <div className="sample-buttons">

              {/* BANK */}

              <button
                type="button"
                className="sample-btn"
                onClick={() => loadSample("bank")}
              >
                🏦 Bank Scam
              </button>


              {/* UPI */}

              <button
                type="button"
                className="sample-btn"
                onClick={() => loadSample("upi")}
              >
                💳 UPI Scam
              </button>


              {/* SAFE */}

              <button
                type="button"
                className="sample-btn"
                onClick={() => loadSample("safe")}
              >
                ✅ Safe Message
              </button>

            </div>
          </div>


          {/* =================================================
              ANALYZE BUTTON
          ================================================= */}

          <button
            type="button"
            className="analyze-btn"
            onClick={analyzeMessage}
            disabled={loading}
          >
            {loading
              ? "🔄 Analyzing..."
              : "🔍 Analyze Message"}
          </button>


          {/* =================================================
              ERROR MESSAGE
          ================================================= */}

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}


          {/* =================================================
              CLEAR BUTTON
          ================================================= */}

          <button
            type="button"
            className="clear-btn"
            onClick={clearMessage}
            disabled={!message && !result}
          >
            🗑️ Clear
          </button>


          {/* =================================================
              ANALYSIS RESULT
          ================================================= */}

          {result && (
            <div className="result">

              <h3>
                Analysis Result
              </h3>


              {/* =============================================
                  RISK SCORE
              ============================================= */}

              <div className="risk-section">

                <div className="risk-header">

                  <strong>
                    Risk Score
                  </strong>

                  <span>
                    {riskScore}/100
                  </span>

                </div>


                {/* RISK BAR */}

                <div className="risk-bar">

                  <div
                    className={`risk-fill ${riskLevel}`}
                    style={{
                      width: `${riskScore}%`,
                    }}
                  />

                </div>

              </div>


              {/* =============================================
                  VERDICT
              ============================================= */}

              <p>

                <strong>
                  Verdict:
                </strong>{" "}

                <span
                  className={
                    riskLevel === "high"
                      ? "verdict-high"
                      : riskLevel === "medium"
                      ? "verdict-medium"
                      : "verdict-low"
                  }
                >
                  {result.verdict || "Unknown"}
                </span>

              </p>


              {/* =============================================
                  CATEGORY
              ============================================= */}

              <p>

                <strong>
                  Category:
                </strong>{" "}

                {Array.isArray(
                  result.detected_categories
                ) &&
                result.detected_categories.length > 0
                  ? result.detected_categories.join(", ")
                  : "None"}

              </p>


              {/* =============================================
                  DETECTED KEYWORDS
              ============================================= */}

              <p>

                <strong>
                  Detected Keywords:
                </strong>{" "}

                {Array.isArray(
                  result.detected_keywords
                ) &&
                result.detected_keywords.length > 0
                  ? result.detected_keywords.join(", ")
                  : "None"}

              </p>


              {/* =============================================
                  RECOMMENDED ACTION
              ============================================= */}

              <div className="result-info-box recommendation-box">

                <h4>
                  🛡️ Recommended Action
                </h4>

                <p>
                  {result.recommendation ||
                    "Do not share personal information, OTPs, passwords, or payment details."}
                </p>

              </div>


              {/* =============================================
                  EXPLANATION
              ============================================= */}

              <div className="result-info-box explanation-box">

                <h4>
                  🔎 Why This Message Is Suspicious
                </h4>

                <p>
                  {result.explanation ||
                    "The message contains one or more indicators commonly associated with scam attempts."}
                </p>

              </div>

            </div>
          )}

        </section>


        {/* =====================================================
            HOW IT WORKS
        ===================================================== */}

        <section
          className="info-section"
          id="how-it-works"
        >

          <h2>
            ⚙️ How ScamShield AI Works
          </h2>

          <p className="section-description">
            Our system analyzes the content of a message
            and identifies suspicious indicators.
          </p>


          <div className="steps-grid">

            {/* STEP 1 */}

            <div className="step-card">

              <div className="step-icon">
                📩
              </div>

              <h3>
                1. Enter Message
              </h3>

              <p>
                Paste the suspicious SMS, email,
                or payment-related message.
              </p>

            </div>


            {/* STEP 2 */}

            <div className="step-card">

              <div className="step-icon">
                🧠
              </div>

              <h3>
                2. Analyze
              </h3>

              <p>
                ScamShield AI analyzes suspicious
                patterns, keywords and risk indicators.
              </p>

            </div>


            {/* STEP 3 */}

            <div className="step-card">

              <div className="step-icon">
                📊
              </div>

              <h3>
                3. Get Risk Score
              </h3>

              <p>
                The system calculates a risk score
                between 0 and 100.
              </p>

            </div>


            {/* STEP 4 */}

            <div className="step-card">

              <div className="step-icon">
                🛡️
              </div>

              <h3>
                4. Stay Protected
              </h3>

              <p>
                Receive a recommendation explaining
                what action you should take.
              </p>

            </div>

          </div>

        </section>


        {/* =====================================================
            FEATURES
        ===================================================== */}

        <section className="info-section">

          <h2>
            🛡️ Scam Detection Features
          </h2>

          <div className="features-grid">

            {/* FEATURE 1 */}

            <div className="feature-card">

              <div className="feature-icon">
                🚨
              </div>

              <h3>
                Risk Detection
              </h3>

              <p>
                Identifies suspicious messages and
                calculates their risk level.
              </p>

            </div>


            {/* FEATURE 2 */}

            <div className="feature-card">

              <div className="feature-icon">
                🔑
              </div>

              <h3>
                Keyword Detection
              </h3>

              <p>
                Detects indicators such as OTP requests,
                urgency and credential requests.
              </p>

            </div>


            {/* FEATURE 3 */}

            <div className="feature-card">

              <div className="feature-icon">
                💳
              </div>

              <h3>
                UPI Scam Detection
              </h3>

              <p>
                Identifies suspicious payment and
                UPI-related requests.
              </p>

            </div>


            {/* FEATURE 4 */}

            <div className="feature-card">

              <div className="feature-icon">
                🏦
              </div>

              <h3>
                Banking Scam Detection
              </h3>

              <p>
                Detects suspicious banking messages,
                account threats and verification requests.
              </p>

            </div>

          </div>

        </section>


        {/* =====================================================
            SAFETY TIPS
        ===================================================== */}

        <section className="safety-section">

          <h2>
            🔐 Stay Safe Online
          </h2>

          <div className="tips-grid">

            <div>
              <span>❌</span>
              Never share your OTP or UPI PIN.
            </div>

            <div>
              <span>🔗</span>
              Avoid clicking unknown links.
            </div>

            <div>
              <span>🔍</span>
              Verify the sender before responding.
            </div>

            <div>
              <span>🔒</span>
              Never share passwords or banking credentials.
            </div>

          </div>

        </section>


        {/* =====================================================
            ANALYSIS HISTORY
        ===================================================== */}

          <section className="history-section">

            <div className="history-header">

              <div>
                <h2>
                  📋 Analysis History
                </h2>

                <p>
                  Recently analyzed messages
                </p>
              </div>


              <button
  type="button"
  className="clear-history-btn"
  onClick={async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/history",
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to clear history");
      }

      setHistory([]);
localStorage.removeItem("scamshield_history");
      console.log("History cleared successfully");
    } catch (error) {
      console.error("Error clearing history:", error);
      alert("Unable to clear history. Please try again.");
    }
  }}
>
  🗑️ Clear History
</button>

            </div>


            <div className="history-list">

  {history.length === 0 ? (
    <p className="history-empty">
      No analysis history yet. Analyze a message to get started.
    </p>
  ) : (
    history.map((item) => (

                <div
                  className="history-card"
                  key={item.id}
                >

                  <div className="history-top">

                    <span
                      className={
                        item.risk_score >= 70
                          ? "history-risk high"
                          : item.risk_score >= 40
                          ? "history-risk medium"
                          : "history-risk low"
                      }
                    >
                      {item.verdict}
                    </span>


                    <span className="history-time">
                      {item.time}
                    </span>

                  </div>


                  <p className="history-message">
                    {item.message}
                  </p>


                  <div className="history-bottom">

                    <span>
                      Risk Score:{" "}

                      <strong>
                        {item.risk_score}/100
                      </strong>
                    </span>


                    <span>
                      Category:{" "}

                      {item.categories.length > 0
                        ? item.categories.join(", ")
                        : "None"}
                    </span>

                  </div>

                </div>
    ))
  )}

</div>

</section>
        <ScreenshotAnalyzer onAnalysisComplete={addToHistory} />
        <URLAnalyzer onAnalysisComplete={addToHistory} />

      </main>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="footer">

        <h3>
          🛡️ ScamShield AI
        </h3>

        <p>
          Intelligent protection against digital scams.
        </p>

        <p className="footer-copy">
          © 2026 ScamShield AI. Built for safer digital communication.
        </p>

      </footer>

    </div>
  );
}

export default App;