# Step-by-Step Netlify Deployment Guide

This quick guide provides the exact steps to deploy your Virtual AI frontend to Netlify and get a live URL.

## 1. Build Your Frontend

```bash
# Run the build script
npm run build:frontend

# When prompted, type 'y' to preview locally
```

## 2. Deploy to Netlify

### Option A: Deploy via Netlify Site

1. Create a GitHub repository and push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. Sign up/login to [Netlify](https://app.netlify.com/)

3. Click "Add new site" > "Import an existing project"

4. Connect to GitHub and select your repository

5. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`

6. Click "Deploy site"

7. Wait for deployment to complete (1-2 minutes)

8. Your site will be live at: `https://random-name.netlify.app`

### Option B: Deploy via Netlify CLI (Faster)

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Deploy the site:
   ```bash
   netlify deploy --prod
   ```

4. When prompted:
   - Select "Create & configure a new site"
   - Choose your team
   - Set a site name (optional)
   - Set the publish directory to: `dist`

5. The CLI will provide your live URL

## 3. Configure Firebase for Your Netlify Domain

1. Go to [Firebase Console](https://console.firebase.google.com/)

2. Select your project

3. Go to Authentication > Sign-in method

4. Add your Netlify domain to Authorized domains:
   - `your-site-name.netlify.app`

## 4. Test Your Deployed Site

1. Visit your Netlify URL

2. Try to register and login

3. Test all frontend features

## 5. Fix Build Settings in Netlify

If you encounter the `@rollup/rollup-linux-x64-gnu` error:

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Build & deploy** > **Environment**
3. Add these environment variables:
   - Key: `NPM_FLAGS`
   - Value: `--no-optional`

4. Then go to **Build & deploy** > **Continuous Deployment**
5. Click on **Edit settings**
6. Scroll down to **Build image selection**
7. Select the latest stable build image

8. After saving, go back to **Deploys**
9. Click **Clear cache and deploy site**

This resolves most platform-specific dependency issues between your local macOS environment and Netlify's Linux build environment.

## Troubleshooting

### Common Build Errors

- **Missing Rollup Module Error** (`@rollup/rollup-linux-x64-gnu`):
  
  This error occurs because Netlify builds on Linux, but your development environment is macOS.
  
  **Solution**:
  1. Add this to your `vite.config.js` file:
     ```javascript
     export default defineConfig({
         // ...existing config...
         build: {
             // ...existing build options...
             rollupOptions: {
                 external: [
                     // Add external dependencies that cause platform-specific issues
                 ]
             }
         }
     });
     ```
  
  2. Or specify the Node.js version in `netlify.toml`:
     ```toml
     [build.environment]
       NODE_VERSION = "18"
     ```
  
  3. You can also try forcing a clean install:
     - Go to Netlify site settings
     - Build & Deploy > Continuous Deployment
     - Edit settings
     - Clear cache and deploy site

- **404 errors on refresh**: Your Netlify redirects might not be set up correctly. Check your `netlify.toml` file.

- **Authentication errors**: Make sure your Netlify domain is added to Firebase authorized domains.

- **Blank page**: Check browser console for errors related to environment variables or missing resources.
