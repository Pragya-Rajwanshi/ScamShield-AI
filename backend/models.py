from sqlalchemy import Column, Integer, String, Text, DateTime
from database import Base
from datetime import datetime


class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    id = Column(Integer, primary_key=True, index=True)

    message = Column(Text, nullable=False)

    risk_score = Column(Integer, nullable=False)

    verdict = Column(String, nullable=False)

    categories = Column(Text, nullable=True)

    detected_keywords = Column(Text, nullable=True)

    recommendation = Column(Text, nullable=True)

    explanation = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        default=datetime.now,
        nullable=True
    )