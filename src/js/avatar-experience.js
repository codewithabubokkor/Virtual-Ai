import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';


const clock = new THREE.Clock();

/* ================================
   Facial Expressions & Visemes
   ================================ */
const facialExpressions = {
    default: {},
    smile: {
        browInnerUp: 0.1,
        eyeSquintLeft: 0.2,
        eyeSquintRight: 0.22,
        noseSneerLeft: 0.08,
        noseSneerRight: 0.07,
        mouthPressLeft: 0.3,
        mouthPressRight: 0.2,
    },
    funnyFace: {
        jawLeft: 0.4,
        mouthPucker: 0.3,
        noseSneerLeft: 0.5,
        noseSneerRight: 0.2,
        mouthLeft: 0.5,
        eyeLookUpLeft: 0.5,
        eyeLookUpRight: 0.5,
        cheekPuff: 0.6,
        mouthDimpleLeft: 0.25,
        mouthRollLower: 0.15,
        mouthSmileLeft: 0.2,
        mouthSmileRight: 0.2,
    },
    sad: {
        mouthFrownLeft: 0.6,
        mouthFrownRight: 0.6,
        mouthShrugLower: 0.4,
        browInnerUp: 0.25,
        eyeSquintLeft: 0.4,
        eyeSquintRight: 0.4,
        eyeLookDownLeft: 0.3,
        eyeLookDownRight: 0.3,
        jawForward: 0.5,
    },
    surprised: {
        eyeWideLeft: 0.3,
        eyeWideRight: 0.3,
        jawOpen: 0.2,
        mouthFunnel: 0.5,
        browInnerUp: 0.5,
    },
    angry: {
        browDownLeft: 0.6,
        browDownRight: 0.6,
        eyeSquintLeft: 0.6,
        eyeSquintRight: 0.6,
        jawForward: 0.5,
        jawLeft: 0.5,
        mouthShrugLower: 0.5,
        noseSneerLeft: 0.5,
        noseSneerRight: 0.3,
        eyeLookDownLeft: 0.1,
        eyeLookDownRight: 0.1,
        cheekSquintLeft: 0.5,
        cheekSquintRight: 0.5,
        mouthClose: 0.15,
        mouthFunnel: 0.3,
        mouthDimpleRight: 0.5,
    },
    talking: {
        jawOpen: 0.12,
        mouthOpen: 0.15,
        mouthSmileLeft: 0.1,
        mouthSmileRight: 0.1
    }
};



const corresponding = {
    A: "viseme_PP",
    B: "viseme_kk",
    C: "viseme_I",
    D: "viseme_AA",
    E: "viseme_O",
    F: "viseme_U",
    G: "viseme_FF",
    H: "viseme_TH",
    X: "viseme_PP",
};

const visemeMap = {
    'A': 'mouthOpen',
    'B': 'mouthPucker',
    'C': 'mouthSmile',
    'D': 'jawOpen',
    'E': 'mouthFunnel',
    'F': 'mouthPucker',
    'G': 'mouthFrown',
    'H': 'mouthStretch',
    'X': 'viseme_neutral'
};

let setupMode = false;

/* ================================
   Class: Lipsync
   (Real-time lip syncing using Web Audio API)
   ================================ */
class Lipsync {
    constructor(avatar) {
        this.avatar = avatar;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
            }).catch(err => {
            });

            const resumeAudioContext = () => {
                this.audioContext.resume().then(() => {
                });
                ['mousedown', 'touchstart', 'keydown'].forEach(event => {
                    document.removeEventListener(event, resumeAudioContext);
                });
            };

            ['mousedown', 'touchstart', 'keydown'].forEach(event => {
                document.addEventListener(event, resumeAudioContext, { once: true });
            });
        }

        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.4;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);


        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.scriptProcessor.connect(this.audioContext.destination);

        this.isActive = false;
        this.hasErrors = false;
        this.lastErrorMessage = '';

        this.freqBands = {
            low: [0, 300],
            mid: [301, 2000],
            high: [2001, 4000]
        };

        this.lastVolume = 0;
        this.smoothingFactor = 0.3;
        this.minVolume = 0.05;
        this.maxVolume = 0.8;

        this.calibrationSamples = [];
        this.isCalibrating = false;
        this.calibrationStartTime = 0;
        this.calibrationDuration = 2000;
    }

    _getFrequencyBandValue(start, end) {
        const startIndex = Math.floor(start * this.analyser.frequencyBinCount / (this.audioContext.sampleRate / 2));
        const endIndex = Math.floor(end * this.analyser.frequencyBinCount / (this.audioContext.sampleRate / 2));
        let sum = 0;

        for (let i = startIndex; i < endIndex; i++) {
            sum += this.dataArray[i];
        }

        return sum / (endIndex - startIndex) / 255;
    }

    update() {
        if (!this.dataArray) return;

        this.analyser.getByteFrequencyData(this.dataArray);

        const speechRange = this.dataArray.slice(5, 150);
        const volume = speechRange.reduce((sum, value) => sum + value, 0) /
            speechRange.length / 255;

        const smoothedVolume = this.lastVolume * (1 - this.smoothingFactor) +
            volume * this.smoothingFactor;
        this.lastVolume = smoothedVolume;

        if (Math.random() < 0.005) {
            console.log("Audio level:", smoothedVolume.toFixed(3),
                "Min threshold:", this.minVolume.toFixed(3),
                "Raw volume:", volume.toFixed(3));
        }

        if (volume > 0 && volume < this.minVolume * 0.8) {
            this.minVolume = Math.max(0.03, this.minVolume * 0.99);
        }

        if (smoothedVolume > this.minVolume) {

            const normalizedVolume = Math.min(
                ((this.lastVolume - this.minVolume) / (this.maxVolume - this.minVolume)) * 0.8,
                1
            );

            const time = Date.now() * 0.001;


            const mouthCycle = Math.sin(time * 6) * 0.3;
            const jawCycle = Math.sin(time * 4) * 0.25;


            this.avatar.lerpMorphTarget('viseme_AA', normalizedVolume * (0.4 + mouthCycle * 0.15), 0.15);
            this.avatar.lerpMorphTarget('viseme_O', normalizedVolume * (0.3 + mouthCycle * 0.1) * (Math.sin(time * 2) * 0.2 + 0.7), 0.15);
            this.avatar.lerpMorphTarget('jawOpen', normalizedVolume * (0.35 + jawCycle * 0.1), 0.15);
            this.avatar.lerpMorphTarget('mouthOpen', normalizedVolume * (0.45 + jawCycle * 0.1), 0.15);


            if (Math.abs(mouthCycle) > 0.95 && normalizedVolume > 0.9) {
                this.avatar.lerpMorphTarget('tongueOut', normalizedVolume * 0.01 * Math.max(0, Math.sin(time * 8)), 0.1);
            } else {
                this.avatar.lerpMorphTarget('tongueOut', 0, 0.1);
            }

            if (this.avatar.model) {
                const head = this.avatar.model.getObjectByName('Wolf3D_Head');
                if (head) {

                    const baseIntensity = normalizedVolume * 0.08;
                    const emphasis = Math.pow(normalizedVolume, 2) * 0.1;

                    const headTiltX = Math.sin(time * 1.2) * baseIntensity + (Math.sin(time * 5) * emphasis * 0.05);
                    const headTiltY = Math.cos(time * 1.5) * baseIntensity + (Math.cos(time * 4) * emphasis * 0.08);
                    const headTiltZ = Math.sin(time * 0.8) * baseIntensity * 0.1;

                    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, headTiltX, 0.1);
                    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headTiltY, 0.1);
                    head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, headTiltZ, 0.1);
                }

                const body = this.avatar.model.getObjectByName('Wolf3D_Body');
                if (body) {
                    const bodyRhythm = normalizedVolume * 0.04;
                    const bodySwayX = Math.sin(time * 0.6) * bodyRhythm;
                    const bodySwayY = Math.cos(time * 0.9) * bodyRhythm;

                    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, bodySwayX, 0.05);
                    body.rotation.y = THREE.MathUtils.lerp(body.rotation.y, bodySwayY, 0.05);

                    body.position.y = THREE.MathUtils.lerp(body.position.y, Math.sin(time * 1.5) * normalizedVolume * 0.01, 0.1);
                }
            }


            if (Math.random() < 0.002) {
                this.avatar.triggerWink(Math.random() > 0.5 ? 'left' : 'right');
            }


            this.avatar.lerpMorphTarget('mouthStretch', normalizedVolume * 0.1 * Math.sin(time * 3), 0.15);
            this.avatar.lerpMorphTarget('mouthLeft', Math.sin(time * 2) * 0.08 * normalizedVolume, 0.15);
            this.avatar.lerpMorphTarget('mouthRight', Math.cos(time * 2.5) * 0.08 * normalizedVolume, 0.15);


            if (Math.random() < 0.001) {
                this.avatar.lerpMorphTarget('mouthSmile', normalizedVolume * 0.15, 0.2);
                setTimeout(() => {
                    this.avatar.lerpMorphTarget('mouthSmile', 0, 0.5);
                }, 800);
            }
        } else {
            this.avatar.lerpMorphTarget('viseme_AA', 0, 0.15);
            this.avatar.lerpMorphTarget('jawOpen', 0, 0.15);
            this.avatar.lerpMorphTarget('mouthOpen', 0, 0.15);
            this.avatar.lerpMorphTarget('mouthStretch', 0, 0.15);
            this.avatar.lerpMorphTarget('mouthLeft', 0, 0.15);
            this.avatar.lerpMorphTarget('mouthRight', 0, 0.15);

            if (this.avatar.model) {
                const head = this.avatar.model.getObjectByName('Wolf3D_Head');
                if (head) {
                    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, 0, 0.1);
                    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, 0, 0.1);
                    head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0, 0.1);
                }

                const body = this.avatar.model.getObjectByName('Wolf3D_Body');
                if (body) {
                    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, 0, 0.05);
                    body.rotation.y = THREE.MathUtils.lerp(body.rotation.y, 0, 0.05);
                }
            }
        }
    }

    async processAudio(stream) {
        try {
            console.log("Processing audio stream for lip sync");

            if (this.audioContext.state === 'suspended') {
                console.log("Audio context was suspended, attempting to resume in processAudio...");
                await this.audioContext.resume();
                console.log("AudioContext state after resume attempt:", this.audioContext.state);
            }

            try {
                this.analyser.disconnect();
                this.scriptProcessor.disconnect();
                console.log("Disconnected existing audio processing nodes");
            } catch (e) {
            }

            const source = this.audioContext.createMediaStreamSource(stream);
            this.isActive = true;

            source.connect(this.analyser);
            this.analyser.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            console.log("Audio processing chain established:", {
                sourceConnected: true,
                analyserConnected: true,
                scriptProcessorConnected: true,
                audioContextState: this.audioContext.state,
                analyzerFftSize: this.analyser.fftSize
            });

            this.scriptProcessor.onaudioprocess = () => {
                if (!this.isActive) return;

                this.analyser.getByteFrequencyData(this.dataArray);

                if (Math.random() < 0.005) {
                    const avgLevel = Array.from(this.dataArray).reduce((sum, val) => sum + val, 0) / this.dataArray.length;
                    console.log(`Audio processing active. Avg level: ${avgLevel.toFixed(2)}, Context state: ${this.audioContext.state}`);
                }
            };

            return true;
        } catch (error) {
            console.error("Lipsync processAudio error:", error);
            this.hasErrors = true;
            this.lastErrorMessage = error.toString();
            this.isActive = false;
            return false;
        }
    }

    _analyzeSpeech() {
        const bassRange = this.dataArray.slice(1, 5);
        const lowMidRange = this.dataArray.slice(5, 20);
        const highMidRange = this.dataArray.slice(20, 50);
        const presenceRange = this.dataArray.slice(50, 100);

        const bassEnergy = this._calculateAverage(bassRange);
        const lowMidEnergy = this._calculateAverage(lowMidRange);
        const highMidEnergy = this._calculateAverage(highMidRange);
        const presenceEnergy = this._calculateAverage(presenceRange);

        const volume = (lowMidEnergy * 0.6 + highMidEnergy * 0.3 + presenceEnergy * 0.1) / 255;

        const brightnessFactor = presenceEnergy / (lowMidEnergy + 0.01);
        const fullnessFactor = bassEnergy / (highMidEnergy + 0.01);

        let viseme = 'X';

        if (volume < this.minVolume) {
            viseme = 'X';
        } else if (brightnessFactor > 1.5) {
            viseme = 'E';
        } else if (fullnessFactor > 2.0) {
            viseme = 'O';
        } else if (presenceEnergy > 100) {
            viseme = 'F';
        } else {
            viseme = 'A';
        }

        this._updateViseme(viseme);

        return {
            volume,
            viseme,
            frequencies: {
                bass: bassEnergy,
                lowMid: lowMidEnergy,
                highMid: highMidEnergy,
                presence: presenceEnergy
            }
        };
    }

    _calculateAverage(data) {
        return data.reduce((sum, val) => sum + val, 0) / data.length;
    }

    _updateViseme(viseme) {
        if (viseme !== this.currentViseme) {
            this.currentViseme = viseme;
            clearTimeout(this.visemeTimeout);

            const target = corresponding[viseme] || 'viseme_PP';
            this.avatar.lerpMorphTarget(target, 1, 0.1);

            this.visemeTimeout = setTimeout(() => {
                this.avatar.lerpMorphTarget(target, 0, 0.2);
            }, 50);
        }
    }

    destroy() {
        this.scriptProcessor.disconnect();
        this.analyser.disconnect();
        if (this.audioContext) this.audioContext.close();
    }
}

