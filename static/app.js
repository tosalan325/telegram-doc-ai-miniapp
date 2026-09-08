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
const analysisPanel = document.getElementById("analysisPanel");
const analysisButtons = document.querySelectorAll(".analysis-button");
const copyButton = document.getElementById("copyButton");

let selectedFile = null;
let selectedAnalysisType = "full";

const analysisButtonTexts = {
    full: "🧾 Сделать полный анализ",
    summary: "📄 Сделать краткое резюме",
    strengths: "✅ Показать сильные стороны",
    weaknesses: "⚠️ Показать слабые стороны",
    risks: "❗ Найти риски",
    dates: "📅 Найти даты и сроки",
    money: "💰 Найти суммы и платежи",
    parties: "👥 Определить стороны",
    attention: "🔍 На что обратить внимание",
    simple: "🧠 Объяснить простыми словами",
    fixes: "✍️ Что исправить",
    questions: "❓ Подготовить вопросы",
    dangerous: "🟥 Найти опасные формулировки",
    score: "📊 Оценить документ",
};

const analysisStatusTexts = {
    full: "Делаю полный анализ документа...",
    summary: "Готовлю краткое резюме...",
    strengths: "Ищу сильные стороны документа...",
    weaknesses: "Ищу слабые стороны документа...",
    risks: "Проверяю возможные риски...",
    dates: "Ищу даты и сроки...",
    money: "Ищу суммы, платежи и штрафы...",
    parties: "Определяю стороны документа...",
    attention: "Выделяю важные пункты...",
    simple: "Объясняю документ простыми словами...",
    fixes: "Ищу, что можно улучшить...",
    questions: "Готовлю вопросы второй стороне...",
    dangerous: "Ищу опасные формулировки...",
    score: "Оцениваю документ...",
};

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

function setAnalyzeButtonText() {
    analyzeButton.textContent =
        analysisButtonTexts[selectedAnalysisType] || "Проверить документ";
}

function resetSelectedFile() {
    selectedFile = null;
    fileInput.value = "";
    fileName.textContent = "Файл не выбран";
    fileName.classList.remove("selected");
    analyzeButton.disabled = true;

    analysisPanel.classList.add("hidden");
    selectedAnalysisType = "full";

    analysisButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.type === "full");
    });

    setAnalyzeButtonText();
}

analysisButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedAnalysisType = button.dataset.type || "full";

        analysisButtons.forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        setAnalyzeButtonText();
        hideError();
        hideResult();
    });
});

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
    analysisPanel.classList.remove("hidden");
});

analyzeButton.addEventListener("click", async () => {
    if (!selectedFile) {
        showError("Сначала выберите файл.");
        return;
    }

    hideError();
    hideResult();

    showStatus(
        analysisStatusTexts[selectedAnalysisType] || "Анализирую документ..."
    );

    analyzeButton.disabled = true;
    analysisButtons.forEach((button) => {
        button.disabled = true;
    });

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("analysis_type", selectedAnalysisType);

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

        analysisButtons.forEach((button) => {
            button.disabled = false;
        });
    }
});

copyButton.addEventListener("click", async () => {
    const text = resultText.textContent.trim();

    if (!text) {
        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        const oldText = copyButton.textContent;
        copyButton.textContent = "✅ Скопировано";

        setTimeout(() => {
            copyButton.textContent = oldText;
        }, 1600);
    } catch (error) {
        showError("Не удалось скопировать текст. Выделите результат вручную.");
    }
});