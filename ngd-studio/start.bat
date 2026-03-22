@echo off
chcp 65001 >nul
title NGD Studio

echo ============================================
echo   NGD Studio 시작 중...
echo ============================================
echo.

cd /d "%~dp0"

:: Node.js 설치 확인
where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 설치 후 다시 시도하세요.
    pause
    exit /b 1
)

:: pnpm 설치 확인
where pnpm >nul 2>nul
if errorlevel 1 (
    echo [정보] pnpm이 없습니다. 설치 중...
    npm install -g pnpm
)

:: 의존성 설치 (node_modules 없으면)
if not exist "node_modules" (
    echo [정보] 의존성 설치 중...
    call pnpm install
    echo.
)

:: 기존 프로세스 정리 (포트 충돌 방지)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do taskkill /pid %%a /f >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3021 " ^| findstr "LISTENING"') do taskkill /pid %%a /f >nul 2>nul

echo [1/2] SSE 서버 시작 (포트 3021)...
start "NGD SSE Server" /min cmd /c "cd /d "%~dp0" && pnpm dev:sse"

echo [2/2] Next.js 서버 시작 (포트 3000)...
start "NGD Next.js" /min cmd /c "cd /d "%~dp0" && pnpm dev"

:: 서버 준비 대기
echo.
echo 서버 준비 대기 중...
timeout /t 5 /nobreak >nul

:: 브라우저 열기
echo 브라우저를 엽니다...
start http://localhost:3000

echo.
echo ============================================
echo   NGD Studio 실행 중
echo   - 웹:  http://localhost:3000
echo   - SSE: http://localhost:3021
echo
echo   이 창을 닫으면 서버가 종료됩니다.
echo ============================================
echo.

:: 이 창이 열려 있는 동안 서버 유지 — 닫으면 자식 프로세스도 종료
pause >nul
taskkill /fi "WINDOWTITLE eq NGD SSE Server" /f >nul 2>nul
taskkill /fi "WINDOWTITLE eq NGD Next.js" /f >nul 2>nul
