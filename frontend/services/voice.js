console.log('[VOICE DEBUG] ===== voice.js LOADING STARTED =====');
console.log('[VOICE DEBUG] Script execution started');
console.log('[VOICE DEBUG] Current timestamp:', new Date().toISOString());

function detectMimeType() {
    console.log('[VOICE] Detecting supported MIME types');
    console.log('[VOICE] MediaRecorder available:', typeof MediaRecorder !== "undefined");
    
    if (typeof MediaRecorder === "undefined") {
        console.log('[VOICE] MediaRecorder not supported, defaulting to audio/webm');
        return "audio/webm";
    }
    
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const t of types) {
        const supported = MediaRecorder.isTypeSupported(t);
        console.log(`[VOICE] ${t}: ${supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
        if (supported) return t;
    }
    
    console.log('[VOICE] No preferred types supported, defaulting to audio/webm');
    return "audio/webm";
}

function mimeToExt(mime) {
    if (mime.includes("webm")) return "webm";
    if (mime.includes("mp4")) return "m4a";
    if (mime.includes("ogg")) return "ogg";
    return "webm";
}

// Make available globally
if (typeof window !== 'undefined') {
    console.log('[VOICE DEBUG] Exporting functions to window');
    window.detectMimeType = detectMimeType;
    window.mimeToExt = mimeToExt;
    console.log('[VOICE DEBUG] Functions exported successfully');
}

class AudioAmplitudeMonitor {
    constructor() {
        this.context = null;
        this.analyser = null;
        this.data = null;
        this.rafId = null;
        this.level = 0;
        this.onUpdate = null;
        console.log('[VOICE MONITOR] AudioAmplitudeMonitor initialized');
    }

    async connectStream(stream) {
        console.log('[VOICE MONITOR] Connecting to stream');
        await this._setup();
        console.log('[VOICE MONITOR] AudioContext state:', this.context.state);
        
        const source = this.context.createMediaStreamSource(stream);
        console.log('[VOICE MONITOR] MediaStreamSource created');
        
        source.connect(this.analyser);
        console.log('[VOICE MONITOR] Source connected to analyser');
        
        this._startLoop();
        console.log('[VOICE MONITOR] Amplitude monitoring loop started');
    }

    async connectElement(audioEl) {
        console.log('[VOICE MONITOR] Connecting to audio element');
        await this._setup();
        console.log('[VOICE MONITOR] AudioContext state before resume:', this.context.state);
        
        if (this.context.state === "suspended") {
            await this.context.resume();
            console.log('[VOICE MONITOR] AudioContext resumed');
        }
        
        const source = this.context.createMediaElementSource(audioEl);
        console.log('[VOICE MONITOR] MediaElementSource created');
        
        source.connect(this.analyser);
        this.analyser.connect(this.context.destination);
        console.log('[VOICE MONITOR] Audio element connected to analyser and destination');
        
        this._startLoop();
        console.log('[VOICE MONITOR] Amplitude monitoring loop started');
    }

    async _setup() {
        if (!this.context) {
            console.log('[VOICE MONITOR] Creating new AudioContext');
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[VOICE MONITOR] AudioContext created');
            
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.75;
            this.data = new Uint8Array(this.analyser.frequencyBinCount);
            console.log('[VOICE MONITOR] Analyser configured');
        }
        
        if (this.context.state === "suspended") {
            console.log('[VOICE MONITOR] Resuming suspended AudioContext');
            await this.context.resume();
        }
    }

    _startLoop() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        const tick = () => {
            if (!this.analyser || !this.data) return;
            this.analyser.getByteFrequencyData(this.data);
            let sum = 0;
            for (let i = 0; i < this.data.length; i++) sum += this.data[i];
            const raw = sum / (this.data.length * 255);
            this.level = this.level * 0.8 + raw * 0.2;
            this.onUpdate?.(this.level);
            this.rafId = requestAnimationFrame(tick);
        };
        tick();
    }

    getLevel() {
        return this.level;
    }

    disconnect() {
        console.log('[VOICE MONITOR] Disconnecting');
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.level = 0;
        if (this.context) {
            this.context.close().catch(() => {});
            console.log('[VOICE MONITOR] AudioContext closed');
        }
        this.context = null;
        this.analyser = null;
        this.data = null;
    }
}

/**
 * Simple voice-activity / silence detector for turn-based voice mode.
 */
class SilenceDetector {
    constructor(analyser, {
        speechThreshold = 0.04,
        silenceThreshold = 0.02,
        silenceDurationMs = 1600,
        minSpeechMs = 600,
        maxDurationMs = 30000,
    } = {}) {
        this.analyser = analyser;
        this.speechThreshold = speechThreshold;
        this.silenceThreshold = silenceThreshold;
        this.silenceDurationMs = silenceDurationMs;
        this.minSpeechMs = minSpeechMs;
        this.maxDurationMs = maxDurationMs;
        this.data = new Uint8Array(analyser.frequencyBinCount);
        this.rafId = null;
        this.onSilence = null;
        this.onAmplitude = null;
        this._speechStart = null;
        this._lastSpeech = null;
        this._startedAt = null;
        console.log('[VOICE SILENCE] SilenceDetector initialized with thresholds:', speechThreshold, silenceThreshold);
    }

    start() {
        console.log('[VOICE SILENCE] Starting silence detection');
        this._speechStart = null;
        this._lastSpeech = null;
        this._startedAt = performance.now();
        const tick = () => {
            this.analyser.getByteFrequencyData(this.data);
            let sum = 0;
            for (let i = 0; i < this.data.length; i++) sum += this.data[i];
            const level = sum / (this.data.length * 255);
            this.onAmplitude?.(level);
            const now = performance.now();

            if (level >= this.speechThreshold) {
                if (!this._speechStart) {
                    this._speechStart = now;
                    console.log('[VOICE SILENCE] Speech detected');
                }
                this._lastSpeech = now;
            }

            if (this._speechStart && this._lastSpeech) {
                const silentFor = now - this._lastSpeech;
                const spokeFor = this._lastSpeech - this._speechStart;
                if (silentFor >= this.silenceDurationMs && spokeFor >= this.minSpeechMs) {
                    console.log('[VOICE SILENCE] Silence detected after', spokeFor.toFixed(0), 'ms of speech');
                    this.stop();
                    this.onSilence?.();
                    return;
                }
            }

            if (now - this._startedAt >= this.maxDurationMs) {
                console.log('[VOICE SILENCE] Max duration reached');
                this.stop();
                this.onSilence?.();
                return;
            }

            this.rafId = requestAnimationFrame(tick);
        };
        tick();
    }

    stop() {
        console.log('[VOICE SILENCE] Stopping silence detection');
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }
}

class VoiceRecorder {
    constructor() {
        this.stream = null;
        this.recorder = null;
        this.chunks = [];
        this.mimeType = detectMimeType();
        this.monitor = new AudioAmplitudeMonitor();
        this.stopPromise = null;
        this.stopResolve = null;
        this.stopReject = null;
        console.log('[VOICE RECORDER] Initialized with MIME type:', this.mimeType);
    }

    async start(onAmplitude) {
        console.log('[VOICE RECORDER] ===== STARTING RECORDING =====');
        this.chunks = [];
        this.mimeType = detectMimeType();
        console.log('[VOICE RECORDER] Selected MIME type:', this.mimeType);
        
        try {
            console.log('[VOICE RECORDER] Requesting microphone access via getUserMedia');
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('[VOICE RECORDER] ✓ Microphone access granted');
            console.log('[VOICE RECORDER] Stream tracks:', this.stream.getTracks().length);
            console.log('[VOICE RECORDER] Stream ID:', this.stream.id);
            
            // Connect amplitude monitor separately - don't let this failure break microphone access
            this.monitor.onUpdate = onAmplitude || null;
            try {
                console.log('[VOICE RECORDER] Connecting amplitude monitor for orb animation');
                await this.monitor.connectStream(this.stream);
                console.log('[VOICE RECORDER] ✓ Amplitude monitor connected');
            } catch (monitorErr) {
                console.warn('[VOICE RECORDER] ⚠️ Amplitude monitor failed (orb animation won\'t work):', monitorErr);
                console.warn('[VOICE RECORDER] ⚠️ Continuing without amplitude monitoring - microphone will still work');
                // Don't throw - continue without amplitude monitoring
            }

            console.log('[VOICE RECORDER] Creating MediaRecorder');
            this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
            console.log('[VOICE RECORDER] ✓ MediaRecorder created, state:', this.recorder.state);
            
            this.recorder.ondataavailable = (e) => {
                if (e.data?.size > 0) {
                    this.chunks.push(e.data);
                    console.log('[VOICE RECORDER] Data chunk received, size:', e.data.size, 'total chunks:', this.chunks.length);
                }
            };

            // Create a new promise for the stop operation
            this.stopPromise = new Promise((resolve, reject) => {
                this.stopResolve = resolve;
                this.stopReject = reject;
                
                this.recorder.onstop = () => {
                    console.log('[VOICE RECORDER] Recording stopped');
                    const blob = new Blob(this.chunks, { type: this.mimeType });
                    console.log('[VOICE RECORDER] Audio blob created, size:', blob.size, 'type:', blob.type);
                    this.chunks = [];
                    this.cleanup();
                    resolve({ blob, ext: mimeToExt(this.mimeType) });
                };
                
                this.recorder.onerror = (err) => {
                    console.error('[VOICE RECORDER] MediaRecorder error:', err);
                    this.cleanup();
                    reject(err);
                };
            });

            console.log('[VOICE RECORDER] Starting MediaRecorder with 250ms timeslice');
            this.recorder.start(250);
            console.log('[VOICE RECORDER] ✓ MediaRecorder started, state:', this.recorder.state);
            console.log('[VOICE RECORDER] ===== RECORDING STARTED SUCCESSFULLY =====');
            
            return this.stopPromise;
        } catch (err) {
            console.error('[VOICE RECORDER] ✗ Error during start:', err);
            console.error('[VOICE RECORDER] Error name:', err.name);
            console.error('[VOICE RECORDER] Error message:', err.message);
            console.error('[VOICE RECORDER] Error stack:', err.stack);
            this.cleanup();
            throw err;
        }
    }

    async stop() {
        console.log('[VOICE RECORDER] ===== STOPPING RECORDING =====');
        if (this.recorder && this.recorder.state !== "inactive") {
            console.log('[VOICE RECORDER] Stopping MediaRecorder, current state:', this.recorder.state);
            this.recorder.stop();
        } else {
            console.log('[VOICE RECORDER] MediaRecorder already inactive or not created');
        }
        return this.stopPromise;
    }

    cleanup() {
        console.log('[VOICE RECORDER] ===== CLEANING UP RESOURCES =====');
        this.monitor.disconnect();
        if (this.stream) {
            console.log('[VOICE RECORDER] Stopping stream tracks');
            this.stream.getTracks().forEach(t => {
                console.log('[VOICE RECORDER] Stopping track:', t.kind, t.label);
                t.stop();
            });
            this.stream = null;
        }
        this.recorder = null;
        this.stopPromise = null;
        this.stopResolve = null;
        this.stopReject = null;
    }

    getAnalyser() {
        return this.monitor.analyser;
    }
}

function playAudioWithMonitor(audioEl, url, monitor, onEnded) {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            audioEl.removeEventListener("ended", onEnd);
            audioEl.removeEventListener("error", onErr);
            monitor?.disconnect();
        };
        const onEnd = () => { cleanup(); onEnded?.(); resolve(); };
        const onErr = () => { cleanup(); reject(new Error("Audio playback failed")); };

        audioEl.addEventListener("ended", onEnd);
        audioEl.addEventListener("error", onErr);
        audioEl.src = url;

        monitor.connectElement(audioEl)
            .then(() => audioEl.play())
            .catch(reject);
    });
}

// Make classes available globally for non-module usage
if (typeof window !== 'undefined') {
    console.log('[VOICE JS] Exporting classes to window object');
    window.detectMimeType = detectMimeType;
    window.mimeToExt = mimeToExt;
    window.AudioAmplitudeMonitor = AudioAmplitudeMonitor;
    window.SilenceDetector = SilenceDetector;
    window.VoiceRecorder = VoiceRecorder;
    window.playAudioWithMonitor = playAudioWithMonitor;
    console.log('[VOICE JS] Classes exported successfully');
    console.log('[VOICE JS] ===== voice.js LOADING COMPLETED =====');
}
