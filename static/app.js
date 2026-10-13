const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();

    if (tg.setHeaderColor) {
        tg.setHeaderColor("#020617");
    }

    if (tg.setBackgroundColor) {
        tg.setBackgroundColor("#020617");
    }
}

// =========================
// Элементы интерфейса
// =========================

const fileInput =
    document.getElementById("fileInput");

const fileInput2 =
    document.getElementById("fileInput2");

const fileName =
    document.getElementById("fileName");

const fileName2 =
    document.getElementById("fileName2");

const analyzeButton =
    document.getElementById("analyzeButton");

const statusBox =
    document.getElementById("statusBox");

const statusText =
    document.getElementById("statusText");

const errorBox =
    document.getElementById("errorBox");

const resultBox =
    document.getElementById("resultBox");

const resultText =
    document.getElementById("resultText");

const copyButton =
    document.getElementById("copyButton");

const customQuestionBox =
    document.getElementById("customQuestionBox");

const customQuestion =
    document.getElementById("customQuestion");

const compareBox =
    document.getElementById("compareBox");

const historyBox =
    document.getElementById("historyBox");

const historyList =
    document.getElementById("historyList");

const clearHistoryButton =
    document.getElementById("clearHistoryButton");

const analysisButtons = Array.from(
    document.querySelectorAll(".analysis-button")
);

const roleButtons = Array.from(
    document.querySelectorAll(".role-button")
);

// =========================
// Состояние приложения
// =========================

let selectedFile = null;
let selectedFile2 = null;

let selectedUserRole = "signer";

/*
Полный анализ выбран изначально.
Обычные режимы можно комбинировать.
Полный анализ и сравнение работают отдельно.
*/
let selectedAnalysisTypes = ["full"];

const HISTORY_KEY = "doccheck_history_v3";

// =========================
// Названия режимов
// =========================

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

const singleButtonTexts = {
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
    questions: "❓ Подготовить вопросы",
    dangerous: "🟥 Найти опасные фразы",
    score: "📊 Кратко оценить документ",
    custom: "💬 Ответить на мой вопрос",
    compare: "🔄 Сравнить документы",
};

// =========================
// Вспомогательные функции
// =========================

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

    errorBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
    });
}

function hideError() {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
}

function showResult(text) {
    resultText.textContent = text;
    resultBox.classList.remove("hidden");

    resultBox.scrollIntoView({
        behavior: "smooth",
        block: "start",
    });
}

function hideResult() {
    resultBox.classList.add("hidden");
    resultText.textContent = "";
}

function validateFileSize(file) {
    const maxSizeMb = 15;
    const maxSizeBytes =
        maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
        throw new Error(
            `Файл слишком большой. Максимальный размер: ${maxSizeMb} МБ.`
        );
    }
}

function isSelected(type) {
    return selectedAnalysisTypes.includes(type);
}

function vibrate(style = "light") {
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred(style);
    }
}

// =========================
// Отображение выбора
// =========================

function updateAnalysisButtons() {
    analysisButtons.forEach((button) => {
        const type = button.dataset.type;
        const selected = isSelected(type);

        button.classList.toggle(
            "active",
            selected
        );

        button.setAttribute(
            "aria-pressed",
            String(selected)
        );

        const tooltip =
            button.dataset.tooltip;

        if (tooltip) {
            button.setAttribute(
                "title",
                tooltip
            );

            button.setAttribute(
                "aria-label",
                tooltip
            );
        }
    });
}

function updateExtraPanels() {
    if (isSelected("custom")) {
        customQuestionBox.classList.remove(
            "hidden"
        );
    } else {
        customQuestionBox.classList.add(
            "hidden"
        );
    }

    if (isSelected("compare")) {
        compareBox.classList.remove("hidden");
    } else {
        compareBox.classList.add("hidden");
    }

    setAnalyzeButtonState();
}

function setAnalyzeButtonState() {
    if (selectedAnalysisTypes.length === 0) {
        analyzeButton.textContent =
            "Выберите тип анализа";

        analyzeButton.disabled = true;
        return;
    }

    if (!selectedFile) {
        analyzeButton.textContent =
            "Сначала выберите документ";

        analyzeButton.disabled = true;
        return;
    }

    if (
        isSelected("compare")
        && !selectedFile2
    ) {
        analyzeButton.textContent =
            "Выберите второй документ";

        analyzeButton.disabled = true;
        return;
    }

    if (selectedAnalysisTypes.length === 1) {
        const selectedType =
            selectedAnalysisTypes[0];

        analyzeButton.textContent =
            singleButtonTexts[selectedType]
            || "Проверить документ";
    } else {
        analyzeButton.textContent =
            `✨ Выполнить выбранное: ${selectedAnalysisTypes.length}`;
    }

    analyzeButton.disabled = false;
}

