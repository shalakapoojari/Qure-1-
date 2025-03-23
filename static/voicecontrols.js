let recognition;
let isProcessing = false;

// ✅ Set the queue ID from the HTML page
let queueId = window.queueIdFromServer || null;

// Initialize Voice Recognition
function initVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        speak("Voice recognition is not supported in this browser.");
        updateMicStatus("❌ Voice recognition not supported.");
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        updateMicStatus("🎙️ Listening... Say 'next' to admit user.");
        speak("Voice recognition activated. Say next to admit the next user.");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        console.log("Voice heard:", transcript);

        if (transcript.includes("next") && !isProcessing) {
            isProcessing = true;
            admitNextUser();

            setTimeout(() => {
                isProcessing = false;
            }, 3000); // Debounce for 3 seconds
        }
    };

    recognition.onerror = (event) => {
        console.error("Voice error:", event.error);
        updateMicStatus("⚠️ Error occurred. Restarting...");
        speak("An error occurred. Restarting voice recognition.");
        restartRecognition();
    };

    recognition.onend = () => {
        console.log("Recognition ended. Restarting...");
        updateMicStatus("🔄 Restarting voice recognition...");
        restartRecognition();
    };

    recognition.start();
}

// Restart recognizer in case of end or error
function restartRecognition() {
    if (recognition) {
        recognition.stop();
        setTimeout(() => recognition.start(), 1000);
    }
}

// Call admit next user route
function admitNextUser() {
    if (!queueId) {
        console.error("Queue ID not found");
        updateMicStatus("❌ Queue ID missing. Cannot admit user.");
        speak("Queue ID not available.");
        return;
    }

    fetch(`/admit_next/${queueId}`)
        .then((response) => {
            if (response.ok) {
                updateMicStatus("✅ User admitted via voice.");
                speak("User admitted successfully.");
            } else {
                updateMicStatus("❌ Failed to admit user.");
                speak("Failed to admit user.");
            }
        })
        .catch((err) => {
            console.error("Fetch error:", err);
            updateMicStatus("❌ Network error.");
            speak("There was a network error.");
        });
}

// Voice feedback system
function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1;
        utterance.pitch = 1;
        speechSynthesis.cancel(); // Stop any prior speech
        speechSynthesis.speak(utterance);
    }
}

// Update mic status on screen
function updateMicStatus(msg) {
    const micEl = document.getElementById("mic-status");
    if (micEl) micEl.textContent = msg;
}

// Start voice recognition once page is fully loaded
window.addEventListener("DOMContentLoaded", () => {
    initVoiceRecognition();
});
