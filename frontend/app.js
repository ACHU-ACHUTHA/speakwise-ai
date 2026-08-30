const API_BASE = "http://127.0.0.1:8000";

console.log('[APP] SpeakWise AI application initializing');
console.log('[APP] API Base:', API_BASE);
console.log('[APP] Secure context:', window.isSecureContext);
console.log('[APP] Current location:', window.location.href);

// DOM Elements - Chat Mode
const messagesContainer = document.getElementById("messages");
const textInput = document.getElementById("text-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const recordingStatus = document.getElementById("recording-status");
const recordingLabel = document.getElementById("recording-label");
const waveform = document.getElementById("waveform");
const statusSpinner = document.getElementById("status-spinner");
const audioPlayer = document.getElementById("audio-player");
const refreshMemoryBtn = document.getElementById("refresh-memory-btn");
const voiceModeBtn = document.getElementById("voice-mode-btn");
const chatArea = document.getElementById("chat-area");

const profName = document.getElementById("prof-name");
const profLevel = document.getElementById("prof-level");
const profGoal = document.getElementById("prof-goal");
const mistakesList = document.getElementById("mistakes-list");

// DOM Elements - Voice Mode
const voiceMode = document.getElementById("voice-mode");
const chatModeBtn = document.getElementById("chat-mode-btn");
const exitVoiceBtn = document.getElementById("exit-voice-btn");
const orbCanvas = document.getElementById("orb-canvas");
const orbStatus = document.getElementById("orb-status");
const statusIcon = document.getElementById("status-icon");
const statusText = document.getElementById("status-text");
const transcriptContainer = document.getElementById("transcript-container");
const voiceMainBtn = document.getElementById("voice-main-btn");
const stopBtn = document.getElementById("stop-btn");
const miniName = document.getElementById("mini-name");
const miniLevel = document.getElementById("mini-level");

console.log('[APP] DOM elements check:');
console.log('[APP] - voiceModeBtn:', voiceModeBtn);
console.log('[APP] - voiceMode:', voiceMode);
console.log('[APP] - orbCanvas:', orbCanvas);
console.log('[APP] - voiceMainBtn:', voiceMainBtn);

// Voice Mode State
let isVoiceMode = false;
let voiceOrb = null;
let voiceState = 'idle'; // idle, listening, thinking, speaking, error
let retellVoiceManager = null;
let voiceSessionActive = false;

console.log('[APP] Checking Retell SDK availability:');
console.log('[APP] - retellSDK:', typeof retellSDK);
console.log('[APP] - RetellVoiceManager:', typeof RetellVoiceManager);



// ─── Mic State Machine ──────────────────────────────────────────────────
// States: "idle" | "recording" | "processing"
let micState = "idle";

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let selectedMimeType = "audio/webm";
let waveformAnimFrame = null;
let audioContext = null;
let analyser = null;

// ─── Status Bar Helpers ─────────────────────────────────────────────────

function showStatus(mode, message = "") {
    recordingStatus.classList.remove("hidden", "status-recording", "status-processing", "status-error");
    waveform.classList.remove("active");
    statusSpinner.classList.add("hidden");

    if (mode === "hidden") {
        recordingStatus.classList.add("hidden");
        return;
    }

    recordingStatus.classList.add(`status-${mode}`);
    recordingLabel.textContent = message;

    if (mode === "recording") {
        waveform.classList.add("active");
    } else if (mode === "processing") {
        statusSpinner.classList.remove("hidden");
    }
}

function showStatusError(message, ms = 3500) {
    showStatus("error", message);
    setTimeout(() => {
        if (micState === "idle") showStatus("hidden");
    }, ms);
}

// ─── UI State Helpers ───────────────────────────────────────────────────

function setMicIdle() {
    micState = "idle";
    micBtn.classList.remove("recording", "processing");
    micBtn.disabled = false;
    sendBtn.disabled = false;
    textInput.disabled = false;
    textInput.placeholder = "Type a message...";
    stopWaveformAnimation();
    showStatus("hidden");
}

function setMicRecording() {
    micState = "recording";
    micBtn.classList.add("recording");
    micBtn.classList.remove("processing");
    micBtn.disabled = false;
    sendBtn.disabled = true;
    textInput.disabled = true;
    textInput.placeholder = "Listening...";
    showStatus("recording", "Listening...");
}

function setMicProcessing() {
    micState = "processing";
    micBtn.classList.remove("recording");
    micBtn.classList.add("processing");
    micBtn.disabled = true;
    sendBtn.disabled = true;
    textInput.disabled = true;
    textInput.placeholder = "Transcribing...";
    stopWaveformAnimation();
    showStatus("processing", "Transcribing...");
}

function releaseMicStream() {
    console.log('[CHAT MODE] Releasing microphone stream');
    if (mediaStream) {
        console.log('[CHAT MODE] Stopping media stream tracks');
        mediaStream.getTracks().forEach(t => {
            console.log('[CHAT MODE] Stopping track:', t.kind, t.readyState);
            t.stop();
        });
        mediaStream = null;
    }
    if (audioContext) {
        console.log('[CHAT MODE] Closing audio context');
        audioContext.close().catch(() => {});
        audioContext = null;
        analyser = null;
    }
}

function stopWaveformAnimation() {
    if (waveformAnimFrame) {
        cancelAnimationFrame(waveformAnimFrame);
        waveformAnimFrame = null;
    }
    waveform.querySelectorAll(".waveform-bar").forEach(bar => {
        bar.style.height = "4px";
    });
}

function startLiveWaveform(stream) {
    stopWaveformAnimation();
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bars = waveform.querySelectorAll(".waveform-bar");
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
            if (micState !== "recording") return;
            analyser.getByteFrequencyData(data);
            bars.forEach((bar, i) => {
                const value = data[i + 1] || 0;
                const height = Math.max(4, Math.min(18, (value / 255) * 18));
                bar.style.height = `${height}px`;
            });
            waveformAnimFrame = requestAnimationFrame(tick);
        };
        tick();
    } catch (e) {
        console.warn("[MIC] Live waveform unavailable:", e);
    }
}

