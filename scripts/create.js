function ensureToastContainer() {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = "info") {
    const container = ensureToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function copyText(text) {
    if (!text) return false;

    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.warn("Clipboard API недоступен, используем fallback.", error);
        }
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.top = "-9999px";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    helper.setSelectionRange(0, helper.value.length);

    let copied = false;
    try {
        copied = document.execCommand("copy");
    } catch (error) {
        console.error("Fallback copy failed:", error);
    }

    helper.remove();
    return copied;
}

function getEditTestIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("edit");
}

function sanitizePositiveInteger(value) {
    return String(value || "").replace(/\D/g, "");
}

function sanitizeAccessCode(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 10);
}

function generateAccessCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let index = 0; index < 6; index++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
}

function generateShareId() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let shareId = "";
    for (let index = 0; index < 20; index++) {
        shareId += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return shareId;
}

function getControlInput(id) {
    return document.getElementById(id);
}

function collectControlMode() {
    const rawLimit = sanitizePositiveInteger(getControlInput("autoSubmitAfterWarnings")?.value || "");
    const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : DEFAULT_CONTROL_MODE.autoSubmitAfterWarnings;

    return {
        preventCopy: Boolean(getControlInput("preventCopy")?.checked),
        hideOnBlur: Boolean(getControlInput("hideOnBlur")?.checked),
        autoSubmitAfterWarnings: Number.isInteger(parsedLimit) && parsedLimit > 0
            ? parsedLimit
            : DEFAULT_CONTROL_MODE.autoSubmitAfterWarnings,
        requireRetakeApproval: Boolean(getControlInput("requireRetakeApproval")?.checked),
        showWatermark: Boolean(getControlInput("showWatermark")?.checked)
    };
}

function fillControlMode(controlMode) {
    const mode = getControlMode({ controlMode });
    if (getControlInput("preventCopy")) getControlInput("preventCopy").checked = mode.preventCopy;
    if (getControlInput("hideOnBlur")) getControlInput("hideOnBlur").checked = mode.hideOnBlur;
    if (getControlInput("autoSubmitAfterWarnings")) getControlInput("autoSubmitAfterWarnings").value = String(mode.autoSubmitAfterWarnings);
    if (getControlInput("requireRetakeApproval")) getControlInput("requireRetakeApproval").checked = mode.requireRetakeApproval;
    if (getControlInput("showWatermark")) getControlInput("showWatermark").checked = mode.showWatermark;
}

function normalizeQuestionType(question) {
    if (!question || typeof question !== "object") {
        return "";
    }

    if (question.type === "open_text_manual") {
        return "open_text_manual";
    }

    if (question.type === "open_text" || question.type === "open_text_auto") {
        return "open_text_auto";
    }

    if (Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0) {
        return "open_text_auto";
    }

    if (Array.isArray(question.options) || typeof question.correctAnswerIndex === "number") {
        return "single_choice";
    }

    return "";
}

function normalizeAcceptedAnswer(value) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeTestStatus(testData) {
    if (testData?.visibilityStatus === "draft" || testData?.visibilityStatus === "closed" || testData?.visibilityStatus === "active") {
        return testData.visibilityStatus;
    }

    if (testData?.isDraft === true) {
        return "draft";
    }

    if (testData?.isPublished === false) {
        return "closed";
    }

    return "active";
}

const editorState = {
    currentTestTitle: "",
    editingTestId: null,
    originalTest: null,
    sourceText: ""
};

function getSourceTextInput() {
    return document.getElementById("sourceTextInput");
}

function readSourceText() {
    const sourceTextInput = getSourceTextInput();
    if (sourceTextInput) {
        return sourceTextInput.value.trim();
    }
    return String(editorState.sourceText || "").trim();
}

function updateSourceTextStatus() {
    const status = document.getElementById("sourceTextStatus");
    if (!status) return;

    const sourceText = readSourceText();
    status.textContent = sourceText
        ? `Текст добавлен: ${sourceText.length} символов.`
        : "Текст не добавлен. Создание вопросов от него не зависит.";
}

