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

let accessToken = sessionStorage.getItem("driveAccessToken") || null;
let playersData = [];
let isLoggingIn = false;

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
        accessToken = sessionStorage.getItem("driveAccessToken");
        if (!accessToken) {
            // log.textContent = "Session expired. Please login again.";
            showLogin();
            toggleLoading(false);
            return;
        }
        showApp(user);
        loadPlayers();
    } else {
        accessToken = null;
        sessionStorage.removeItem("driveAccessToken");
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
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
        toggleLoading(true);
        const result = await auth.signInWithPopup(provider);
        accessToken = result.credential.accessToken;
        sessionStorage.setItem("driveAccessToken", accessToken);
        showApp(result.user);
        loadPlayers();
    } catch (err) {
        log.textContent = "Login failed: " + err.message;
    } finally {
        toggleLoading(false);
        isLoggingIn = false;
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

const dropZone = document.getElementById("dropZone");
const fileInfo = document.getElementById("fileInfo");

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const file = e.dataTransfer.files[0];
    if (file) {
        // Atualizar o fileInput com o arquivo arrastado
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // Exibir pré-visualização
        previewFile(file);
    }
});

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
        // Exibir pré-visualização
        previewFile(file);
    }
});

function previewFile(file) {
    // Limpar o conteúdo do dropZone
    dropZone.innerHTML = "";

    const fileType = file.type;
    if (fileType.startsWith("image/")) {
        // Criar elemento de imagem
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = "Preview";
        img.style.maxWidth = "100%";
        img.style.maxHeight = "100%";
        dropZone.appendChild(img);
    } else if (fileType.startsWith("video/")) {
        // Criar elemento de vídeo
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.controls = true;
        video.style.maxWidth = "100%";
        video.style.maxHeight = "100%";
        dropZone.appendChild(video);
    } else {
        // Caso o arquivo não seja imagem ou vídeo
        dropZone.textContent = "File type not supported for preview.";
    }
}

uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    const journeyId = journeySelect.value;
    const player = playersData.find((p) => p.id === playerSelect.value);
    const journey = player?.subfolders.find((j) => j.id === journeyId);

    if (!file || !accessToken || !journeyId) {
        console.log({ file, accessToken, journeyId, player });
        // alert("Please login, choose a player/journey, and select a file.");
        // return;
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
