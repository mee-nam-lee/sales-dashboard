# Stage 1: Build Frontend
FROM node:18-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN rm -f package-lock.json
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Server
FROM python:3.10-slim
WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code first
COPY backend/ ./backend

# Copy built frontend into the backend's static directory
COPY --from=frontend-builder /app/frontend/dist ./backend/static

WORKDIR /app/backend

# Expose port (Cloud Run sets PORT environment variable)
ENV PORT=8080

# Run the backend server
CMD ["python", "main.py"]
