import re
import json
from datetime import datetime

from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from sqlalchemy.orm import Session

from database import engine, get_db
from models import Base, AnalysisHistory

app = FastAPI(
    title="ScamShield AI",
    description="AI-Powered Scam & Phishing Detection Platform",
    version="1.0.0"
)


# Create database tables
Base.metadata.create_all(bind=engine)
# Add created_at column to existing database if it does not exist
with engine.begin() as connection:
    try:
        connection.execute(
            text(
                "ALTER TABLE analysis_history "
                "ADD COLUMN created_at DATETIME"
            )
        )
    except Exception:
        # Column already exists
        pass

    # Give existing records a timestamp
    connection.execute(
        text(
            "UPDATE analysis_history "
            "SET created_at = CURRENT_TIMESTAMP "
            "WHERE created_at IS NULL"
        )
    )


# -----------------------------------
# CORS
# -----------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174"
],
allow_credentials=True,
allow_methods=["*"],
allow_headers=["*"],
)


# -----------------------------------
# HOME
# -----------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to ScamShield AI",
        "status": "Backend is running"
    }


# -----------------------------------
# HEALTH CHECK
# -----------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


# -----------------------------------
# REQUEST MODEL
# -----------------------------------

class TextRequest(BaseModel):
    text: str


# -----------------------------------
# ANALYZE TEXT
# -----------------------------------

