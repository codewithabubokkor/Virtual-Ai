#!/bin/bash

# Check if MySQL running
echo "Checking if MySQL server is running..."
if ! pgrep -x "mysqld" > /dev/null; then
    echo "Starting MySQL server..."
    mysql.server start
    
    # Wait for MySQL to fully start
    echo "Waiting for MySQL to initialize..."
    sleep 3
fi

# Directly check MySQL connection
echo "Verifying MySQL connection..."
# Load database configuration from .env file
source <(grep -v '^//' .env | sed 's/^/export /')

# Try to connect to MySQL
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 'Connection successful';" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "MySQL connection failed. Please check your database configuration in .env file."
    exit 1
else
    echo "MySQL connection successful."
fi

# Initialize the database schema if needed
echo "Initializing database schema..."
node src/js/db-setup.js

# Start the backend server in the background
echo "Starting backend server..."
node src/js/server.js &
SERVER_PID=$!

# Wait to ensure server is up
echo "Waiting for server to start..."
sleep 3

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "Failed to start the server. Check logs for errors."
    exit 1
fi

echo "Server started successfully with PID: $SERVER_PID"

# Start the Vite development server
echo "Starting frontend development server..."
npm run dev

# Add trap to catch interrupts and terminate both servers
trap "echo 'Shutting down servers...'; kill $SERVER_PID 2>/dev/null; exit" INT TERM EXIT