function setSourceText(value) {
    editorState.sourceText = String(value || "").trim();
    const sourceTextInput = getSourceTextInput();
    if (sourceTextInput) {
        sourceTextInput.value = editorState.sourceText;
    }
    updateSourceTextStatus();
}

function openSourceTextModal() {
    const modal = document.getElementById("sourceTextModal");
    if (!modal) return;

    setSourceText(editorState.sourceText);
    modal.hidden = false;
    getSourceTextInput()?.focus();
}

function closeSourceTextModal() {
    const modal = document.getElementById("sourceTextModal");
    if (modal) {
        modal.hidden = true;
    }
    const sourceTextInput = getSourceTextInput();
    if (sourceTextInput) {
        sourceTextInput.value = editorState.sourceText;
    }
    updateSourceTextStatus();
}

function saveSourceTextFromModal() {
    setSourceText(readSourceText());
    closeSourceTextModal();
    showToast(
        editorState.sourceText
            ? "Текст для теста сохранён."
            : "Текст очищен. Тест можно создавать без него.",
        "success"
    );
}

function setPageMode(isEditMode) {
    const modeHint = document.getElementById("modeHint");
    const generateBtn = document.getElementById("generateBtn");
    const saveBtn = document.getElementById("saveTestBtn");
    const saveDraftBtn = document.getElementById("saveDraftBtn");

    if (isEditMode) {
        modeHint.textContent = "Можно менять вопросы, время, код входа, перемешивание и статус теста.";
        generateBtn.textContent = "Обновить вопросы";
        saveBtn.textContent = "Сохранить и опубликовать";
        saveDraftBtn.textContent = "Сохранить как черновик";
    } else {
        modeHint.textContent = "Создай тест. У каждого вопроса можно выбрать либо варианты ответа, либо открытый ответ.";
        generateBtn.textContent = "Создать вопросы";
        saveBtn.textContent = "Опубликовать в облаке";
        saveDraftBtn.textContent = "Сохранить как черновик";
    }
}

function setStatusChip(status) {
    const chip = document.getElementById("currentStatusChip");
    if (!chip) return;

    if (status === "draft") {
        chip.textContent = "Статус: черновик";
        return;
    }

    if (status === "closed") {
        chip.textContent = "Статус: доступ закрыт";
        return;
    }

    chip.textContent = "Статус: опубликован";
}

function updateQuestionModeUi(questionCard) {
    const mode = questionCard.dataset.questionType || "";
    const modeLabel = questionCard.querySelector(".question-mode-label");
    const choiceSection = questionCard.querySelector(".choice-section");
    const openSection = questionCard.querySelector(".open-section");
    const addOptionBtn = questionCard.querySelector(".add-option-btn");
    const addOpenAnswerBtn = questionCard.querySelector(".add-open-answer-btn");

    if (mode === "single_choice") {
        modeLabel.textContent = "Тип вопроса: с вариантами ответа";
        choiceSection.style.display = "block";
        openSection.style.display = "none";
        addOptionBtn.classList.add("active-builder-btn");
        addOpenAnswerBtn.classList.remove("active-builder-btn");
        return;
    }

    if (mode === "open_text_manual") {
        modeLabel.textContent = "Тип вопроса: открытый ответ с ручной проверкой";
        choiceSection.style.display = "none";
        openSection.style.display = "block";
        addOptionBtn.classList.remove("active-builder-btn");
        addOpenAnswerBtn.classList.add("active-builder-btn");
        return;
    }

    if (mode === "open_text_auto") {
        modeLabel.textContent = "Тип вопроса: открытый ответ с автопроверкой";
        choiceSection.style.display = "none";
        openSection.style.display = "block";
        addOptionBtn.classList.remove("active-builder-btn");
        addOpenAnswerBtn.classList.add("active-builder-btn");
        return;
    }

    modeLabel.textContent = "Тип вопроса пока не выбран. Добавь варианты ответа или поле для открытого ответа.";
    choiceSection.style.display = "none";
    openSection.style.display = "none";
    addOptionBtn.classList.remove("active-builder-btn");
    addOpenAnswerBtn.classList.remove("active-builder-btn");
}

