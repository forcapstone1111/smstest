@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found in PATH.
  echo Install it from https://nodejs.org then run this again.
  pause
  exit /b 1
)

echo Starting the SMS relay on http://127.0.0.1:3000 ...
echo Keep this window open while using the app. Press Ctrl+C to stop.
echo.

start "" "index.html"
node proxy.js