// ─── Message Helpers ─────────────────────────────────────────────────────

function appendMessage(role, text, options = {}) {
    const { audioUrl = null, ttsFailed = false } = options;

    if (!text || typeof text !== "string" || text.trim() === "") {
        console.warn("[UI] appendMessage called with empty text, skipping");
        return null;
    }

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", role === "user" ? "user-message" : "assistant-message");

    const avatar = document.createElement("div");
    avatar.classList.add("avatar");
    avatar.innerHTML = role === "user"
        ? '<i class="fa-solid fa-user"></i>'
        : '<i class="fa-solid fa-robot"></i>';

    const bubble = document.createElement("div");
    bubble.classList.add("bubble");
    bubble.innerText = text.trim();

    if (role === "assistant") {
        const actions = document.createElement("div");
        actions.classList.add("message-actions");

        if (audioUrl) {
            const audioBtn = document.createElement("button");
            audioBtn.classList.add("audio-play-btn");
            audioBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
            audioBtn.onclick = () => playAudio(audioUrl);
            actions.appendChild(audioBtn);
        }

        if (ttsFailed) {
            const retryBtn = document.createElement("button");
            retryBtn.classList.add("audio-retry-btn");
            retryBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Retry audio';
            retryBtn.onclick = async () => {
                retryBtn.disabled = true;
                retryBtn.textContent = "Generating...";
                try {
                    const res = await fetch(`${API_BASE}/voice/tts`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: text.trim() })
                    });
                    if (!res.ok) throw new Error("TTS failed");
                    const data = await res.json();
                    if (data.audio_url) {
                        const errNote = actions.querySelector(".tts-error-note");
                        if (errNote) errNote.remove();
                        retryBtn.remove();
                        const audioBtn = document.createElement("button");
                        audioBtn.classList.add("audio-play-btn");
                        audioBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
                        audioBtn.onclick = () => playAudio(data.audio_url);
                        actions.insertBefore(audioBtn, actions.firstChild);
                        playAudio(data.audio_url);
                    }
                } catch (e) {
                    retryBtn.disabled = false;
                    retryBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Retry audio';
                    showStatusError("Could not generate audio. Please try again.");
                }
            };
            actions.appendChild(retryBtn);

            const errNote = document.createElement("span");
            errNote.classList.add("tts-error-note");
            errNote.textContent = "Audio unavailable";
            actions.appendChild(errNote);
        }

        if (actions.childElementCount > 0) {
            bubble.appendChild(document.createElement("br"));
            bubble.appendChild(actions);
        }
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msgDiv;
}

// ─── Audio ───────────────────────────────────────────────────────────────