function clearChoiceData(questionCard) {
    const optionsContainer = questionCard.querySelector(".options-container");
    optionsContainer.innerHTML = "";
}

function clearOpenAnswerData(questionCard) {
    const openAnswersContainer = questionCard.querySelector(".open-answers-container");
    openAnswersContainer.innerHTML = "";
}

function updateOpenQuestionReviewMode(questionCard) {
    const manualCheckbox = questionCard.querySelector(".manual-review-checkbox");
    questionCard.dataset.questionType = manualCheckbox?.checked ? "open_text_manual" : "open_text_auto";

    const acceptedAnswersHint = questionCard.querySelector(".accepted-answers-hint");
    if (acceptedAnswersHint) {
        acceptedAnswersHint.textContent = manualCheckbox?.checked
            ? "При ручной проверке допустимые ответы можно не заполнять. Учитель сам решит, засчитывать ли ответ."
            : "Добавь один или несколько правильных ответов, которые будут засчитываться автоматически.";
    }

    updateQuestionModeUi(questionCard);
}

function switchQuestionType(questionCard, nextType) {
    const previousType = questionCard.dataset.questionType || "";
    if (previousType === nextType) {
        return;
    }

    if (nextType === "single_choice") {
        if ((previousType === "open_text_auto" || previousType === "open_text_manual") && questionCard.querySelector(".open-answer-row")) {
            clearOpenAnswerData(questionCard);
            showToast("Открытые ответы очищены. Теперь это вопрос с вариантами ответа.", "info");
        }
        questionCard.dataset.questionType = "single_choice";
    } else if (nextType === "open_text_auto" || nextType === "open_text_manual") {
        if (previousType === "single_choice" && questionCard.querySelector(".option-row")) {
            clearChoiceData(questionCard);
            showToast("Варианты ответа очищены. Теперь это открытый вопрос.", "info");
        }
        const manualCheckbox = questionCard.querySelector(".manual-review-checkbox");
        if (manualCheckbox) {
            manualCheckbox.checked = nextType === "open_text_manual";
        }
        updateOpenQuestionReviewMode(questionCard);
        return;
    } else {
        questionCard.dataset.questionType = "";
    }

    updateQuestionModeUi(questionCard);
}

function refreshOptionRows(questionCard) {
    const optionRows = questionCard.querySelectorAll(".option-row");

    optionRows.forEach((row, index) => {
        const radio = row.querySelector(".option-radio");
        const input = row.querySelector(".option-text");
        radio.value = String(index);
        input.placeholder = `Вариант ${index + 1}`;
    });
}

function refreshOpenAnswerRows(questionCard) {
    const answerRows = questionCard.querySelectorAll(".open-answer-row");

    answerRows.forEach((row, index) => {
        const input = row.querySelector(".open-answer-text");
        input.placeholder = `Допустимый ответ ${index + 1}`;
    });
}

function addOptionRow(questionCard, optionValue = "", isChecked = false) {
    const optionsContainer = questionCard.querySelector(".options-container");
    const questionIndex = questionCard.dataset.questionIndex;
    const optionRows = optionsContainer.querySelectorAll(".option-row");

    if (optionRows.length >= 10) {
        showToast("Максимум 10 вариантов ответа в одном вопросе.", "error");
        return;
    }

    switchQuestionType(questionCard, "single_choice");

    const optionRow = document.createElement("div");
    optionRow.className = "option-row";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `correct_${questionIndex}`;
    radio.value = String(optionRows.length);
    radio.className = "option-radio";
    radio.checked = isChecked;

    const optionInput = document.createElement("input");
    optionInput.type = "text";
    optionInput.placeholder = `Вариант ${optionRows.length + 1}`;
    optionInput.className = "option-text";
    optionInput.required = true;
    optionInput.value = optionValue;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "option-remove-btn";
    removeBtn.textContent = "Удалить";
    removeBtn.addEventListener("click", () => {
        optionRow.remove();
        refreshOptionRows(questionCard);
    });

    optionRow.appendChild(radio);
    optionRow.appendChild(optionInput);
    optionRow.appendChild(removeBtn);
    optionsContainer.appendChild(optionRow);

    refreshOptionRows(questionCard);
}

