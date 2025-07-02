// This utility provides fallbacks for API calls when the backend is unavailable
// Useful for running the frontend-only version on Netlify

/**
 * Attempts to make an API call, with fallback handling if the API is unavailable
 * @param {Function} apiCall - The function that makes the actual API call
 * @param {any} fallbackData - Data to return if the API is unavailable
 * @param {Function} onError - Optional callback for handling specific errors
 */
export const withApiFallback = async (apiCall, fallbackData, onError) => {
    try {
        const response = await apiCall();
        return response;
    } catch (error) {
        // Check if the error is due to the API being unavailable
        if (error.message.includes('Failed to fetch') ||
            error.message.includes('Network Error') ||
            error.response?.status === 404 ||
            error.response?.status === 503) {
            console.warn('API unavailable, using fallback data');
            return fallbackData;
        }

        // Handle other types of errors
        if (onError) {
            onError(error);
        }

        throw error;
    }
};

/**
 * Creates a mock response for when APIs are unavailable
 */
export const createMockResponse = (data) => {
    return {
        data,
        status: 200,
        statusText: 'OK (Mocked)',
        headers: {},
        config: {}
    };
};

/**
 * Checks if the API is available
 * @returns {Promise<boolean>} True if API is available, false otherwise
 */
export const isApiAvailable = async (apiUrl) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(apiUrl, {
            method: 'HEAD',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.warn('API availability check failed:', error.message);
        return false;
    }
};
