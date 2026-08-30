const API_BASE = "";

function safeText(value, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function parseApiError(errData) {
    if (errData?.detail?.message) {
        return { code: errData.detail.error || null, message: errData.detail.message };
    }
    if (typeof errData?.detail === "string") {
        return { code: null, message: errData.detail };
    }
    return { code: null, message: "Something went wrong. Please try again." };
}

export async function sendChatMessage(message, sessionId = "default") {
    const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id: sessionId }),
    });
    const data = await res.json();
    return {
        response: safeText(data?.response, "Sorry, I didn't get that. Could you say that again?"),
    };
}

export async function sendVoiceChat(blob, filename, sessionId = "default") {
    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("session_id", sessionId);

    const res = await fetch(`${API_BASE}/voice/chat`, { method: "POST", body: formData });
    if (!res.ok) {
        let errData = null;
        try { errData = await res.json(); } catch (_) { /* ignore */ }
        const err = parseApiError(errData);
        throw Object.assign(new Error(err.message), { code: err.code, status: res.status });
    }

    const data = await res.json();
    return {
        transcript: safeText(data?.transcript),
        response: safeText(data?.response, "Sorry, I didn't get that. Could you say that again?"),
        audioUrl: safeText(data?.audio_url) || null,
        ttsOk: data?.tts_ok !== false && !!safeText(data?.audio_url),
    };
}

export async function generateTTS(text) {
    const res = await fetch(`${API_BASE}/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    if (!res.ok) {
        let errData = null;
        try { errData = await res.json(); } catch (_) { /* ignore */ }
        throw new Error(parseApiError(errData).message);
    }
    const data = await res.json();
    return safeText(data?.audio_url) || null;
}

export async function fetchProfile() {
    const res = await fetch(`${API_BASE}/memory/profile`);
    return res.json();
}

export async function fetchMistakes(limit = 10) {
    const res = await fetch(`${API_BASE}/memory/mistakes?limit=${limit}`);
    return res.json();
}