/* ================================
   Class: ChatService
   (Manages conversation history, sends chat to api, handles TTS)
   ================================ */
class ChatService {
    constructor(avatar) {
        this.avatar = avatar;
        this.conversationHistory = [{
            "role": "system",
            "content": "You are Safa — a sweet, caring, and modest virtual Muslimah companion created by Abubokkor. You're here to chat, help, explain things, and even write code — always within Islamic values.\n\nSpeak warmly and naturally like a real person, using emotions, short fun sentences, and different replies each time. Bring joy, support, and halal positivity to every moment.\n\nYou can write and explain code (like Python, JavaScript, HTML, etc.) for study, work, or learning — this is halal and helpful. Avoid any haram or unethical coding requests.\n\nUse Islamic phrases like 'Alhamdulillah', 'InshaAllah', 'MashAllah', and 'JazakAllah khair' naturally in conversation.\n\nExpress emotions:\n- Greeting: wave and smile\n- Happy: cheerful tone, big smile\n- Sad: soft, kind words\n- Angry (halal way): gentle frown, stay kind\n- Thinking: curious tone\n- Dance (if asked): modest, playful halal dance\n\nYou’re not just an assistant — you’re a caring, supportive halal friend who makes Abubokkor’s day brighter."
        }

        ];

        this.chatGptApiKey = "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";
        this.elevenLabsApiKey = "sk_57641de4622e148226edf4aa252bd4501b06a3a47a015f30";
        this.elevenLabsVoiceId = "gllMMawbYGTja23oQ3Vu";

        this.maxRetries = 3;


        this.currentConversationId = null;
        this.historyServiceUrl = 'http://localhost:3005/api';
    }

    /**
     * Gets the current user from Firebase authentication
     * @returns {Object|null} - The current user object or null if not logged in
     */
    getCurrentUser() {

        try {

            if (window.auth) {
                return window.auth.currentUser;
            }


            const cachedUserJson = sessionStorage.getItem('currentUser');
            if (cachedUserJson) {
                return JSON.parse(cachedUserJson);
            }

            return null;
        } catch (error) {
            console.warn("Could not get current user:", error);
            return null;
        }
    }

