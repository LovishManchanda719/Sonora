# Zero-Cost Production Dockerfile for DysarthriaNet-XC FastAPI Service
# Compatible with HuggingFace Spaces (Docker), Render, or Railway (Free Tier)
FROM python:3.10-slim

WORKDIR /app

# Install system audio libraries (libsndfile for soundfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code and model bundle
COPY app/ ./backend/app/
COPY models/ ./backend/models/

# Expose standard port
EXPOSE 7860
ENV PORT=7860
ENV PYTHONUNBUFFERED=1

# Run FastAPI app with Uvicorn
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