@app.post("/analyze-text")
def analyze_text(
    request: TextRequest,
    db: Session = Depends(get_db)
):

    # -----------------------------------
    # TEXT NORMALIZATION
    # -----------------------------------

    text = request.text.lower().strip()

    # Normalize spaces
    text = re.sub(r"\s+", " ", text)

    # Normalize common separators
    text = re.sub(r"[-_/]+", " ", text)

    detected_keywords = []
    detected_categories = []
    risk_score = 0


    # -----------------------------------
    # ADD DETECTION FUNCTION
    # -----------------------------------

    def add_detection(keyword, score, category):

        nonlocal risk_score

        if keyword not in detected_keywords:

            detected_keywords.append(keyword)

            risk_score += score

            if category not in detected_categories:
                detected_categories.append(category)


    # -----------------------------------
    # BANKING / OTP SCAM DETECTION
    # -----------------------------------

    banking_patterns = {

        r"\b(share|send|provide|give|tell|forward|enter|submit).{0,20}\b(otp|one[- ]time password)\b":
            ("OTP request", 35, "Banking Scam"),

        r"\b(otp|one[- ]time password).{0,30}\b(share|send|provide|give|tell|forward|enter|submit)\b":
            ("OTP request", 35, "Banking Scam"),

        r"\b(account|bank account).{0,20}\b(blocked|suspended|locked|disabled|closed)\b":
            ("Account threat", 25, "Banking Scam"),

        r"\b(update|verify|complete|submit).{0,20}\b(kyc|know your customer)\b":
            ("KYC request", 25, "Banking Scam"),

        r"\b(card|debit card|credit card).{0,20}\b(blocked|expired|suspended|deactivated)\b":
            ("Card threat", 20, "Banking Scam"),

        r"\b(bank|account|card).{0,30}\b(verify|verification|confirm)\b":
            ("Bank verification request", 20, "Banking Scam")
    }


    # -----------------------------------
    # URGENCY / PRESSURE DETECTION
    # -----------------------------------

    urgency_patterns = {

        r"\burgent\b":
            ("Urgent language", 10, "Urgency"),

        r"\b(immediately|right away|without delay)\b":
            ("Immediate action", 10, "Urgency"),

        r"\bact now\b":
            ("Act now", 10, "Urgency"),

        r"\b(do it now|respond now|reply now)\b":
            ("Immediate response pressure", 10, "Urgency"),

        r"\bwithin \d+ (minutes?|hours?|days?)\b":
            ("Time pressure", 15, "Urgency"),

        r"\blast warning\b":
            ("Last warning", 15, "Urgency"),

        r"\b(final warning|final notice)\b":
            ("Final warning", 15, "Urgency"),

        r"\b(you will|your account will).{0,30}\b(blocked|suspended|closed|deactivated)\b":
            ("Threatening language", 20, "Urgency")
    }


    # -----------------------------------
    # PHISHING DETECTION
    # -----------------------------------

    phishing_patterns = {

        r"\bclick here\b":
            ("Click here", 15, "Phishing"),

        r"\bclick (the )?link\b":
            ("Click link", 15, "Phishing"),

        r"\b(open|follow|visit|tap).{0,20}\b(link|url)\b":
            ("Link action request", 15, "Phishing"),

        r"\bverify your account\b":
            ("Account verification", 20, "Phishing"),

        r"\bconfirm your identity\b":
            ("Identity verification", 20, "Phishing"),

        r"\bverify your identity\b":
            ("Identity verification", 20, "Phishing"),

        r"\bconfirm your account\b":
            ("Account confirmation", 20, "Phishing"),

        r"\b(open|visit|go to).{0,30}\b(website|webpage|portal)\b":
            ("Website visit request", 15, "Phishing")
    }


    # -----------------------------------
    # LOTTERY / PRIZE SCAMS
    # -----------------------------------

    lottery_patterns = {

        r"\blottery\b":
            ("Lottery", 20, "Lottery Scam"),

        r"\b(you have won|you won|you are a winner)\b":
            ("Prize notification", 25, "Lottery Scam"),

        r"\bclaim your prize\b":
            ("Prize claim", 25, "Lottery Scam"),

        r"\b(congratulations).{0,50}\b(won|winner|prize)\b":
            ("Prize notification", 20, "Lottery Scam"),

        r"\b(you have been selected|selected as a winner)\b":
            ("Winner notification", 25, "Lottery Scam"),

        r"\b(prize|reward).{0,30}\b(claim|collect|receive)\b":
            ("Prize claim", 20, "Lottery Scam")
    }


    # -----------------------------------
    # FINANCIAL / PAYMENT SCAMS
    # -----------------------------------

    financial_patterns = {

        r"\bsend money\b":
            ("Send money", 20, "Financial Scam"),

        r"\btransfer money\b":
            ("Transfer money", 20, "Financial Scam"),

        r"\b(send|transfer|pay).{0,30}\b(money|cash|funds)\b":
            ("Money transfer request", 20, "Financial Scam"),

        r"\bpay (a )?fee\b":
            ("Payment request", 20, "Financial Scam"),

        r"\bprocessing fee\b":
            ("Processing fee", 25, "Financial Scam"),

        r"\b(advance|registration|security|activation).{0,20}\b(fee|payment)\b":
            ("Advance payment request", 25, "Financial Scam"),

        r"\b(payment|fee).{0,30}\b(urgent|immediately|now)\b":
            ("Urgent payment request", 25, "Financial Scam")
    }


    # -----------------------------------
    # JOB / INTERNSHIP SCAMS
    # -----------------------------------

    job_patterns = {

        r"\b(guaranteed|100%).{0,30}\b(job|job offer|placement)\b":
            ("Guaranteed job claim", 20, "Job Scam"),

        r"\b(job|job offer|work from home).{0,40}\b(pay|payment|fee|deposit)\b":
            ("Job payment request", 25, "Job Scam"),

        r"\b(pay|send|deposit).{0,30}\b(registration|joining|training).{0,20}\b(fee|money)\b":
            ("Job registration fee", 25, "Job Scam"),

        r"\b(work from home).{0,50}\b(earn|income).{0,30}\b(easy|guaranteed)\b":
            ("Suspicious job promise", 20, "Job Scam")
    }


    # -----------------------------------
    # KYC / SIM SCAMS
    # -----------------------------------

    kyc_patterns = {

        r"\b(kyc).{0,40}\b(expir|update|verify|complete)\b":
            ("KYC warning", 20, "KYC Scam"),

        r"\b(sim|mobile number|phone number).{0,40}\b(blocked|deactivated|suspended)\b":
            ("SIM threat", 25, "KYC Scam"),

        r"\b(verify|update).{0,30}\b(sim|mobile number)\b":
            ("SIM verification request", 20, "KYC Scam")
    }


    # -----------------------------------
    # INVESTMENT SCAM DETECTION
    # -----------------------------------

    investment_patterns = {

    r"\binvest\b":
        ("Investment request", 30, "Investment Scam"),

    r"\binvestment\b":
        ("Investment request", 30, "Investment Scam"),

    r"\bguaranteed\s+(?:returns?|profit)\b":
        ("Guaranteed returns", 35, "Investment Scam"),

    r"\b\d+x\s+(?:returns?|profit)\b":
        ("High return claim", 35, "Investment Scam"),

    r"\b(?:3x|5x|10x)\b":
        ("Unrealistic return claim", 30, "Investment Scam"),

    r"\b(?:quick|fast|instant)\s+(?:returns?|profit)\b":
        ("Quick profit claim", 30, "Investment Scam"),

    r"\b(?:high|huge|massive)\s+(?:returns?|profit)\b":
        ("High profit claim", 25, "Investment Scam"),

    r"\bwithin\s+\d+\s+(?:hours?|days?)\b":
        ("Short time return claim", 25, "Investment Scam")
}


    # -----------------------------------
    # UPI / PAYMENT SCAM DETECTION
    # -----------------------------------

    payment_patterns = {

        r"\bupi\b":
            ("UPI reference", 10, "Payment Scam"),

        r"\bscan.*qr\b":
            ("QR payment request", 20, "Payment Scam"),

        r"\bscan the qr\b":
            ("QR payment request", 20, "Payment Scam"),

        r"\bsend.*upi\b":
            ("UPI payment request", 20, "Payment Scam"),

        r"\bpayment.*pending\b":
            ("Payment issue", 15, "Payment Scam")
    }

    # -----------------------------------
    # IMPERSONATION SCAM DETECTION
    # -----------------------------------

    impersonation_patterns = {

        r"\bwe are (from|calling from) (your )?(bank|police)\b":
            ("Authority impersonation", 30, "Impersonation Scam"),

        r"\bthis is (your )?(bank|bank officer)\b":
            ("Bank impersonation", 25, "Impersonation Scam"),

        r"\bpolice.*case\b":
            ("Police threat", 25, "Impersonation Scam"),

        r"\blegal action\b":
            ("Legal threat", 20, "Impersonation Scam"),

        r"\barrest warrant\b":
            ("Arrest threat", 30, "Impersonation Scam")
    }


    # -----------------------------------
    # ADVANCED CREDENTIAL DETECTION
    # -----------------------------------

    credential_patterns = {

        r"\b(one time password|one time passcode)\b":
            ("One-time password", 30, "Credential Scam"),

        r"\b(otp|passcode|verification code)\b.*\b(share|send|provide|tell|give)\b":
            ("Credential request", 35, "Credential Scam"),

        r"\b(share|send|provide|tell|give)\b.*\b(otp|passcode|verification code)\b":
            ("Credential request", 35, "Credential Scam"),

        r"\b(username|password|login details|banking details)\b":
            ("Credential request", 25, "Credential Scam")
    }


    # -----------------------------------
    # PHONE NUMBER DETECTION
    # -----------------------------------

    phone_patterns = {

        r"\b(?:\+91[\s-]?)?[6-9]\d{9}\b":
            ("Phone number present", 5, "Contact Information"),

        r"\bcall (me|us|this number)\b":
            ("Call request", 10, "Contact Request")
    }


    # -----------------------------------
    # UPI SCAM DETECTION
    # -----------------------------------

    upi_patterns = {

        r"\bupi\b":
            ("UPI mentioned", 10, "UPI Scam"),

        r"\bupi (id|payment|transfer|request)\b":
            ("UPI payment request", 25, "UPI Scam"),

        r"\bscan (the )?qr\b":
            ("QR payment request", 25, "UPI Scam"),

        r"\bqr code\b":
            ("QR code request", 15, "UPI Scam"),

        r"\bcollect request\b":
            ("UPI collect request", 30, "UPI Scam")
    }


    # -----------------------------------
    # DELIVERY SCAM DETECTION
    # -----------------------------------

    delivery_patterns = {

        r"\b(package|parcel|delivery|courier)\b":
            ("Delivery message", 10, "Delivery Scam"),

        r"\b(package|parcel|delivery|courier)\b.{0,40}\b(held|stopped|failed|cancelled|canceled)\b":
            ("Delivery problem", 25, "Delivery Scam"),

        r"\b(pay|payment).{0,30}\b(delivery|custom|shipping|courier|parcel|package)\b":
            ("Delivery fee request", 30, "Delivery Scam"),

        r"\b(delivery|parcel|package|courier)\b.{0,40}\b(fee|charge|payment)\b":
            ("Delivery payment request", 30, "Delivery Scam"),

        r"\b(update|verify|confirm).{0,30}\b(address|delivery address)\b":
            ("Delivery verification request", 20, "Delivery Scam"),

        r"\b(parcel|package|delivery|courier)\b.{0,40}\b(link|verify|payment|fee)\b":
            ("Parcel verification request", 25, "Delivery Scam")
    }


    # -----------------------------------
    # EMAIL / ACCOUNT SECURITY DETECTION
    # -----------------------------------

    email_patterns = {

        r"\b(email|mailbox)\b.*\b(suspended|blocked|locked)\b":
            ("Email account threat", 25, "Account Scam"),

        r"\bverify (your )?email\b":
            ("Email verification", 15, "Phishing"),

        r"\bemail (password|credentials)\b":
            ("Email credential request", 30, "Credential Scam")
    }


    # ==========================================================
    # NEW ADDITIONAL SCAM DETECTION
    # ==========================================================
    # These are added without removing or changing your
    # existing dictionaries above.
    # ==========================================================

    additional_patterns = {

        # -----------------------------------
        # GOVERNMENT / POLICE IMPERSONATION
        # -----------------------------------

        r"\b(cyber police|police|government|court|legal department)\b.{0,60}\b(arrest|case|complaint|fine|penalty|warrant)\b":
            ("Government or police threat", 30, "Government Impersonation"),

        r"\b(arrest|police case|court case|legal action|arrest warrant)\b":
            ("Legal threat", 25, "Government Impersonation"),

        r"\b(pay|transfer|send).{0,30}\b(fine|penalty|legal fee)\b":
            ("Legal payment request", 30, "Government Impersonation"),


        # -----------------------------------
        # REFUND SCAM
        # -----------------------------------

        r"\b(refund|cashback|reimbursement)\b.{0,50}\b(verify|confirm|claim|activate)\b":
            ("Suspicious refund request", 25, "Refund Scam"),

        r"\b(refund|cashback)\b.{0,50}\b(otp|pin|password|upi)\b":
            ("Refund credential request", 35, "Refund Scam"),


        # -----------------------------------
        # TECH SUPPORT SCAM
        # -----------------------------------

        r"\b(virus|malware|hacked|infected|security alert)\b.{0,50}\b(call|support|helpline|technician)\b":
            ("Fake technical support", 30, "Tech Support Scam"),

        r"\b(call|contact).{0,30}\b(technical support|support team|technician)\b":
            ("Technical support contact request", 20, "Tech Support Scam"),


        # -----------------------------------
        # ACCOUNT TAKEOVER
        # -----------------------------------

        r"\b(account|profile|login)\b.{0,40}\b(hacked|compromised|unauthorized|suspicious login)\b":
            ("Account security threat", 25, "Account Takeover"),

        r"\b(reset|change|verify).{0,30}\b(password|login)\b":
            ("Password action request", 20, "Account Takeover"),


        # -----------------------------------
        # GIFT / REWARD SCAM
        # -----------------------------------

        r"\b(free gift|free iphone|free smartphone|free mobile)\b":
            ("Free gift claim", 25, "Reward Scam"),

        r"\b(gift|reward|cashback)\b.{0,40}\b(fee|payment|tax|charge)\b":
            ("Reward payment request", 30, "Reward Scam"),


        # -----------------------------------
        # TAX / REFUND IMPERSONATION
        # -----------------------------------

        r"\b(income tax|tax department|itr|tax refund)\b.{0,50}\b(verify|update|click|payment|otp)\b":
            ("Tax verification request", 30, "Tax Scam"),


        # -----------------------------------
        # LOAN SCAM
        # -----------------------------------

        r"\b(loan|personal loan|instant loan)\b.{0,50}\b(processing fee|advance fee|registration fee|payment)\b":
            ("Loan fee request", 30, "Loan Scam"),

        r"\b(instant loan|guaranteed loan)\b":
            ("Suspicious loan offer", 20, "Loan Scam"),


        # -----------------------------------
        # CHARITY / DONATION SCAM
        # -----------------------------------

        r"\b(donation|charity|relief fund|help fund)\b.{0,50}\b(send|transfer|pay|upi)\b":
            ("Donation payment request", 20, "Charity Scam"),


        # -----------------------------------
        # SOCIAL MEDIA ACCOUNT SCAM
        # -----------------------------------

        r"\b(instagram|facebook|whatsapp|telegram)\b.{0,50}\b(verify|suspended|blocked|hacked)\b":
            ("Social media account threat", 25, "Social Media Scam"),


        # -----------------------------------
        # FAKE CUSTOMER CARE
        # -----------------------------------

        r"\b(customer care|customer support|helpline)\b.{0,40}\b(call|contact|whatsapp)\b":
            ("Customer care contact request", 20, "Impersonation Scam"),


        # -----------------------------------
        # QR CODE SCAM
        # -----------------------------------

        r"\b(scan|scanning).{0,30}\b(qr|qr code)\b.{0,40}\b(receive|refund|cashback|money)\b":
            ("QR payment scam indicator", 30, "UPI Scam"),


        # -----------------------------------
        # SECRET / CONFIDENTIALITY PRESSURE
        # -----------------------------------

        r"\b(do not tell|don't tell|keep this secret|confidential)\b.{0,50}\b(payment|money|otp|bank)\b":
            ("Secrecy pressure", 20, "Social Engineering"),


        # -----------------------------------
        # PERSONAL INFORMATION REQUEST
        # -----------------------------------

        r"\b(aadhaar|pan card|date of birth|dob)\b.{0,40}\b(share|send|provide|upload)\b":
            ("Personal information request", 25, "Identity Scam"),


        # -----------------------------------
        # ATM / CARD INFORMATION
        # -----------------------------------

        r"\b(atm|debit card|credit card)\b.{0,40}\b(pin|cvv|expiry|card number)\b":
            ("Card information request", 30, "Credential Scam"),


        # -----------------------------------
        # SUSPICIOUS MONEY TRANSFER
        # -----------------------------------

        r"\b(send|transfer|deposit)\b.{0,40}\b(money|cash|funds)\b.{0,50}\b(unknown|new|different|personal account)\b":
            ("Suspicious money transfer", 25, "Financial Scam")
    }


    # -----------------------------------
    # ALL PATTERNS
    # -----------------------------------

    all_patterns = {

        **banking_patterns,
        **urgency_patterns,
        **phishing_patterns,
        **lottery_patterns,
        **financial_patterns,
        **job_patterns,
        **kyc_patterns,
        **investment_patterns,
        **payment_patterns,
        **delivery_patterns,
        **impersonation_patterns,
        **credential_patterns,
        **phone_patterns,
        **upi_patterns,
        **email_patterns,

        # New patterns
        **additional_patterns
    }


    # -----------------------------------
    # CHECK PATTERNS
    # -----------------------------------

    for pattern, details in all_patterns.items():

        keyword, score, category = details

        if re.search(pattern, text):

            add_detection(
                keyword,
                score,
                category
            )


    # -----------------------------------
    # CONTEXTUAL RISK BOOST
    # -----------------------------------

    if (
        "Banking Scam" in detected_categories
        and "Urgency" in detected_categories
    ):
        risk_score += 10


    if (
        "Phishing" in detected_categories
        and "Urgency" in detected_categories
    ):
        risk_score += 10


    if (
        "Credential Scam" in detected_categories
        and "Banking Scam" in detected_categories
    ):
        risk_score += 15


    if (
        "UPI Scam" in detected_categories
        and "Financial Scam" in detected_categories
    ):
        risk_score += 15


    if (
        "Investment Scam" in detected_categories
        and "Urgency" in detected_categories
    ):
        risk_score += 10


    if (
        "Delivery Scam" in detected_categories
        and "Phishing" in detected_categories
    ):
        risk_score += 10


    # -----------------------------------
    # ADDITIONAL CONTEXTUAL BOOSTS
    # -----------------------------------

    if (
        "Government Impersonation" in detected_categories
        and "Urgency" in detected_categories
    ):
        risk_score += 10


    if (
        "Credential Scam" in detected_categories
        and "Phishing" in detected_categories
    ):
        risk_score += 10


    if (
        "Job Scam" in detected_categories
        and "Financial Scam" in detected_categories
    ):
        risk_score += 10


    if (
        "Investment Scam" in detected_categories
        and "Financial Scam" in detected_categories
    ):
        risk_score += 10


    if (
        "Refund Scam" in detected_categories
        and "Credential Scam" in detected_categories
    ):
        risk_score += 10


    if (
        "Loan Scam" in detected_categories
        and "Financial Scam" in detected_categories
    ):
        risk_score += 10


    # -----------------------------------
    # URL DETECTION
    # -----------------------------------

    url_pattern = r"https?://[^\s]+|www\.[^\s]+"

    urls = re.findall(url_pattern, text)

    if urls:

        add_detection(
            "Suspicious link present",
            20,
            "Phishing"
        )


    # -----------------------------------
    # SUSPICIOUS URL CHARACTERISTICS
    # -----------------------------------

    suspicious_url_words = [
        "verify",
        "login",
        "update",
        "secure",
        "account",
        "kyc",
        "claim",
        "reward",
        "refund",
        "bank"
    ]

    if urls:

        for url in urls:

            for word in suspicious_url_words:

                if word in url:

                    add_detection(
                        "Suspicious URL keyword",
                        10,
                        "Phishing"
                    )

                    break


    # -----------------------------------
    # LIMIT SCORE
    # -----------------------------------

    risk_score = min(risk_score, 100)


    # -----------------------------------
    # VERDICT
    # -----------------------------------

    if risk_score >= 70:

        verdict = "High Risk"

        recommendation = (
            "Do not respond, click links, "
            "or share personal information."
        )


    elif risk_score >= 40:

        verdict = "Suspicious"

        recommendation = (
            "Verify the sender and avoid "
            "sharing sensitive information."
        )


    else:

        verdict = "Low Risk"

        recommendation = (
            "No strong scam indicators detected. "
            "Stay cautious."
        )


    # -----------------------------------
    # SCAM EXPLANATION
    # -----------------------------------

    if detected_keywords:

        explanation = (
            "This message contains suspicious indicators such as "
            + ", ".join(detected_keywords)
            + ". These indicators may suggest a potential scam."
        )

    else:

        explanation = (
            "No strong scam indicators were detected in this message."
        )


    # -----------------------------------
    # CATEGORY-SPECIFIC EXPLANATION
    # -----------------------------------

    category_explanations = {

        "Banking Scam":
            "The message contains indicators associated with banking or account-related scams.",

        "UPI Scam":
            "The message contains indicators associated with suspicious UPI or digital payment activity.",

        "Payment Scam":
            "The message contains indicators associated with suspicious payment requests.",

        "Credential Scam":
            "The message appears to request sensitive credentials such as OTPs, passwords, PINs or verification codes.",

        "Phishing":
            "The message contains indicators commonly associated with phishing or suspicious links.",

        "Urgency":
            "The message uses urgency or pressure to encourage immediate action.",

        "Investment Scam":
            "The message contains investment-related claims or potentially unrealistic return promises.",

        "Job Scam":
            "The message contains indicators associated with suspicious employment or job offers.",

        "Delivery Scam":
            "The message contains indicators associated with suspicious parcel or delivery requests.",

        "Lottery Scam":
            "The message contains indicators associated with unexpected prizes, lotteries or rewards.",

        "Impersonation Scam":
            "The message contains indicators that may suggest impersonation of an authority or organization.",

        "Government Impersonation":
            "The message contains legal, government or police-related threats that may be used to pressure the recipient.",

        "KYC Scam":
            "The message contains indicators associated with suspicious KYC or SIM verification requests.",

        "Refund Scam":
            "The message contains indicators associated with suspicious refund or cashback requests.",

        "Tech Support Scam":
            "The message contains indicators associated with potentially fraudulent technical support requests.",

        "Account Takeover":
            "The message contains indicators associated with suspicious account access or password activity.",

        "Loan Scam":
            "The message contains indicators associated with suspicious loan offers or advance-fee requests.",

        "Reward Scam":
            "The message contains indicators associated with suspicious gifts, rewards or cashback offers.",

        "Tax Scam":
            "The message contains indicators associated with suspicious tax or tax-refund requests.",

        "Identity Scam":
            "The message contains indicators associated with requests for sensitive personal identity information."
    }


    # Add category explanation when available
    if detected_categories:

        category_messages = []

        for category in detected_categories:

            if category in category_explanations:

                category_messages.append(
                    category_explanations[category]
                )

        if category_messages:

            explanation += " " + " ".join(category_messages)


        # -----------------------------------
    # SAVE ANALYSIS TO DATABASE
    # -----------------------------------

    history = AnalysisHistory(
        message=request.text,
        risk_score=risk_score,
        verdict=verdict,
        categories=json.dumps(detected_categories),
        detected_keywords=json.dumps(detected_keywords),
        recommendation=recommendation,
        explanation=explanation,
        created_at=datetime.now()
    )

    db.add(history)
    db.commit()
    db.refresh(history)

    # -----------------------------------
    # RETURN RESPONSE
    # -----------------------------------

    return {
        "id": history.id,
        "risk_score": risk_score,
        "verdict": verdict,
        "detected_keywords": detected_keywords,
        "detected_categories": detected_categories,
        "recommendation": recommendation,
        "explanation": explanation,
        "time": history.created_at.strftime("%d %b %Y, %I:%M %p")
    }


