const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

const fileInput = document.getElementById("fileInput");
const fileInput2 = document.getElementById("fileInput2");

const fileName = document.getElementById("fileName");
const fileName2 = document.getElementById("fileName2");

const analyzeButton = document.getElementById("analyzeButton");

const statusBox = document.getElementById("statusBox");
const statusText = document.getElementById("statusText");

const errorBox = document.getElementById("errorBox");

const resultBox = document.getElementById("resultBox");
const resultText = document.getElementById("resultText");

const analysisButtons = document.querySelectorAll(".analysis-button");
const roleButtons = document.querySelectorAll(".role-button");

const copyButton = document.getElementById("copyButton");

const customQuestionBox = document.getElementById("customQuestionBox");
const customQuestion = document.getElementById("customQuestion");

const compareBox = document.getElementById("compareBox");

const historyBox = document.getElementById("historyBox");
const historyList = document.getElementById("historyList");
const clearHistoryButton = document.getElementById("clearHistoryButton");

let selectedFile = null;
let selectedFile2 = null;
let selectedAnalysisType = "full";
let selectedUserRole = "signer";

const HISTORY_KEY = "doccheck_history_v1";

const analysisButtonTexts = {
    full: "🧾 Сделать полный анализ",
    summary: "📄 Сделать краткое резюме",
    strengths: "✅ Показать сильные стороны",
    weaknesses: "⚠️ Показать слабые стороны",
    risks: "❗ Найти риски документа",
    dates: "📅 Найти даты и сроки",
    money: "💰 Найти деньги и суммы",
    parties: "👥 Определить стороны документа",
    attention: "🔍 Показать важные пункты",
    simple: "🧠 Объяснить простыми словами",
    fixes: "✍️ Показать, что исправить",
    questions: "❓ Подготовить вопросы стороне",
    dangerous: "🟥 Найти опасные фразы",
    score: "📊 Оценить документ",
    custom: "💬 Ответить на мой вопрос",
    compare: "🔄 Сравнить документы",
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
    custom: "Ищу ответ на ваш вопрос...",
    compare: "Сравниваю два документа...",
};

const analysisTitles = {
    full: "Полный анализ",
    summary: "Краткое резюме",
    strengths: "Сильные стороны",
    weaknesses: "Слабые стороны",
    risks: "Риски документа",
    dates: "Даты и сроки",
    money: "Деньги и суммы",
    parties: "Стороны документа",
    attention: "Важные пункты",
    simple: "Простыми словами",
    fixes: "Что исправить",
    questions: "Вопросы стороне",
    dangerous: "Опасные фразы",
    score: "Оценка документа",
    custom: "Свой вопрос",
    compare: "Сравнение документов",
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
    resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideResult() {
    resultBox.classList.add("hidden");
    resultText.textContent = "";
}

function validateFileSize(file) {
    const maxSizeMb = 15;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
        throw new Error(`Файл слишком большой. Максимальный размер: ${maxSizeMb} МБ.`);
    }
}

function setAnalyzeButtonText() {
    if (!selectedFile) {
        analyzeButton.textContent = "Сначала выберите документ";
        analyzeButton.disabled = true;
        return;
    }

    if (selectedAnalysisType === "compare" && !selectedFile2) {
        analyzeButton.textContent = "Выберите второй документ";
        analyzeButton.disabled = true;
        return;
    }

    analyzeButton.textContent =
        analysisButtonTexts[selectedAnalysisType] || "Проверить документ";

    analyzeButton.disabled = false;
}

function updateExtraPanels() {
    if (selectedAnalysisType === "custom") {
        customQuestionBox.classList.remove("hidden");
    } else {
        customQuestionBox.classList.add("hidden");
    }

    if (selectedAnalysisType === "compare") {
        compareBox.classList.remove("hidden");
    } else {
        compareBox.classList.add("hidden");
    }

    setAnalyzeButtonText();
}

roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedUserRole = button.dataset.role || "signer";

        roleButtons.forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        hideError();
        hideResult();
    });
});

analysisButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedAnalysisType = button.dataset.type || "full";

        analysisButtons.forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        updateExtraPanels();
        hideError();
        hideResult();
    });
});