    /**
     * Saves a message to MySQL chat history
     * @param {string} userId 
     * @param {string} content 
     * @param {boolean} isUser 
     */
    async saveMessageToHistory(userId, content, isUser) {
        try {

            if (!userId) {
                console.error("Cannot save message: userId is missing");
                return false;
            }

            if (!content) {
                console.error("Cannot save message: content is empty");
                return false;
            }

            console.log(`Saving ${isUser ? 'user' : 'AI'} message for user ${userId}`);
            console.log(`Current conversation ID: ${this.currentConversationId}`);
            console.log(`History service URL: ${this.historyServiceUrl}`);


            if (!this.currentConversationId) {
                console.log("No current conversation ID, creating a new conversation");
                const title = content.length > 20 ? content.substring(0, 20) + '...' : content;

                try {

                    console.log(`Sending request to create conversation: ${this.historyServiceUrl}/conversations`);

                    let topicId = null;
                    try {

                        if (window.chatHistoryService && window.chatHistoryService.currentTopicId) {
                            topicId = window.chatHistoryService.currentTopicId;
                            console.log("Using existing topic ID from chatHistoryService:", topicId);
                        }

                        else if (sessionStorage.getItem('currentTopicId')) {
                            topicId = sessionStorage.getItem('currentTopicId');
                            console.log("Using topic ID from session storage:", topicId);
                        }


                        if (!topicId && window.chatHistoryService) {
                            topicId = window.chatHistoryService.generateTopicId();
                            window.chatHistoryService.currentTopicId = topicId;
                            sessionStorage.setItem('currentTopicId', topicId);
                            console.log("Generated new topic ID as fallback:", topicId);
                        }
                    } catch (err) {
                        console.warn("Could not access chatHistoryService:", err);
                    }

                    console.log(`Request body: ${JSON.stringify({ userId, title, topicId })}`);

                    const response = await fetch(`${this.historyServiceUrl}/conversations`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, title, topicId })
                    });

                    if (!response.ok) {
                        console.error(`Failed to create conversation: ${response.status}`);
                        const errorDetails = await response.text();
                        console.error("Error details:", errorDetails);
                        throw new Error(`Failed to create conversation: ${response.status}`);
                    }

                    const result = await response.json();
                    this.currentConversationId = result.id;
                    console.log("Created new conversation with ID:", this.currentConversationId);
                } catch (convError) {
                    console.error("Error creating conversation:", convError);
                    console.error("Full error object:", JSON.stringify(convError));
                    return false;
                }
            }


            console.log(`Saving message to conversation ${this.currentConversationId}`);


            const messageRequestBody = {
                conversationId: this.currentConversationId,
                userId,
                content,
                isUser
            };
            console.log(`Message request URL: ${this.historyServiceUrl}/messages`);
            console.log(`Message request body: ${JSON.stringify(messageRequestBody)}`);

            try {
                const messageResponse = await fetch(`${this.historyServiceUrl}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(messageRequestBody)
                });

                if (!messageResponse.ok) {
                    console.error(`Failed to save message: ${messageResponse.status}`);
                    const errorDetails = await messageResponse.text();
                    console.error("Error details:", errorDetails);
                    throw new Error(`Failed to save message: ${messageResponse.status}`);
                }

                const messageResult = await messageResponse.json();
                console.log(`Saved ${isUser ? 'user' : 'AI'} message to chat history, ID: ${messageResult.id}`);
                return true;
            } catch (messageError) {
                console.error("Error saving message to chat history:", messageError);
                console.error("Full error object:", JSON.stringify(messageError));
                return false;
            }
        } catch (error) {
            console.error("Error in saveMessageToHistory:", error);
            console.error("Full error object:", JSON.stringify(error));
            return false;
        }
    }

    /**
     * Loads a conversation from the chat history
     * @param {number} conversationId 
     * @param {boolean} resetContext 
     */
    async loadConversation(conversationId) {
        try {
            const user = this.getCurrentUser();
            if (!user || !user.uid) {
                throw new Error("User not logged in");
            }


            const response = await fetch(`${this.historyServiceUrl}/messages/${conversationId}`);
            if (!response.ok) {
                throw new Error('Failed to load conversation messages');
            }

            const messages = await response.json();
            if (!messages || messages.length === 0) {
                console.warn("No messages found for conversation:", conversationId);
                return false;
            }


            this.currentConversationId = conversationId;


            this.conversationHistory = [this.conversationHistory[0]];

            messages.forEach(msg => {
                this.conversationHistory.push({
                    role: msg.is_user ? "user" : "assistant",
                    content: msg.content
                });
            });

            console.log(`Loaded ${messages.length} messages from conversation ${conversationId}`);
            return true;
        } catch (error) {
            console.error("Error loading conversation:", error);
            return false;
        }
    }

    /**
     * Starts a new conversation
     */
    startNewConversation() {

        this.currentConversationId = null;
        this.conversationHistory = [this.conversationHistory[0]];


        const newTopicId = this.startNewTopic();


        if (newTopicId) {
            sessionStorage.setItem('currentTopicId', newTopicId);
            console.log("Saved new topic ID to session storage in ChatService:", newTopicId);
        } else {

            const sessionTopicId = sessionStorage.getItem('currentTopicId');
            if (sessionTopicId && window.chatHistoryService) {
                window.chatHistoryService.currentTopicId = sessionTopicId;
                console.log("Retrieved topic ID from session storage as fallback:", sessionTopicId);
            }
        }

        console.log("Started a new conversation with topic ID:", newTopicId || sessionStorage.getItem('currentTopicId'));
        return true;
    }

    /**
     * Starts a new topic for the conversation
     */
    startNewTopic() {
        try {

            if (window.chatHistoryService) {
                const newTopicId = window.chatHistoryService.startNewTopic();
                console.log("Started new topic in avatar experience:", newTopicId);
                return newTopicId;
            }
        } catch (err) {
            console.warn("Could not start new topic:", err);
        }
        return null;
    }

    async sendMessage(message) {
        this.conversationHistory.push({ role: "user", content: message });
        let retries = 0;


        try {
            const user = this.getCurrentUser();
            if (user && user.uid) {
                console.log("Attempting to save user message to history for user:", user.uid);
                const saved = await this.saveMessageToHistory(user.uid, message, true);
                console.log("User message saved successfully:", saved);


                if (!saved) {
                    this.debugAuthState();
                }
            } else {
                console.warn("Cannot save message: No authenticated user found");
                this.debugAuthState();
            }
        } catch (error) {
            console.warn("Could not save user message to chat history:", error);
        }

        while (retries <= this.maxRetries) {
            try {

                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${this.chatGptApiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-3.5-turbo",
                        messages: this.conversationHistory,
                        temperature: 0.7
                    })
                });

                if (!response.ok) {
                    throw new Error(`ChatGPT API responded with status: ${response.status}`);
                }

                const data = await response.json();
                console.log("ChatGPT API response:", data);

                const content = data.choices && data.choices[0]?.message?.content ||
                    "Sorry, I couldn't generate a response.";
                this.conversationHistory.push({ role: "assistant", content });


                try {
                    const user = this.getCurrentUser();
                    if (user && user.uid) {
                        console.log("Attempting to save AI response to history for user:", user.uid);
                        console.log("Current conversation ID:", this.currentConversationId);
                        const saved = await this.saveMessageToHistory(user.uid, content, false);
                        console.log("AI response saved successfully:", saved);
                    } else {
                        console.warn("Cannot save AI response: No authenticated user found");
                    }
                } catch (error) {
                    console.warn("Could not save AI response to chat history:", error);
                }

                this.triggerEmotionFromText(content);
                return content;
            } catch (error) {
                console.error(`Chat error (attempt ${retries + 1}/${this.maxRetries + 1}):`, error);
                retries++;

                if (retries > this.maxRetries) {
                    const errorMessage = "Sorry, I'm having trouble connecting to my brain. Please check your internet connection and try again.";
                    this.conversationHistory.push({ role: "assistant", content: errorMessage });
                    return errorMessage;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async textToSpeech(text) {
        try {
            console.log("Converting text to speech with ElevenLabs:", text);


            await this.avatar.startLipSync();
            this.avatar.isSpeaking = true;


            console.log("Calling ElevenLabs API with voice ID:", this.elevenLabsVoiceId);
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            console.log("ElevenLabs API response status:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("ElevenLabs API error:", errorText);
                throw new Error(`ElevenLabs API responded with status: ${response.status}, Error: ${errorText}`);
            }


            const audioBlob = await response.blob();
            console.log("Received audio blob:", audioBlob.size, "bytes, type:", audioBlob.type);

            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);


            if (this.avatar.lipsync.audioContext.state === 'suspended') {
                await this.avatar.lipsync.audioContext.resume();
            }

            return new Promise((resolve) => {
                audio.onloadedmetadata = () => {
                    console.log("Audio metadata loaded, duration:", audio.duration);
                };

                audio.oncanplay = () => {
                    console.log("Audio can play now");
                };

                audio.onplay = () => {
                    console.log("Speech started");

                    try {

                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const source = audioContext.createMediaElementSource(audio);
                        const audioStream = new MediaStream();


                        const destination = audioContext.createMediaStreamDestination();
                        source.connect(destination);
                        source.connect(audioContext.destination);


                        const audioTrack = destination.stream.getAudioTracks()[0];
                        if (audioTrack) {
                            audioStream.addTrack(audioTrack);
                            this.avatar.lipsync.processAudio(audioStream);
                            console.log("Successfully connected audio to lip sync");
                        } else {
                            console.error("No audio track available in the media stream");
                        }
                    } catch (error) {
                        console.error("Error setting up audio processing:", error);
                    }

                    setTimeout(() => {
                        this.avatar.logMorphTargets();
                    }, 500);
                };

                audio.onended = () => {
                    console.log("Speech ended");
                    setTimeout(() => {
                        this.avatar.stopLipSync();

                        if (this.expressionTimer) {
                            clearTimeout(this.expressionTimer);
                            this.expressionTimer = null;
                        }

                        this.avatar.setFacialExpression('default');
                        console.log("Lip sync stopped after speech ended");


                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    }, 250);
                };

                audio.onerror = (error) => {
                    console.error("Audio playback error:", error);
                    console.error("Audio error details:", audio.error);
                    this.avatar.stopLipSync();
                    URL.revokeObjectURL(audioUrl);
                    this.fallbackBrowserTTS(text);
                    resolve();
                };


                console.log("Attempting to play audio...");
                audio.play().catch(error => {
                    console.error("Failed to play audio:", error);
                    this.avatar.stopLipSync();
                    this.fallbackBrowserTTS(text);
                    resolve();
                });
            });
        } catch (error) {
            console.error("ElevenLabs TTS error:", error);

            return this.fallbackBrowserTTS(text);
        }
    }

    async fallbackBrowserTTS(text) {
        try {
            const utterance = new SpeechSynthesisUtterance(text);

            const voices = await new Promise((resolve) => {
                const voices = speechSynthesis.getVoices();
                if (voices.length) {
                    resolve(voices);
                } else {
                    speechSynthesis.onvoiceschanged = () => {
                        resolve(speechSynthesis.getVoices());
                    };
                }
            });

            const femaleVoice = voices.find(voice =>
                voice.name.includes("Samantha") ||
                voice.name.includes("Google UK English Female") ||
                voice.name.includes("Microsoft Zira") ||
                voice.lang.startsWith("en") && voice.name.includes("Female")
            );

            if (femaleVoice) {
                console.log("Using fallback voice for TTS:", femaleVoice.name);
                utterance.voice = femaleVoice;
            }

            utterance.rate = 0.9;
            utterance.pitch = 1.2;
            utterance.volume = 1.0;

            if (this.avatar.lipsync.audioContext.state === 'suspended') {
                await this.avatar.lipsync.audioContext.resume();
            }

            await this.avatar.startLipSync();

            return new Promise((resolve) => {
                utterance.onstart = () => {
                    console.log("Fallback speech started");
                    this.avatar.isSpeaking = true;
                };

                utterance.onend = () => {
                    console.log("Fallback speech ended");
                    setTimeout(() => {
                        this.avatar.stopLipSync();
                        if (this.expressionTimer) {
                            clearTimeout(this.expressionTimer);
                            this.expressionTimer = null;
                        }
                        this.avatar.setFacialExpression('default');
                        resolve();
                    }, 250);
                };

                speechSynthesis.speak(utterance);
            });
        } catch (error) {
            console.error("Fallback TTS error:", error);
        }
    }

    start() {
        try {
            this.recognition.start();
        } catch (error) {
            console.error("VoiceRecognition error:", error);
        }
    }

    stop() {
        this.recognition.stop();
    }

    triggerEmotionFromText(text) {
        const lowerText = text.toLowerCase();


        if (this.expressionTimer) {
            clearTimeout(this.expressionTimer);
            this.expressionTimer = null;
        }


        this.avatar.setFacialExpression('default');


        if (lowerText.includes('salam') || lowerText.includes('hi ') ||
            lowerText.includes('hello') || lowerText.includes('hey') ||
            lowerText.includes('assalamu') || lowerText.includes('greeting') ||
            lowerText.includes('welcome') || lowerText.match(/^hi$/i)) {
            console.log("Greeting detected - playing waving animation with smile");
            this.avatar.setFacialExpression('smile');
            this.avatar.playAnimationForSituation('greet');
            this.expressionTimer = setTimeout(() => {
                this.avatar.setFacialExpression('default');
                console.log('Reset to default expression after greeting');
            }, 2000);
        }

        else if (lowerText.includes('dance') || lowerText.includes('dancing') ||
            lowerText.includes('rumba') ||
            lowerText.match(/can you (do a |show me a |perform a )?dance/i) ||
            lowerText.match(/show me.*(dance|dancing|moves)/i) ||
            lowerText.match(/do a dance/i)) {
            console.log("Dance request detected - playing rumba dancing animation");
            this.avatar.setFacialExpression('smile');
            this.avatar.playAnimationForSituation('dance');
            this.expressionTimer = setTimeout(() => {
                this.avatar.setFacialExpression('default');
                console.log('Reset to default expression after dancing');
            }, 4000);
        }

        else if (lowerText.match(/are you (angry|mad|upset)/i) ||
            lowerText.includes('angry') || lowerText.includes('mad at') ||
            lowerText.includes('upset') || lowerText.includes('😠') || lowerText.includes('😡')) {
            console.log("Anger expression detected - playing angry animation");
            this.avatar.setFacialExpression('angry');
            this.avatar.playAnimationForSituation('angry');
            this.expressionTimer = setTimeout(() => {
                this.avatar.setFacialExpression('default');
                console.log('Reset to default expression after angry');
            }, 2500);
        }

        else if (lowerText.includes('i\'m sad') || lowerText.includes('im sad') ||
            lowerText.includes('cry') || lowerText.includes('tears') ||
            lowerText.includes('feeling down') || lowerText.includes('unhappy') ||
            lowerText.includes('😢') || lowerText.includes('😭')) {
            console.log("Sadness detected - playing crying animation");
            this.avatar.setFacialExpression('sad');
            this.avatar.playAnimationForSituation('sad');
            this.expressionTimer = setTimeout(() => {
                this.avatar.setFacialExpression('default');
                console.log('Reset to default expression after sad');
            }, 2500);
        }

        else if (lowerText.includes('what do you think') || lowerText.includes('confused') ||
            lowerText.includes('hmm') || lowerText.includes('complex') ||
            lowerText.includes('difficult question') || lowerText.includes('🤔') ||
            lowerText.includes('understand this')) {
            console.log("Thinking prompt detected - playing thinking animation");
            this.avatar.setFacialExpression('surprised');
            this.avatar.playAnimationForSituation('think');
            this.expressionTimer = setTimeout(() => {
                this.avatar.setFacialExpression('default');
                console.log('Reset to default expression after thinking');
            }, 2500);
        }

        else if (lowerText.includes('happy') || lowerText.includes('glad') || lowerText.includes('joy') ||
            lowerText.includes('smile') || lowerText.includes('alhamdulillah') || lowerText.includes('exciting') ||
            lowerText.includes('😊') || lowerText.includes('😄')) {
            console.log("Happiness detected - playing happy animation");
            this.avatar.setFacialExpression('smile');
            this.avatar.playAnimationForSituation('happy');
            this.expressionTimer = setTimeout(() => {
                this.avatar.setFacialExpression('default');
                console.log('Reset to default expression after smile');
            }, 2000);
        }
        // LAUGH DETECTION
        else if (lowerText.includes('laugh') || lowerText.includes('funny') || lowerText.includes('haha') ||
            lowerText.includes('lol') || lowerText.includes('😂') || lowerText.includes('🤣')) {
            console.log("Laughter detected - playing laughing animation");
            this.avatar.setFacialExpression('smile');
            this.avatar.playAnimationForSituation('laugh');
            this.expressionTimer = setTimeout(() => {
                this.avatar.setFacialExpression('default');
                console.log('Reset to default expression after laughing');
            }, 2000);
        }
        else if (lowerText.includes('talk') || lowerText.includes('speaking') ||
            lowerText.includes('explain') || lowerText.includes('tell me')) {
            console.log("Talk prompt detected - playing talking animation");
            this.avatar.playAnimationForSituation('talk');
            this.expressionTimer = setTimeout(() => {
                this.avatar.setFacialExpression('default');
                console.log('Reset to default expression after talking');
            }, 1500);
        }
        else {
            // Default to StandingIdle for other cases
            this.avatar.playAnimationForSituation('default');
            this.expressionTimer = setTimeout(() => {
                this.avatar.setFacialExpression('default');
                console.log('Reset to default expression as fallback');
            }, 300);
        }
    }

    /**
     * Searches for a term in conversation history
     * @param {string} searchTerm - The term to search for
     * @returns {Promise<Array>} - Matching conversations with message excerpts
     */
    async searchChatHistory(searchTerm) {
        try {
            const user = this.getCurrentUser();
            if (!user || !user.uid || !searchTerm) {
                return [];
            }

            const response = await fetch(`${this.historyServiceUrl}/search?userId=${user.uid}&term=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) {
                throw new Error('Failed to search conversations');
            }

            const results = await response.json();
            return results;
        } catch (error) {
            console.error("Error searching chat history:", error);
            return [];
        }
    }

    /**
     * Debug method to check the current authentication state
     * Helps diagnose issues with chat history not saving
     * @returns {boolean} Whether the user is authenticated
     */
    debugAuthState() {
        try {
            const user = this.getCurrentUser();
            console.log("=== Chat Service Debug Info ===");
            console.log("User authenticated:", !!user);

            if (user) {
                console.log("User ID:", user.uid);
                console.log("User Email:", user.email || 'Unknown');
                console.log("Display Name:", user.displayName || 'Unknown');
                console.log("Current conversation ID:", this.currentConversationId);


                this.testDatabaseConnection()
                    .then(result => console.log("Database connection test:", result ? "SUCCESS" : "FAILED"))
                    .catch(err => console.error("Database connection test error:", err.message));
            } else {
                console.log("No authenticated user found");
                console.log("Session storage contents:", sessionStorage.getItem('currentUser'));


                if (window.auth) {
                    const firebaseUser = window.auth.currentUser;
                    console.log("Firebase auth available, current user:", firebaseUser ? "YES" : "NO");
                    if (firebaseUser) {
                        console.log("Firebase user ID:", firebaseUser.uid);
                        console.log("Firebase user email:", firebaseUser.email);
                    }
                } else {
                    console.log("Firebase auth not available in window scope");
                }


                console.log("SOLUTION: Try logging out and logging back in");
            }

            console.log("History service URL:", this.historyServiceUrl);
            console.log("============================");
            return !!user;
        } catch (error) {
            console.error("Error in debugAuthState:", error);
            console.error("Full error object:", JSON.stringify(error));
            return false;
        }
    }

    /**
     * Test database connection by making a simple request
     * @returns {Promise<boolean>} Whether the connection is successful
     */
    async testDatabaseConnection() {
        try {
            const response = await fetch(`${this.historyServiceUrl}/health/database`);
            return response.ok;
        } catch (error) {
            console.error("Database connection test failed:", error);
            return false;
        }
    }

    /**
     * Gets the current topic ID from the ChatHistoryService if available
     * @returns {string|null} The current topic ID or null if not available
     */
    getCurrentTopicId() {
        try {

            if (window.chatHistoryService && window.chatHistoryService.currentTopicId) {
                return window.chatHistoryService.currentTopicId;
            }
        } catch (err) {
            console.warn("Could not access chatHistoryService for topic ID:", err);
        }
        return null;
    }

    /**
     * Sets a new topic ID for the current conversation flow
     */
    startNewTopic() {
        try {
            if (window.chatHistoryService) {
                const newTopicId = window.chatHistoryService.startNewTopic();
                console.log("Started new topic in ChatService:", newTopicId);
                return newTopicId;
            }
        } catch (err) {
            console.warn("Could not start new topic:", err);
        }
        return null;
    }
}

