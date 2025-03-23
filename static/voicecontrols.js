let recognition;
let queueId = window.queueIdFromServer || null;
let isProcessing = false;

// Initialize Voice Recognition
function initVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        updateMicStatus("❌ Voice recognition not supported.");
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        speak("Hello sangeeta maam.");
        updateMicStatus("🎙️ Listening for the word 'next'...");
    };

    recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        console.log("Recognized:", result);

        if (result.includes("next") && !isProcessing) {
            isProcessing = true;
            admitNextUser();
            setTimeout(() => {
                isProcessing = false;
            }, 3000); // prevent multiple triggers
        }
    };

    recognition.onerror = (event) => {
        console.error("Recognition error:", event.error);
        updateMicStatus("⚠️ Voice recognition error.");
    };

    recognition.onend = () => {
        // Don't speak on end, just restart silently
        console.log("Recognition ended. Restarting...");
        recognition.start(); // silent restart
    };

    recognition.start();
}

// Admit user via fetch
function admitNextUser() {
    if (!queueId) {
        console.warn("Queue ID missing.");
        updateMicStatus("❌ Queue ID not available.");
        speak("Queue ID not available.");
        return;
    }

    fetch(`/admit_next/${queueId}`)
        .then(response => {
            if (response.ok) {
                updateMicStatus("✅ User admitted via voice.");
                speak("User admitted.");
            } else {
                updateMicStatus("❌ Failed to admit user.");
                speak("Failed to admit user.");
            }
        })
        .catch(err => {
            console.error("Fetch error:", err);
            updateMicStatus("❌ Network error.");
            speak("Network error.");
        });
}

// Speak text once
function speak(text) {
    if ('speechSynthesis' in window && text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        speechSynthesis.cancel(); // prevent overlapping speech
        speechSynthesis.speak(utterance);
    }
}

// Show mic status on page
function updateMicStatus(msg) {
    const status = document.getElementById("mic-status");
    if (status) {
        status.textContent = msg;
    }
}

// Start everything on page load
window.addEventListener("DOMContentLoaded", () => {
    initVoiceRecognition();
});
