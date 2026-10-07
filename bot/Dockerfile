FROM python:3.11-slim

# تنظیم منطقه زمانی و ممانعت از ایجاد فایل‌های موقت .pyc
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Asia/Tehran

WORKDIR /app

# نصب ابزارهای مورد نیاز سیستم‌عامل
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# نصب کتابخانه‌های پایتون
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# کپی اسکریپت ربات
COPY telegram_scraper.py .

# اجرای ربات با راه‌اندازی کانتینر
CMD ["python", "telegram_scraper.py"]
