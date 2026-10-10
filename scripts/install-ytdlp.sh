#!/usr/bin/env bash
set -e

# اسکریپت نصب و به‌روزرسانی yt-dlp
echo "==> بررسی و نصب آخرین نسخه yt-dlp..."

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
TARGET="${INSTALL_DIR}/yt-dlp"

if [ -w "$INSTALL_DIR" ]; then
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$TARGET"
  chmod a+rx "$TARGET"
  echo "==> yt-dlp با موفقیت در $TARGET نصب شد:"
  "$TARGET" --version
else
  # نصب در پوشه محلی bin در صورت عدم دسترسی روت
  mkdir -p ./bin
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./bin/yt-dlp
  chmod a+rx ./bin/yt-dlp
  echo "==> yt-dlp در پوشه محلی ./bin/yt-dlp نصب شد:"
  ./bin/yt-dlp --version
fi
