// Firebase config (same as app.js)
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
// provider.addScope("https://www.googleapis.com/auth/drive");
provider.addScope("https://www.googleapis.com/auth/drive.file");

let accessToken = null;
let playersData = [];
let receivedFile = null;

const playerSelect = document.getElementById("playerSelect");
const journeySelect = document.getElementById("journeySelect");
const uploadBtn = document.getElementById("uploadBtn");
const preview = document.getElementById("preview");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const log = document.getElementById("log");

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

// async function countFilesInFolder(folderId) {
//     const res = await fetch(
//         `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id)`,
//         {
//             headers: { Authorization: `Bearer ${accessToken}` },
//         }
//     );
//     const json = await res.json();
//     return json.files?.length || 0;
// }

async function countFilesInFolder(folderId) {
    const res = await fetch(
        `https://alanvasconcelos.net/uptodrive/?list=files&folder=${folderId}`
    );
    const files = await res.json();
    return files.length || 0;
}

window.addEventListener("DOMContentLoaded", async () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            user.getIdToken().then((token) => {
                accessToken = token;
                uploadBtn.disabled = false;
                loadPlayers();
            });
        }
    });
    auth.onAuthStateChanged((user) => {
        if (user) {
            user.getIdToken().then((token) => {
                accessToken = token;
                uploadBtn.disabled = false;
                loadPlayers();
            });
        }
    });
    const body = await new Response(
        location.search === "" ? window.__shareFile : null
    ).formData();
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

    try {
        const result = await auth.signInWithPopup(provider);
        accessToken = result.credential.accessToken;
        uploadBtn.disabled = false;
        loadPlayers();
    } catch (err) {
        log.textContent = "Login failed: " + err.message;
    }
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

uploadBtn.addEventListener("click", async () => {
    const journeyId = journeySelect.value;
    const player = playersData.find((p) => p.id === playerSelect.value);
    const journey = player?.subfolders.find((j) => j.id === journeyId);

    if (!receivedFile || !accessToken || !journeyId || !player || !journey) {
        alert("Missing file, token or journey selection");
        return;
    }

    const ext = receivedFile.name.split(".").pop();
    const prefix = receivedFile.type.startsWith("image/") ? "i" : "v";
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