// =========================
// Выбор типов анализа
// =========================

function selectExclusiveType(type) {
    selectedAnalysisTypes = [type];
}

function toggleRegularType(type) {
    /*
    Если был выбран полный анализ или сравнение,
    при выборе обычной кнопки отключаем их.
    */
    selectedAnalysisTypes =
        selectedAnalysisTypes.filter(
            (item) =>
                item !== "full"
                && item !== "compare"
        );

    if (selectedAnalysisTypes.includes(type)) {
        selectedAnalysisTypes =
            selectedAnalysisTypes.filter(
                (item) => item !== type
            );
    } else {
        selectedAnalysisTypes.push(type);
    }
}

analysisButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const type =
            button.dataset.type || "full";

        vibrate("light");

        /*
        Полный анализ и сравнение документов
        всегда выбираются отдельно.
        */
        if (
            type === "full"
            || type === "compare"
        ) {
            selectExclusiveType(type);
        } else {
            toggleRegularType(type);
        }

        updateAnalysisButtons();
        updateExtraPanels();

        hideError();
        hideResult();
    });
});

// =========================
// Выбор ситуации
// =========================

roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedUserRole =
            button.dataset.role || "signer";

        vibrate("light");

        roleButtons.forEach((item) => {
            item.classList.remove("active");

            item.setAttribute(
                "aria-pressed",
                "false"
            );
        });

        button.classList.add("active");

        button.setAttribute(
            "aria-pressed",
            "true"
        );

        hideError();
        hideResult();
    });
});

// =========================
// Выбор первого файла
// =========================

fileInput.addEventListener("change", () => {
    hideError();
    hideResult();

    selectedFile =
        fileInput.files[0] || null;

    if (!selectedFile) {
        fileName.textContent =
            "Файл не выбран";

        fileName.classList.remove(
            "selected"
        );

        setAnalyzeButtonState();
        return;
    }

    try {
        validateFileSize(selectedFile);

        fileName.textContent =
            `✅ Выбран файл: ${selectedFile.name}`;

        fileName.classList.add("selected");

        vibrate("medium");
    } catch (error) {
        selectedFile = null;
        fileInput.value = "";

        fileName.textContent =
            "Файл не выбран";

        fileName.classList.remove(
            "selected"
        );

        showError(error.message);
    }

    setAnalyzeButtonState();
});

// =========================
// Выбор второго файла
// =========================

fileInput2.addEventListener(
    "change",
    () => {
        hideError();
        hideResult();

        selectedFile2 =
            fileInput2.files[0] || null;

        if (!selectedFile2) {
            fileName2.textContent =
                "Второй файл не выбран";

            fileName2.classList.remove(
                "selected"
            );

            setAnalyzeButtonState();
            return;
        }

        try {
            validateFileSize(selectedFile2);

            fileName2.textContent =
                `✅ Второй файл: ${selectedFile2.name}`;

            fileName2.classList.add(
                "selected"
            );

            vibrate("medium");
        } catch (error) {
            selectedFile2 = null;
            fileInput2.value = "";

            fileName2.textContent =
                "Второй файл не выбран";

            fileName2.classList.remove(
                "selected"
            );

            showError(error.message);
        }

        setAnalyzeButtonState();
    }
);

// =========================
// Блокировка интерфейса
// =========================

function setInterfaceLoading(isLoading) {
    analyzeButton.disabled = isLoading;

    analysisButtons.forEach((button) => {
        button.disabled = isLoading;
    });

    roleButtons.forEach((button) => {
        button.disabled = isLoading;
    });

    fileInput.disabled = isLoading;
    fileInput2.disabled = isLoading;
    customQuestion.disabled = isLoading;
}

// =========================
// Запуск анализа
// =========================

