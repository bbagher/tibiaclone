#!/bin/bash

echo "=========================================="
echo "  Tibia Clone - Multiplayer (via ngrok)"
echo "=========================================="
echo ""
echo "Starting server and creating public URL..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ERROR: ngrok is not installed!"
    echo ""
    echo "Install ngrok:"
    echo "  brew install ngrok  (on macOS)"
    echo "  Or download from: https://ngrok.com/download"
    echo ""
    exit 1
fi

# Start the Node.js server in background
echo "Starting game server on port 3000..."
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Start ngrok tunnel
echo ""
echo "Creating ngrok tunnel..."
echo ""
echo "========================================"
echo "  SHARE THIS URL WITH YOUR FRIEND:"
echo "========================================"
echo ""

# Start ngrok and capture the output
ngrok http 3000 --log=stdout 2>&1 | tee /tmp/ngrok.log &
NGROK_PID=$!

# Wait a bit for ngrok to start
sleep 3

# Get the public URL from ngrok API
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "Checking ngrok status..."
    sleep 2
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)
fi

if [ ! -z "$NGROK_URL" ]; then
    echo ""
    echo "┌──────────────────────────────────────┐"
    echo "│  Public URL (share with friend):     │"
    echo "│                                      │"
    echo "│  $NGROK_URL/multiplayer.html"
    echo "│                                      │"
    echo "└──────────────────────────────────────┘"
    echo ""
    echo "You can also play locally at:"
    echo "  http://localhost:3000/multiplayer.html"
    echo ""
else
    echo "Ngrok tunnel created!"
    echo "View your public URL at: http://localhost:4040"
    echo ""
    echo "Local access: http://localhost:3000/multiplayer.html"
    echo ""
fi

echo "========================================"
echo ""
echo "Server is running..."
echo "Press Ctrl+C to stop"
echo ""
echo "View ngrok dashboard: http://localhost:4040"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $SERVER_PID 2>/dev/null
    kill $NGROK_PID 2>/dev/null
    killall ngrok 2>/dev/null
    echo "Done!"
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup SIGINT SIGTERM

# Keep script running
wait
