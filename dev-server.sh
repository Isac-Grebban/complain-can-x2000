#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_DIR="$ROOT_DIR/proxy-server"

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm is required to run the proxy server."
    exit 1
fi

if [ ! -d "$PROXY_DIR/node_modules" ]; then
    echo "📦 Installing proxy dependencies..."
    npm --prefix "$PROXY_DIR" install
fi

if [ ! -f "$PROXY_DIR/.env" ]; then
    echo "ℹ️  No proxy-server/.env found. Starting with local development defaults."
    echo "   Copy proxy-server/.env.example to proxy-server/.env to enable GitHub OAuth and Gist storage."
fi

echo "🚀 Starting Complain Can proxy server..."
echo "🌐 App: http://localhost:3000/index-dev.html"
echo "🌐 Main entry: http://localhost:3000/"
echo ""

AUTH_MODE="${AUTH_MODE:-development}" STORAGE_MODE="${STORAGE_MODE:-local}" npm --prefix "$PROXY_DIR" start