function playAudio(url) {
    if (!url) return;
    try {
        audioPlayer.src = url;
        audioPlayer.play().catch(e => console.warn("[AUDIO] Playback blocked:", e));
    } catch (e) {
        console.error("[AUDIO] Error:", e);
    }
}

function parseApiError(res, errData) {
    if (errData && errData.detail && errData.detail.message) {
        return { code: errData.detail.error || null, message: errData.detail.message };
    }
    if (errData && typeof errData.detail === "string") {
        return { code: null, message: errData.detail };
    }
    return { code: null, message: "Voice processing failed. Please try again." };
}

// ─── Text Chat ───────────────────────────────────────────────────────────

async function sendTextMessage() {
    const text = textInput.value.trim();
    if (!text) return;

    appendMessage("user", text);
    textInput.value = "";

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, session_id: "default" })
        });
        const data = await response.json();

        const responseText = data && typeof data.response === "string" && data.response.trim() !== ""
            ? data.response
            : "Sorry, I didn't get that. Could you say that again?";

        appendMessage("assistant", responseText);
        fetchMemory();
    } catch (err) {
        console.error("[TEXT CHAT] Error:", err);
        appendMessage("assistant", "Could not reach the server. Please check your connection and try again.");
    }
}

// ─── Voice Recording ─────────────────────────────────────────────────────

function detectMimeType() {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
    ];
    for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "audio/webm";
}

async function createMediaRecorder() {
    selectedMimeType = detectMimeType();
    releaseMicStream();
    audioChunks = [];

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startLiveWaveform(mediaStream);

    const recorder = new MediaRecorder(mediaStream, { mimeType: selectedMimeType });

    recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            audioChunks.push(event.data);
        }
    };

    recorder.onstop = () => {
        const ext = selectedMimeType.includes("webm") ? "webm"
                  : selectedMimeType.includes("mp4")  ? "m4a"
                  : selectedMimeType.includes("ogg")  ? "ogg"
                  : "webm";

        const audioBlob = new Blob(audioChunks, { type: selectedMimeType });
        audioChunks = [];
        releaseMicStream();

        if (audioBlob.size < 500) {
            showStatusError("Nothing recorded. Tap the mic and speak, then tap again to stop.");
            setMicIdle();
            return;
        }

        setMicProcessing();
        sendVoiceMessage(audioBlob, ext);
    };

    return recorder;
}

async function toggleRecording() {
    console.log('[CHAT MODE] Toggle recording called, current state:', micState);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showStatusError("Microphone access is not supported in this browser.");
        return;
    }

    if (micState === "processing") return;

    if (micState === "idle") {
        try {
            console.log('[CHAT MODE] Starting microphone recording');
            mediaRecorder = await createMediaRecorder();
            mediaRecorder.start(250);
            setMicRecording();
        } catch (err) {
            console.error("[MIC] Could not access microphone:", err);
            console.error("[MIC] Error name:", err.name);
            console.error("[MIC] Error message:", err.message);
            releaseMicStream();
            showStatusError("Could not access microphone. Please check permissions.");
            setMicIdle();
        }
    } else if (micState === "recording") {
        try {
            console.log('[CHAT MODE] Stopping microphone recording');
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                mediaRecorder.stop();
            } else {
                setMicIdle();
            }
        } catch (err) {
            console.error("[MIC] Failed to stop recorder:", err);
            releaseMicStream();
            setMicIdle();
        }
    }
}

// ─── Voice → API → Chat Pipeline ─────────────────────────────────────────

