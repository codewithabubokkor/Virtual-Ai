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

## Troubleshooting

- **404 errors on refresh**: Your Netlify redirects might not be set up correctly. Check your `netlify.toml` file.

- **Authentication errors**: Make sure your Netlify domain is added to Firebase authorized domains.

- **Blank page**: Check browser console for errors related to environment variables or missing resources.
