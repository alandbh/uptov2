// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCOl1-8HoQQMB5fQdsJrfSwvR9qOlWeTkc",
    authDomain: "uptov2-da01d.firebaseapp.com",
    projectId: "uptov2-da01d",
    storageBucket: "uptov2-da01d.appspot.com",
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

const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const avatarBtn = document.getElementById("avatarBtn");
const logoutPopover = document.getElementById("logoutPopover");
const logoutBtn = document.getElementById("logoutBtn");
const loginBtn = document.getElementById("loginBtn");
const uploadBtn = document.getElementById("uploadBtn");
const playerSelect = document.getElementById("playerSelect");
const journeySelect = document.getElementById("journeySelect");
const fileInput = document.getElementById("fileInput");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const log = document.getElementById("log");
const loadingOverlay = document.getElementById("loadingOverlay");

function toggleLoading(show) {
    if (!loadingOverlay) return;
    if (show) {
        loadingOverlay.classList.remove("hidden");
    } else {
        loadingOverlay.classList.add("hidden");
    }
}

function fadeTransition(showAppView) {
    const fadeOut = showAppView ? loginSection : appSection;
    const fadeIn = showAppView ? appSection : loginSection;

    fadeOut.classList.add("opacity-0");
    setTimeout(() => {
        fadeOut.classList.add("hidden");
        fadeIn.classList.remove("hidden");
        fadeIn.classList.add("opacity-0");
        setTimeout(() => {
            fadeIn.classList.remove("opacity-0");
        }, 10);
    }, 300);
}

auth.onAuthStateChanged(async (user) => {
    toggleLoading(true);
    if (user) {
        accessToken = (await user.getIdTokenResult()).token;
        showApp(user);
        loadPlayers();
    } else {
        showLogin();
    }
    toggleLoading(false);
});

function showApp(user) {
    fadeTransition(true);
    avatarBtn.innerHTML = `<img src="${user.photoURL}" class="h-8 w-8 rounded-full" />`;
    uploadBtn.disabled = false;
}

function showLogin() {
    fadeTransition(false);
    uploadBtn.disabled = true;
}

avatarBtn.addEventListener("click", () => {
    logoutPopover.classList.toggle("hidden");
});

logoutBtn.addEventListener("click", () => {
    auth.signOut();
});

loginBtn.addEventListener("click", async () => {
    try {
        toggleLoading(true);
        const result = await auth.signInWithPopup(provider);
        accessToken = result.credential.accessToken;
        showApp(result.user);
        loadPlayers();
    } catch (err) {
        log.textContent = "Login failed: " + err.message;
    } finally {
        toggleLoading(false);
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

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

async function countFilesInFolder(folderId) {
    const res = await fetch(
        `https://alanvasconcelos.net/uptodrive/?list=files&folder=${folderId}`
    );
    const files = await res.json();
    return files.length || 0;
}

uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    const journeyId = journeySelect.value;
    const player = playersData.find((p) => p.id === playerSelect.value);
    const journey = player?.subfolders.find((j) => j.id === journeyId);

    if (!file || !accessToken || !journeyId) {
        alert("Please login, choose a player/journey, and select a file.");
        return;
    }

    const ext = file.name.split(".").pop();
    const prefix = file.type.startsWith("image/") ? "i" : "v";
    const count = await countFilesInFolder(journeyId);
    const customName = `${prefix}${count + 1}-${slugify(
        journey.name
    )}-${slugify(player.name)}.${ext}`;

    const metadata = {
        name: customName,
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
                log.innerHTML = `
            <p class="mb-2">✅ <strong>${response.name}</strong> uploaded successfully.</p>
            <button id="copyBtn" class="bg-gray-200 text-sm px-3 py-1 rounded hover:bg-gray-300">Copy to clipboard</button>
          `;
                document
                    .getElementById("copyBtn")
                    .addEventListener("click", () => {
                        navigator.clipboard.writeText(response.name);
                        document.getElementById("copyBtn").textContent =
                            "Copied!";
                    });
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