# -----------------------------------
# GET ANALYSIS HISTORY
# -----------------------------------

@app.get("/history")
def get_history(
    db: Session = Depends(get_db)
):
    history = (
        db.query(AnalysisHistory)
        .order_by(AnalysisHistory.id.desc())
        .all()
    )

    return [
        {
            "id": item.id,
            "message": item.message,
            "risk_score": item.risk_score,
            "verdict": item.verdict,

            "categories": json.loads(item.categories)
            if item.categories
            else [],

            "detected_keywords": json.loads(item.detected_keywords)
            if item.detected_keywords
            else [],

            "recommendation": item.recommendation,

            "explanation": item.explanation,

            "time": item.created_at.strftime("%d %b %Y, %I:%M %p")
            if item.created_at
            else ""
        }
        for item in history
    ]


# -----------------------------------
# DELETE ANALYSIS HISTORY
# -----------------------------------

@app.delete("/history")
def clear_history(db: Session = Depends(get_db)):
    db.query(AnalysisHistory).delete()
    db.commit()

    return {
        "message": "Analysis history cleared successfully."
    }


# -----------------------------------
# DELETE INDIVIDUAL HISTORY ITEM
# -----------------------------------

@app.delete("/history/{history_id}")
def delete_history_item(
    history_id: int,
    db: Session = Depends(get_db)
):
    item = (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.id == history_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="History item not found"
        )

    db.delete(item)
    db.commit()

    return {
        "message": "History item deleted successfully."
    }


