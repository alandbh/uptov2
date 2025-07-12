// Firebase configuration (substitua com a sua)
// const firebaseConfig = {
//     apiKey: "YOUR_API_KEY",
//     authDomain: "YOUR_PROJECT.firebaseapp.com",
//     projectId: "YOUR_PROJECT_ID",
//     appId: "YOUR_APP_ID",
// };
const firebaseConfig = {
    apiKey: "AIzaSyCOl1-8HoQQMB5fQdsJrfSwvR9qOlWeTkc",
    authDomain: "uptov2-da01d.firebaseapp.com",
    projectId: "uptov2-da01d",
    storageBucket: "uptov2-da01d.firebasestorage.app",
    messagingSenderId: "742064299083",
    appId: "1:742064299083:web:ea688d0d0ea318fe7ac1ce",
};

const PLAYERS_JSON_PATH = "players.json";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");

let accessToken = null;
let playersData = [];

const loginBtn = document.getElementById("loginBtn");
const uploadBtn = document.getElementById("uploadBtn");
const playerSelect = document.getElementById("playerSelect");
const journeySelect = document.getElementById("journeySelect");
const fileInput = document.getElementById("fileInput");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const log = document.getElementById("log");

loginBtn.addEventListener("click", async () => {
    try {
        const result = await auth.signInWithPopup(provider);
        accessToken = result.credential.accessToken;
        uploadBtn.disabled = false;
        loginBtn.textContent = `Logged in as ${result.user.displayName}`;
        loginBtn.classList.add("bg-gray-400", "cursor-default");
        loginBtn.disabled = true;
        loadPlayers();
    } catch (err) {
        log.textContent = "Login failed: " + err.message;
    }
});

async function loadPlayers() {
    try {
        const response = await fetch(PLAYERS_JSON_PATH);
        playersData = await response.json();

        playersData.forEach((player) => {
            const opt = document.createElement("option");
            opt.value = player.id;
            opt.textContent = player.name;
            playerSelect.appendChild(opt);
        });
    } catch (e) {
        log.textContent = "Failed to load players.json";
    }
}

playerSelect.addEventListener("change", () => {
    journeySelect.innerHTML = '<option value="">Select a journey</option>';
    journeySelect.disabled = true;
    const player = playersData.find((p) => p.id === playerSelect.value);
    if (player) {
        player.subfolders.forEach((j) => {
            const opt = document.createElement("option");
            opt.value = j.id;
            opt.textContent = j.name;
            journeySelect.appendChild(opt);
        });
        journeySelect.disabled = false;
    }
});

uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    const journeyId = journeySelect.value;
    if (!file || !accessToken || !journeyId) {
        alert("Please login, choose a player/journey, and select a file.");
        return;
    }

    const metadata = {
        name: file.name,
        parents: [journeyId],
    };

    const form = new FormData();
    form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", file);

    progressContainer.classList.remove("hidden");
    progressBar.style.width = "0%";

    try {
        const xhr = new XMLHttpRequest();
        xhr.open(
            "POST",
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink"
        );
        xhr.setRequestHeader("Authorization", "Bearer " + accessToken);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                progressBar.style.width = `${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status < 300) {
                const response = JSON.parse(xhr.responseText);
                log.textContent = `✅ Uploaded: ${response.name}\nURL: ${response.webViewLink}`;
            } else {
                log.textContent = `❌ Upload failed (${xhr.status}): ${xhr.statusText}`;
            }
        };

        xhr.onerror = () => {
            log.textContent = "❌ Upload error occurred.";
        };

        xhr.send(form);
    } catch (err) {
        log.textContent = "❌ Upload failed: " + err.message;
    }
});
