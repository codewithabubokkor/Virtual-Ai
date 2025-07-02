
class ChatGPTService {
    constructor() {
        this.apiKey = '';
        this.model = 'gpt-3.5-turbo';
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
        this.systemPrompt = 'You are a helpful virtual AI assistant.';
    }

    /**
     * Initialize the service with API key and options
     */
    init(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.model = options.model || this.model;
        this.systemPrompt = options.systemPrompt || this.systemPrompt;

        if (!this.apiKey) {
            console.warn('ChatGPT service initialized without API key');
        }
    }

    /**
     * Set a custom system prompt for the AI
     */
    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
    }

    /**
     * Generate a response from the ChatGPT API
     * @param {string} userMessage - The user's message
     * @param {Array} conversationHistory - Previous messages in the conversation
     * @param {Object} options - Additional options for the API call
     * @returns {Promise<string>} - The AI's response
     */
    async generateResponse(userMessage, conversationHistory = [], options = {}) {
        if (!this.apiKey) {
            throw new Error('API key not configured. Please call init() with a valid API key.');
        }

        try {

            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...this.formatConversationHistory(conversationHistory),
                { role: 'user', content: userMessage }
            ];


            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: options.model || this.model,
                    messages: messages,
                    max_tokens: options.maxTokens || 150,
                    temperature: options.temperature || 0.7
                })
            };


            const response = await fetch(this.baseUrl, requestOptions);

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`API request failed: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error generating ChatGPT response:', error);
            throw error;
        }
    }

    /**
     * Format conversation history for the API
     * @param {Array} history - Array of message objects
     * @returns {Array} - Formatted messages for the API
     */
    formatConversationHistory(history) {
        return history.map(message => ({
            role: message.isUser ? 'user' : 'assistant',
            content: message.content
        }));
    }
}


export default new ChatGPTService();
