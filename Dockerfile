# Dockerfile for the backend API + the Python scraper.
#
# They ship in one image on purpose: the API starts the scraper as a
# subprocess (POST /ingest/trigger) and both read/write the same SQLite
# file, so they need to sit on the same machine.

FROM node:22-slim

# Python, so the scraper can run inside this container too.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY scraper/requirements.txt ./scraper/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r scraper/requirements.txt

# Node dependencies
COPY backend/package*.json ./backend/
RUN npm install --prefix backend --omit=dev

# Application code
COPY scraper ./scraper
COPY backend ./backend

ENV PYTHON_BIN=python3
ENV SCRAPER_DIR=../scraper
ENV DB_PATH=../news_pulse.db
ENV PORT=4000

EXPOSE 4000

CMD ["node", "backend/server.js"]