function addOpenAnswerRow(questionCard, answerValue = "") {
    const openAnswersContainer = questionCard.querySelector(".open-answers-container");
    const answerRows = openAnswersContainer.querySelectorAll(".open-answer-row");

    if (answerRows.length >= 10) {
        showToast("Максимум 10 допустимых ответов в открытом вопросе.", "error");
        return;
    }

    const currentType = questionCard.dataset.questionType === "open_text_manual" ? "open_text_manual" : "open_text_auto";
    switchQuestionType(questionCard, currentType);

    const answerRow = document.createElement("div");
    answerRow.className = "open-answer-row";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Допустимый ответ ${answerRows.length + 1}`;
    input.className = "open-answer-text";
    input.required = true;
    input.value = answerValue;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "option-remove-btn";
    removeBtn.textContent = "Удалить";
    removeBtn.addEventListener("click", () => {
        answerRow.remove();
        refreshOpenAnswerRows(questionCard);
    });

    answerRow.appendChild(input);
    answerRow.appendChild(removeBtn);
    openAnswersContainer.appendChild(answerRow);

    refreshOpenAnswerRows(questionCard);
}

function createQuestionCard(questionIndex, existingQuestion = null) {
    const card = document.createElement("div");
    card.className = "question-card";
    card.dataset.questionIndex = String(questionIndex);
    card.dataset.questionType = normalizeQuestionType(existingQuestion);

    const title = document.createElement("h3");
    title.textContent = `Вопрос ${questionIndex + 1}`;
    card.appendChild(title);

    const questionGroup = document.createElement("div");
    questionGroup.className = "input-group";

    const questionInput = document.createElement("input");
    questionInput.type = "text";
    questionInput.placeholder = "Введите текст вопроса";
    questionInput.className = "q-text";
    questionInput.required = true;
    questionInput.value = existingQuestion?.question || "";
    questionGroup.appendChild(questionInput);
    card.appendChild(questionGroup);

    const modeLabel = document.createElement("div");
    modeLabel.className = "question-mode-label";
    card.appendChild(modeLabel);

    const builderActions = document.createElement("div");
    builderActions.className = "builder-actions";

    const addOptionBtn = document.createElement("button");
    addOptionBtn.type = "button";
    addOptionBtn.className = "builder-action-btn add-option-btn";
    addOptionBtn.textContent = "Добавить вариант ответа";
    addOptionBtn.addEventListener("click", () => {
        addOptionRow(card, "", false);
    });

    const addOpenAnswerBtn = document.createElement("button");
    addOpenAnswerBtn.type = "button";
    addOpenAnswerBtn.className = "builder-action-btn add-open-answer-btn";
    addOpenAnswerBtn.textContent = "Добавить поле для заполнения ответа";
    addOpenAnswerBtn.addEventListener("click", () => {
        const questionType = card.dataset.questionType === "open_text_manual" ? "open_text_manual" : "open_text_auto";
        switchQuestionType(card, questionType);
        if (card.querySelectorAll(".open-answer-row").length === 0) {
            addOpenAnswerRow(card, "");
        }
    });

    builderActions.appendChild(addOptionBtn);
    builderActions.appendChild(addOpenAnswerBtn);
    card.appendChild(builderActions);

    const choiceSection = document.createElement("div");
    choiceSection.className = "choice-section";

    const choiceTitle = document.createElement("h4");
    choiceTitle.textContent = "Варианты ответов (отметь правильный кружочком):";
    choiceSection.appendChild(choiceTitle);

    const optionsContainer = document.createElement("div");
    optionsContainer.className = "options-container";
    choiceSection.appendChild(optionsContainer);
    card.appendChild(choiceSection);

    const openSection = document.createElement("div");
    openSection.className = "open-section";

    const openTitle = document.createElement("h4");
    openTitle.textContent = "Открытый ответ:";
    openSection.appendChild(openTitle);

    const manualReviewBox = document.createElement("div");
    manualReviewBox.className = "manual-review-box";

    const manualReviewRow = document.createElement("div");
    manualReviewRow.className = "checkbox-row";

    const manualReviewCheckbox = document.createElement("input");
    manualReviewCheckbox.type = "checkbox";
    manualReviewCheckbox.className = "manual-review-checkbox";
    manualReviewCheckbox.checked = card.dataset.questionType === "open_text_manual";
    manualReviewCheckbox.addEventListener("change", () => {
        switchQuestionType(card, manualReviewCheckbox.checked ? "open_text_manual" : "open_text_auto");
    });

    const manualReviewContent = document.createElement("div");
    manualReviewContent.className = "checkbox-content";

    const manualReviewTitle = document.createElement("div");
    manualReviewTitle.className = "checkbox-title";
    manualReviewTitle.textContent = "Проверять этот вопрос вручную";

    const openHint = document.createElement("div");
    openHint.className = "hint-text accepted-answers-hint";

    manualReviewContent.appendChild(manualReviewTitle);
    manualReviewContent.appendChild(openHint);
    manualReviewRow.appendChild(manualReviewCheckbox);
    manualReviewRow.appendChild(manualReviewContent);
    manualReviewBox.appendChild(manualReviewRow);
    openSection.appendChild(manualReviewBox);

    const openAnswersContainer = document.createElement("div");
    openAnswersContainer.className = "open-answers-container";
    openSection.appendChild(openAnswersContainer);
    card.appendChild(openSection);

    if (card.dataset.questionType === "single_choice") {
        const options = Array.isArray(existingQuestion?.options) && existingQuestion.options.length > 0
            ? existingQuestion.options.slice(0, 10)
            : [];

        options.forEach((option, optionIndex) => {
            addOptionRow(card, option, existingQuestion?.correctAnswerIndex === optionIndex);
        });
    } else if (card.dataset.questionType === "open_text_auto" || card.dataset.questionType === "open_text_manual") {
        const acceptedAnswers = Array.isArray(existingQuestion?.acceptedAnswers) && existingQuestion.acceptedAnswers.length > 0
            ? existingQuestion.acceptedAnswers.slice(0, 10)
            : [];

        acceptedAnswers.forEach((answer) => {
            addOpenAnswerRow(card, answer);
        });
    }

    if (card.dataset.questionType === "open_text_auto" || card.dataset.questionType === "open_text_manual") {
        updateOpenQuestionReviewMode(card);
    } else {
        updateQuestionModeUi(card);
    }
    return card;
}

function renderQuestionCards(questionCount, existingQuestions = []) {
    const container = document.getElementById("questionsContainer");
    container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < questionCount; index++) {
        fragment.appendChild(createQuestionCard(index, existingQuestions[index] || null));
    }

    container.appendChild(fragment);
}

function showEditor(title, questionCount, existingQuestions = []) {
    editorState.currentTestTitle = title;

    document.getElementById("questionsSection").style.display = "block";
    document.getElementById("displayTitle").textContent = `Тест: ${title}`;
    document.getElementById("testTitle").value = title;
    document.getElementById("qCount").value = String(questionCount);

    renderQuestionCards(questionCount, existingQuestions);
}

function fillSettingsFromTest(testData) {
    const questionCount = Array.isArray(testData.questions) ? testData.questions.length : 1;
    const status = normalizeTestStatus(testData);

    document.getElementById("testTitle").value = testData.title || "";
    document.getElementById("qCount").value = String(questionCount);
    document.getElementById("timeLimitMinutes").value =
        Number.isInteger(testData.timeLimitMinutes) && testData.timeLimitMinutes > 0
            ? String(testData.timeLimitMinutes)
            : "";
    document.getElementById("accessCode").value =
        status === "draft" ? "" : sanitizeAccessCode(testData.accessCode || "");
    document.getElementById("shuffleQuestions").checked = Boolean(testData.shuffleQuestions);
    document.getElementById("shuffleOptions").checked = Boolean(testData.shuffleOptions);
    fillControlMode(testData.controlMode);
    setSourceText(testData.sourceText || "");
    setStatusChip(status);
}

function renderLinkBox(shareId, accessCode, status) {
    const testLink = shareId
        ? `${window.location.origin}/pages/play.html?test=${encodeURIComponent(shareId)}`
        : "";
    const linkBox = document.getElementById("linkBox");
    const testLinkBox = document.getElementById("testLink");
    const copyLinkBtn = document.getElementById("copyLinkBtn");
    const testCodeBox = document.getElementById("testCodeBox");

    linkBox.style.display = "block";

    if (status === "draft") {
        testLinkBox.textContent = "Ссылка появится после публикации теста.";
        copyLinkBtn.dataset.link = "";
        copyLinkBtn.style.display = "none";
        testCodeBox.textContent = "Код для входа появится после публикации теста.";
        return;
    }

    if (status === "closed" || !shareId) {
        testLinkBox.textContent = "Доступ к тесту закрыт. Новая ссылка появится после открытия доступа.";
        copyLinkBtn.dataset.link = "";
        copyLinkBtn.style.display = "none";
        testCodeBox.textContent = "Код для входа появится после повторного открытия доступа.";
        return;
    }

    testLinkBox.textContent = testLink;
    copyLinkBtn.dataset.link = testLink;
    copyLinkBtn.style.display = "inline-flex";
    testCodeBox.textContent = accessCode ? `Код для входа: ${accessCode}` : "";
}

function collectQuestions() {
    const questionCards = document.querySelectorAll(".question-card");
    const questions = [];

    for (let index = 0; index < questionCards.length; index++) {
        const card = questionCards[index];
        const questionText = card.querySelector(".q-text").value.trim();
        const questionType = card.dataset.questionType || "";

        if (!questionText) {
            showToast(`В вопросе ${index + 1} нет текста.`, "error");
            return null;
        }

        if (!questionType) {
            showToast(`Выбери тип для вопроса ${index + 1}: варианты ответа или открытый ответ.`, "error");
            return null;
        }

        if (questionType === "single_choice") {
            const optionRows = Array.from(card.querySelectorAll(".option-row"));
            const optionsArray = optionRows.map((row) => row.querySelector(".option-text").value.trim());
            const checkedRadio = card.querySelector(".option-radio:checked");
            const correctIndex = checkedRadio ? parseInt(checkedRadio.value, 10) : -1;

            if (optionsArray.length < 2) {
                showToast(`В вопросе ${index + 1} должно быть минимум 2 варианта ответа.`, "error");
                return null;
            }

            if (optionsArray.some((option) => !option)) {
                showToast(`В вопросе ${index + 1} есть пустой вариант ответа.`, "error");
                return null;
            }

            if (correctIndex === -1) {
                showToast(`Не выбран правильный ответ в вопросе ${index + 1}.`, "error");
                return null;
            }

            questions.push({
                question: questionText,
                type: "single_choice",
                options: optionsArray,
                correctAnswerIndex: correctIndex
            });
            continue;
        }

        const acceptedAnswers = Array.from(card.querySelectorAll(".open-answer-row"))
            .map((row) => row.querySelector(".open-answer-text").value.trim())
            .filter(Boolean);

        const uniqueAnswers = acceptedAnswers.filter((answer, answerIndex, answerArray) => {
            const normalized = normalizeAcceptedAnswer(answer);
            return answerArray.findIndex((item) => normalizeAcceptedAnswer(item) === normalized) === answerIndex;
        });

        if (questionType === "open_text_auto" && uniqueAnswers.length < 1) {
            showToast(`В открытом вопросе ${index + 1} с автопроверкой должен быть минимум 1 допустимый ответ.`, "error");
            return null;
        }

        questions.push({
            question: questionText,
            type: questionType,
            acceptedAnswers: uniqueAnswers
        });
    }

    return questions;
}

async function loadTestForEditing(testId, user) {
    try {
        const testDoc = await db.collection("tests").doc(testId).get();

        if (!testDoc.exists) {
            showToast("Тест для редактирования не найден.", "error");
            setTimeout(() => {
                window.location.href = "/pages/home.html";
            }, 1200);
            return;
        }

        const testData = testDoc.data();

        if (testData.authorId !== user.uid) {
            showToast("Можно редактировать только свои тесты.", "error");
            setTimeout(() => {
                window.location.href = "/pages/home.html";
            }, 1200);
            return;
        }

        editorState.editingTestId = testDoc.id;
        editorState.originalTest = testData;

        setPageMode(true);
        fillSettingsFromTest(testData);
        showEditor(testData.title || "Без названия", Array.isArray(testData.questions) ? testData.questions.length : 1, testData.questions || []);
        renderLinkBox(testData.shareId || "", sanitizeAccessCode(testData.accessCode || ""), normalizeTestStatus(testData));
    } catch (error) {
        console.error("Ошибка загрузки теста для редактирования:", error);
        showToast("Не удалось открыть тест для редактирования.", "error");
    }
}

function buildTestPayload(currentUser, questions, saveStatus) {
    const rawTimeLimit = sanitizePositiveInteger(document.getElementById("timeLimitMinutes").value);
    const timeLimitMinutes = rawTimeLimit ? parseInt(rawTimeLimit, 10) : null;
    const existingShareId = String(editorState.originalTest?.shareId || "");
    const existingAccessCode = sanitizeAccessCode(editorState.originalTest?.accessCode || "");
    const manualAccessCode = sanitizeAccessCode(document.getElementById("accessCode").value);
    const shareId = saveStatus === "draft"
        ? ""
        : existingShareId || generateShareId();
    const accessCode = saveStatus === "draft"
        ? ""
        : manualAccessCode || existingAccessCode || generateAccessCode();
    document.getElementById("accessCode").value = accessCode;
    editorState.sourceText = readSourceText();

    return {
        title: editorState.currentTestTitle,
        authorId: currentUser.uid,
        authorEmail: currentUser.email || "",
        visibilityStatus: saveStatus,
        isPublished: saveStatus === "active",
        isDraft: saveStatus === "draft",
        createdAt: editorState.originalTest?.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        shareId: shareId,
        accessCode: accessCode,
        timeLimitMinutes: Number.isInteger(timeLimitMinutes) && timeLimitMinutes > 0 ? timeLimitMinutes : null,
        shuffleQuestions: Boolean(document.getElementById("shuffleQuestions").checked),
        shuffleOptions: Boolean(document.getElementById("shuffleOptions").checked),
        controlMode: collectControlMode(),
        sourceText: editorState.sourceText,
        questions: questions,
        manualReviewMap: editorState.originalTest?.manualReviewMap || {}
    };
}

async function saveTestWithStatus(saveStatus) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        showToast("Сначала войди в аккаунт.", "error");
        window.location.href = "/pages/login.html";
        return;
    }

    const title = document.getElementById("testTitle").value.trim();
    const questionCount = parseInt(document.getElementById("qCount").value, 10);

    if (!title) {
        showToast("Введите название теста.", "error");
        return;
    }

    if (!Number.isInteger(questionCount) || questionCount < 1) {
        showToast("Количество вопросов должно быть положительным числом.", "error");
        return;
    }

    if (!document.querySelector(".question-card")) {
        showToast("Сначала создай вопросы.", "error");
        return;
    }

    editorState.currentTestTitle = title;
    const questions = collectQuestions();
    if (!questions) return;

    try {
        const wasEditing = Boolean(editorState.editingTestId);
        const testRef = editorState.editingTestId
            ? db.collection("tests").doc(editorState.editingTestId)
            : db.collection("tests").doc();

        const testData = buildTestPayload(currentUser, questions, saveStatus);
        await testRef.set(testData);

        editorState.editingTestId = testRef.id;
        editorState.originalTest = {
            ...(editorState.originalTest || {}),
            ...testData
        };

        document.getElementById("displayTitle").textContent = `Тест: ${editorState.currentTestTitle}`;
        setPageMode(true);
        setStatusChip(saveStatus);
        renderLinkBox(testData.shareId || "", testData.accessCode, saveStatus);

        if (!getEditTestIdFromUrl()) {
            const url = new URL(window.location.href);
            url.searchParams.set("edit", testRef.id);
            window.history.replaceState({}, "", url.toString());
        }

        showToast(
            saveStatus === "draft"
                ? "Черновик сохранён."
                : wasEditing
                    ? "Тест сохранён и опубликован."
                    : "Тест успешно опубликован!",
            "success"
        );
    } catch (error) {
        console.error("Ошибка сохранения теста:", error);
        showToast("Ошибка сохранения теста в Firebase.", "error");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const generateBtn = document.getElementById("generateBtn");
    const saveBtn = document.getElementById("saveTestBtn");
    const saveDraftBtn = document.getElementById("saveDraftBtn");
    const copyLinkBtn = document.getElementById("copyLinkBtn");
    const qCountInput = document.getElementById("qCount");
    const timeLimitInput = document.getElementById("timeLimitMinutes");
    const accessCodeInput = document.getElementById("accessCode");
    const autoSubmitAfterWarningsInput = document.getElementById("autoSubmitAfterWarnings");
    const sourceTextOpenBtn = document.getElementById("sourceTextOpenBtn");
    const sourceTextCloseBtn = document.getElementById("sourceTextCloseBtn");
    const sourceTextSaveBtn = document.getElementById("sourceTextSaveBtn");
    const sourceTextModal = document.getElementById("sourceTextModal");

    qCountInput.addEventListener("input", () => {
        qCountInput.value = sanitizePositiveInteger(qCountInput.value);
    });

    timeLimitInput.addEventListener("input", () => {
        timeLimitInput.value = sanitizePositiveInteger(timeLimitInput.value);
    });

    if (autoSubmitAfterWarningsInput) {
        autoSubmitAfterWarningsInput.addEventListener("input", () => {
            autoSubmitAfterWarningsInput.value = sanitizePositiveInteger(autoSubmitAfterWarningsInput.value);
        });
    }

    accessCodeInput.addEventListener("input", () => {
        accessCodeInput.value = sanitizeAccessCode(accessCodeInput.value);
    });

    if (sourceTextOpenBtn) {
        sourceTextOpenBtn.addEventListener("click", openSourceTextModal);
    }

    if (sourceTextCloseBtn) {
        sourceTextCloseBtn.addEventListener("click", closeSourceTextModal);
    }

    if (sourceTextSaveBtn) {
        sourceTextSaveBtn.addEventListener("click", saveSourceTextFromModal);
    }

    if (sourceTextModal) {
        sourceTextModal.addEventListener("click", (event) => {
            if (event.target === sourceTextModal) {
                closeSourceTextModal();
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && sourceTextModal && !sourceTextModal.hidden) {
            closeSourceTextModal();
        }
    });

    getSourceTextInput()?.addEventListener("input", updateSourceTextStatus);
    updateSourceTextStatus();

    const user = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            unsubscribe();
            resolve(currentUser);
        });
    });

    if (!user) {
        window.location.href = "/pages/login.html";
        return;
    }

    const editTestId = getEditTestIdFromUrl();
    setPageMode(Boolean(editTestId));
    setStatusChip("active");
    fillControlMode(DEFAULT_CONTROL_MODE);

    if (editTestId) {
        await loadTestForEditing(editTestId, user);
    }

    generateBtn.addEventListener("click", () => {
        const title = document.getElementById("testTitle").value.trim();
        const questionCount = parseInt(qCountInput.value, 10);

        if (!title) {
            showToast("Введите название теста.", "error");
            return;
        }

        if (!Number.isInteger(questionCount) || questionCount < 1) {
            showToast("Количество вопросов должно быть положительным числом.", "error");
            return;
        }

        showEditor(title, questionCount);
        showToast("Вопросы подготовлены. В каждом вопросе выбери нужный тип и заполни ответы.", "success");
    });

    saveBtn.addEventListener("click", async () => {
        await saveTestWithStatus("active");
    });

    saveDraftBtn.addEventListener("click", async () => {
        await saveTestWithStatus("draft");
    });

    copyLinkBtn.addEventListener("click", async () => {
        const link = copyLinkBtn.dataset.link;
        if (!link) {
            showToast("Ссылка появится после публикации теста.", "info");
            return;
        }

        const copied = await copyText(link);
        if (copied) {
            showToast("Ссылка скопирована!", "success");
        } else {
            showToast("Не удалось скопировать ссылку.", "error");
        }
    });
});
