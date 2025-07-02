import { auth } from './firebase-config';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import * as THREE from 'three';
import { Avatar, Experience } from './avatar-experience.js';
import chatHistoryService from './chat-history-service.js';
import chatGPTService from './chatgpt-service.js';


window.chatHistoryService = chatHistoryService;

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");


    let currentUser = null;
    let currentConversation = null;


    const sidebarExists = document.getElementById('sidebar');
    const historyListExists = document.getElementById('history-list');
    console.log("Sidebar exists:", !!sidebarExists);
    console.log("History list exists:", !!historyListExists);


    document.addEventListener('forceHistoryUpdate', () => {
        console.log("Force update chat history triggered");
        updateChatHistory();
    });


    document.addEventListener('continueConversation', (e) => {
        console.log("Continue conversation event received:", e.detail);
        const { conversationId, conversation } = e.detail;
        if (conversationId) {

            loadConversation(conversation || { id: conversationId });


            document.querySelectorAll('.history-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.conversationId === conversationId.toString()) {
                    item.classList.add('active');
                }
            });
        }
    });


    document.addEventListener('deleteConversation', (e) => {
        console.log("Delete conversation event received:", e.detail);
        const { conversationId } = e.detail;
        if (conversationId) {
            deleteConversation(conversationId);
        }
    });


    try {
        const storedUserJson = sessionStorage.getItem('currentUser');
        if (storedUserJson) {
            const storedUser = JSON.parse(storedUserJson);
            console.log("Found user in session storage:", storedUser.uid);
            currentUser = storedUser;
        } else {
            console.log("No user found in session storage");
        }
    } catch (error) {
        console.error("Error checking session storage:", error);
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const experience = new Experience(scene, camera, renderer);

    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        experience.update(delta);
        renderer.render(scene, camera);
    }
    animate();


    const chatBox = document.getElementById('chat-box');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const historyList = document.getElementById('history-list');
    const newConversationBtn = document.getElementById('new-conversation');


    console.log("Initial check of critical elements:");
    console.log("- chatBox found:", !!chatBox);
    console.log("- historyList found:", !!historyList);
    console.log("- historyList element:", historyList);
    if (historyList) {
        console.log("historyList parent:", historyList.parentElement);
        console.log("historyList innerHTML:", historyList.innerHTML);
    } else {
        console.error("Critical error: history-list element not found!");

        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            console.log("Attempting to fix missing history list...");

            const possibleHistoryList = sidebar.querySelector('.history-list') ||
                sidebar.querySelector('[id*="history"]');
            if (possibleHistoryList) {
                console.log("Found possible history list element:", possibleHistoryList);
            } else {
                console.log("Creating new history list element");
                const newHistoryList = document.createElement('div');
                newHistoryList.id = 'history-list';
                newHistoryList.className = 'history-list';
                sidebar.appendChild(newHistoryList);
            }
        }
    }


    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', startNewConversation);
    }


    function updateChatHistory() {
        console.log("updateChatHistory function called");


        console.log("historyList element exists?:", !!document.getElementById('history-list'));
        console.log("sidebar element exists?:", !!document.getElementById('sidebar'));

        if (!currentUser) {
            try {
                const storedUserJson = sessionStorage.getItem('currentUser');
                if (storedUserJson) {
                    currentUser = JSON.parse(storedUserJson);
                    console.log("Retrieved user from session storage for chat history:", currentUser.uid);
                } else {
                    console.log("No user in session storage, cannot update chat history");
                    return;
                }
            } catch (error) {
                console.error("Error retrieving user from session storage:", error);
                return;
            }
        }

        console.log("Updating chat history for user:", currentUser.uid);
        console.log("Using API URL:", chatHistoryService.baseUrl);


        if (historyList.querySelector('.loading-history')) {
            historyList.innerHTML = '<div class="loading-history">Loading conversations...</div>';
        }

        chatHistoryService.getConversations(currentUser.uid)
            .then(conversations => {
                console.log("Fetched conversations:", conversations);
                console.log("typeof conversations:", typeof conversations);
                console.log("Is array:", Array.isArray(conversations));
                if (Array.isArray(conversations)) {
                    console.log("Number of conversations:", conversations.length);
                }


                historyList.innerHTML = '';

                if (!Array.isArray(conversations)) {
                    console.error("API returned non-array response:", conversations);
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'error-history';
                    errorMsg.textContent = 'Error loading conversations';
                    historyList.appendChild(errorMsg);
                    return;
                }

                if (conversations.length === 0) {
                    console.log("No conversations found for user");
                    const emptyMsg = document.createElement('div');
                    emptyMsg.className = 'empty-history';
                    emptyMsg.textContent = 'No conversations yet';
                    historyList.appendChild(emptyMsg);
                    return;
                }


                const topicGroups = {};
                conversations.forEach(conv => {
                    const topicId = conv.topic_id || 'no_topic';
                    if (!topicGroups[topicId]) {
                        topicGroups[topicId] = [];
                    }
                    topicGroups[topicId].push(conv);
                });


                conversations.forEach((conv, index) => {
                    console.log("Processing conversation:", conv);
                    try {
                        const convItem = document.createElement('div');
                        convItem.className = 'history-item';
                        convItem.dataset.topicId = conv.topic_id || '';


                        if (index > 0 && conversations[index - 1].topic_id === conv.topic_id && conv.topic_id) {
                            convItem.dataset.sameTopic = 'true';
                        }

                        if (currentConversation && currentConversation.id === conv.id) {
                            convItem.classList.add('active');
                        }


                        const date = new Date(conv.created_at);
                        const formattedDate = date.toLocaleDateString();


                        chatHistoryService.getMessages(conv.id)
                            .then(messages => {

                                const userMessage = messages.find(m => m.is_user);
                                const aiResponse = messages.find(m => !m.is_user);


                                let previewHtml = '';
                                if (userMessage) {
                                    const userPreview = userMessage.content.length > 25
                                        ? userMessage.content.substring(0, 25) + '...'
                                        : userMessage.content;
                                    previewHtml += `<div class="message-preview user">You: ${userPreview}</div>`;
                                }

                                if (aiResponse) {
                                    const aiPreview = aiResponse.content.length > 25
                                        ? aiResponse.content.substring(0, 25) + '...'
                                        : aiResponse.content;
                                    previewHtml += `<div class="message-preview ai">AI: ${aiPreview}</div>`;
                                }


                                convItem.innerHTML = `
                                    <div class="history-content">
                                        <span class="history-title">${conv.title}</span>
                                        <span class="history-date">${formattedDate}</span>
                                        <div class="conversation-preview">${previewHtml}</div>
                                    </div>
                                    <button class="delete-btn" data-id="${conv.id}">&times;</button>
                                `;


                                addConversationEventListeners(convItem, conv);
                            })
                            .catch(error => {
                                console.error(`Error loading messages for conversation ${conv.id}:`, error);

                                convItem.innerHTML = `
                                    <div class="history-content" data-id="${conv.id}" data-topic-id="${conv.topic_id || ''}">
                                        <span class="history-title">${conv.title}</span>
                                        <span class="history-date">${formattedDate}</span>
                                    </div>
                                    <button class="delete-btn" data-id="${conv.id}">&times;</button>
                                `;


                                addConversationEventListeners(convItem, conv);
                            });


                        convItem.innerHTML = `
                            <div class="history-content" data-id="${conv.id}" data-topic-id="${conv.topic_id || ''}">
                                <span class="history-title">${conv.title}</span>
                                <span class="history-date">${formattedDate}</span>
                                ${conv.topic_id ?
                                `<span class="topic-badge" title="Topic ID: ${conv.topic_id}"></span>` :
                                ''}
                                <div class="conversation-preview"><small>Loading...</small></div>
                            </div>
                            <button class="delete-btn" data-id="${conv.id}">&times;</button>
                        `;


                        convItem.querySelector('.history-content').addEventListener('click', (e) => {
                            console.log("Loading conversation:", conv);


                            if (e.shiftKey) {
                                console.log("Shift+Click detected - continuing conversation in topic:", conv.topic_id);


                                if (conv.topic_id) {
                                    chatHistoryService.currentTopicId = conv.topic_id;
                                    console.log("Set current topic ID to:", chatHistoryService.currentTopicId);
                                }


                                document.dispatchEvent(new CustomEvent('continueConversation', {
                                    detail: { conversationId: conv.id, conversation: conv }
                                }));
                            } else {

                                loadConversation(conv);
                            }
                        });


                        convItem.querySelector('.delete-btn').addEventListener('click', (e) => {
                            e.stopPropagation();
                            console.log("Deleting conversation with ID:", conv.id);
                            if (confirm('Are you sure you want to delete this conversation?')) {
                                deleteConversation(conv.id);
                            }
                        });

                        historyList.appendChild(convItem);
                        console.log("Added conversation to history list:", conv.title);
                    } catch (error) {
                        console.error("Error processing conversation:", error, conv);
                    }
                });

                console.log("History list now contains:", historyList.children.length, "items");


                groupConversationsByTopic(historyList.children);
            })
            .catch(error => {
                console.error('Error fetching conversations:', error);
                historyList.innerHTML = '<div class="error-history">Error: ' + error.message + '</div>';
            });
    }


    function groupConversationsByTopic(historyItems) {

        const topicGroups = {};


        Array.from(historyItems).forEach(item => {
            const historyContent = item.querySelector('.history-content');
            if (!historyContent) return;

            const topicId = historyContent.dataset.topicId;
            if (topicId) {
                if (!topicGroups[topicId]) {
                    topicGroups[topicId] = [];
                }
                topicGroups[topicId].push(item);
            }
        });


        Object.entries(topicGroups).forEach(([topicId, group]) => {
            if (group.length > 1) {

                group.sort((a, b) => {
                    return Array.from(historyItems).indexOf(a) - Array.from(historyItems).indexOf(b);
                });


                const wrapper = document.createElement('div');
                wrapper.className = 'topic-group';


                const topicHeader = document.createElement('div');
                topicHeader.className = 'topic-header';



                const isNewFormat = topicId.startsWith('T-');
                const displayTopicId = isNewFormat ? topicId : (
                    topicId.length > 8 ? topicId.substring(topicId.length - 8) : topicId
                );

                topicHeader.innerHTML = `
                    <span class="topic-label">Topic Group</span>
                    <span class="topic-id" title="Topic ID: ${topicId}">${isNewFormat ? displayTopicId : '#' + displayTopicId}</span>
                    <span class="conversation-count">${group.length} conversations</span>
                    <span class="topic-tip">Shift+Click to continue in this topic</span>
                `;


                topicHeader.addEventListener('click', () => {

                    const firstConvItem = wrapper.querySelector('.history-item .history-content');
                    if (firstConvItem) {

                        firstConvItem.click();
                    }
                });

                wrapper.appendChild(topicHeader);


                const firstItem = group[0];
                firstItem.parentNode.insertBefore(wrapper, firstItem);


                group.forEach(item => {
                    wrapper.appendChild(item);
                });
            }
        });
    }


    function addConversationEventListeners(convItem, conv) {

        const historyContent = convItem.querySelector('.history-content');
        if (!historyContent) return;

        historyContent.addEventListener('click', (e) => {
            console.log("Loading conversation:", conv);


            if (e.shiftKey) {
                console.log("Shift+Click detected - continuing conversation in topic:", conv.topic_id);


                if (conv.topic_id) {
                    chatHistoryService.currentTopicId = conv.topic_id;

                    sessionStorage.setItem('currentTopicId', conv.topic_id);
                    console.log("Set current topic ID to:", chatHistoryService.currentTopicId);
                }


                document.dispatchEvent(new CustomEvent('continueConversation', {
                    detail: { conversationId: conv.id, conversation: conv }
                }));
            } else {

                loadConversation(conv);
            }
        });


        const deleteBtn = convItem.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log("Deleting conversation with ID:", conv.id);
                if (confirm('Are you sure you want to delete this conversation?')) {
                    deleteConversation(conv.id);
                }
            });
        }
    }
    function startNewConversation() {

        currentConversation = null;


        sessionStorage.setItem('startedNewChat', 'true');


        const newTopicId = chatHistoryService.startNewTopic();
        console.log("Started a new topic:", newTopicId);


        if (newTopicId) {
            sessionStorage.setItem('currentTopicId', newTopicId);
            console.log("Saved new topic ID to session storage:", newTopicId);
        } else {
            console.warn("Failed to generate new topic ID!");
        }


        if (experience) {
            experience.startNewConversation();


            chatBox.innerHTML = '';


            document.querySelectorAll('.history-item').forEach(item => {
                item.classList.remove('active');
            });


            updateChatHistory();


            const welcomeMsg = document.createElement('div');
            welcomeMsg.className = 'message';
            welcomeMsg.textContent = 'Start a new conversation. How can I help you today?';
            chatBox.appendChild(welcomeMsg);
            console.log("Started new conversation with topic ID:", newTopicId);
        }
    }


    async function loadConversation(conversation) {
        currentConversation = conversation;


        chatBox.innerHTML = '';
        showLoadingIndicator();

        try {

            if (experience && conversation && conversation.id) {
                const success = await experience.loadConversation(conversation.id);
                if (!success) {
                    throw new Error('Failed to load conversation');
                }


                const messages = await chatHistoryService.getMessages(conversation.id);
                console.log("Retrieved messages for conversation:", messages);

                if (messages && messages.length > 0) {
                    console.log(`Displaying ${messages.length} messages in conversation ${conversation.id}`);


                    chatBox.innerHTML = '';


                    messages.forEach(msg => {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = msg.is_user ? 'message user' : 'message';
                        messageDiv.textContent = msg.content;
                        chatBox.appendChild(messageDiv);
                        console.log(`Added message to UI: ${msg.is_user ? 'User' : 'AI'}: ${msg.content.substring(0, 30)}...`);
                    });


                    chatBox.scrollTop = chatBox.scrollHeight;


                    console.log(`Successfully loaded conversation ${conversation.id} with ${messages.length} messages`);
                } else {
                    console.warn(`No messages found for conversation ${conversation.id}`);

                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'message system';
                    emptyDiv.textContent = 'This conversation has no messages yet. Start typing to begin!';
                    chatBox.appendChild(emptyDiv);
                }
            }


            document.querySelectorAll('.history-item').forEach(item => {
                item.classList.remove('active');
                if (item.querySelector(`[data-id="${conversation.id}"]`)) {
                    item.classList.add('active');
                } else if (item.querySelector('.history-title') &&
                    item.querySelector('.history-title').textContent === conversation.title) {
                    item.classList.add('active');
                }
            });


            hideLoadingIndicator();

        } catch (error) {
            console.error('Error loading conversation:', error);
            hideLoadingIndicator();


            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.textContent = "Couldn't load this conversation. Please try again.";
            chatBox.appendChild(errorDiv);
        }
    }


    async function createNewConversation(firstMessage) {
        try {
            if (!currentUser) return;

            const title = firstMessage.length > 20
                ? `${firstMessage.substring(0, 20)}...`
                : firstMessage;


            const startedNewChat = sessionStorage.getItem('startedNewChat') === 'true';


            let topicId = chatHistoryService.currentTopicId || sessionStorage.getItem('currentTopicId');

            if (startedNewChat || !topicId) {

                topicId = chatHistoryService.startNewTopic();
                console.log("Created new topic ID for conversation:", topicId);


                if (topicId) {
                    sessionStorage.setItem('currentTopicId', topicId);
                }

                sessionStorage.removeItem('startedNewChat');
            } else {
                console.log("Using existing topic ID for conversation:", topicId);
            }


            if (!topicId) {
                console.warn("No topic ID available, generating a new one as fallback");
                topicId = chatHistoryService.generateTopicId();
                chatHistoryService.currentTopicId = topicId;
                sessionStorage.setItem('currentTopicId', topicId);
            }

            const conversation = await chatHistoryService.createConversation(currentUser.uid, title, topicId);
            currentConversation = conversation;


            if (!currentConversation.topic_id) {
                currentConversation.topic_id = topicId;
            }


            updateChatHistory();

            return conversation;
        } catch (error) {
            console.error('Error creating conversation:', error);
            return null;
        }
    }


    function deleteConversation(conversationId) {
        chatHistoryService.deleteConversation(conversationId)
            .then(() => {
                if (currentConversation && currentConversation.id === conversationId) {
                    currentConversation = null;
                    chatBox.innerHTML = '';
                }
                updateChatHistory();
            })
            .catch(error => {
                console.error('Error deleting conversation:', error);
            });
    }


    async function sendMessage(message) {
        if (!message.trim()) return;

        if (!currentUser) return;

        try {

            const startedNewChat = sessionStorage.getItem('startedNewChat') === 'true';



            if (!startedNewChat && currentConversation) {
                console.log("Continuing with existing conversation:", currentConversation.id);


                if (currentConversation.topic_id) {

                    chatHistoryService.currentTopicId = currentConversation.topic_id;
                    sessionStorage.setItem('currentTopicId', currentConversation.topic_id);
                    console.log("Synced topic ID for existing conversation:", currentConversation.topic_id);
                }
            } else {

                sessionStorage.removeItem('startedNewChat');
                console.log("Will create new conversation for this message");


                const currentTopicId = chatHistoryService.currentTopicId || sessionStorage.getItem('currentTopicId');
                if (!currentTopicId) {

                    const newTopicId = chatHistoryService.startNewTopic();
                    sessionStorage.setItem('currentTopicId', newTopicId);
                    console.log("Generated new topic ID before creating conversation:", newTopicId);
                }
            }


            appendMessage(message, true);


            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'typing-indicator';
            loadingDiv.innerHTML = '<span></span><span></span><span></span>';
            chatBox.appendChild(loadingDiv);
            chatBox.scrollTop = chatBox.scrollHeight;



            const aiResponse = await experience.sendMessage(message);


            if (loadingDiv && loadingDiv.parentNode === chatBox) {
                chatBox.removeChild(loadingDiv);
            }


            appendMessage(aiResponse, false);


            updateChatHistory();


            const currentConversationId = experience.getCurrentConversationId();
            if (currentConversationId && (!currentConversation || currentConversation.id !== currentConversationId)) {

                const conversations = await chatHistoryService.getConversations(currentUser.uid);
                currentConversation = conversations.find(c => c.id === currentConversationId);
            }

            console.log("AI response saved successfully:", true);
            updateChatHistory();

        } catch (error) {
            console.error('Error sending message:', error);


            if (loadingDiv && loadingDiv.parentNode === chatBox) {
                chatBox.removeChild(loadingDiv);
            }


            appendMessage("I'm sorry, I couldn't process your request at the moment.", false);
        }
    }


    function appendMessage(content, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = isUser ? 'message user' : 'message';
        messageDiv.textContent = content;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }


    async function searchConversations(searchTerm) {
        if (!searchTerm.trim() || !currentUser) {
            updateChatHistory();
            return;
        }

        try {

            const searchContainer = document.querySelector('.search-container');
            searchContainer.classList.add('searching', 'active');


            historyList.innerHTML = '<div class="loading-history">Searching...</div>';


            const searchResults = await experience.chatService.searchChatHistory(searchTerm);


            historyList.innerHTML = '';


            searchContainer.classList.remove('searching');

            if (searchResults.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-history';
                emptyMsg.innerHTML = `
                    <p>No results found for "${searchTerm}"</p>
                    <button id="clear-search">Clear Search</button>
                `;
                historyList.appendChild(emptyMsg);

                document.getElementById('clear-search').addEventListener('click', clearSearch);
                return;
            }


            searchResults.forEach(result => {
                const convItem = document.createElement('div');
                convItem.className = 'history-item';
                if (currentConversation && currentConversation.id === result.id) {
                    convItem.classList.add('active');
                }


                const date = new Date(result.messages[0].timestamp);
                const formattedDate = date.toLocaleDateString();


                const messageExcerpts = result.messages.slice(0, 2).map(msg => {
                    let content = msg.content;
                    if (content.length > 60) {
                        content = content.substring(0, 60) + '...';
                    }

                    content = content.replace(
                        new RegExp(searchTerm, 'gi'),
                        match => `<span class="search-highlight">${match}</span>`
                    );
                    return `<div class="message-excerpt ${msg.is_user ? 'user' : ''}">
                        ${content}
                    </div>`;
                }).join('');

                convItem.innerHTML = `
                    <div class="history-content">
                        <span class="history-title">${result.title}</span>
                        <span class="history-date">${formattedDate}</span>
                        <div class="search-results">
                            ${messageExcerpts}
                        </div>
                    </div>
                    <button class="delete-btn" data-id="${result.id}">&times;</button>
                `;


                convItem.querySelector('.history-content').addEventListener('click', () => {

                    loadConversation({ id: result.id, title: result.title });
                    clearSearch();
                });


                convItem.querySelector('.delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this conversation?')) {
                        deleteConversation(result.id);
                    }
                });

                historyList.appendChild(convItem);
            });
        } catch (error) {
            console.error('Error searching conversations:', error);
            historyList.innerHTML = '<div class="error-message">Error searching conversations</div>';
        }
    }


    const searchInput = document.getElementById('history-search');
    const searchBtn = document.getElementById('search-btn');

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchConversations(searchInput.value);
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchConversations(searchInput.value);
        });
    }


    if (sendButton && chatInput) {
        sendButton.addEventListener('click', () => {
            const message = chatInput.value;
            if (message.trim()) {
                sendMessage(message);
                chatInput.value = '';
            }
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const message = chatInput.value;
                if (message.trim()) {
                    sendMessage(message);
                    chatInput.value = '';
                }
            }
        });
    }


    const newConvButton = document.createElement('button');
    newConvButton.id = 'new-conversation';
    newConvButton.textContent = 'New Chat';
    newConvButton.className = 'new-conversation-btn';
    document.getElementById('sidebar').prepend(newConvButton);

    newConvButton.addEventListener('click', () => {
        startNewConversation();
    });


    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log("User authenticated in chatbot.js:", user.uid);


            const userInfo = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0]
            };


            try {
                sessionStorage.setItem("currentUser", JSON.stringify(userInfo));
                console.log("User info stored in session storage successfully");
            } catch (storageError) {
                console.error("Failed to store user info in session storage:", storageError);
            }


            try {
                const storedUserJson = sessionStorage.getItem('currentUser');
                if (storedUserJson) {
                    console.log("Verified user data in session storage");
                } else {
                    console.warn("Failed to verify user data in session storage");
                }
            } catch (error) {
                console.error("Error verifying user data:", error);
            }

            console.log("Loading chat history immediately after authentication");

            setTimeout(() => {
                updateChatHistory();
            }, 500);


            if (experience && experience.chatService) {

                console.log("Running debug auth state check...");
                const authState = experience.chatService.debugAuthState();
                console.log("Auth state debug result:", authState ? "Authenticated" : "Not authenticated");
            } else {
                console.warn("Experience or chatService not available for authentication check");
            }


            console.log("Forcing update of chat history for user:", user.uid);
            updateChatHistory();


            updateChatHistory();


            if (experience && experience.getCurrentConversationId()) {

                chatHistoryService.getConversations(user.uid).then(conversations => {
                    const conversationId = experience.getCurrentConversationId();
                    currentConversation = conversations.find(c => c.id === conversationId);

                    if (!currentConversation) {
                        console.warn("Could not find conversation with ID:", conversationId);

                        appendMessage(`Welcome back, ${userInfo.displayName}! How can I help you today?`, false);
                    } else {
                        console.log("Loaded existing conversation:", currentConversation.title);


                        loadConversation(currentConversation);
                    }
                }).catch(error => {
                    console.error("Failed to load conversations:", error);

                    appendMessage(`Welcome back, ${userInfo.displayName}! How can I help you today?`, false);
                });
            } else {

                appendMessage(`Welcome back, ${userInfo.displayName}! How can I help you today?`, false);
            }
        } else {
            console.warn("No authenticated user found");
            sessionStorage.removeItem('currentUser');
            window.location.href = '/index.html';
        }
    });


    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            signOut(auth).then(() => {
                window.location.href = '/index.html';
            }).catch((error) => {
                alert("Error: " + error.message);
            });
        });
    }

    /**
     * Shows a loading indicator in the chat box
     */
    function showLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'typing-indicator';
        loadingDiv.id = 'loading-indicator';
        loadingDiv.innerHTML = '<span></span><span></span><span></span>';
        chatBox.appendChild(loadingDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    /**
     * Removes the loading indicator from the chat box
     */
    function hideLoadingIndicator() {
        const loadingDiv = document.getElementById('loading-indicator');
        if (loadingDiv && loadingDiv.parentNode === chatBox) {
            chatBox.removeChild(loadingDiv);
        }
    }

    /**
     * Shows a notification message that fades out
     * @param {string} message 
     * @param {string} type 
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;


        document.body.appendChild(notification);


        setTimeout(() => {
            notification.classList.add('show');
        }, 10);


        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 500);
        }, 4000);
    }

    /**
     * Clears the search state and updates the chat history
     */
    function clearSearch() {
        const searchInput = document.getElementById('history-search');
        if (searchInput) {
            searchInput.value = '';
        }

        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.classList.remove('searching', 'active');
        }

        updateChatHistory();
    }
});