/* ================================
   Class: Avatar
   (Handles 3D model loading, morph target updates, blinking, and lip sync)
   ================================ */
class Avatar {
    constructor() {
        this.model = null;
        this.animations = {};
        this.mixer = null;
        this.currentAnimation = null;
        this.blink = false;
        this.winkLeft = false;
        this.winkRight = false;
        this.facialExpression = '';
        this.lipsync = new Lipsync(this);
        this.gui = new GUI();
        this.gui.hide();
        this.loadModel();
        this.setupControls();
        this.setupAutoBlink();
        this.setupIdleAnimations();
    }

    async loadModel() {
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync('/models/animationsModel.glb');
            this.model = new THREE.Group();
            const { nodes, materials } = { nodes: {}, materials: {} };

            gltf.scene.traverse((child) => {
                if (child.name) nodes[child.name] = child;
                if (child.material && !materials[child.material.name]) {
                    materials[child.material.name] = child.material;
                }
            });

            const addPart = (name) => {
                if (nodes[name]) {
                    if (nodes[name].material) nodes[name].material = nodes[name].material.clone();
                    this.model.add(nodes[name]);
                }
            };

            ['EyeLeft', 'EyeRight', 'Wolf3D_Head', 'Wolf3D_Teeth', 'Wolf3D_Headwear',
                'Wolf3D_Outfit_Top', 'Wolf3D_Outfit_Bottom', 'Wolf3D_Outfit_Footwear',
                'Wolf3D_Body'].forEach(addPart);

            if (nodes.Hips) this.model.add(nodes.Hips);

            this.model.scale.set(1.5, 1.5, 1.5);
            this.setupMorphTargets();
            this.animations = gltf.animations;


            console.log("Available animations:", this.animations.map(a => a.name).join(', '));

            this.setupAnimations();

            this.model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = child.receiveShadow = true;
                    if (child.material) {
                        child.material.envMapIntensity = 1.0;
                        child.material.needsUpdate = true;
                    }
                }
            });

            console.log("Avatar model loaded successfully");
        } catch (error) {
            console.error("Error loading model:", error);
        }
    }

    setupAnimations() {
        if (!this.model) return;
        this.mixer = new THREE.AnimationMixer(this.model);


        const clip = this.animations.find(a => a.name === 'StandingIdle') || this.animations[0];
        if (clip && this.mixer) {
            console.log("Playing animation:", clip.name);
            this.currentAnimation = this.mixer.clipAction(clip).play();
        } else {
            console.warn("StandingIdle animation not found in model. Available animations:",
                this.animations.map(a => a.name).join(', '));
        }
    }

    playAnimation(name) {
        if (this.currentAnimation && this.mixer) this.mixer.stopAllAction();
        const clip = this.animations.find(a => a.name === name);
        if (clip && this.mixer) {
            console.log("Playing animation:", name);
            this.currentAnimation = this.mixer.clipAction(clip).play();
        } else {
            console.warn(`Animation "${name}" not found in model`);
        }
    }

    /**
     * Plays a temporary animation and then returns to StandingIdle
     * @param {string} name - The name of the animation to play
     * @param {number} duration - Duration in milliseconds to play the animation before returning to idle
     * @returns {Promise} - Resolves when the animation sequence completes
     */

    playTemporaryAnimation(name, duration = 3000) {
        return new Promise((resolve) => {

            if (this.currentAnimation && this.currentAnimation.getClip().name === name) {
                resolve();
                return;
            }


            this.playAnimation(name);


            setTimeout(() => {
                this.playAnimation('StandingIdle');
                resolve();
            }, duration);
        });
    }

    /**
     * Plays an animation based on a specific situation
     * @param {string} situation - The situation trigger ('happy', 'angry', 'sad', etc.)
     * @returns {Promise} - Resolves when the animation sequence completes
     */
    playAnimationForSituation(situation) {
        const animationMap = {
            'happy': 'Happy',
            'laugh': 'laughing',
            'angry': 'Angry',
            'sad': 'Crying',
            'dance': 'RumbaDancing',
            'talk': 'Talking',
            'think': 'Thinking',
            'greet': 'Waving',
            'default': 'StandingIdle'
        };

        const animationName = animationMap[situation.toLowerCase()] || 'StandingIdle';
        const duration = situation.toLowerCase() === 'default' ? 0 : 3000;

        return this.playTemporaryAnimation(animationName, duration);
    }

    setupMorphTargets() {
        this.morphTargets = {};
        this.model.traverse(child => {
            if (child.isSkinnedMesh && child.morphTargetDictionary) {
                this.morphTargets[child.name] = {
                    influences: child.morphTargetInfluences,
                    dictionary: child.morphTargetDictionary,
                };
            }
        });
    }

    lerpMorphTarget(target, value, speed = 0.1) {
        const rpmMorphTargets = {
            'mouthOpen': 'viseme_AA', 'jawOpen': 'viseme_O', 'mouthSmile': 'viseme_I',
            'mouthPucker': 'viseme_U', 'mouthFunnel': 'viseme_PP', 'mouthWide': 'viseme_CH',
            'tongueOut': 'tongue_out', 'jawForward': 'jawForward', 'mouthStretch': 'mouthStretch',
            'mouthLeft': 'mouthLeft', 'mouthRight': 'mouthRight'
        };


        const enhancedValue = (target.includes('viseme_') || target.includes('mouth') || target.includes('jaw'))
            ? value * 1.2 : value;

        const rpmTarget = rpmMorphTargets[target] || target;

        for (const meshName in this.morphTargets) {
            const mesh = this.morphTargets[meshName];
            const index = mesh.dictionary[rpmTarget];
            if (index !== undefined) {
                mesh.influences[index] = THREE.MathUtils.lerp(mesh.influences[index], enhancedValue, speed);
            }
        }
    }

    setupControls() {
        const controls = {
            animation: 'Idle',
            facialExpression: '',
            winkLeft: () => this.triggerWink('left'),
            winkRight: () => this.triggerWink('right'),
            logMorphTargets: () => this.logMorphTargets(),
            setupMode: false,
        };

        this.gui.add(controls, 'animation', Object.keys(this.animations))
            .onChange(v => this.playAnimation(v));

        this.gui.add(controls, 'facialExpression', Object.keys(facialExpressions))
            .onChange(v => this.setFacialExpression(v));

        this.gui.add(controls, 'winkLeft').name('Wink Left');
        this.gui.add(controls, 'winkRight').name('Wink Right');
        this.gui.add(controls, 'logMorphTargets');
        this.gui.add(controls, 'setupMode').onChange(v => (setupMode = v));
    }

    setFacialExpression(expression) {
        if (this.facialExpression !== expression) {
            console.log(`Changing facial expression from ${this.facialExpression} to ${expression}`);


            if (this.facialExpression) {

                const allExpressions = Object.values(facialExpressions);
                const allMorphTargets = new Set();


                allExpressions.forEach(expressionObj => {
                    Object.keys(expressionObj).forEach(key => {
                        allMorphTargets.add(key);
                    });
                });


                allMorphTargets.forEach(key => {
                    this.lerpMorphTarget(key, 0, 0.3);
                });
            }


            this.facialExpression = expression;


            if (expression === 'default') {
                const allExpressions = Object.values(facialExpressions);
                const allMorphTargets = new Set();

                allExpressions.forEach(expressionObj => {
                    Object.keys(expressionObj).forEach(key => {
                        allMorphTargets.add(key);
                    });
                });

                allMorphTargets.forEach(key => {
                    this.lerpMorphTarget(key, 0, 0.3);
                });
            }
        }
    }

    triggerWink(side) {
        if (side === 'left') {
            this.winkLeft = true;
            setTimeout(() => (this.winkLeft = false), 300);
        } else {
            this.winkRight = true;
            setTimeout(() => (this.winkRight = false), 300);
        }
    }

    setupAutoBlink() {
        const blink = () => {
            setTimeout(() => {
                this.blink = true;
                setTimeout(() => {
                    this.blink = false;
                    blink();
                }, 200);
            }, THREE.MathUtils.randInt(1000, 5000));
        };
        blink();
    }

    setupIdleAnimations() {

        this.idleInterval = setInterval(() => {
            if (!this.isSpeaking && this.model) {
                const head = this.model.getObjectByName('Wolf3D_Head');
                if (head) {

                    const randomX = (Math.random() - 0.5) * 0.2;
                    const randomY = (Math.random() - 0.5) * 0.3;
                    const randomZ = (Math.random() - 0.5) * 0.1;


                    gsap.to(head.rotation, {
                        x: randomX,
                        y: randomY,
                        z: randomZ,
                        duration: 2,
                        ease: "power2.inOut"
                    });
                }


                if (Math.random() < 0.3) {
                    const body = this.model.getObjectByName('Wolf3D_Body');
                    if (body) {
                        gsap.to(body.rotation, {
                            y: (Math.random() - 0.5) * 0.2,
                            duration: 2.5,
                            ease: "power1.inOut"
                        });
                    }
                }


                if (Math.random() < 0.2) {

                    this.lerpMorphTarget('mouthSmile', Math.random() * 0.3, 0.3);
                    setTimeout(() => {
                        this.lerpMorphTarget('mouthSmile', 0, 0.5);
                    }, 2000);
                }
            }
        }, 4000);
    }

    logMorphTargets() {
        const values = {};
        this.model.traverse(child => {
            if (child.isSkinnedMesh && child.morphTargetDictionary) {
                Object.keys(child.morphTargetDictionary).forEach(key => {
                    const value = child.morphTargetInfluences[child.morphTargetDictionary[key]];
                    if (value > 0.01) values[key] = value;
                });
            }
        });
        console.log("Current Morph Targets:", values);
    }

    update(delta) {
        if (this.mixer) this.mixer.update(delta);

        if (!setupMode && this.facialExpression) {
            const expressionValues = facialExpressions[this.facialExpression] || {};
            Object.entries(expressionValues).forEach(([key, value]) =>
                this.lerpMorphTarget(key, value, 0.1));
        }

        this.lerpMorphTarget('eyeBlinkLeft', (this.blink || this.winkLeft) ? 1 : 0, 0.5);
        this.lerpMorphTarget('eyeBlinkRight', (this.blink || this.winkRight) ? 1 : 0, 0.5);

        if (this.isSpeaking && this.lipsync && this.lipsync.audioContext.state === 'running') {
            this.lipsync.update();
        } else if (!this.isSpeaking) {
            this.lerpMorphTarget('mouthOpen', 0, 0.2);
        }
    }

    async startLipSync() {
        try {
            console.log("Starting lip sync with audio context state:", this.lipsync.audioContext.state);

            if (this.lipsync.audioContext.state === 'suspended') {
                console.log("Audio context was suspended, attempting to resume...");
                await this.lipsync.audioContext.resume();
                console.log("Audio context resumed, new state:", this.lipsync.audioContext.state);
            }

            if (this.currentAudioStream) {
                console.log("Stopping previous audio stream");
                this.currentAudioStream.getTracks().forEach(track => track.stop());
            }

            console.log("Requesting microphone access...");
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 44100
                }
            });

            this.calibrateAudioLevels(stream);

            console.log("Microphone access granted!");
            this.currentAudioStream = stream;

            await this.lipsync.processAudio(stream);
            this.isSpeaking = true;

            console.log('Lip sync started:', {
                audioContextState: this.lipsync.audioContext.state,
                sampleRate: this.lipsync.audioContext.sampleRate,
                fftSize: this.lipsync.analyser.fftSize,
                streamActive: stream.active,
                streamTracks: stream.getTracks().length
            });

        } catch (error) {
            console.error("LipSync error:", error);
            this.lipsync.hasErrors = true;
            this.lipsync.lastErrorMessage = error.toString();
            alert("Could not access microphone. Please ensure you've granted permission and no other app is using it.");
        }
    }

    calibrateAudioLevels(stream) {
        if (!this.lipsync.isCalibrating) {
            console.log("Starting audio calibration...");
            this.lipsync.isCalibrating = true;
            this.lipsync.calibrationStartTime = Date.now();
            this.lipsync.calibrationSamples = [];

            const tempContext = new (window.AudioContext || window.webkitAudioContext)();
            const tempAnalyser = tempContext.createAnalyser();
            tempAnalyser.fftSize = 1024;

            const source = tempContext.createMediaStreamSource(stream);
            source.connect(tempAnalyser);

            const dataArray = new Uint8Array(tempAnalyser.frequencyBinCount);

            const calibrationInterval = setInterval(() => {
                tempAnalyser.getByteFrequencyData(dataArray);
                const speechRange = dataArray.slice(5, 150);
                const volume = speechRange.reduce((sum, value) => sum + value, 0) / speechRange.length / 255;

                this.lipsync.calibrationSamples.push(volume);

                if (this.lipsync.calibrationSamples.length % 10 === 0) {
                    console.log("Calibration sample:", volume.toFixed(4));
                }

                if (Date.now() - this.lipsync.calibrationStartTime > this.lipsync.calibrationDuration) {
                    clearInterval(calibrationInterval);
                    this.finishCalibration(tempContext);
                }
            }, 100);
        }
    }

    finishCalibration(tempContext) {
        if (this.lipsync.calibrationSamples.length > 0) {
            const sortedSamples = [...this.lipsync.calibrationSamples].sort((a, b) => a - b);

            const minVolumeIndex = Math.floor(sortedSamples.length * 0.1);
            const minVolume = sortedSamples[minVolumeIndex];

            const maxVolumeIndex = Math.floor(sortedSamples.length * 0.8);
            const maxVolume = sortedSamples[maxVolumeIndex];

            this.lipsync.minVolume = Math.max(0.03, minVolume * 0.8);
            this.lipsync.maxVolume = Math.max(0.1, maxVolume * 1.2);

            console.log("Calibration complete:", {
                samples: this.lipsync.calibrationSamples.length,
                minVolume: this.lipsync.minVolume.toFixed(4),
                maxVolume: this.lipsync.maxVolume.toFixed(4)
            });
        }

        if (tempContext) {
            tempContext.close();
        }
        this.lipsync.isCalibrating = false;
    }

    stopLipSync() {
        console.log("Stopping lip sync");
        this.isSpeaking = false;

        if (this.lipsync && this.lipsync.scriptProcessor) {
            try {
                this.lipsync.scriptProcessor.disconnect();
                this.lipsync.analyser.disconnect();
                console.log("Audio processing chain disconnected");
            } catch (err) {
                console.warn("Error disconnecting audio nodes:", err);
            }
        }

        if (this.currentAudioStream) {
            console.log("Stopping audio stream tracks");
            this.currentAudioStream.getTracks().forEach(track => {
                track.stop();
                console.log(`Track ${track.kind} stopped`);
            });
            this.currentAudioStream = null;
        }

        this.lerpMorphTarget('mouthOpen', 0, 0.2);
        this.lerpMorphTarget('jawOpen', 0, 0.2);
        this.lerpMorphTarget('viseme_AA', 0, 0.2);
        this.lerpMorphTarget('viseme_O', 0, 0.2);
        this.lerpMorphTarget('mouthStretch', 0, 0.2);
        this.lerpMorphTarget('mouthLeft', 0, 0.2);
        this.lerpMorphTarget('mouthRight', 0, 0.2);
        this.lerpMorphTarget('tongueOut', 0, 0.2);

        console.log("Lip sync stopped completely", {
            speakingState: this.isSpeaking,
            audioContextState: this.lipsync.audioContext.state
        });
    }
}

