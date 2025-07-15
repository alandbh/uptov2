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
let receivedFile = null;

const playerSelect = document.getElementById("playerSelect");
const journeySelect = document.getElementById("journeySelect");
const uploadBtn = document.getElementById("uploadBtn");
const preview = document.getElementById("preview");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const log = document.getElementById("log");

window.addEventListener("DOMContentLoaded", async () => {
    // const body = await new Response(
    //     location.search === "" ? window.__shareFile : null
    // ).formData();

    let body;

    if (location.search === "") {
        if (window.__shareFile) {
            const response = new Response(window.__shareFile);
            body = await response.formData();
        } else {
            log.textContent = "No file received via share target.";
            return;
        }
    } else {
        const response = new Response(new URLSearchParams(location.search));
        body = await response.formData();
    }

    // Verificar se body foi inicializado corretamente
    if (!body) {
        log.textContent = "Failed to process the shared file.";
        return;
    }

    const file = body.get("file");

    if (!file) {
        log.textContent = "No file received via share target.";
        return;
    }

    receivedFile = file;
    preview.innerHTML = file.type.startsWith("image/")
        ? `<img src="${URL.createObjectURL(
              file
          )}" class="w-full rounded shadow" />`
        : `<p class='text-sm'>File: ${file.name} (${file.type})</p>`;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            accessToken = sessionStorage.getItem("driveAccessToken");
            if (!accessToken) {
                log.textContent = "Session expired. Please login again.";
                return;
            }
            uploadBtn.disabled = false;
            await loadPlayers();
        } else {
            try {
                const result = await auth.signInWithPopup(provider);
                accessToken = result.credential.accessToken;
                sessionStorage.setItem("driveAccessToken", accessToken);
                uploadBtn.disabled = false;
                await loadPlayers();
            } catch (err) {
                log.textContent = "Login failed: " + err.message;
            }
        }
    });
});

async function loadPlayers() {
    const res = await fetch(PLAYERS_JSON_PATH);
    playersData = await res.json();

    playersData.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        playerSelect.appendChild(opt);
    });
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
    if (!receivedFile || !accessToken || !journeySelect.value) {
        alert("Missing file, token or journey selection");
        return;
    }

    const player = playersData.find((p) => p.id === playerSelect.value);
    const journey = player?.subfolders.find(
        (j) => j.id === journeySelect.value
    );
    const ext = receivedFile.name.split(".").pop();
    const prefix = receivedFile.type.startsWith("image/") ? "i" : "v";
    const count = await countFilesInFolder(journeySelect.value);
    const customName = `${prefix}${count + 1}-${slugify(
        journey.name
    )}-${slugify(player.name)}.${ext}`;

    const metadata = {
        name: customName,
        parents: [journeySelect.value],
    };

    const form = new FormData();
    form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", receivedFile);

    progressContainer.classList.remove("hidden");
    progressBar.style.width = "0%";

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
            document.getElementById("copyBtn").addEventListener("click", () => {
                navigator.clipboard.writeText(response.name);
                document.getElementById("copyBtn").textContent = "Copied!";
            });
        } else {
            log.textContent = `❌ Upload failed (${xhr.status}): ${xhr.statusText}`;
        }
    };

    xhr.onerror = () => {
        log.textContent = "❌ Upload error occurred.";
    };

    xhr.send(form);
});
