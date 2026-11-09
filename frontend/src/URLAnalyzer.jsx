
import { useState } from "react";

function URLAnalyzer({ onAnalysisComplete }) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeURL = async () => {
    const inputURL = url.trim();

    if (!inputURL) {
      setError("Please enter a website URL.");
      setResult(null);
      return;
    }

    let normalizedURL = inputURL;

    // Add HTTPS if the user has not entered a protocol.
    if (!/^https?:\/\//i.test(normalizedURL)) {
      normalizedURL = "https://" + normalizedURL;
    }

    // Validate the URL.
    try {
      const parsedURL = new URL(normalizedURL);

      if (
        !["http:", "https:"].includes(parsedURL.protocol) ||
        !parsedURL.hostname.includes(".") ||
        parsedURL.hostname.startsWith(".") ||
        parsedURL.hostname.endsWith(".")
      ) {
        throw new Error("Invalid URL");
      }
    } catch {
      setError("Please enter a valid website URL.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/analyze-url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: normalizedURL,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Request failed: ${response.status}`
        );
      }

      const data = await response.json();

      console.log("URL Analysis Response:", data);

      if (
        typeof data.risk_score !== "number" ||
        !data.verdict
      ) {
        throw new Error("Unexpected backend response");
      }

      const score = Math.min(
        100,
        Math.max(0, data.risk_score)
      );

      const safeResult = {
        ...data,
        risk_score: score,
        reasons: Array.isArray(data.reasons)
          ? data.reasons
          : [],
      };

      setResult(safeResult);

      // Save URL analysis in shared history.
      if (onAnalysisComplete) {
        onAnalysisComplete(
          {
            ...safeResult,
            detected_categories: ["URL Analysis"],
          },
          normalizedURL
        );
      }
    } catch (err) {
      console.error("URL analysis error:", err);

      setError(
        "Could not analyze the URL. Check that the backend is running and the /analyze-url endpoint is available."
      );
    } finally {
      setLoading(false);
    }
  };

  const riskScore = result?.risk_score ?? 0;

  const riskLevel =
    riskScore >= 70
      ? "high"
      : riskScore >= 40
      ? "medium"
      : "low";

  return (
    <section className="url-analyzer">
      <div className="section-header">
        <h2>🔗 URL Analyzer</h2>
        <p>
          Check a website URL for suspicious indicators.
        </p>
      </div>

      <div className="url-box">
        <input
          type="text"
          placeholder="Paste website URL here..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              analyzeURL();
            }
          }}
        />

        <button
          type="button"
          onClick={analyzeURL}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "🔍 Analyze URL"}
        </button>

        {error && (
          <p className="error-message">{error}</p>
        )}

        {result && (
          <div className="url-result">
            <h3>🛡️ URL Analysis Result</h3>

            {/* Risk score */}
            <div className="url-risk-summary">
              <div className="url-risk-header">
                <strong>Risk Score</strong>
                <span>{riskScore}/100</span>
              </div>

              <div className="url-risk-bar">
                <div
                  className={`url-risk-fill ${riskLevel}`}
                  style={{ width: `${riskScore}%` }}
                />
              </div>

              <p className="url-risk-label">
                {riskLevel === "high"
                  ? "High Risk"
                  : riskLevel === "medium"
                  ? "Suspicious"
                  : "Low Risk"}
              </p>
            </div>

            {/* Analyzed URL */}
            <p className="url-detail">
              <strong>URL:</strong> {normalizedURLDisplay(url)}
            </p>

            {/* Verdict */}
            <div className={`url-verdict ${riskLevel}`}>
              <strong>Verdict:</strong> {result.verdict}
            </div>

            {/* Reasons */}
            <div className="result-section">
              <h4>⚠️ Reasons</h4>

              {result.reasons.length > 0 ? (
                <ul>
                  {result.reasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  No suspicious indicators were reported.
                  This does not guarantee the website is safe.
                </p>
              )}
            </div>

            {/* Safety note */}
            <p className="url-safety-note">
              🛡️ This score is based on the backend analysis.
              Always verify a website before sharing personal
              or financial information.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function normalizedURLDisplay(value) {
  const trimmed = value.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export default URLAnalyzer;