async function sendVoiceMessage(blob, ext) {
    const formData = new FormData();
    formData.append("file", blob, `user_voice.${ext}`);
    formData.append("session_id", "default");

    try {
        const res = await fetch(`${API_BASE}/voice/chat`, {
            method: "POST",
            body: formData
        });

        if (!res.ok) {
            let errData = null;
            try { errData = await res.json(); } catch (_) { /* ignore */ }
            const { code, message } = parseApiError(res, errData);

            if (code === "no_speech") {
                showStatusError("No speech detected. Tap the mic and try again.");
            } else if (code === "stt_failed") {
                showStatusError("Speech recognition failed. Tap the mic to try again.");
            } else {
                showStatusError(message || "Voice processing failed. Please try again.");
            }
            setMicIdle();
            return;
        }

        const data = await res.json();

        const transcript = (typeof data.transcript === "string") ? data.transcript.trim() : "";
        const responseText = (typeof data.response === "string" && data.response.trim())
            ? data.response.trim()
            : "Sorry, I didn't get that. Could you say that again?";
        const audioUrl = (typeof data.audio_url === "string" && data.audio_url) ? data.audio_url : null;
        const ttsOk = data.tts_ok !== false && !!audioUrl;

        if (!transcript) {
            showStatusError("No speech detected. Tap the mic and try again.");
            setMicIdle();
            return;
        }

        // Hide status bar before adding real chat messages (ChatGPT-style)
        showStatus("hidden");
        appendMessage("user", transcript);
        appendMessage("assistant", responseText, {
            audioUrl: ttsOk ? audioUrl : null,
            ttsFailed: !ttsOk
        });

        if (ttsOk) {
            playAudio(audioUrl);
        }

        fetchMemory();
    } catch (err) {
        console.error("[VOICE] Network/fetch error:", err);
        showStatusError("Could not reach the server. Check your connection and try again.");
    } finally {
        setMicIdle();
    }
}

// ─── Learner Profile & Mistakes ─────────────────────────────────────────

async function fetchMemory() {
    try {
        const profRes = await fetch(`${API_BASE}/memory/profile`);
        const profData = await profRes.json();
        profName.innerText = profData.name || "Not set";
        profLevel.innerText = profData.english_level || "Not set";
        profGoal.innerText = profData.goal || "Not set";

        const mistRes = await fetch(`${API_BASE}/memory/mistakes`);
        const mistData = await mistRes.json();

        mistakesList.innerHTML = "";
        if (!mistData || mistData.length === 0) {
            mistakesList.innerHTML = "<li>No mistakes recorded yet.</li>";
        } else {
            mistData.slice(0, 5).forEach(m => {
                const li = document.createElement("li");
                li.innerHTML = `❌ <s>${m.original}</s><br>✅ <strong>${m.correction}</strong>`;
                mistakesList.appendChild(li);
            });
        }
    } catch (err) {
        console.error("[MEMORY] Failed to fetch:", err);
    }
}

// ─── Voice Mode Setup ─────────────────────────────────────────────────────

