
class ChatHistoryService {
    constructor() {
        this.baseUrl = 'http://localhost:3005/api';
        this.currentTopicId = null;
    }


    async createConversation(userId, title = 'New Conversation', topicId = null) {
        try {

            if (!topicId) {

                topicId = this.currentTopicId;


                if (!topicId) {
                    topicId = sessionStorage.getItem('currentTopicId');
                    console.log("Retrieved topic ID from session storage:", topicId);
                }


                if (!topicId) {
                    topicId = this.generateTopicId();
                    console.log("Generated new topic ID in createConversation:", topicId);
                }
            }


            if (!topicId || topicId === 'null' || topicId === 'undefined') {
                topicId = this.generateTopicId();
                console.log("Fallback: Generated new topic ID:", topicId);
            }


            this.currentTopicId = topicId;


            try {
                sessionStorage.setItem('currentTopicId', topicId);
            } catch (e) {
                console.warn("Could not save topic ID to session storage:", e);
            }

            const response = await fetch(`${this.baseUrl}/conversations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    title,
                    topicId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create conversation');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating conversation:', error);
            throw error;
        }
    }


    generateTopicId() {

        const timestamp = Date.now();


        const simpleId = parseInt(timestamp.toString().slice(-6));


        const randomPart = Math.floor(Math.random() * 999) + 1;


        return `T-${simpleId}-${randomPart}`;
    }


    startNewTopic() {
        this.currentTopicId = this.generateTopicId();
        return this.currentTopicId;
    }


    async getConversations(userId) {
        try {
            console.log(`Fetching conversations for user ${userId} from ${this.baseUrl}/conversations/${userId}`);
            const response = await fetch(`${this.baseUrl}/conversations/${userId}`);

            if (!response.ok) {
                console.error(`API error: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to fetch conversations: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`Received ${data.length} conversations from API`);
            return data;
        } catch (error) {
            console.error('Error fetching conversations:', error);
            throw error;
        }
    }


    async getConversationsByTopic(topicId) {
        if (!topicId) return [];

        try {
            console.log(`Fetching conversations for topic ${topicId}`);
            const response = await fetch(`${this.baseUrl}/conversations/topic/${topicId}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch conversations by topic: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Received ${data.length} conversations for topic ${topicId}`);
            return data;
        } catch (error) {
            console.error('Error fetching conversations by topic:', error);
            return [];
        }
    }


    isInCurrentTopic(conversation) {
        return this.currentTopicId && conversation &&
            conversation.topic_id === this.currentTopicId;
    }


    async saveMessage(conversationId, userId, content, isUser) {
        try {
            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationId,
                    userId,
                    content,
                    isUser
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save message');
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }


    async getMessages(conversationId) {
        try {
            const response = await fetch(`${this.baseUrl}/messages/${conversationId}`);

            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching messages:', error);
            throw error;
        }
    }


    async deleteConversation(conversationId) {
        try {
            const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete conversation');
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting conversation:', error);
            throw error;
        }
    }


    async searchConversations(userId, searchTerm) {
        try {
            const response = await fetch(`${this.baseUrl}/search?userId=${userId}&term=${encodeURIComponent(searchTerm)}`);

            if (!response.ok) {
                throw new Error('Failed to search conversations');
            }

            return await response.json();
        } catch (error) {
            console.error('Error searching conversations:', error);
            throw error;
        }
    }
}

export default new ChatHistoryService();