# -----------------------------------

# -----------------------------------
# SMART URL ANALYZER
# -----------------------------------

import ipaddress
from urllib.parse import urlparse


class URLRequest(BaseModel):
    url: str


@app.post("/analyze-url")
def analyze_url(
    request: URLRequest,
    db: Session = Depends(get_db)
):
    raw_url = request.url.strip()

    if not raw_url:
        raise HTTPException(
            status_code=400,
            detail="Please enter a URL."
        )

    # Add a scheme if the user did not provide one.
    if not re.match(r"^https?://", raw_url, re.IGNORECASE):
        normalized_url = "https://" + raw_url
    else:
        normalized_url = raw_url

    # Validate the URL structure.
    try:
        parsed = urlparse(normalized_url)
        hostname = parsed.hostname or ""

        if (
            parsed.scheme.lower() not in ("http", "https")
            or not hostname
            or "." not in hostname
            or hostname.startswith(".")
            or hostname.endswith(".")
        ):
            raise ValueError("Invalid URL")

        # Accessing port can raise an error for invalid ports.
        _ = parsed.port

    except (ValueError, UnicodeError):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid website URL."
        )

    url_lower = normalized_url.lower()
    host_lower = hostname.lower()

    score = 0
    reasons = []

    def add_indicator(points, reason):
        nonlocal score
        score += points
        reasons.append(reason)

    # 1. HTTP instead of HTTPS.
    if parsed.scheme.lower() == "http":
        add_indicator(
            15,
            "The URL uses HTTP instead of HTTPS."
        )

    # 2. Suspicious words in the URL.
    suspicious_words = [
        "login", "verify", "verification", "kyc",
        "secure", "account", "update", "reward",
        "prize", "claim", "refund", "wallet",
        "payment", "password", "signin"
    ]

    found_words = [
        word for word in suspicious_words
        if re.search(r"\b" + re.escape(word) + r"\b", url_lower)
    ]

    if found_words:
        add_indicator(
            min(8 * len(found_words), 24),
            "Suspicious keywords found: "
            + ", ".join(found_words)
        )

    # 3. IP address used as the hostname.
    try:
        ipaddress.ip_address(hostname)
        is_ip_address = True
    except ValueError:
        is_ip_address = False

    if is_ip_address:
        add_indicator(
            25,
            "The website uses an IP address instead of a domain name."
        )

    # 4. @ symbol in the URL authority section.
    if "@" in parsed.netloc:
        add_indicator(
            25,
            "The URL contains an @ symbol in its authority section, "
            "which can be used to disguise the destination."
        )

    # 5. URL is unusually long.
    if len(normalized_url) > 100:
        add_indicator(
            10,
            "The URL is unusually long."
        )

    # 6. Many subdomains.
    if host_lower.count(".") >= 3 and not is_ip_address:
        add_indicator(
            10,
            "The hostname contains several subdomains."
        )

    # 7. Internationalized/punycode domain.
    if "xn--" in host_lower:
        add_indicator(
            15,
            "The domain contains punycode encoding. "
            "Check carefully for lookalike characters."
        )

    # 8. Excessive hyphens in the hostname.
    if host_lower.count("-") >= 3:
        add_indicator(
            10,
            "The hostname contains several hyphens."
        )

    # 9. Known URL-shortening services.
    # A shortener is not automatically malicious.
    shorteners = {
        "bit.ly", "tinyurl.com", "t.co", "is.gd",
        "cutt.ly", "shorturl.at", "rb.gy"
    }

    if host_lower in shorteners:
        add_indicator(
            10,
            "This is a URL-shortening service. "
            "The final destination is not visible in this link."
        )

    # 10. Executable or install-package file extensions.
    risky_extensions = (
        ".exe", ".apk", ".msi", ".bat",
        ".cmd", ".scr", ".ps1", ".vbs"
    )

    path_lower = parsed.path.lower()

    if path_lower.endswith(risky_extensions):
        add_indicator(
            20,
            "The URL points to a potentially risky executable "
            "or install-package file."
        )

    # 11. URL includes a non-standard port.
    if parsed.port and parsed.port not in (80, 443):
        add_indicator(
            10,
            "The URL uses a non-standard port."
        )

    # 12. Cap the score.
    score = min(score, 100)

    # 13. Verdict.
    if score >= 70:
        verdict = "High Risk"
        recommendation = (
            "Avoid opening this URL until you can verify "
            "the destination independently."
        )
    elif score >= 40:
        verdict = "Suspicious"
        recommendation = (
            "Check the domain carefully and verify it through "
            "the organization's official website."
        )
    else:
        verdict = "Low Risk"
        recommendation = (
            "No strong indicators were detected by these checks. "
            "This does not guarantee the URL is safe."
        )

    if not reasons:
        reasons.append(
            "No suspicious patterns were detected by these checks."
        )
        
    # Save URL analysis to the database
    history = AnalysisHistory(
        message=normalized_url,
        risk_score=score,
        verdict=verdict,
        categories=json.dumps(["URL Analysis"]),
        detected_keywords=json.dumps(found_words),
        recommendation=recommendation,
        explanation=" ".join(reasons),
        created_at=datetime.now()
    )

    db.add(history)
    db.commit()
    db.refresh(history)


    
    return {
        "id": history.id,
        "url": normalized_url,
        "risk_score": score,
        "verdict": verdict,
        "reasons": reasons,
        "recommendation": recommendation,
        "detected_categories": ["URL Analysis"],
        "detected_keywords": found_words,
        "analysis_type": "Smart URL Analysis",
        "time": (
            history.created_at.strftime("%d %b %Y, %I:%M %p")
            if history.created_at else ""
        )
    }
