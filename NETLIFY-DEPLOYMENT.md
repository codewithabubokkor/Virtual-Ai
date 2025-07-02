# Deploying Virtual AI to Netlify

This guide explains how to deploy the Virtual AI frontend to Netlify.

## Prerequisites

1. A [Netlify account](https://app.netlify.com/signup)
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Separating Frontend and Backend

Your project currently has both frontend and backend code in the same repository. For Netlify deployment, we'll focus on deploying just the frontend part.

### Understanding Project Structure

- **Frontend**: UI code built with Vite (HTML, CSS, JS in the root and public folders)
- **Backend**: Express server in `src/js/server.js` and database operations

### Building Just the Frontend

For Netlify, you only need to build the frontend:

```bash
# Make sure you're using npm (not nmp, which is a typo)
npm run build
```

This command will:
1. Run Vite's build process
2. Create optimized files in the `dist` directory
3. Only include frontend code

### What Netlify Will Deploy

- Netlify will only deploy the static files generated in `dist/`
- The backend server code won't be executed on Netlify
- Firebase authentication will still work because it's client-side

## Deployment Steps

### 1. Push your code to a Git repository

Make sure your code is pushed to a Git repository (GitHub, GitLab, or Bitbucket).

### 2. Log in to Netlify

- Go to [Netlify](https://app.netlify.com/) and log in
- Click "Add new site" > "Import an existing project"

### 3. Connect to your Git provider

- Select your Git provider (GitHub, GitLab, or Bitbucket)
- Authorize Netlify to access your repositories
- Select your Virtual AI repository

### 4. Configure build settings

Netlify should automatically detect your build settings from the `netlify.toml` file, but verify these settings:

- Build command: `npm run build`
- Publish directory: `dist`

### 5. Configure environment variables

For the frontend to communicate with your backend, you'll need to set up environment variables in Netlify:

1. Go to Site settings > Environment variables
2. Add the following variables:
   - `VITE_API_URL`: URL to your deployed backend API (e.g., https://your-backend-api.com)

> **Note**: You don't need to add Firebase configuration as environment variables since they are already hardcoded in your firebase-config.js file. However, for better security in a production environment, it's recommended to use environment variables for Firebase config as well.

### 6. Firebase Authentication Setup

To ensure Firebase authentication works correctly on your Netlify deployment:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Authentication > Sign-in method
4. For each authentication provider you're using (Email/Password, Google, Facebook):
   - Make sure they are enabled
   - Add your Netlify domain to the "Authorized domains" list:
     - `your-site-name.netlify.app`
     - Your custom domain if you're using one

This step is crucial for Firebase to accept authentication requests from your Netlify domain.

### 7. Deploy

- Click "Deploy site"
- Wait for the build and deployment to complete

## Backend Deployment Options

Since Netlify only hosts static sites, you'll need to deploy your backend server separately if you want to use the backend features. Options include:

1. **Render**: Good for Node.js applications
2. **Heroku**: Easy deployment with free and paid tiers
3. **Railway**: Simple deployment with competitive pricing
4. **AWS, GCP, or Azure**: More complex but highly scalable

## Running Without a Backend

If you only want to deploy the frontend with authentication functionality, you can use the application with just Firebase auth without deploying the backend. Here's what will work:

✅ **Working without backend**:
- User registration and login (Email/Password, Google, Facebook)
- Basic UI functionality
- Client-side features that don't require API calls

❌ **Not working without backend**:
- Chat history storage
- Any server-side processing
- Database operations

To configure the application to work without a backend:

1. Make sure all Firebase authentication is set up correctly
2. Consider implementing fallbacks in your code for API calls (check for API availability and provide appropriate UI feedback)

## Handling CORS

After deploying your backend, make sure to update the CORS settings in your Express server to allow requests from your Netlify domain:

```javascript
// In your server.js
app.use(cors({
  origin: ['https://your-netlify-site.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
```

## Testing Your Deployment

After deployment, test all features to ensure they're working correctly:

### Testing Authentication

1. Try to register a new user with email/password
2. Try to log in with existing credentials
3. Test social logins (Google, Facebook) if you're using them
4. Verify successful redirects after login

### Common Firebase Authentication Issues

If you encounter issues with Firebase authentication on Netlify:

1. **"Unauthorized domain" errors**:
   - Make sure your Netlify domain is added to Firebase's authorized domains list
   - Check for any typos in the domain name

2. **Social login redirects failing**:
   - Verify OAuth redirect URLs are configured correctly in your social providers (Google/Facebook developer consoles)
   - Check that popup windows aren't being blocked by browsers

3. **CORS issues**:
   - Firebase auth should work without CORS issues as it's client-side
   - For Firestore or other Firebase services, ensure your security rules are properly configured

4. **Console errors**:
   - Check browser console for specific Firebase error messages
   - Google the exact error code for specific solutions

## Troubleshooting Build Issues

### Common Build Problems

1. **Command not found: nmp**:
   - This is a typo! Use `npm run build` (not nmp)
   
2. **Build failing on Netlify**:
   - Check the build logs in Netlify for specific errors
   - Common issues include:
     - Missing dependencies
     - Node.js version incompatibility
     - Environment variable problems

3. **Local build works but Netlify build fails**:
   - Try specifying Node.js version in `netlify.toml`
   - Ensure all dependencies are in `package.json` (not just installed locally)

4. **Pages not found after deployment**:
   - Check if the redirect rules in `netlify.toml` are working
   - Verify file paths in your HTML/JavaScript are correct
