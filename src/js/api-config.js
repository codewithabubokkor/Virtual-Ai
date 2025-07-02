// This file helps manage API URLs across different environments

const API_URL = {
    // Use environment variable in production, fallback to localhost in development
    base: import.meta.env.VITE_API_URL || 'http://localhost:3005',

    // API endpoints
    endpoints: {
        chat: '/api/chat',
        history: '/api/history',
        user: '/api/user',
        // Add other endpoints as needed
    }
};

export const getApiUrl = (endpoint) => {
    return `${API_URL.base}${API_URL.endpoints[endpoint] || endpoint}`;
};

export default API_URL;
