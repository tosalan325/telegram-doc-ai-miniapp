const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const analyzeButton = document.getElementById("analyzeButton");
const statusBox = document.getElementById("statusBox");
const statusText = document.getElementById("statusText");
const errorBox = document.getElementById("errorBox");
const resultBox = document.getElementById("resultBox");
const resultText = document.getElementById("resultText");

let selectedFile = null;

function showStatus(message) {
    statusText.textContent = message;
    statusBox.classList.remove("hidden");
}

function hideStatus() {
    statusBox.classList.add("hidden");
}

function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

function hideError() {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
}

function showResult(text) {
    resultText.textContent = text;
    resultBox.classList.remove("hidden");
}

function hideResult() {
    resultBox.classList.add("hidden");
    resultText.textContent = "";
}

function resetSelectedFile() {
    selectedFile = null;
    fileInput.value = "";
    fileName.textContent = "Файл не выбран";
    fileName.classList.remove("selected");
    analyzeButton.disabled = true;
}

fileInput.addEventListener("change", () => {
    hideError();
    hideResult();

    selectedFile = fileInput.files[0];

    if (!selectedFile) {
        resetSelectedFile();
        return;
    }

    const maxSizeMb = 15;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (selectedFile.size > maxSizeBytes) {
        resetSelectedFile();
        showError(`Файл слишком большой. Максимальный размер: ${maxSizeMb} МБ.`);
        return;
    }

    fileName.textContent = `✅ Выбран файл: ${selectedFile.name}`;
    fileName.classList.add("selected");
    analyzeButton.disabled = false;
});

analyzeButton.addEventListener("click", async () => {
    if (!selectedFile) {
        showError("Сначала выберите файл.");
        return;
    }

    hideError();
    hideResult();
    showStatus("Загружаю и анализирую документ...");
    analyzeButton.disabled = true;

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.error || "Не удалось обработать файл.");
        }

        showResult(data.result || "AI не вернул результат.");
    } catch (error) {
        showError(error.message || "Произошла неизвестная ошибка.");
    } finally {
        hideStatus();
        analyzeButton.disabled = false;
    }
});