fileInput.addEventListener("change", () => {
    hideError();
    hideResult();

    selectedFile = fileInput.files[0];

    if (!selectedFile) {
        fileName.textContent = "Файл не выбран";
        fileName.classList.remove("selected");
        setAnalyzeButtonText();
        return;
    }

    try {
        validateFileSize(selectedFile);

        fileName.textContent = `✅ Выбран файл: ${selectedFile.name}`;
        fileName.classList.add("selected");
    } catch (error) {
        selectedFile = null;
        fileInput.value = "";
        fileName.textContent = "Файл не выбран";
        fileName.classList.remove("selected");
        showError(error.message);
    }

    setAnalyzeButtonText();
});

fileInput2.addEventListener("change", () => {
    hideError();
    hideResult();

    selectedFile2 = fileInput2.files[0];

    if (!selectedFile2) {
        fileName2.textContent = "Второй файл не выбран";
        fileName2.classList.remove("selected");
        setAnalyzeButtonText();
        return;
    }

    try {
        validateFileSize(selectedFile2);

        fileName2.textContent = `✅ Второй файл: ${selectedFile2.name}`;
        fileName2.classList.add("selected");
    } catch (error) {
        selectedFile2 = null;
        fileInput2.value = "";
        fileName2.textContent = "Второй файл не выбран";
        fileName2.classList.remove("selected");
        showError(error.message);
    }

    setAnalyzeButtonText();
});

analyzeButton.addEventListener("click", async () => {
    if (!selectedFile) {
        showError("Сначала выберите документ.");
        return;
    }

    if (selectedAnalysisType === "compare" && !selectedFile2) {
        showError("Для сравнения выберите второй документ.");
        return;
    }

    if (selectedAnalysisType === "custom" && !customQuestion.value.trim()) {
        showError("Введите свой вопрос по документу.");
        customQuestion.focus();
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

    roleButtons.forEach((button) => {
        button.disabled = true;
    });

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("analysis_type", selectedAnalysisType);
    formData.append("user_role", selectedUserRole);
    formData.append("custom_question", customQuestion.value.trim());

    if (selectedAnalysisType === "compare" && selectedFile2) {
        formData.append("file2", selectedFile2);
    }

    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.error || "Не удалось обработать файл.");
        }

        const result = data.result || "AI не вернул результат.";
        showResult(result);

        saveHistoryItem({
            date: new Date().toISOString(),
            fileName: selectedFile.name,
            fileName2: selectedFile2 ? selectedFile2.name : "",
            type: selectedAnalysisType,
            role: selectedUserRole,
            question: customQuestion.value.trim(),
            result: result,
        });

        renderHistory();
    } catch (error) {
        showError(error.message || "Произошла неизвестная ошибка.");
    } finally {
        hideStatus();

        analysisButtons.forEach((button) => {
            button.disabled = false;
        });

        roleButtons.forEach((button) => {
            button.disabled = false;
        });

        setAnalyzeButtonText();
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

// =========================
// История проверок
// =========================

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function saveHistoryItem(item) {
    const history = getHistory();

    history.unshift(item);

    const limitedHistory = history.slice(0, 10);
    saveHistory(limitedHistory);
}

function formatDate(isoString) {
    const date = new Date(isoString);

    return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function renderHistory() {
    const history = getHistory();

    if (!history.length) {
        historyBox.classList.add("hidden");
        historyList.innerHTML = "";
        return;
    }

    historyBox.classList.remove("hidden");
    historyList.innerHTML = "";

    history.forEach((item, index) => {
        const button = document.createElement("button");
        button.className = "history-item";

        const typeTitle = analysisTitles[item.type] || "Анализ";
        const dateText = formatDate(item.date);
        const fileText = item.fileName2
            ? `${item.fileName} ↔ ${item.fileName2}`
            : item.fileName;

        button.innerHTML = `
            <span class="history-title">${typeTitle}</span>
            <span class="history-file">${fileText}</span>
            <span class="history-date">${dateText}</span>
        `;

        button.addEventListener("click", () => {
            showResult(item.result);
        });

        historyList.appendChild(button);
    });
}

clearHistoryButton.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
});

renderHistory();
setAnalyzeButtonText();
updateExtraPanels();