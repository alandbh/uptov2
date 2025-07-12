// Firebase config (same as app.js)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_APP_ID",
};

const PLAYERS_JSON_PATH = "players.json";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
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

window.addEventListener("DOMContentLoaded", async () => {
    const formData = new FormData();
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

uploadBtn.addEventListener("click", () => {
    if (!receivedFile || !accessToken || !journeySelect.value) {
        alert("Missing file, token or journey selection");
        return;
    }

    const metadata = {
        name: receivedFile.name,
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
            log.textContent = `✅ Uploaded: ${response.name}\nURL: ${response.webViewLink}`;
        } else {
            log.textContent = `❌ Upload failed (${xhr.status}): ${xhr.statusText}`;
        }
    };

    xhr.onerror = () => {
        log.textContent = "❌ Upload error occurred.";
    };

    xhr.send(form);
});
