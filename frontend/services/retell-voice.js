/**
 * Retell AI Voice Integration
 * Manages Retell Web SDK for voice conversations
 */

class RetellVoiceManager {
    constructor() {
        this.retellClient = null;
        this.currentCall = null;
        this.isConnected = false;
        this.isSpeaking = false;
        this.isListening = false;
        this.isThinking = false;
        
        this.onStateChange = null;
        this.onTranscript = null;
        this.onError = null;
        
        console.log('[RETELL] RetellVoiceManager initialized');
    }
    
    async startCall(accessToken, callbacks = {}) {
        console.log('[RETELL SDK] ===== STARTING CALL =====');
        console.log('[RETELL SDK] Access token received:', !!accessToken);
        console.log('[RETELL SDK] Token length:', accessToken?.length);
        
        // Check what's available globally
        console.log('[RETELL SDK] window.retellSDK:', typeof window.retellSDK);
        console.log('[RETELL SDK] window.Retell:', typeof window.Retell);
        console.log('[RETELL SDK] window.RetellWebClient:', typeof window.RetellWebClient);
        console.log('[RETELL SDK] Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('retell')));
        
        this.onStateChange = callbacks.onStateChange || null;
        this.onTranscript = callbacks.onTranscript || null;
        this.onError = callbacks.onError || null;
        
        try {
            // Check browser capabilities
            console.log('[RETELL SDK] Checking browser capabilities');
            console.log('[RETELL SDK] navigator.mediaDevices:', !!navigator.mediaDevices);
            console.log('[RETELL SDK] isSecureContext:', window.isSecureContext);
            
            if (!navigator.mediaDevices) {
                throw new Error('Browser does not support mediaDevices API');
            }
            
            // Initialize Retell SDK with current API
            console.log('[RETELL SDK] Initializing Retell SDK');
            
            // Inspect the actual SDK structure
            console.log('[RETELL SDK] Available Retell globals:', Object.keys(window).filter(k => k.toLowerCase().includes('retell')));
            
            if (typeof window.retellClientJsSdk !== 'undefined') {
                console.log('[RETELL SDK] window.retellClientJsSdk structure:');
                console.log('[RETELL SDK] Type:', typeof window.retellClientJsSdk);
                console.log('[RETELL SDK] Keys:', Object.keys(window.retellClientJsSdk));
                console.log('[RETELL SDK] Full object:', window.retellClientJsSdk);
                
                // Check for common constructor properties
                if (typeof window.retellClientJsSdk.RetellWebClient !== 'undefined') {
                    console.log('[RETELL SDK] Found RetellWebClient property');
                }
                if (typeof window.retellClientJsSdk.default !== 'undefined') {
                    console.log('[RETELL SDK] Found default property');
                }
            }
            
            // Try different possible SDK global names
            let SDKClass = null;
            if (typeof window.RetellWebClient !== 'undefined') {
                console.log('[RETELL SDK] Using RetellWebClient');
                SDKClass = window.RetellWebClient;
            } else if (typeof window.retellClientJsSdk !== 'undefined') {
                console.log('[RETELL SDK] Using retellClientJsSdk');
                SDKClass = window.retellClientJsSdk;
            } else if (typeof window.retellSDK !== 'undefined' && typeof window.retellSDK.SDK !== 'undefined') {
                console.log('[RETELL SDK] Using retellSDK.SDK (old API)');
                SDKClass = window.retellSDK.SDK;
            } else if (typeof window.Retell !== 'undefined') {
                console.log('[RETELL SDK] Using Retell');
                SDKClass = window.Retell;
            } else {
                throw new Error('Retell SDK not loaded - no global Retell object found');
            }
            
            console.log('[RETELL SDK] SDK class found:', typeof SDKClass);
            console.log('[RETELL SDK] Creating SDK instance');
            this.retellClient = new SDKClass();
            console.log('[RETELL SDK] SDK instance created:', !!this.retellClient);
            
            // Set up event listeners BEFORE starting call
            this.setupEventListeners();
            
            // Start the call with current API - SDK will handle microphone permission
            console.log('[RETELL SDK] Calling startCall with access token');
            console.log('[RETELL SDK] Access token length:', accessToken?.length);
            try {
                // Current Retell API uses object parameter
                console.log('[RETELL SDK] Invoking: retellClient.startCall({ accessToken })');
                this.currentCall = await this.retellClient.startCall({
                    accessToken: accessToken
                });
                console.log('[RETELL SDK] startCall SUCCESS');
                console.log('[RETELL SDK] Call object:', !!this.currentCall);
            } catch (sdkError) {
                console.error('[RETELL SDK] startCall FAILED');
                console.error('[RETELL SDK] ERROR NAME:', sdkError?.name);
                console.error('[RETELL SDK] ERROR MESSAGE:', sdkError?.message);
                console.error('[RETELL SDK] ERROR STACK:', sdkError?.stack);
                console.error('[RETELL SDK] ERROR OBJECT:', sdkError);
                
                // Provide user-friendly error messages for common issues
                let userMessage = 'Failed to start voice call. ';
                if (sdkError.message && sdkError.message.includes('NotAllowedError')) {
                    userMessage = 'Microphone access required. Please allow microphone access in your browser and try again.';
                } else if (sdkError.message && sdkError.message.includes('NotFoundError')) {
                    userMessage = 'No microphone found. Please connect a microphone and try again.';
                } else if (sdkError.message) {
                    userMessage += `Error: ${sdkError.message}`;
                } else {
                    userMessage += 'Please check your browser permissions and try again.';
                }
                
                throw new Error(userMessage);
            }
            
            console.log('[RETELL SDK] Call started successfully');
            this.isConnected = true;
            this.updateState('listening');
            
            return true;
        } catch (error) {
            console.error('[RETELL SDK] CALL START FAILED:', {
                name: error?.name,
                message: error?.message,
                stack: error?.stack,
                error
            });
            this.handleError(error);
            return false;
        }
    }
    
    setupEventListeners() {
        if (!this.retellClient) return;
        
        console.log('[RETELL SDK] Setting up event listeners');
        
        // Current Retell SDK events based on documentation
        this.retellClient.on('call_started', () => {
            console.log('[RETELL SDK] Call started event');
            this.updateState('listening');
        });
        
        this.retellClient.on('call_ended', () => {
            console.log('[RETELL SDK] Call ended event');
            this.isConnected = false;
            this.updateState('idle');
        });
        
        this.retellClient.on('agent_started_speaking', () => {
            console.log('[RETELL SDK] Agent started speaking');
            this.isSpeaking = true;
            this.isListening = false;
            this.updateState('speaking');
        });
        
        this.retellClient.on('agent_stopped_speaking', () => {
            console.log('[RETELL SDK] Agent stopped speaking');
            this.isSpeaking = false;
            this.isListening = true;
            this.updateState('listening');
        });
        
        this.retellClient.on('user_started_speaking', () => {
            console.log('[RETELL SDK] User started speaking');
            this.isListening = false;
            this.updateState('listening');
        });
        
        this.retellClient.on('user_stopped_speaking', () => {
            console.log('[RETELL SDK] User stopped speaking');
            this.isListening = true;
            this.updateState('thinking');
        });
        
        this.retellClient.on('update', (update) => {
            console.log('[RETELL SDK] Update received:', update);
            
            // Handle transcript updates - Retell sends transcript in different formats
            if (update.transcript) {
                this.handleTranscript(update.transcript);
            }
            // Also check for transcript in different event formats
            if (update.content) {
                this.handleTranscript(update);
            }
        });
        
        this.retellClient.on('error', (error) => {
            console.error('[RETELL SDK] SDK error:', error);
            this.handleError(error);
        });
        
        this.retellClient.on('metadata', (metadata) => {
            console.log('[RETELL SDK] Metadata received:', metadata);
        });
        
        console.log('[RETELL SDK] Event listeners set up');
    }
    
    handleTranscript(transcriptData) {
        if (!this.onTranscript) return;
        
        try {
            // Handle different Retell transcript formats
            let role, text;
            
            if (transcriptData.transcript) {
                // Retell may send nested transcript object
                role = transcriptData.transcript.role === 'agent' ? 'assistant' : 'user';
                text = transcriptData.transcript.content;
            } else if (transcriptData.role && transcriptData.content) {
                // Direct format
                role = transcriptData.role === 'agent' ? 'assistant' : 'user';
                text = transcriptData.content;
            } else if (typeof transcriptData === 'string') {
                // Simple string format
                text = transcriptData;
                role = 'user'; // Default to user if role not specified
            } else {
                console.warn('[RETELL] Unknown transcript format:', transcriptData);
                return;
            }
            
            if (text && text.trim()) {
                console.log(`[RETELL] Transcript: ${role} - ${text}`);
                this.onTranscript(role, text);
            }
        } catch (error) {
            console.error('[RETELL] Error handling transcript:', error);
        }
    }
    
    updateState(state) {
        console.log('[RETELL] State updated:', state);
        
        // Update internal state
        this.isListening = state === 'listening';
        this.isSpeaking = state === 'speaking';
        this.isThinking = state === 'thinking';
        
        // Notify callback
        if (this.onStateChange) {
            this.onStateChange(state);
        }
    }
    
    handleError(error) {
        console.error('[RETELL] Error:', error);
        
        if (this.onError) {
            this.onError(error.message || 'Unknown error');
        }
    }
    
    stopCall() {
        console.log('[RETELL] Stopping call');
        
        if (this.currentCall) {
            this.currentCall.stop();
            this.currentCall = null;
        }
        
        if (this.retellClient) {
            this.retellClient = null;
        }
        
        this.isConnected = false;
        this.isSpeaking = false;
        this.isListening = false;
        this.isThinking = false;
        
        this.updateState('idle');
    }
    
    interrupt() {
        console.log('[RETELL] Interrupting');
        
        if (this.currentCall && this.isSpeaking) {
            // Retell handles interruption automatically when user speaks
            // This is mainly for UI state management
            this.updateState('listening');
        }
    }
    
    getState() {
        if (this.isSpeaking) return 'speaking';
        if (this.isThinking) return 'thinking';
        if (this.isListening) return 'listening';
        if (this.isConnected) return 'listening';
        return 'idle';
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    console.log('[RETELL] Exporting RetellVoiceManager to window');
    window.RetellVoiceManager = RetellVoiceManager;
    console.log('[RETELL] RetellVoiceManager exported successfully');
}