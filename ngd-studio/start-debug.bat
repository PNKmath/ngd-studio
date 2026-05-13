@echo off
title NGD Studio (DEBUG)
cd /d "%~dp0"

echo ============================================
echo   NGD Studio - DEBUG MODE
echo   child windows stay open so you can see errors
echo ============================================
echo.

:: Kill existing processes on ports
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3020" ^| findstr "LISTENING"') do taskkill /pid %%a /f >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3021 " ^| findstr "LISTENING"') do taskkill /pid %%a /f >nul 2>nul

echo [1/2] Starting SSE server (port 3021)...
start "NGD-SSE (DEBUG)" cmd /k "cd /d %~dp0 && call pnpm.cmd dev:sse"

echo [2/2] Starting Next.js (port 3020)...
start "NGD-Next (DEBUG)" cmd /k "cd /d %~dp0 && call pnpm.cmd dev"

echo.
echo Two child windows opened. Check the messages there.
echo Press any key to close this dispatcher (child windows remain open).
pause >nul
