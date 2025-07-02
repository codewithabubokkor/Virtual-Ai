# Virtual AI

A web application with AI chat capabilities and 3D avatar visualization.

## Features

- User authentication with Firebase (Email/Password, Google, Facebook)
- Interactive 3D avatar using Three.js
- AI-powered chat functionality
- Chat history management

## Project Structure

- **Frontend**: Vite-based web application
- **Backend**: Express server with MySQL database

## Quick Start

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables:
   ```
   cp env.example .env
   ```
   Edit the `.env` file with your credentials
4. Start the application:
   ```
   npm start
   ```

## Development

To start development servers:

- Frontend only:
  ```
  npm run dev
  ```
- Backend only:
  ```
  npm run backend
  ```
- Both together:
  ```
  npm start
  ```

## Deployment

### Frontend Deployment (Netlify)

The frontend can be deployed to Netlify with Firebase authentication working. See the [detailed deployment guide](NETLIFY-DEPLOYMENT.md) for instructions.

### Backend Deployment

The backend can be deployed to platforms like Render, Heroku, or Railway. Configuration instructions are included in the deployment guide.

## Technologies Used

- **Frontend**:
  - Vite
  - Three.js
  - Firebase Authentication
  - GSAP for animations
  
- **Backend**:
  - Express.js
  - MySQL
  - ElevenLabs API integration

## License

[MIT](LICENSE)
