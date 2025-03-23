let recognition;
let isProcessing = false; // Prevent repeated processing for same word

function initVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        speak("Voice recognition not supported.");
        updateMicStatus("❌ Voice recognition not supported.");
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        updateMicStatus("🎙️ Listening for 'next' command...");
        speak("Hello shalaka & sanjana!. Say 'next' to admit a user.");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        console.log("👂 Heard:", transcript);

        if (transcript.includes("next") && !isProcessing) {
            isProcessing = true;
            admitNextUser();
            // Wait for 3s before accepting next command
            setTimeout(() => isProcessing = false, 3000);
        }
    };

    recognition.onerror = (event) => {
        console.error("⚠️ Voice recognition error:", event.error);
        updateMicStatus("⚠️ Voice error. Restarting recognition...");
        speak("There was an error. Restarting voice control.");
        restartRecognition();
    };

    recognition.onend = () => {
        console.log("🔁 Voice recognition ended, restarting...");
        updateMicStatus("🔄 Restarting voice recognition...");
        restartRecognition();
    };

    recognition.start();
}

function restartRecognition() {
    if (recognition) {
        recognition.stop(); // Prevent double listeners
        setTimeout(() => recognition.start(), 1000);
    }
}

function admitNextUser() {
    fetch(`/admit_next/${queueId}`)
        .then(response => {
            if (response.ok) {
                updateMicStatus("✅ User admitted via voice");
                speak("User admitted successfully.");
            } else {
                updateMicStatus("❌ Failed to admit user");
                speak("Failed to admit user.");
            }
        })
        .catch(err => {
            console.error("Fetch error:", err);
            updateMicStatus("⚠️ Network error");
            speak("Network error occurred.");
        });
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.volume = 1;
        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.cancel(); // Cancel previous utterance if any
        window.speechSynthesis.speak(utterance);
    }
}

function updateMicStatus(message) {
    const statusEl = document.getElementById("mic-status");
    if (statusEl) {
        statusEl.textContent = message;
    }
}

window.onload = initVoiceRecognition;