analyzeButton.addEventListener(
    "click",
    async () => {
        if (
            selectedAnalysisTypes.length === 0
        ) {
            showError(
                "Выберите хотя бы один тип анализа."
            );

            return;
        }

        if (!selectedFile) {
            showError(
                "Сначала выберите документ."
            );

            return;
        }

        if (
            isSelected("compare")
            && !selectedFile2
        ) {
            showError(
                "Для сравнения выберите второй документ."
            );

            return;
        }

        if (
            isSelected("custom")
            && !customQuestion.value.trim()
        ) {
            showError(
                "Введите свой вопрос по документу."
            );

            customQuestion.focus();
            return;
        }

        hideError();
        hideResult();

        if (isSelected("compare")) {
            showStatus(
                "Кратко сравниваю два документа..."
            );
        } else if (
            selectedAnalysisTypes.length > 1
        ) {
            showStatus(
                `Выполняю выбранные проверки: ${selectedAnalysisTypes.length}...`
            );
        } else {
            showStatus(
                "Кратко анализирую документ..."
            );
        }

        setInterfaceLoading(true);
        vibrate("medium");

        const formData = new FormData();

        formData.append(
            "file",
            selectedFile
        );

        formData.append(
            "analysis_types",
            selectedAnalysisTypes.join(",")
        );

        formData.append(
            "user_role",
            selectedUserRole
        );

        formData.append(
            "custom_question",
            customQuestion.value.trim()
        );

        if (
            isSelected("compare")
            && selectedFile2
        ) {
            formData.append(
                "file2",
                selectedFile2
            );
        }

        try {
            const response = await fetch(
                "/api/analyze",
                {
                    method: "POST",
                    body: formData,
                }
            );

            let data;

            try {
                data = await response.json();
            } catch {
                throw new Error(
                    "Сервер вернул некорректный ответ."
                );
            }

            if (!response.ok || !data.ok) {
                throw new Error(
                    data.error
                    || "Не удалось обработать файл."
                );
            }

            const result =
                data.result
                || "AI не вернул результат.";

            showResult(result);

            saveHistoryItem({
                date: new Date().toISOString(),

                fileName:
                    selectedFile.name,

                fileName2:
                    isSelected("compare")
                    && selectedFile2
                        ? selectedFile2.name
                        : "",

                types: [
                    ...selectedAnalysisTypes,
                ],

                role: selectedUserRole,

                question:
                    customQuestion.value.trim(),

                result,
            });

            renderHistory();
            vibrate("medium");
        } catch (error) {
            showError(
                error.message
                || "Произошла неизвестная ошибка."
            );

            if (tg?.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred(
                    "error"
                );
            }
        } finally {
            hideStatus();
            setInterfaceLoading(false);
            setAnalyzeButtonState();
        }
    }
);

// =========================
// Копирование результата
// =========================

copyButton.addEventListener(
    "click",
    async () => {
        const text =
            resultText.textContent.trim();

        if (!text) {
            return;
        }

        try {
            await navigator.clipboard.writeText(
                text
            );

            const oldText =
                copyButton.textContent;

            copyButton.textContent =
                "✅ Скопировано";

            vibrate("light");

            setTimeout(() => {
                copyButton.textContent =
                    oldText;
            }, 1600);
        } catch {
            showError(
                "Не удалось скопировать текст. Выделите результат вручную."
            );
        }
    }
);

// =========================
// История проверок
// =========================

function getHistory() {
    try {
        return JSON.parse(
            localStorage.getItem(HISTORY_KEY)
        ) || [];
    } catch {
        return [];
    }
}

function saveHistory(history) {
    try {
        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(history)
        );
    } catch {
        /*
        Если хранилище переполнено,
        удаляем старые записи.
        */
        const shortHistory =
            history.slice(0, 3);

        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(shortHistory)
        );
    }
}

function saveHistoryItem(item) {
    const history = getHistory();

    history.unshift(item);

    /*
    Храним максимум 10 последних проверок.
    */
    saveHistory(
        history.slice(0, 10)
    );
}

function formatDate(isoString) {
    const date = new Date(isoString);

    return date.toLocaleString(
        "ru-RU",
        {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }
    );
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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

    history.forEach((item) => {
        const button =
            document.createElement("button");

        button.className = "history-item";
        button.type = "button";

        /*
        Поддерживаем новую и старую структуру
        сохранённых записей.
        */
        const storedTypes =
            item.types
            || (item.type
                ? [item.type]
                : ["full"]);

        const typeText = storedTypes
            .map(
                (type) =>
                    analysisTitles[type]
                    || type
            )
            .join(", ");

        const fileText = item.fileName2
            ? `${item.fileName} ↔ ${item.fileName2}`
            : item.fileName;

        button.innerHTML = `
            <span class="history-title">
                ${escapeHtml(typeText)}
            </span>

            <span class="history-file">
                ${escapeHtml(fileText)}
            </span>

            <span class="history-date">
                ${escapeHtml(formatDate(item.date))}
            </span>
        `;

        button.addEventListener(
            "click",
            () => {
                showResult(item.result);
                vibrate("light");
            }
        );

        historyList.appendChild(button);
    });
}

clearHistoryButton.addEventListener(
    "click",
    () => {
        const confirmed = window.confirm(
            "Очистить всю историю проверок?"
        );

        if (!confirmed) {
            return;
        }

        localStorage.removeItem(
            HISTORY_KEY
        );

        renderHistory();
        vibrate("light");
    }
);

// =========================
// Начальная настройка
// =========================

updateAnalysisButtons();
updateExtraPanels();
renderHistory();
setAnalyzeButtonState();