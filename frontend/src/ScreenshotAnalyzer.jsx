import { useState } from "react";
import { createWorker } from "tesseract.js";
import "./ScreenshotAnalyzer.css";

function ScreenshotAnalyzer({ onAnalysisComplete }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // LOAD IMAGE
  // --------------------------------------------------
  const loadImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = reject;

      img.src = URL.createObjectURL(file);
    });
  };

  // --------------------------------------------------
  // AUTO CROP WHATSAPP MESSAGE
  // --------------------------------------------------
  const cropMessageArea = async (file) => {
    const img = await loadImage(file);

    const originalWidth = img.width;
    const originalHeight = img.height;

    console.log("Original image:", originalWidth, originalHeight);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = originalWidth;
    canvas.height = originalHeight;

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(
      0,
      0,
      originalWidth,
      originalHeight
    );

    const data = imageData.data;

    // ---------------------------------------------
    // STEP 1:
    // Find large bright/white regions.
    // WhatsApp message bubbles are mostly white.
    // ---------------------------------------------

    const scale = Math.max(
      1,
      Math.ceil(Math.max(originalWidth, originalHeight) / 350)
    );

    const smallWidth = Math.floor(originalWidth / scale);
    const smallHeight = Math.floor(originalHeight / scale);

    const mask = new Uint8Array(smallWidth * smallHeight);

    for (let y = 0; y < smallHeight; y++) {
      for (let x = 0; x < smallWidth; x++) {
        const originalX = Math.min(
          originalWidth - 1,
          x * scale
        );

        const originalY = Math.min(
          originalHeight - 1,
          y * scale
        );

        const index =
          (originalY * originalWidth + originalX) * 4;

        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        // White/very light pixels
        if (r > 225 && g > 225 && b > 225) {
          mask[y * smallWidth + x] = 1;
        }
      }
    }

    // ---------------------------------------------
    // STEP 2:
    // Connected component detection
    // ---------------------------------------------

    const visited = new Uint8Array(mask.length);

    const components = [];

    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (let y = 0; y < smallHeight; y++) {
      for (let x = 0; x < smallWidth; x++) {
        const startIndex = y * smallWidth + x;

        if (
          mask[startIndex] === 0 ||
          visited[startIndex] === 1
        ) {
          continue;
        }

        const queue = [[x, y]];
        visited[startIndex] = 1;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;

        let count = 0;

        while (queue.length > 0) {
          const [cx, cy] = queue.pop();

          count++;

          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);

          for (const [dx, dy] of directions) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (
              nx < 0 ||
              nx >= smallWidth ||
              ny < 0 ||
              ny >= smallHeight
            ) {
              continue;
            }

            const ni = ny * smallWidth + nx;

            if (
              mask[ni] === 1 &&
              visited[ni] === 0
            ) {
              visited[ni] = 1;
              queue.push([nx, ny]);
            }
          }
        }

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;

        // Ignore tiny regions
        if (
          count > 100 &&
          width > smallWidth * 0.25 &&
          height > smallHeight * 0.12
        ) {
          components.push({
            minX,
            maxX,
            minY,
            maxY,
            width,
            height,
            count,
          });
        }
      }
    }

    console.log("Detected components:", components);

    // ---------------------------------------------
    // STEP 3:
    // Select likely message bubble
    // ---------------------------------------------

    let bestComponent = null;

    if (components.length > 0) {
      bestComponent = components
        .filter((c) => {
          const aspectRatio = c.width / c.height;

          return (
            c.width > smallWidth * 0.45 &&
            c.height > smallHeight * 0.25 &&
            aspectRatio > 0.35 &&
            aspectRatio < 2.5
          );
        })
        .sort((a, b) => {
          const areaA = a.width * a.height;
          const areaB = b.width * b.height;

          return areaB - areaA;
        })[0];
    }

    // ---------------------------------------------
    // FALLBACK:
    // WhatsApp mobile screenshot
    // ---------------------------------------------

    let cropX;
    let cropY;
    let cropWidth;
    let cropHeight;

    if (bestComponent) {
      cropX = bestComponent.minX * scale;
      cropY = bestComponent.minY * scale;
      cropWidth =
        (bestComponent.maxX - bestComponent.minX + 1) *
        scale;
      cropHeight =
        (bestComponent.maxY - bestComponent.minY + 1) *
        scale;

      console.log("AUTO DETECTED MESSAGE AREA:", {
        cropX,
        cropY,
        cropWidth,
        cropHeight,
      });

      // Small padding around detected bubble
      const paddingX = Math.floor(cropWidth * 0.02);
      const paddingY = Math.floor(cropHeight * 0.01);

      cropX = Math.max(0, cropX - paddingX);
      cropY = Math.max(0, cropY - paddingY);

      cropWidth = Math.min(
        originalWidth - cropX,
        cropWidth + paddingX * 2
      );

      cropHeight = Math.min(
        originalHeight - cropY,
        cropHeight + paddingY * 2
      );
    } else {
      console.log("No bubble detected. Using fallback crop.");

      // For normal WhatsApp mobile screenshot
      cropX = Math.floor(originalWidth * 0.03);
      cropY = Math.floor(originalHeight * 0.17);

      cropWidth = Math.floor(originalWidth * 0.76);
      cropHeight = Math.floor(originalHeight * 0.72);
    }

    // ---------------------------------------------
    // STEP 4:
    // Create cropped canvas
    // ---------------------------------------------

    const croppedCanvas = document.createElement("canvas");

    // Upscale 2.5x
    const upscale = 2.5;

    croppedCanvas.width = Math.floor(
      cropWidth * upscale
    );

    croppedCanvas.height = Math.floor(
      cropHeight * upscale
    );

    const croppedCtx =
      croppedCanvas.getContext("2d");

    croppedCtx.imageSmoothingEnabled = true;
    croppedCtx.imageSmoothingQuality = "high";

    croppedCtx.drawImage(
      img,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      croppedCanvas.width,
      croppedCanvas.height
    );

    URL.revokeObjectURL(img.src);

    console.log(
      "Final OCR image:",
      croppedCanvas.width,
      croppedCanvas.height
    );

    return croppedCanvas;
  };

  // --------------------------------------------------
  // CLEAN OCR TEXT
  // --------------------------------------------------
  const cleanOCRText = (text) => {
    if (!text) return "";

    let cleaned = text;

    cleaned = cleaned.replace(/\r/g, "\n");

    // Remove excessive spaces
    cleaned = cleaned.replace(/[ \t]+/g, " ");

    // Fix common OCR mistakes
    cleaned = cleaned
      .replace(/\bhttp:\/\//gi, "http://")
      .replace(/\bhttps:\/\//gi, "https://");

    // Remove empty lines repeated many times
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    return cleaned.trim();
  };

  // --------------------------------------------------
  // RUN OCR
  // --------------------------------------------------
  const runOCR = async (canvas) => {
    console.log("Starting OCR...");

    const worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status) {
          console.log(
            message.status,
            Math.round((message.progress || 0) * 100) + "%"
          );
        }
      },
    });

    try {
      // ---------------------------------------------
      // FIRST OCR
      // Single block mode
      // ---------------------------------------------

      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const result1 = await worker.recognize(canvas);

      console.log(
        "OCR RESULT 1:",
        result1.data.text
      );

      // ---------------------------------------------
      // SECOND OCR
      // Sparse text mode
      // ---------------------------------------------

      await worker.setParameters({
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const result2 = await worker.recognize(canvas);

      console.log(
        "OCR RESULT 2:",
        result2.data.text
      );

      // ---------------------------------------------
      // Select based on actual text quality
      // NOT confidence only
      // ---------------------------------------------

      const text1 = cleanOCRText(
        result1.data.text
      );

      const text2 = cleanOCRText(
        result2.data.text
      );

      const scoreText = (text) => {
        if (!text) return 0;

        let score = 0;

        // Length
        score += Math.min(text.length / 20, 20);

        // Words
        const words = text.split(/\s+/).length;
        score += Math.min(words / 5, 20);

        // Useful sentence characters
        if (/[a-zA-Z]{3,}/.test(text)) {
          score += 10;
        }

        // URL detection
        if (/https?:\/\/|www\.|\.com|\.in|\.org/i.test(text)) {
          score += 20;
        }

        // Scam-related text
        if (
          /urgent|verify|verification|account|bank|kyc|suspended|click|password|otp|payment/i.test(
            text
          )
        ) {
          score += 20;
        }

        return score;
      };

      const score1 = scoreText(text1);
      const score2 = scoreText(text2);

      console.log("TEXT SCORE 1:", score1);
      console.log("TEXT SCORE 2:", score2);

      const finalText =
        score2 > score1 ? text2 : text1;

      console.log(
        "FINAL OCR TEXT:",
        finalText
      );

      return finalText;
    } finally {
      await worker.terminate();
    }
  };
  const resetAnalyzer = () => {
  setFile(null);
  setPreview("");
  setOcrText("");
  setResult(null);
  setError("");

  const fileInput = document.getElementById(
    "screenshot-input"
  );

  if (fileInput) {
    fileInput.value = "";
  }
};

  // --------------------------------------------------
  // HANDLE FILE
  // --------------------------------------------------
  const handleFileChange = (event) => {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) return;

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));

    setOcrText("");
    setResult(null);
    setError("");
  };


  // --------------------------------------------------
  // ANALYZE SCREENSHOT
  // --------------------------------------------------
  const analyzeScreenshot = async () => {
    if (!file) {
      setError("Please upload a screenshot first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setOcrText("");

    try {
      console.log("================================");
      console.log("SCAMSHIELD OCR STARTED");
      console.log("================================");

      // 1. Automatically detect/crop message
      const croppedCanvas =
        await cropMessageArea(file);

      // 2. OCR
      const extractedText =
        await runOCR(croppedCanvas);

      if (!extractedText) {
        throw new Error(
          "No readable text found in screenshot."
        );
      }

      setOcrText(extractedText);

      console.log(
        "TEXT SENT TO BACKEND:",
        extractedText
      );

      // ---------------------------------------------
      // 3. SEND OCR TEXT TO BACKEND
      // ---------------------------------------------

      const response = await fetch(
        "http://127.0.0.1:8000/analyze-text",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: extractedText,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Backend error: ${response.status}`
        );
      }

      const data = await response.json();

      console.log(
        "BACKEND RESULT:",
        data
      );

      setResult(data);

if (onAnalysisComplete) {
  onAnalysisComplete(data, extractedText);
}
    } catch (err) {
      console.error("ANALYSIS ERROR:", err);

      setError(
        err.message ||
          "Something went wrong while analyzing the screenshot."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="screenshot-analyzer">

      <h2>Screenshot Analyzer</h2>

      <p>
        Upload a screenshot and ScamShield AI will
        extract and analyze the message.
      </p>

     <input
  id="screenshot-input"
  type="file"
  accept="image/*"
  onChange={handleFileChange}
/>
{preview && (
  <div className="uploaded-preview">
    <h3>Uploaded Screenshot</h3>

    <img
      src={preview}
      alt="Uploaded screenshot"
    />
  </div>
)}

{file && (
  <button
    onClick={analyzeScreenshot}
    disabled={loading}
    className="analyze-btn"
  >
    {loading ? "Analyzing..." : "Analyze Screenshot"}
  </button>
)}

{error && (
  <div className="error-message">
    {error}
  </div>
)}

{ocrText && (
  <div className="extracted-text">
    <h3>Extracted Text</h3>

    <pre>{ocrText}</pre>
  </div>
)}

      {result && (
  <div className="analysis-result">

    <h2>🛡️ ScamShield Analysis</h2>

    {/* RISK SCORE */}
    <div className="risk-card">
      <h3>Risk Score</h3>

      <div className="risk-score">
        {result.risk_score}%
      </div>

      <div className="risk-bar">
        <div
          className="risk-fill"
          style={{
            width: `${Math.min(
              Number(result.risk_score) || 0,
              100
            )}%`,
          }}
        ></div>
      </div>
    </div>

    {/* VERDICT */}
    <div className="verdict-card">
      <h3>Verdict</h3>

      <div className="verdict">
        {result.verdict}
      </div>
    </div>

    {/* DETECTED CATEGORIES */}
    {result.detected_categories &&
      result.detected_categories.length > 0 && (
        <div className="result-section">

          <h3>🚨 Detected Categories</h3>

          <div className="tag-container">
            {result.detected_categories.map(
              (category, index) => (
                <span
                  className="result-tag"
                  key={index}
                >
                  {category}
                </span>
              )
            )}
          </div>

        </div>
      )}

    {/* DETECTED KEYWORDS */}
    {result.detected_keywords &&
      result.detected_keywords.length > 0 && (
        <div className="result-section">

          <h3>🔍 Detected Indicators</h3>

          <div className="tag-container">
            {result.detected_keywords.map(
              (keyword, index) => (
                <span
                  className="keyword-tag"
                  key={index}
                >
                  {keyword}
                </span>
              )
            )}
          </div>

        </div>
      )}

    {/* EXPLANATION */}
    {result.explanation && (
      <div className="result-section">

        <h3>📋 Why is this suspicious?</h3>

        <p className="explanation">
          {result.explanation}
        </p>

      </div>
    )}

    {/* RECOMMENDATION */}
    {result.recommendation && (
      <div className="recommendation">

        <h3>✅ What should you do?</h3>

        <p>
          {result.recommendation}
        </p>

      </div>
    )}

  </div>
)}

{result && (
  <button
    onClick={resetAnalyzer}
    className="analyze-again-btn"
  >
    🔄 Analyze Another Screenshot
  </button>
)}

    </div>
  );
}

export default ScreenshotAnalyzer;