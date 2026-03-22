@echo off
title NGD Studio
cd /d "%~dp0"

echo ============================================
echo   NGD Studio
echo ============================================
echo.

:: Check Node.js
where node.exe >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

:: Check pnpm
where pnpm.cmd >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Installing pnpm...
    call npm.cmd install -g pnpm
)

:: Install dependencies
if not exist "node_modules\.bin\next.CMD" (
    echo [INFO] Installing dependencies...
    call pnpm.cmd install
    echo.
)

:: Kill existing processes on ports
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3020" ^| findstr "LISTENING"') do taskkill /pid %%a /f >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3021 " ^| findstr "LISTENING"') do taskkill /pid %%a /f >nul 2>nul

echo [1/2] Starting SSE server (port 3021)...
start "NGD-SSE" /min cmd /c "cd /d %~dp0 && call pnpm.cmd dev:sse"

echo [2/2] Starting Next.js (port 3020)...
start "NGD-Next" /min cmd /c "cd /d %~dp0 && call pnpm.cmd dev"

:: Wait for Next.js to be ready
echo.
echo Waiting for servers...
:wait
ping -n 2 127.0.0.1 >nul
netstat -ano 2>nul | findstr ":3020" | findstr "LISTENING" >nul 2>nul
if %errorlevel% neq 0 goto wait

:: Open browser
start "" http://localhost:3020

echo.
echo ============================================
echo   NGD Studio Running
echo   - Web:  http://localhost:3020
echo   - SSE:  http://localhost:3021
echo.
echo   Press any key to stop servers...
echo ============================================
echo.
pause >nul

:: Shutdown
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3020" ^| findstr "LISTENING"') do taskkill /pid %%a /f >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3021 " ^| findstr "LISTENING"') do taskkill /pid %%a /f >nul 2>nul
echo Servers stopped.