function initializeVoiceMode() {
    console.log('[VOICE MODE] ===== INITIALIZING VOICE MODE =====');
    console.log('[VOICE MODE] VoiceOrb available:', typeof VoiceOrb);
    console.log('[VOICE MODE] RetellVoiceManager available:', typeof RetellVoiceManager);
    console.log('[VOICE MODE] RetellWebClient available:', typeof RetellWebClient);
    console.log('[VOICE MODE] retellSDK available:', typeof retellSDK);
    console.log('[VOICE MODE] All window keys:', Object.keys(window).filter(k => k.toLowerCase().includes('retell')));
    
    if (typeof VoiceOrb !== 'undefined') {
        console.log('[VOICE MODE] Creating VoiceOrb instance');
        voiceOrb = new VoiceOrb(orbCanvas);
        console.log('[VOICE MODE] VoiceOrb instance created');
    } else {
        console.error('[VOICE MODE] VoiceOrb class not found');
    }
    
    if (typeof RetellVoiceManager !== 'undefined') {
        console.log('[VOICE MODE] Creating RetellVoiceManager instance');
        retellVoiceManager = new RetellVoiceManager();
        console.log('[VOICE MODE] RetellVoiceManager instance created');
    } else {
        console.error('[VOICE MODE] RetellVoiceManager class not found');
        console.error('[VOICE MODE] Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('retell')));
    }
}

function switchToVoiceMode() {
    console.log('[VOICE MODE] ===== SWITCHING TO VOICE MODE =====');
    isVoiceMode = true;
    chatArea.style.display = 'none';
    voiceMode.style.display = 'flex';
    
    // IMPORTANT: Stop any chat mode recording that might be active
    console.log('[VOICE MODE] Checking for active chat mode recording');
    if (micState === 'recording' || micState === 'processing') {
        console.log('[VOICE MODE] Stopping active chat mode recording');
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        releaseMicStream();
        setMicIdle();
    }
    
    console.log('[VOICE MODE] Checking if voiceOrb exists:', !!voiceOrb);
    if (!voiceOrb) {
        console.log('[VOICE MODE] Initializing voice orb');
        initializeVoiceMode();
    } else {
        console.log('[VOICE MODE] VoiceOrb already exists');
    }
    
    // Update mini profile
    miniName.textContent = profName.textContent;
    miniLevel.textContent = profLevel.textContent;
    
    updateOrbState('idle');
    console.log('[VOICE MODE] ===== SWITCHED TO VOICE MODE =====');
}

function switchToChatMode() {
    isVoiceMode = false;
    voiceMode.style.display = 'none';
    chatArea.style.display = 'flex';
    
    // Stop any active voice session
    if (voiceSessionActive) {
        stopVoiceSession();
    }
}

function updateOrbState(state) {
    voiceState = state;
    
    // Update orb visual state
    if (voiceOrb) {
        voiceOrb.setState(state);
    }
    
    // Update status indicator
    orbStatus.className = 'orb-status ' + state;
    
    let iconClass, statusMessage;
    switch (state) {
        case 'idle':
            iconClass = 'fa-microphone';
            statusMessage = 'Ready to listen';
            break;
        case 'listening':
            iconClass = 'fa-microphone';
            statusMessage = 'SpeakWise is listening...';
            break;
        case 'processing':
            iconClass = 'fa-brain';
            statusMessage = 'SpeakWise is thinking...';
            break;
        case 'speaking':
            iconClass = 'fa-volume-high';
            statusMessage = 'SpeakWise is speaking...';
            break;
        case 'error':
            iconClass = 'fa-triangle-exclamation';
            statusMessage = 'Something went wrong';
            break;
        default:
            iconClass = 'fa-microphone';
            statusMessage = 'Ready';
    }
    
    statusIcon.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    statusText.textContent = statusMessage;
    
    // Update main button
    updateVoiceMainButton(state);
}

function interruptVoiceSession() {
    console.log('[RETELL] Interrupting voice session');
    
    if (retellVoiceManager && retellVoiceManager.isSpeaking) {
        retellVoiceManager.interrupt();
    }
}

function updateVoiceMainButton(state) {
    voiceMainBtn.className = 'control-btn main-btn';
    
    switch (state) {
        case 'idle':
            voiceMainBtn.innerHTML = '<i class="fa-solid fa-microphone"></i><span class="btn-text">Start</span>';
            break;
        case 'listening':
            voiceMainBtn.classList.add('listening');
            voiceMainBtn.innerHTML = '<i class="fa-solid fa-stop"></i><span class="btn-text">Stop</span>';
            break;
        case 'processing':
            voiceMainBtn.classList.add('processing');
            voiceMainBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span class="btn-text">Processing</span>';
            break;
        case 'speaking':
            voiceMainBtn.classList.add('speaking');
            voiceMainBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i><span class="btn-text">Speaking</span>';
            break;
        case 'error':
            voiceMainBtn.innerHTML = '<i class="fa-solid fa-rotate"></i><span class="btn-text">Retry</span>';
            break;
    }
}

// ─── Transcript Management ────────────────────────────────────────────────

function addTranscriptMessage(role, text) {
    // Remove empty state if present
    const emptyState = transcriptContainer.querySelector('.transcript-empty');
    if (emptyState) {
        emptyState.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `transcript-message ${role}`;
    
    const roleDiv = document.createElement('div');
    roleDiv.className = 'role';
    roleDiv.innerHTML = role === 'user' 
        ? '<i class="fa-solid fa-user"></i> You'
        : '<i class="fa-solid fa-robot"></i> SpeakWise';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'text';
    textDiv.textContent = text;
    
    messageDiv.appendChild(roleDiv);
    messageDiv.appendChild(textDiv);
    transcriptContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}

function clearTranscript() {
    transcriptContainer.innerHTML = `
        <div class="transcript-empty">
            <i class="fa-solid fa-microphone-lines"></i>
            <p>Start speaking to see the live transcript</p>
        </div>
    `;
}

// ─── Voice Session Management ─────────────────────────────────────────────

async function startVoiceSession() {
    console.log('[RETELL] ===== STARTING RETELL VOICE SESSION =====');
    console.log('[RETELL] API Base:', API_BASE);
    console.log('[RETELL] Request URL:', `${API_BASE}/retell/create-call`);
    
    if (!retellVoiceManager) {
        console.error('[RETELL] RetellVoiceManager not initialized');
        updateOrbState('error');
        statusText.textContent = 'Voice service not available. Please refresh the page.';
        return;
    }
    
    try {
        voiceSessionActive = true;
        updateOrbState('processing');
        statusText.textContent = 'Connecting to voice agent...';
        
        // Request access token from backend
        console.log('[RETELL] Requesting access token from backend');
        let response;
        try {
            response = await fetch(`${API_BASE}/retell/create-call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            console.log('[RETELL] Fetch completed, status:', response.status);
        } catch (networkError) {
            console.error('[RETELL] NETWORK ERROR:', networkError);
            console.error('[RETELL] Network error details:', {
                message: networkError.message,
                name: networkError.name
            });
            throw new Error(`NETWORK ERROR: ${networkError.message}. Check if backend is running on ${API_BASE}`);
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[RETELL] HTTP ERROR:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(`HTTP ERROR ${response.status}: ${errorData.detail?.message || response.statusText}`);
        }
        
        const { access_token, call_id } = await response.json();
        console.log('[RETELL] Access token received, call ID:', call_id);
        console.log('[RETELL] Access token length:', access_token?.length || 0);
        
        // Clear previous transcript
        clearTranscript();
        
        // Start Retell call with callbacks
        console.log('[RETELL] Starting Retell SDK call with access token');
        const success = await retellVoiceManager.startCall(access_token, {
            onStateChange: (state) => {
                console.log('[RETELL] State change callback:', state);
                updateOrbState(state);
                
                // Update status text based on state
                switch (state) {
                    case 'idle':
                        statusText.textContent = 'Ready to listen';
                        break;
                    case 'listening':
                        statusText.textContent = 'SpeakWise is listening...';
                        break;
                    case 'thinking':
                        statusText.textContent = 'SpeakWise is thinking...';
                        break;
                    case 'speaking':
                        statusText.textContent = 'SpeakWise is speaking...';
                        break;
                }
            },
            onTranscript: (role, text) => {
                console.log('[RETELL] Transcript callback:', role, text);
                addTranscriptMessage(role, text);
            },
            onError: (error) => {
                console.error('[RETELL] SDK ERROR callback:', error);
                updateOrbState('error');
                statusText.textContent = `SDK ERROR: ${error}`;
            }
        });
        
        if (success) {
            console.log('[RETELL] ===== RETELL VOICE SESSION STARTED SUCCESSFULLY =====');
        } else {
            console.error('[RETELL] SDK returned false for startCall');
            throw new Error('SDK ERROR: Retell SDK failed to start call');
        }
        
    } catch (err) {
        console.error('[RETELL] SESSION FAILED:', err);
        console.error('[RETELL] Error details:', {
            message: err.message,
            name: err.name,
            stack: err.stack
        });
        updateOrbState('error');
        statusText.textContent = err.message || 'Failed to connect to voice agent';
        voiceSessionActive = false;
    }
}



async function stopVoiceSession() {
    console.log('[RETELL] ===== STOPPING RETELL VOICE SESSION =====');
    voiceSessionActive = false;
    
    if (retellVoiceManager) {
        console.log('[RETELL] Stopping Retell call');
        retellVoiceManager.stopCall();
    }
    
    updateOrbState('idle');
    statusText.textContent = 'Ready to listen';
    console.log('[RETELL] ===== RETELL VOICE SESSION STOPPED =====');
}



// ─── Event Listeners ─────────────────────────────────────────────────────

sendBtn.addEventListener("click", sendTextMessage);
textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) sendTextMessage();
});
refreshMemoryBtn.addEventListener("click", fetchMemory);
micBtn.addEventListener("click", toggleRecording);

// Voice Mode Event Listeners
voiceModeBtn.addEventListener('click', switchToVoiceMode);
chatModeBtn.addEventListener('click', switchToChatMode);
exitVoiceBtn.addEventListener('click', switchToChatMode);

voiceMainBtn.addEventListener('click', () => {
    console.log('[RETELL] Main button clicked, current state:', voiceState);
    
    // If currently speaking, interrupt and allow user to speak
    if (voiceState === 'speaking') {
        console.log('[RETELL] Interrupting to allow user to speak');
        interruptVoiceSession();
        return;
    }
    
    if (voiceState === 'idle' || voiceState === 'error') {
        startVoiceSession();
    } else if (voiceState === 'listening') {
        stopVoiceSession();
    } else if (voiceState === 'processing') {
        console.log('[RETELL] Currently connecting, please wait');
    }
});

stopBtn.addEventListener('click', stopVoiceSession);



fetchMemory();