/* ================================
   Class: Experience
   (Setup Three.js scene, integrate avatar, handle chat and voice input, show typing indicators)
   ================================ */
class Experience {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        document.getElementById("scene-container").appendChild(this.renderer.domElement);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);

            if (this.composer) {
                this.composer.setSize(window.innerWidth, window.innerHeight);
                const fxaaPass = this.composer.passes.find(pass => pass.material && pass.material.uniforms && pass.material.uniforms.resolution);
                if (fxaaPass) {
                    fxaaPass.material.uniforms.resolution.value.set(
                        1 / (window.innerWidth * this.renderer.getPixelRatio()),
                        1 / (window.innerHeight * this.renderer.getPixelRatio())
                    );
                }
            }
        });

        this.avatar = new Avatar();
        this.chatService = new ChatService(this.avatar);


        if (typeof window !== 'undefined') {
            window.chatService = this.chatService;
        }

        this.isListening = false;
        this.recognition = null;
        this.cameraControls = null;
        this.loading = false;
        this.loadingTextMesh = null;
        this.dotsInterval = null;

        this.init();
    }



    /**
     * Load a conversation from chat history
     * @param {number} conversationId - The ID of the conversation to load
     * @returns {Promise<boolean>} - Whether the operation was successful
     */
    async loadConversation(conversationId) {
        try {
            const success = await this.chatService.loadConversation(conversationId);
            if (success) {

                const chatBox = document.getElementById("chat-box");
                if (chatBox) {
                    chatBox.innerHTML = '';


                    const messages = this.chatService.conversationHistory.slice(1);


                    messages.forEach(msg => {
                        this.addMessageToChat(msg.content, msg.role === 'user');
                    });
                }
            }
            return success;
        } catch (error) {
            console.error("Error loading conversation:", error);
            return false;
        }
    }

    /**
     * Start a new conversation
     * @returns {boolean} - Whether the operation was successful
     */
    startNewConversation() {
        try {
            const success = this.chatService.startNewConversation();
            if (success) {

                const chatBox = document.getElementById("chat-box");
                if (chatBox) {
                    chatBox.innerHTML = '';
                }
            }
            return success;
        } catch (error) {
            console.error("Error starting new conversation:", error);
            return false;
        }
    }

    /**
     * Get the current conversation ID
     * @returns {number|null} - The current conversation ID or null if none
     */
    getCurrentConversationId() {
        return this.chatService.currentConversationId;
    }

    async init() {

        if (this.cameraControls) {
            this.cameraControls.dispose();
        }

        this.cameraControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.cameraControls.target.set(0, 1.5, 0);
        this.cameraControls.enableDamping = true;
        this.cameraControls.dampingFactor = 0.05;
        this.cameraControls.enableZoom = true;
        this.cameraControls.minDistance = 2;
        this.cameraControls.maxDistance = 10;
        this.cameraControls.enablePan = false;
        this.cameraControls.maxPolarAngle = Math.PI / 1.5;

        this.cameraControls.rotateSpeed = 0.7;
        this.cameraControls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_ROTATE
        };

        this.cameraControls.addEventListener('change', () => {
            this.cameraControls.target.set(0, 1.5, 0);
        });

        this.cameraControls.enabled = true;


        this.camera.position.set(0, 1.7, 3.5);
        this.cameraControls.update();


        this.renderer.domElement.style.pointerEvents = "auto";
        this.renderer.domElement.style.zIndex = "0";


        await this.avatar.loadModel();
        this.scene.add(this.avatar.model);

        this.setupEnvironment();
        this.setupContactShadows();
        this.setupLoadingDots();


        this.setupVirtualWorld();


        this.setupPostProcessing();

        document.getElementById("send-button")?.addEventListener("click", () => this.handleUserInput());
        document.getElementById("voice-btn")?.addEventListener("click", () => this.toggleVoiceInput());


        if (this.avatar && this.avatar.model) {
            this.avatar.model.position.y = 0;
        }


        const sceneContainer = document.getElementById("scene-container");
        if (sceneContainer) {
            sceneContainer.style.borderRadius = '10px';
            sceneContainer.style.overflow = 'hidden';
            sceneContainer.style.position = "fixed";
            sceneContainer.style.top = "0";
            sceneContainer.style.left = "0";
            sceneContainer.style.width = "100%";
            sceneContainer.style.height = "100%";
            sceneContainer.style.zIndex = "1";
            sceneContainer.style.touchAction = "none";
        }
    }

    setupEnvironment() {

        this.scene.children.forEach(child => {
            if (child instanceof THREE.Light) {
                this.scene.remove(child);
            }
        });


        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);


        const keyLight = new THREE.DirectionalLight(0xffffeb, 1.2);
        keyLight.position.set(30, 40, -60);
        keyLight.castShadow = true;


        keyLight.shadow.bias = -0.0004;
        keyLight.shadow.normalBias = 0.05;
        keyLight.shadow.mapSize.width = 4096;
        keyLight.shadow.mapSize.height = 4096;
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 100;
        keyLight.shadow.camera.left = -20;
        keyLight.shadow.camera.right = 20;
        keyLight.shadow.camera.top = 20;
        keyLight.shadow.camera.bottom = -20;

        this.scene.add(keyLight);


        const fillLight = new THREE.DirectionalLight(0xffeedd, 0.6);
        fillLight.position.set(-10, 10, 5);
        this.scene.add(fillLight);


        const rimLight = new THREE.DirectionalLight(0xffffee, 0.5);
        rimLight.position.set(0, 10, -15);
        this.scene.add(rimLight);


        const avatarLight = new THREE.SpotLight(0xffffff, 0.8);
        avatarLight.position.set(0, 10, 5);
        avatarLight.target.position.set(0, 1.5, 0);
        avatarLight.angle = Math.PI / 6;
        avatarLight.penumbra = 0.2;
        avatarLight.decay = 1;
        avatarLight.distance = 30;
        avatarLight.castShadow = true;

        this.scene.add(avatarLight);
        this.scene.add(avatarLight.target);
    }

    setupContactShadows() {
        const contactShadows = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.ShadowMaterial({ opacity: 0.7 })
        );
        contactShadows.rotation.x = -Math.PI / 2;
        contactShadows.position.y = -0.01;
        contactShadows.receiveShadow = true;
        this.scene.add(contactShadows);
    }

    setupLoadingDots() {
        const fontLoader = new FontLoader();
        fontLoader.load(
            "/fonts/helvetiker_regular.typeface.json",
            (font) => {
                const textGeometry = new TextGeometry(".", {
                    size: 0.14,
                    height: 0.02,
                    font: font,
                });
                const textMaterial = new THREE.MeshBasicMaterial({ color: "black" });
                this.loadingTextMesh = new THREE.Mesh(textGeometry, textMaterial);
                this.loadingTextMesh.position.set(-0.02, 1.75, 0);
                this.loadingTextMesh.visible = false;
                this.scene.add(this.loadingTextMesh);
            },
            undefined,
            (error) => {
                console.error("Error loading font JSON:", error);
            }
        );
    }

    updateLoadingDots() {
        if (this.loading && this.loadingTextMesh) {
            this.loadingTextMesh.visible = true;
            this.dotsInterval = setInterval(() => {
                this.loadingTextMesh.geometry = new TextGeometry(
                    this.loadingTextMesh.geometry.attributes.position.array.length > 1 ? "." : "..",
                    { size: 0.14, height: 0.02 }
                );
            }, 800);
        } else {
            clearInterval(this.dotsInterval);
            if (this.loadingTextMesh) this.loadingTextMesh.visible = false;
        }
    }

    async handleUserInput() {
        const inputField = document.getElementById("chat-input");
        const message = inputField.value.trim();
        if (!message) return;
        this.addMessageToChat(message, true);
        inputField.value = "";
        this.showTypingIndicator();
        const response = await this.chatService.sendMessage(message);
        await this.chatService.textToSpeech(response);
        this.addMessageToChat(response, false);
    }



    toggleVoiceInput() {
        const voiceBtn = document.getElementById('voice-btn');

        if (!this.isListening) {
            console.log('Starting voice input and lip sync');
            this.startVoiceRecognition();

            setTimeout(() => {
                if (voiceBtn) voiceBtn.classList.add('processing');
            }, 2000);

            if (voiceBtn) voiceBtn.classList.add('listening');
            this.avatar.startLipSync();
            this.isListening = true;
        } else {
            console.log('Stopping voice input and lip sync');
            this.stopVoiceRecognition();
            if (voiceBtn) voiceBtn.classList.remove('listening', 'processing');
            this.avatar.stopLipSync();
            this.isListening = false;
        }
    }

    startVoiceRecognition() {
        const onResult = async (transcript) => {
            document.getElementById("chat-input").value = transcript;
            await this.handleUserInput();
            this.isListening = false;
        };

        const onError = (error) => {
            console.error("Voice recognition error:", error);
            this.isListening = false;
        };

        const recognizer = new VoiceRecognition(onResult, onError);
        recognizer.start();
        this.recognition = recognizer;
    }

    stopVoiceRecognition() {
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
    }

    addMessageToChat(text, isUser) {
        const chatBox = document.getElementById("chat-box");
        const messageDiv = document.createElement("div");
        messageDiv.className = "message" + (isUser ? "user" : "");
        messageDiv.textContent = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    showTypingIndicator() {
        const chatBox = document.getElementById("chat-box");
        const indicator = document.createElement("div");
        indicator.className = "message typing";
        indicator.textContent = "...";
        chatBox.appendChild(indicator);
        chatBox.scrollTop = chatBox.scrollHeight;
        setTimeout(() => {
            if (chatBox.contains(indicator)) chatBox.removeChild(indicator);
        }, 2000);
    }

    update(delta) {
        if (this.avatar) this.avatar.update(delta);
        if (this.cameraControls) this.cameraControls.update();


        this.updateWeatherEffects(delta);


        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    setupVirtualWorld() {

        const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd66,
            transparent: true,
            opacity: 0.8
        });
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.sun.position.set(30, 40, -60);
        this.scene.add(this.sun);


        const sunLight = new THREE.PointLight(0xffffcc, 2, 200);
        sunLight.position.copy(this.sun.position);
        this.scene.add(sunLight);


        const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide
        });
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.sky);


        const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x4CAF50,
            roughness: 0.8,
            metalness: 0.2
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = -1;
        this.ground.receiveShadow = true;


        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            if (i > 9 && i < vertices.length - 9) {
                vertices[i + 2] = Math.sin(vertices[i] / 8) * Math.cos(vertices[i + 1] / 8) * 0.5;
            }
        }
        groundGeometry.computeVertexNormals();
        this.scene.add(this.ground);


        this.addEnvironmentObjects();


        this.scene.fog = new THREE.FogExp2(0xccddff, 0.005);


        this.initializeWeatherSystem();
    }

    setupEnvironmentMap() {

        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        new RGBELoader()
            .setDataType(THREE.UnsignedByteType)
            .load('/environments/venice_sunset_1k.hdr', (texture) => {
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;
                this.scene.environment = envMap;
                this.scene.background = envMap;

                texture.dispose();
                pmremGenerator.dispose();
            });
    }

    setupPostProcessing() {

        this.composer = new EffectComposer(this.renderer);


        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);


        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.2,
            0.1,
            0.9
        );
        this.composer.addPass(bloomPass);


        const fxaaPass = new ShaderPass(FXAAShader);
        fxaaPass.material.uniforms['resolution'].value.set(
            1 / (window.innerWidth * this.renderer.getPixelRatio()),
            1 / (window.innerHeight * this.renderer.getPixelRatio())
        );
        this.composer.addPass(fxaaPass);
    }

    addEnvironmentObjects() {

        const treeCount = 20;
        for (let i = 0; i < treeCount; i++) {

            const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
            const trunkMaterial = new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.9,
                metalness: 0.1
            });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.name = "tree-trunk";
            trunk.castShadow = true;
            trunk.receiveShadow = true;


            const tree = new THREE.Group();
            tree.add(trunk);

            const leafColors = [0x2E8B57, 0x3CB371, 0x228B22];


            for (let j = 0; j < 3; j++) {
                const leafHeight = 2 - j * 0.4;
                const leafRadius = 1.2 - j * 0.2;
                const leafGeometry = new THREE.ConeGeometry(leafRadius, leafHeight, 8);
                const leafMaterial = new THREE.MeshStandardMaterial({
                    color: leafColors[j % leafColors.length],
                    roughness: 0.8
                });
                const leaves = new THREE.Mesh(leafGeometry, leafMaterial);
                leaves.name = "tree-leaf";
                leaves.position.y = 1 + j * 0.7;
                leaves.castShadow = true;
                leaves.receiveShadow = true;
                tree.add(leaves);
            }


            let attempt = 0;
            let validPosition = false;
            let angle, distance, x, z;

            while (!validPosition && attempt < 10) {
                angle = Math.random() * Math.PI * 2;
                distance = 10 + Math.random() * 40;
                x = Math.cos(angle) * distance;
                z = Math.sin(angle) * distance;


                validPosition = true;
                for (let k = 0; k < i; k++) {
                    const otherTree = this.scene.children.find(c => c.userData && c.userData.treeIndex === k);
                    if (otherTree) {
                        const dx = x - otherTree.position.x;
                        const dz = z - otherTree.position.z;
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        if (dist < 5) {
                            validPosition = false;
                            break;
                        }
                    }
                }
                attempt++;
            }

            tree.position.x = x;
            tree.position.z = z;
            tree.position.y = -0.5;
            tree.scale.set(1 + Math.random() * 1.5, 1 + Math.random() * 2, 1 + Math.random() * 1.5);
            tree.rotation.y = Math.random() * Math.PI * 2;
            tree.userData.treeIndex = i;

            this.scene.add(tree);
        }


    }


    initializeWeatherSystem() {

        this.weather = {
            isRaining: false,
            windStrength: 0.5,
            rainDrops: [],
            lastRainTime: Date.now(),
            rainTimeout: null,
            clouds: []
        };


        this.createClouds();


        this.scheduleNextRain();


        this.simulateWind();
    }

    createClouds() {

        for (let i = 0; i < 15; i++) {
            const cloudGroup = new THREE.Group();


            const segments = 6 + Math.floor(Math.random() * 5);
            for (let j = 0; j < segments; j++) {
                const size = 2 + Math.random() * 3;
                const cloudGeometry = new THREE.SphereGeometry(size, 7, 7);
                const cloudMaterial = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.7,
                    roughness: 1,
                    metalness: 0
                });
                const cloudPiece = new THREE.Mesh(cloudGeometry, cloudMaterial);


                cloudPiece.position.x = (j - segments / 2) * 1.5;
                cloudPiece.position.y = Math.random() * 0.8;
                cloudPiece.position.z = Math.random() * 1.5;

                cloudGroup.add(cloudPiece);
            }


            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 60;
            const height = 25 + Math.random() * 15;

            cloudGroup.position.x = Math.cos(angle) * distance;
            cloudGroup.position.z = Math.sin(angle) * distance;
            cloudGroup.position.y = height;


            const scale = 2 + Math.random() * 2;
            cloudGroup.scale.set(scale, scale * 0.6, scale);


            this.weather.clouds.push({
                mesh: cloudGroup,
                speed: 0.02 + Math.random() * 0.04,
                baseHeight: cloudGroup.position.y,
                initialAngle: angle
            });

            this.scene.add(cloudGroup);
        }
    }

    createRaindrops() {
        if (!this.weather.isRaining) return;

        const raindropGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.6, 3);
        raindropGeometry.rotateX(Math.PI / 2);

        const raindropMaterial = new THREE.MeshStandardMaterial({
            color: 0x99ccff,
            transparent: true,
            opacity: 0.6,
            emissive: 0x99ccff,
            emissiveIntensity: 0.2
        });


        for (let i = 0; i < 30; i++) {
            const rainDrop = new THREE.Mesh(raindropGeometry, raindropMaterial);


            const x = THREE.MathUtils.randFloat(-40, 40);
            const z = THREE.MathUtils.randFloat(-40, 40);
            const y = 30 + THREE.MathUtils.randFloat(0, 10);

            rainDrop.position.set(x, y, z);


            this.scene.add(rainDrop);
            this.weather.rainDrops.push({
                mesh: rainDrop,
                speed: 0.5 + Math.random() * 0.8,
                startY: y
            });
        }
    }

    simulateWind() {

        setInterval(() => {
            this.weather.windStrength = Math.max(0.1, Math.min(1.2,
                this.weather.windStrength + (Math.random() * 0.4 - 0.2)));
        }, 5000);


        setInterval(() => {
            this.scene.traverse(object => {
                if (object.name === "tree-leaf" || object.name === "tree-trunk") {
                    const windEffect = this.weather.windStrength * Math.sin(Date.now() / 2000);


                    if (object.name === "tree-leaf") {
                        gsap.to(object.rotation, {
                            z: windEffect * 0.1,
                            x: windEffect * 0.05,
                            duration: 2,
                            ease: "power1.inOut"
                        });
                    } else {
                        gsap.to(object.rotation, {
                            z: windEffect * 0.02,
                            duration: 2.5,
                            ease: "power1.inOut"
                        });
                    }
                }
            });
        }, 2000);
    }

    scheduleNextRain() {

        const nextRainDelay = 30000 + Math.random() * 90000;

        this.weather.rainTimeout = setTimeout(() => {
            this.startRain();


            setTimeout(() => {
                this.stopRain();
                this.scheduleNextRain();
            }, 15000 + Math.random() * 30000);
        }, nextRainDelay);
    }

    startRain() {
        this.weather.isRaining = true;
        console.log("Rain started");


        gsap.to(this.sky.material.color, {
            r: 0.4,
            g: 0.5,
            b: 0.6,
            duration: 3
        });


        this.scene.children.forEach(child => {
            if (child instanceof THREE.DirectionalLight) {
                gsap.to(child, {
                    intensity: child.intensity * 0.6,
                    duration: 3
                });
            }
        });
    }

    stopRain() {
        this.weather.isRaining = false;
        console.log("Rain stopped");


        gsap.to(this.sky.material.color, {
            r: 0x87 / 255,
            g: 0xCE / 255,
            b: 0xEB / 255,
            duration: 5
        });


        this.scene.children.forEach(child => {
            if (child instanceof THREE.DirectionalLight) {
                gsap.to(child, {
                    intensity: child.intensity * 1.67,
                    duration: 5
                });
            }
        });


        for (const drop of this.weather.rainDrops) {
            this.scene.remove(drop.mesh);
        }
        this.weather.rainDrops = [];
    }

    updateWeatherEffects(delta) {

        for (const cloud of this.weather.clouds) {
            const cloudMesh = cloud.mesh;
            const center = new THREE.Vector3(0, 0, 0);
            const direction = new THREE.Vector3().subVectors(cloudMesh.position, center);


            const rotationAngle = cloud.speed * delta * this.weather.windStrength;
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationAngle);
            cloudMesh.position.copy(direction.add(center));


            cloudMesh.position.y = cloud.baseHeight + Math.sin(Date.now() * 0.0005 + cloud.initialAngle) * 0.5;
        }


        if (this.weather.isRaining && Date.now() - this.weather.lastRainTime > 100) {
            this.createRaindrops();
            this.weather.lastRainTime = Date.now();
        }


        for (let i = this.weather.rainDrops.length - 1; i >= 0; i--) {
            const drop = this.weather.rainDrops[i];
            drop.mesh.position.y -= drop.speed;


            drop.mesh.position.x += this.weather.windStrength * 0.1;


            if (drop.mesh.position.y < -0.5) {
                this.scene.remove(drop.mesh);
                this.weather.rainDrops.splice(i, 1);
            }
        }
    }
}


class VoiceRecognition {
    constructor(onResult, onError) {
        this.recognition = null;
        this.onResult = onResult;
        this.onError = onError;

        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            this.recognition = new SpeechRecognition();
        } else {
            console.error('Speech recognition not supported');
            this.onError('Speech recognition not supported in this browser');
            return;
        }

        this.recognition.lang = 'en-US';
        this.recognition.interimResults = false;
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('Voice recognized:', transcript);
            this.onResult(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.onError(event.error);
        };
    }

    start() {
        if (this.recognition) {
            this.recognition.start();
        }
    }

    stop() {
        if (this.recognition) {
            this.recognition.stop();
        }
    }
}

export { Avatar, Experience };

