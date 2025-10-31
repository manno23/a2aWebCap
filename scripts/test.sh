#!/usr/bin/fish

# Function to handle cleanup - kills the server process
function cleanup_server
    if set -q SERVER_PID
        echo "Stopping server..."
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
    end
end

# Set up signal handler for SIGINT (Ctrl+C)
functions --on-signal INT cleanup_server

# Execute the build script at the beginning
echo "Running build script..."
./scripts/build.sh

# Start the server in background and capture its process ID
echo "Starting server in background from build artifacts..."
bun packages/server/dist/index.js &
set -l SERVER_PID $status

# Wait for 2 seconds to allow the server to initialize
echo "Waiting for server to initialize..."
sleep 2

# Execute the client script
echo "Running client from build artifacts..."
bun packages/client/dist/index.js

echo "Test complete."

# Explicitly call cleanup function to stop the server
cleanup_server