#!/bin/bash

# build-frontend.sh - A script to build only the frontend part for Netlify deployment

echo "🏗️  Building Virtual AI Frontend for Netlify deployment"
echo "----------------------------------------------------"

# Check for npm
if ! command -v npm &> /dev/null; then
  echo "❌ Error: npm is not installed. Please install Node.js and npm first."
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Create a .env.production file if it doesn't exist
if [ ! -f ".env.production" ]; then
  echo "🔧 Creating production environment file..."
  echo "# Production environment settings" > .env.production
  echo "VITE_API_URL=https://your-backend-url-if-deployed.com" >> .env.production
  echo "⚠️  Created default .env.production file. Edit it if you have a deployed backend."
else
  echo "✅ Using existing .env.production file"
fi

# Build the frontend
echo "🚀 Building frontend with Vite..."
# Set environment variable to fix Rollup platform-specific issues
export ROLLUP_SKIP_NODEJS_NATIVE=true
npm run build

# Check if build was successful
if [ -d "dist" ]; then
  echo "✅ Build successful! Files generated in dist/ directory"
  echo "📂 Contents of dist directory:"
  ls -la dist/
  echo ""
  echo "🌐 To deploy to Netlify:"
  echo "  1. Push these changes to your Git repository"
  echo "  2. Connect your repository in Netlify"
  echo "  3. Use 'npm run build' as the build command"
  echo "  4. Use 'dist' as the publish directory"
  
  # Ask if user wants to preview the build
  echo ""
  echo "🔍 Would you like to preview the build locally? (y/n)"
  read -r preview_response
  
  if [[ $preview_response =~ ^[Yy]$ ]]; then
    echo "🚀 Starting local preview server..."
    echo "📱 Your site will be available at: http://localhost:5000"
    echo "⚠️ This is just a preview and doesn't include backend functionality."
    echo "❗ Press Ctrl+C to stop the preview server when done."
    npx serve -s dist -l 5000
  else
    echo "🔗 To serve the build locally later, run: npx serve -s dist"
  fi
else
  echo "❌ Build failed. Check the errors above."
  exit 1
fi
