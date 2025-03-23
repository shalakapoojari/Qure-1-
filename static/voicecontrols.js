// voice_control.js

let recognition;

function initVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        speak("Voice recognition is not supported in your browser.");
        updateMicStatus("❌ Voice recognition not supported.");
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log("🎤 Voice recognition started.");
        updateMicStatus("🎙️ Listening for 'next' command...");
        speak("Voice recognition activated. Say 'next' to admit a user.");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        console.log("👂 Heard:", transcript);
        if (transcript.includes("next")) {
            admitNextUser();
        }
    };

    recognition.onerror = (event) => {
        console.error("❌ Voice recognition error:", event.error);
        updateMicStatus("⚠️ Voice error, restarting...");
        speak("There was an error with voice recognition. Restarting.");
        restartRecognition();
    };

    recognition.onend = () => {
        console.log("🔁 Voice recognition stopped, restarting...");
        updateMicStatus("🔄 Restarting voice recognition...");
        restartRecognition();
    };

    recognition.start();
}

function restartRecognition() {
    setTimeout(() => {
        if (recognition) recognition.start();
    }, 1000);
}

function admitNextUser() {
    fetch(`/admit_next/${queueId}`)
        .then(response => {
            if (response.ok) {
                console.log("✅ User admitted via voice command.");
                updateMicStatus("✅ User admitted! Listening again...");
                speak("User admitted successfully.");
            } else {
                console.warn("❌ Failed to admit user.");
                updateMicStatus("⚠️ Failed to admit user.");
                speak("Failed to admit the user. Please try again.");
            }
        })
        .catch(err => {
            console.error("❌ Fetch error:", err);
            updateMicStatus("⚠️ Network error.");
            speak("There was a network error. Please check your connection.");
        });
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.volume = 1;    // 0 to 1
        utterance.rate = 1;      // 0.1 to 10
        utterance.pitch = 1;     // 0 to 2
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn("🗣️ Speech synthesis not supported.");
    }
}

function updateMicStatus(message) {
    const statusEl = document.getElementById("mic-status");
    if (statusEl) {
        statusEl.textContent = message;
    }
}

window.onload = initVoiceRecognition;
