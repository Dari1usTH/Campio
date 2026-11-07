FROM python:3.13-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir pillow==11.3.0 numpy==2.3.3 \
 && useradd -u 10002 -M -s /usr/sbin/nologin worker

COPY vidkit.py /usr/local/lib/python3.13/site-packages/vidkit.py
COPY server.py /app/server.py

USER worker
WORKDIR /tmp
ENV PORT=8000 PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python3", "/app/server.py"]
