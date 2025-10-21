#!/bin/bash
# Local development helper script

echo "🚀 Starting Complain Can in development mode..."
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "📱 Using Python 3 HTTP server"
    echo "🌐 Development version: http://localhost:8080/index-dev.html"
    echo "🌐 Production version: http://localhost:8080/index.html"
    echo ""
    echo "📁 Clean project structure:"
    echo "  - src/          Source code (JS files)"
    echo "  - assets/       Static assets (CSS, images, sounds)"
    echo "  - docs/         Documentation"
    echo "  - legacy-server/ Original server (archived)"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    echo "📱 Using Python 2 HTTP server"
    echo "🌐 Development version: http://localhost:8080/index-dev.html"
    echo "🌐 Production version: http://localhost:8080/index.html"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python -m SimpleHTTPServer 8080
elif command -v npx &> /dev/null; then
    echo "📱 Using Node.js serve"
    echo "🌐 Development version: http://localhost:8080/index-dev.html"
    echo "🌐 Production version: http://localhost:8080/index.html"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    npx serve . -p 8080
else
    echo "❌ No suitable HTTP server found!"
    echo ""
    echo "Please install one of the following:"
    echo "  - Python 3: python3 -m http.server 8080"
    echo "  - Python 2: python -m SimpleHTTPServer 8080"
    echo "  - Node.js: npx serve . -p 8080"
    echo "  - PHP: php -S localhost:8080"
    exit 1
fi