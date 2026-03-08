#!/bin/bash
# NGD Studio 시작 스크립트
# 팀 서버 또는 로컬에서 실행

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js가 설치되어 있지 않습니다."
  echo "   https://nodejs.org 에서 설치해주세요."
  exit 1
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo "📦 pnpm 설치중..."
  npm install -g pnpm
fi

# Check Claude CLI
if ! command -v claude &> /dev/null; then
  echo "⚠️  Claude CLI가 설치되어 있지 않습니다."
  echo "   작업 실행은 불가하지만 UI는 확인 가능합니다."
fi

# Install dependencies
echo "📦 의존성 설치중..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Build
echo "🔨 빌드중..."
pnpm build

# Start
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"

echo ""
echo "🚀 NGD Studio 시작"
echo "   로컬:  http://localhost:${PORT}"
echo "   네트워크: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):${PORT}"
echo ""

pnpm start -H "$HOST" -p "$PORT"
