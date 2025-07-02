#!/bin/bash

echo "Starting Virtual AI Chat Backend Server..."
echo "----------------------------------------"
echo "Loading environment variables from .env file..."

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Warning: .env file not found. Using default or environment values."
  echo "Create a .env file from .env.example for proper configuration."
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js to continue."
  exit 1
fi

# Start the server
echo "Starting backend server on port $PORT..."
node src/js/server.js
