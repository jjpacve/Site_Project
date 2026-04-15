function getTestIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("test");
}

function getCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("code");
}

function showError(message) {
    const loadingText = document.getElementById("loadingText");
    const errorText = document.getElementById("errorText");
    const testContent = document.getElementById("testContent");
    const codeLookupBox = document.getElementById("codeLookupBox");

    loadingText.style.display = "none";
    testContent.style.display = "none";
    if (codeLookupBox) {
        codeLookupBox.style.display = "none";
    }
    errorText.style.display = "block";
    errorText.textContent = message;
}

const playState = {
    testData: null,
    preparedQuestions: [],
    attemptId: null,
    studentName: "",
    answers: new Map(),
    started: false,
    startedAtMs: null,
    timerIntervalId: null,
    timeLimitSeconds: null,
    submitted: false,
    timedOut: false,
    adminGhostMode: true,
    attemptDeviceId: "",
    normalizedStudentName: "",
    retakeRequestId: "",
    retakeMode: false,
    controlMode: DEFAULT_CONTROL_MODE,
    focusWarnings: 0,
    autoSubmittedByControlMode: false,
    copyProtectionCleanup: null,
    focusProtectionCleanup: null,
    fullscreenProtectionCleanup: null,
    pasteProtectionCleanup: null,
    fullscreenWasRequested: false,
    cheatWarningsCount: 0,
    fullscreenExitCount: 0,
    pasteAttemptCount: 0,
    suspiciousEvents: [],
    autoSubmittedByAntiCheat: false,
    lastPasteBlockAtMs: 0
};

function getPercent(score, total) {
    if (!total) return 0;
    return Math.round((score / total) * 100);
}

function formatDuration(seconds) {
    const safeSeconds = Math.max(0, seconds || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getElapsedSeconds() {
    if (!playState.startedAtMs) {
        return 0;
    }

    return Math.max(0, Math.floor((Date.now() - playState.startedAtMs) / 1000));
}

function getAntiCheatLimit() {
    const configuredLimit = Number.parseInt(playState.controlMode?.autoSubmitAfterWarnings, 10);
    return Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 3;
}

function resetAntiCheatState() {
    playState.fullscreenWasRequested = false;
    playState.cheatWarningsCount = 0;
    playState.fullscreenExitCount = 0;
    playState.pasteAttemptCount = 0;
    playState.suspiciousEvents = [];
    playState.autoSubmittedByAntiCheat = false;
    playState.lastPasteBlockAtMs = 0;
}

function shouldBypassAntiCheat() {
    return canBypassStudentControlMode(auth.currentUser, playState.testData, playState.adminGhostMode);
}

function rememberSuspiciousEvent(type, message) {
    playState.suspiciousEvents.push({
        type: type,
        message: message,
        atMs: Date.now(),
        elapsedSeconds: getElapsedSeconds()
    });

    if (playState.suspiciousEvents.length > 50) {
        playState.suspiciousEvents = playState.suspiciousEvents.slice(-50);
    }
}

async function recordAntiCheatViolation(type, message) {
    if (!playState.started || playState.submitted || shouldBypassAntiCheat()) {
        return;
    }

    if (type === "fullscreen_exit") {
        playState.fullscreenExitCount += 1;
    }
    if (type === "paste_attempt") {
        playState.pasteAttemptCount += 1;
    }

    playState.cheatWarningsCount += 1;
    rememberSuspiciousEvent(type, message);
    appShowToast(message, "error");
    if (type === "fullscreen_exit") {
        showAntiCheatWarning(message);
    }

    if (playState.cheatWarningsCount >= getAntiCheatLimit()) {
        playState.autoSubmittedByControlMode = true;
        playState.autoSubmittedByAntiCheat = true;
        appShowToast("Тест завершен из-за слишком большого количества нарушений.", "error");
        await submitTest({ forcedByAntiCheat: true });
    }
}

function getRemainingSeconds() {
    if (!playState.timeLimitSeconds) {
        return null;
    }

    return Math.max(0, playState.timeLimitSeconds - getElapsedSeconds());
}

function updateTimerUi() {
    const timerValue = document.getElementById("timerValue");
    const timerLabel = document.querySelector("#timerBox .timer-label");
    const timerNote = document.getElementById("timerNote");
    if (!timerValue) {
        return;
    }

    const remainingSeconds = getRemainingSeconds();

    if (typeof remainingSeconds === "number") {
        timerValue.textContent = formatDuration(remainingSeconds);
        if (timerLabel) {
            timerLabel.textContent = "Осталось времени";
        }
        if (timerNote) {
            timerNote.textContent = "Когда время закончится, тест завершится автоматически.";
        }
        return;
    }

    timerValue.textContent = formatDuration(getElapsedSeconds());
    if (timerLabel) {
        timerLabel.textContent = "Время выполнения";
    }
    if (timerNote) {
        timerNote.textContent = "Тест без ограничения по времени.";
    }
}

function startAttemptTimer() {
    playState.startedAtMs = Date.now();
    updateTimerUi();

    if (playState.timerIntervalId) {
        clearInterval(playState.timerIntervalId);
    }

    playState.timerIntervalId = window.setInterval(async () => {
        updateTimerUi();

        if (playState.timeLimitSeconds && getRemainingSeconds() === 0 && !playState.submitted) {
            playState.timedOut = true;
            await submitTest({ forcedByTimer: true });
        }
    }, 1000);
}

function stopAttemptTimer() {
    if (playState.timerIntervalId) {
        clearInterval(playState.timerIntervalId);
        playState.timerIntervalId = null;
    }

    updateTimerUi();
}

function normalizeQuestionType(question) {
    if (question?.type === "open_text_manual") {
        return "open_text_manual";
    }

    if (question?.type === "open_text" || question?.type === "open_text_auto") {
        return "open_text_auto";
    }

    if (Array.isArray(question?.acceptedAnswers) && question.acceptedAnswers.length > 0) {
        return "open_text_auto";
    }

    return "single_choice";
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

function sanitizeAccessCode(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 10);
}

async function findExistingFinalAttempt(testData, normalizedStudentName, attemptDeviceId) {
    const snap = await db.collection("attemptLocks")
        .doc(getAttemptAccessKey(testData.id, normalizedStudentName, attemptDeviceId))
        .get();

    return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

function getAttemptAccessKey(testId, normalizedStudentName, attemptDeviceId) {
    const safeName = encodeURIComponent(normalizedStudentName)
        .replace(/[^A-Za-z0-9]/g, "_")
        .slice(0, 90);
    const safeDeviceId = String(attemptDeviceId || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 90);
    return `${testId}_${safeName}_${safeDeviceId}`;
}

function getRetakeRequestId(testData, normalizedStudentName, attemptDeviceId) {
    return getAttemptAccessKey(testData.id, normalizedStudentName, attemptDeviceId);
}

async function findRetakeRequestByStatus(testData, normalizedStudentName, attemptDeviceId, status) {
    const requestId = getRetakeRequestId(testData, normalizedStudentName, attemptDeviceId);
    const doc = await db.collection("retakeRequests").doc(requestId).get();
    if (!doc.exists) {
        return null;
    }

    const data = doc.data();
    return data.status === status ? { id: doc.id, ...data } : null;
}

async function createRetakeRequest(testData, studentName, normalizedStudentName, attemptDeviceId) {
    const requestId = getRetakeRequestId(testData, normalizedStudentName, attemptDeviceId);
    const existingDoc = await db.collection("retakeRequests").doc(requestId).get();
    if (existingDoc.exists) {
        return { id: existingDoc.id, ...existingDoc.data() };
    }

    const payload = {
        testId: testData.id,
        teacherId: testData.authorId || "",
        studentName: studentName,
        normalizedStudentName: normalizedStudentName,
        attemptDeviceId: attemptDeviceId,
        status: RETAKE_STATUSES.PENDING,
        requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
        resolvedAt: null,
        resolvedBy: null
    };

    await db.collection("retakeRequests").doc(requestId).set(payload);
    return { id: requestId, ...payload };
}

async function markRetakeRequestUsed(requestId) {
    if (!requestId) {
        return;
    }

    await db.collection("retakeRequests").doc(requestId).update({
        status: RETAKE_STATUSES.USED,
        usedAt: firebase.firestore.FieldValue.serverTimestamp(),
        usedByAttemptId: playState.attemptId || ""
    });
}

function shuffleArray(items) {
    const clonedItems = [...items];

    for (let index = clonedItems.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [clonedItems[index], clonedItems[randomIndex]] = [clonedItems[randomIndex], clonedItems[index]];
    }

    return clonedItems;
}

function shouldHideAdminAttempt(user = auth.currentUser) {
    return Boolean(isAdminUser(user) && playState.adminGhostMode);
}

function normalizeOpenAnswer(value) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildChoiceAnswerData(question, selectedIndex) {
    let selectedOption = "";
    if (Array.isArray(question.options)) {
        const preparedOption = question.options.find((option) => typeof option === "object" && option.originalIndex === selectedIndex);
        selectedOption = preparedOption
            ? preparedOption.text || ""
            : question.options[selectedIndex] || "";
    }

    return {
        type: "single_choice",
        question: question.question,
        selectedIndex: selectedIndex,
        selectedOption: selectedOption,
        correctAnswerIndex: question.correctAnswerIndex,
        isCorrect: selectedIndex === question.correctAnswerIndex
    };
}

function buildOpenAnswerData(question, studentAnswer) {
    const acceptedAnswers = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];
    const normalizedStudentAnswer = normalizeOpenAnswer(studentAnswer);
    const normalizedAcceptedAnswers = acceptedAnswers.map((answer) => normalizeOpenAnswer(answer));
    const questionType = normalizeQuestionType(question);

    return {
        type: questionType,
        question: question.question,
        studentAnswer: studentAnswer,
        acceptedAnswers: acceptedAnswers,
        isCorrect: questionType === "open_text_manual" ? null : normalizedAcceptedAnswers.includes(normalizedStudentAnswer),
        needsManualReview: questionType === "open_text_manual"
    };
}

function prepareQuestionsForAttempt(testData) {
    const preparedQuestions = (testData.questions || []).map((question, originalIndex) => {
        const questionType = normalizeQuestionType(question);
        const preparedQuestion = {
            ...question,
            originalIndex: originalIndex,
            type: questionType
        };

        if (questionType === "single_choice") {
            let options = (question.options || []).map((option, optionIndex) => ({
                text: option,
                originalIndex: optionIndex
            }));

            if (testData.shuffleOptions) {
                options = shuffleArray(options);
            }

            preparedQuestion.options = options;
        }

        return preparedQuestion;
    });

    return testData.shuffleQuestions ? shuffleArray(preparedQuestions) : preparedQuestions;
}

function renderSourceText(testData) {
    const sourceTextBox = document.getElementById("sourceTextBox");
    const sourceTextContent = document.getElementById("sourceTextContent");
    if (!sourceTextBox || !sourceTextContent) {
        return;
    }

    const sourceText = String(testData?.sourceText || "").trim();
    if (!sourceText) {
        sourceTextBox.hidden = true;
        sourceTextContent.textContent = "";
        return;
    }

    sourceTextContent.textContent = sourceText;
    sourceTextBox.hidden = false;
}

function renderQuestions(preparedQuestions) {
    const questionsContainer = document.getElementById("questionsContainer");
    questionsContainer.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const canRevealAnswers = canSeeAnswerHighlights(auth.currentUser);

    preparedQuestions.forEach((question, displayIndex) => {
        const questionType = normalizeQuestionType(question);
        const card = document.createElement("div");
        card.className = "question-card";
        card.dataset.questionIndex = String(question.originalIndex);

        const title = document.createElement("div");
        title.className = "question-title";
        title.textContent = `${displayIndex + 1}. ${question.question}`;
        card.appendChild(title);

        const typeHint = document.createElement("div");
        typeHint.className = "question-type-hint";
        typeHint.textContent = questionType === "open_text_manual"
            ? "Открытый вопрос: ответ сохранится и потом будет проверен вручную."
            : questionType === "open_text_auto"
                ? "Открытый вопрос: впишите ответ и зафиксируйте его кнопкой."
                : "Выберите один вариант ответа. Первый выбор сразу фиксируется.";
        card.appendChild(typeHint);

        if (canRevealAnswers) {
            const tools = document.createElement("div");
            tools.className = "question-tools";

            const revealBtn = document.createElement("button");
            revealBtn.type = "button";
            revealBtn.className = "answer-toggle-btn";
            revealBtn.textContent = "Cavabı göstər";
            revealBtn.dataset.questionReveal = String(question.originalIndex);
            tools.appendChild(revealBtn);
            card.appendChild(tools);

            const preview = document.createElement("div");
            preview.className = "answer-preview";
            preview.hidden = true;
            preview.dataset.answerPreview = String(question.originalIndex);

            if (questionType === "single_choice") {
                const correctOption = (question.options || []).find((option) => option.originalIndex === question.correctAnswerIndex);
                preview.textContent = `Правильный ответ: ${correctOption ? correctOption.text : "не указан"}`;
            } else if (questionType === "open_text_auto") {
                preview.textContent = `Допустимые ответы: ${(question.acceptedAnswers || []).join(", ") || "не указаны"}`;
            } else {
                preview.textContent = "Этот открытый вопрос проверяется вручную преподавателем.";
            }

            card.appendChild(preview);
        }

        if (questionType === "open_text_auto" || questionType === "open_text_manual") {
            const openAnswerWrap = document.createElement("div");
            openAnswerWrap.className = "open-answer-wrap";

            const answerInput = document.createElement("textarea");
            answerInput.className = "open-answer-input";
            answerInput.rows = 3;
            answerInput.placeholder = "Введите ваш ответ";
            answerInput.setAttribute("data-open-answer-input", String(question.originalIndex));

            const lockBtn = document.createElement("button");
            lockBtn.type = "button";
            lockBtn.className = "lock-open-answer-btn";
            lockBtn.dataset.questionIndex = String(question.originalIndex);
            lockBtn.textContent = "Зафиксировать ответ";

            openAnswerWrap.appendChild(answerInput);
            openAnswerWrap.appendChild(lockBtn);
            card.appendChild(openAnswerWrap);
        } else {
            (question.options || []).forEach((option) => {
                const optionRow = document.createElement("label");
                optionRow.className = "option-row";

                const input = document.createElement("input");
                input.type = "radio";
                input.name = `question_${question.originalIndex}`;
                input.value = String(option.originalIndex);

                const label = document.createElement("span");
                label.className = "option-label";
                label.textContent = option.text;

                optionRow.appendChild(input);
                optionRow.appendChild(label);
                card.appendChild(optionRow);
            });
        }

        const status = document.createElement("div");
        status.className = "question-status";
        status.dataset.questionStatus = String(question.originalIndex);
        status.style.display = "none";
        card.appendChild(status);

        fragment.appendChild(card);
    });

    questionsContainer.appendChild(fragment);
}

function setQuestionLocked(questionIndex, message) {
    const card = document.querySelector(`[data-question-index="${questionIndex}"]`);
    if (!card) return;

    const radioInputs = card.querySelectorAll(`input[name="question_${questionIndex}"]`);
    radioInputs.forEach((input) => {
        input.disabled = true;
    });

    const openInput = card.querySelector('[data-open-answer-input]');
    const lockBtn = card.querySelector(".lock-open-answer-btn");
    if (openInput) {
        openInput.disabled = true;
    }
    if (lockBtn) {
        lockBtn.disabled = true;
    }

    const status = card.querySelector(`[data-question-status="${questionIndex}"]`);
    if (status) {
        status.style.display = "block";
        status.textContent = message;
    }
}

async function getLatestTestSnapshot(testId) {
    const testRef = db.collection("tests").doc(testId);

    try {
        return await testRef.get({ source: "server" });
    } catch (serverError) {
        console.warn("Не удалось взять тест с сервера, используем обычное чтение.", serverError);
        return await testRef.get();
    }
}

function canAccessTest(testData, currentUser) {
    if (!testData) {
        return false;
    }

    if (isAdminUser(currentUser)) {
        return true;
    }

    if (testData.authorId && currentUser && testData.authorId === currentUser.uid) {
        return true;
    }

    return normalizeTestStatus(testData) === "active";
}

function updateTestMeta(testData) {
    const metaParts = [`Количество вопросов: ${Array.isArray(testData.questions) ? testData.questions.length : 0}`];

    if (Number.isInteger(testData.timeLimitMinutes) && testData.timeLimitMinutes > 0) {
        metaParts.push(`Лимит времени: ${testData.timeLimitMinutes} мин`);
    }

    if (testData.shuffleQuestions) {
        metaParts.push("Вопросы перемешиваются");
    }

    if (testData.shuffleOptions) {
        metaParts.push("Варианты перемешиваются");
    }

    if (testData.accessCode) {
        metaParts.push(`Код: ${testData.accessCode}`);
    }

    document.getElementById("testMeta").textContent = metaParts.join(" • ");
}

function isOpenAnswerElement(element) {
    return Boolean(element?.closest?.("[data-open-answer-input], .open-answer-input"));
}

function isEditableElement(element) {
    return Boolean(element?.closest?.("input, textarea, [contenteditable='true']"));
}

function enableCopyProtection() {
    const protectedArea = document.getElementById("testForm");
    if (!protectedArea) {
        return () => {};
    }

    protectedArea.classList.add("copy-protected");
    const blockedEvents = ["copy", "cut", "contextmenu", "dragstart", "selectstart"];
    const blockEvent = (event) => {
        if (event.type === "contextmenu" && isOpenAnswerElement(event.target)) {
            return;
        }
        if (event.type === "selectstart" && isEditableElement(event.target)) {
            return;
        }

        event.preventDefault();
        appShowToast("В этом тесте копирование отключено.", "info");
    };

    blockedEvents.forEach((eventName) => {
        protectedArea.addEventListener(eventName, blockEvent);
    });

    return () => {
        protectedArea.classList.remove("copy-protected");
        blockedEvents.forEach((eventName) => {
            protectedArea.removeEventListener(eventName, blockEvent);
        });
    };
}

function getFullscreenElement() {
    return document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement
        || document.msFullscreenElement
        || null;
}

async function requestTestFullscreen() {
    const target = document.getElementById("testContent") || document.documentElement;
    const requestFullscreen = target.requestFullscreen
        || target.webkitRequestFullscreen
        || target.mozRequestFullScreen
        || target.msRequestFullscreen;

    if (!requestFullscreen) {
        appShowToast("Полноэкранный режим не поддерживается в этом браузере.", "info");
        return false;
    }

    try {
        await requestFullscreen.call(target);
        playState.fullscreenWasRequested = true;
        return true;
    } catch (error) {
        console.warn("Браузер не разрешил включить полноэкранный режим.", error);
        appShowToast("Браузер не разрешил включить полноэкранный режим.", "info");
        return false;
    }
}

async function exitTestFullscreen() {
    if (!getFullscreenElement()) {
        return;
    }

    const exitFullscreen = document.exitFullscreen
        || document.webkitExitFullscreen
        || document.mozCancelFullScreen
        || document.msExitFullscreen;

    if (!exitFullscreen) {
        return;
    }

    try {
        await exitFullscreen.call(document);
    } catch (error) {
        console.warn("Не удалось выйти из полноэкранного режима после завершения теста.", error);
    }
}

function enableFullscreenProtection() {
    const handleFullscreenChange = () => {
        if (!playState.started || playState.submitted || !playState.fullscreenWasRequested) {
            return;
        }
        if (getFullscreenElement()) {
            return;
        }

        void recordAntiCheatViolation("fullscreen_exit", "Вы вышли из полноэкранного режима.");
    };

    const fullscreenEvents = [
        "fullscreenchange",
        "webkitfullscreenchange",
        "mozfullscreenchange",
        "MSFullscreenChange"
    ];

    fullscreenEvents.forEach((eventName) => {
        document.addEventListener(eventName, handleFullscreenChange);
    });

    return () => {
        fullscreenEvents.forEach((eventName) => {
            document.removeEventListener(eventName, handleFullscreenChange);
        });
    };
}

function blockOpenAnswerPaste(event) {
    if (!isOpenAnswerElement(event.target)) {
        return;
    }

    event.preventDefault();
    const now = Date.now();
    if (now - playState.lastPasteBlockAtMs < 250) {
        return;
    }
    playState.lastPasteBlockAtMs = now;
    void recordAntiCheatViolation("paste_attempt", "Вставка текста в это поле запрещена.");
}

function enableOpenAnswerPasteProtection() {
    const protectedArea = document.getElementById("testForm");
    if (!protectedArea) {
        return () => {};
    }

    const handleKeydown = (event) => {
        const key = String(event.key || "").toLowerCase();
        const isPasteShortcut = ((event.ctrlKey || event.metaKey) && key === "v")
            || (event.shiftKey && key === "insert");

        if (isPasteShortcut) {
            blockOpenAnswerPaste(event);
        }
    };
    const handleBeforeInput = (event) => {
        if (String(event.inputType || "").startsWith("insertFromPaste")) {
            blockOpenAnswerPaste(event);
        }
    };
    const handleDragOver = (event) => {
        if (isOpenAnswerElement(event.target)) {
            event.preventDefault();
        }
    };

    protectedArea.addEventListener("paste", blockOpenAnswerPaste);
    protectedArea.addEventListener("dragover", handleDragOver);
    protectedArea.addEventListener("drop", blockOpenAnswerPaste);
    protectedArea.addEventListener("contextmenu", blockOpenAnswerPaste);
    protectedArea.addEventListener("keydown", handleKeydown);
    protectedArea.addEventListener("beforeinput", handleBeforeInput);

    return () => {
        protectedArea.removeEventListener("paste", blockOpenAnswerPaste);
        protectedArea.removeEventListener("dragover", handleDragOver);
        protectedArea.removeEventListener("drop", blockOpenAnswerPaste);
        protectedArea.removeEventListener("contextmenu", blockOpenAnswerPaste);
        protectedArea.removeEventListener("keydown", handleKeydown);
        protectedArea.removeEventListener("beforeinput", handleBeforeInput);
    };
}

function hideControlWarning() {
    const overlay = document.getElementById("controlWarningOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

function showAntiCheatWarning(message) {
    const overlay = document.getElementById("controlWarningOverlay");
    const text = document.getElementById("controlWarningText");

    if (text) {
        text.textContent = `${message} Предупреждение ${playState.cheatWarningsCount} из ${getAntiCheatLimit()}.`;
    }
    if (overlay) {
        overlay.style.display = "flex";
    }
}

function showControlWarning() {
    const overlay = document.getElementById("controlWarningOverlay");
    const text = document.getElementById("controlWarningText");

    playState.focusWarnings += 1;
    if (text) {
        text.textContent = `Вы покинули вкладку теста. Предупреждение ${playState.focusWarnings} из ${playState.controlMode.autoSubmitAfterWarnings}.`;
    }
    if (overlay) {
        overlay.style.display = "flex";
    }
}

function enableFocusProtection() {
    let hiddenByProtection = false;

    const handleLeave = async () => {
        if (!playState.started || playState.submitted || hiddenByProtection) {
            return;
        }

        hiddenByProtection = true;
        showControlWarning();
        if (playState.focusWarnings >= playState.controlMode.autoSubmitAfterWarnings) {
            playState.autoSubmittedByControlMode = true;
            await submitTest({ forcedByControlMode: true });
        }
    };

    const handleReturn = () => {
        hiddenByProtection = false;
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
            handleLeave();
        }
    };

    window.addEventListener("blur", handleLeave);
    window.addEventListener("focus", handleReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
        window.removeEventListener("blur", handleLeave);
        window.removeEventListener("focus", handleReturn);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
}

async function loadTest(currentUser) {
    const shareId = String(getTestIdFromUrl() || "").trim();

    if (!shareId) {
        return null;
    }

    try {
        const snap = await db.collection("tests")
            .where("shareId", "==", shareId)
            .where("visibilityStatus", "==", "active")
            .limit(1)
            .get();

        if (snap.empty) {
            showError("Тест не найден.");
            return null;
        }

        const doc = snap.docs[0];
        const testData = doc.data();

        if (!Array.isArray(testData.questions) || testData.questions.length === 0) {
            showError("В этом тесте нет вопросов.");
            return null;
        }

        if (!canAccessTest(testData, currentUser)) {
            showError("Доступ к этому тесту сейчас закрыт.");
            return null;
        }

        document.getElementById("loadingText").style.display = "none";
        document.getElementById("testContent").style.display = "block";
        document.getElementById("testTitle").textContent = testData.title || "Без названия";
        updateTestMeta(testData);

        return { id: doc.id, ...testData };
    } catch (error) {
        console.error("Ошибка загрузки теста:", error);
        showError("Не удалось загрузить тест.");
        return null;
    }
}

async function findTestByCode(code, currentUser) {
    const normalizedCode = sanitizeAccessCode(code);

    if (!normalizedCode) {
        appShowToast("Введите код теста.", "error");
        return null;
    }

    try {
        const snap = await db.collection("tests")
            .where("accessCode", "==", normalizedCode)
            .where("visibilityStatus", "==", "active")
            .limit(1)
            .get();

        if (snap.empty) {
            appShowToast("Тест с таким кодом не найден.", "error");
            return null;
        }

        const testDoc = snap.docs[0];
        const testData = { id: testDoc.id, ...testDoc.data() };

        if (!canAccessTest(testData, currentUser)) {
            appShowToast("Этот тест сейчас закрыт для прохождения.", "error");
            return null;
        }

        const url = new URL(window.location.href);
        url.searchParams.set("test", testData.shareId || "");
        url.searchParams.delete("code");
        window.location.href = url.toString();
        return testData;
    } catch (error) {
        console.error("Ошибка поиска теста по коду:", error);
        appShowToast("Не удалось найти тест по коду.", "error");
        return null;
    }
}

async function saveAnswerEntry(testData, questionIndex, answerData) {
    const currentUser = auth.currentUser;
    const question = testData.questions[questionIndex];
    const entryId = `${playState.attemptId}_answer_${questionIndex}`;

    const payload = {
        resultId: entryId,
        attemptId: playState.attemptId,
        entryType: "answer",
        testId: testData.id,
        testTitle: testData.title || "Без названия",
        teacherId: testData.authorId || "",
        studentUid: currentUser ? currentUser.uid : null,
        studentEmail: currentUser ? (currentUser.email || "") : "",
        studentName: playState.studentName || "Без имени",
        normalizedStudentName: playState.normalizedStudentName || normalizeStudentNameForAttempt(playState.studentName),
        attemptDeviceId: playState.attemptDeviceId || "",
        retake: Boolean(playState.retakeMode),
        retakeRequestId: playState.retakeRequestId || "",
        questionIndex: questionIndex,
        question: question.question,
        questionType: answerData.type,
        selectedIndex: typeof answerData.selectedIndex === "number" ? answerData.selectedIndex : null,
        selectedOption: answerData.selectedOption || "",
        studentAnswer: answerData.studentAnswer || "",
        correctAnswerIndex: typeof question.correctAnswerIndex === "number" ? question.correctAnswerIndex : null,
        acceptedAnswers: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [],
        isCorrect: Boolean(answerData.isCorrect),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const publicRef = db.collection("results").doc(entryId);
    const ownerRef = db
        .collection("users")
        .doc(testData.authorId)
        .collection("testResults")
        .doc(entryId);

    const batch = db.batch();
    batch.set(publicRef, payload);
    batch.set(ownerRef, payload);
    if (!playState.retakeMode && playState.normalizedStudentName && playState.attemptDeviceId) {
        const lockRef = db.collection("attemptLocks").doc(
            getAttemptAccessKey(testData.id, playState.normalizedStudentName, playState.attemptDeviceId)
        );
        batch.set(lockRef, {
            testId: testData.id,
            teacherId: testData.authorId || "",
            studentName: playState.studentName || "Без имени",
            normalizedStudentName: playState.normalizedStudentName,
            attemptDeviceId: playState.attemptDeviceId,
            attemptId: playState.attemptId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    await batch.commit();
}

async function saveFinalResult(testData, score, answers, durationSeconds, autoCheckedQuestions, pendingManualCount) {
    const currentUser = auth.currentUser;
    const total = testData.questions.length;
    const percent = getPercent(score, total);
    const entryId = `${playState.attemptId}_final`;

    const payload = {
        resultId: entryId,
        attemptId: playState.attemptId,
        entryType: "final",
        testId: testData.id,
        testTitle: testData.title || "Без названия",
        teacherId: testData.authorId || "",
        studentUid: currentUser ? currentUser.uid : null,
        studentEmail: currentUser ? (currentUser.email || "") : "",
        studentName: playState.studentName || "Без имени",
        normalizedStudentName: playState.normalizedStudentName || normalizeStudentNameForAttempt(playState.studentName),
        attemptDeviceId: playState.attemptDeviceId || "",
        retake: Boolean(playState.retakeMode),
        retakeRequestId: playState.retakeRequestId || "",
        score: score,
        totalQuestions: total,
        percent: percent,
        durationSeconds: durationSeconds,
        startedAtMs: playState.startedAtMs || null,
        submittedAtMs: Date.now(),
        focusWarnings: playState.focusWarnings,
        cheatWarningsCount: playState.cheatWarningsCount,
        fullscreenExitCount: playState.fullscreenExitCount,
        pasteAttemptCount: playState.pasteAttemptCount,
        suspiciousEvents: playState.suspiciousEvents.slice(-50),
        autoSubmitted: Boolean(playState.autoSubmittedByControlMode || playState.autoSubmittedByAntiCheat || playState.timedOut),
        autoSubmitReason: playState.autoSubmittedByAntiCheat
            ? "anti_cheat"
            : playState.autoSubmittedByControlMode
                ? "focus_warnings"
                : playState.timedOut ? "timer" : "",
        autoCheckedQuestions: autoCheckedQuestions,
        pendingManualCount: pendingManualCount,
        answers: answers,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const publicRef = db.collection("results").doc(entryId);
    const ownerRef = db
        .collection("users")
        .doc(testData.authorId)
        .collection("testResults")
        .doc(entryId);

    const batch = db.batch();
    batch.set(publicRef, payload);
    batch.set(ownerRef, payload);
    await batch.commit();
}

async function handleChoiceAnswerSelection(input) {
    const currentUser = auth.currentUser;
    const shouldSkipSaving = shouldHideAdminAttempt(currentUser);
    const questionIndex = parseInt(input.name.replace("question_", ""), 10);
    const card = document.querySelector(`[data-question-index="${questionIndex}"]`);
    const radioInputs = card
        ? Array.from(card.querySelectorAll(`input[name="question_${questionIndex}"]`))
        : [];

    if (playState.answers.has(questionIndex)) {
        input.checked = true;
        return;
    }

    const selectedIndex = parseInt(input.value, 10);
    const question = playState.testData.questions[questionIndex];
    const answerData = buildChoiceAnswerData(question, selectedIndex);

    radioInputs.forEach((radioInput) => {
        radioInput.disabled = true;
    });

    if (!shouldSkipSaving) {
        try {
            await saveAnswerEntry(playState.testData, questionIndex, answerData);
        } catch (error) {
            console.error("Ошибка сохранения ответа:", error);
            input.checked = false;
            radioInputs.forEach((radioInput) => {
                radioInput.disabled = false;
            });
            appShowToast("Не удалось сохранить ответ. Попробуйте ещё раз.", "error");
            return;
        }
    }

    playState.answers.set(questionIndex, answerData);
    setQuestionLocked(
        questionIndex,
        shouldSkipSaving
            ? "Ответ зафиксирован. Как администратор, вы не попадаете в результаты автора."
            : "Ответ сохранён. Изменить его уже нельзя."
    );
}

async function handleOpenAnswerLock(button) {
    const currentUser = auth.currentUser;
    const shouldSkipSaving = shouldHideAdminAttempt(currentUser);
    const questionIndex = parseInt(button.dataset.questionIndex, 10);

    if (playState.answers.has(questionIndex)) {
        return;
    }

    const card = document.querySelector(`[data-question-index="${questionIndex}"]`);
    if (!card) {
        return;
    }

    const input = card.querySelector('[data-open-answer-input]');
    const studentAnswer = input ? input.value.trim() : "";

    if (!studentAnswer) {
        appShowToast("Сначала впишите ответ в поле.", "error");
        return;
    }

    const question = playState.testData.questions[questionIndex];
    const answerData = buildOpenAnswerData(question, studentAnswer);
    button.disabled = true;

    if (!shouldSkipSaving) {
        try {
            await saveAnswerEntry(playState.testData, questionIndex, answerData);
        } catch (error) {
            console.error("Ошибка сохранения открытого ответа:", error);
            button.disabled = false;
            appShowToast("Не удалось сохранить открытый ответ. Попробуйте ещё раз.", "error");
            return;
        }
    }

    playState.answers.set(questionIndex, answerData);
    setQuestionLocked(
        questionIndex,
        shouldSkipSaving
            ? "Ответ зафиксирован. Как администратор, вы не попадаете в результаты автора."
            : "Ответ сохранён. Изменить его уже нельзя."
    );
}

async function collectPendingOpenAnswersBeforeFinish() {
    const shouldSkipSaving = shouldHideAdminAttempt(auth.currentUser);

    for (const question of playState.preparedQuestions) {
        const questionType = normalizeQuestionType(question);
        if (questionType === "single_choice" || playState.answers.has(question.originalIndex)) {
            continue;
        }

        const card = document.querySelector(`[data-question-index="${question.originalIndex}"]`);
        const input = card?.querySelector('[data-open-answer-input]');
        const studentAnswer = input?.value.trim() || "";
        if (!studentAnswer) {
            continue;
        }

        const answerData = buildOpenAnswerData(question, studentAnswer);

        if (!shouldSkipSaving) {
            await saveAnswerEntry(playState.testData, question.originalIndex, answerData);
        }

        playState.answers.set(question.originalIndex, answerData);
        setQuestionLocked(
            question.originalIndex,
            shouldSkipSaving
                ? "Ответ учтён при завершении. Как администратор, вы не попадаете в результаты автора."
                : "Ответ автоматически зафиксирован при завершении теста."
        );
    }
}

function buildFinalAnswersAndStats() {
    let score = 0;
    let pendingManualCount = 0;
    let autoCheckedQuestions = 0;

    const answers = playState.testData.questions.map((question, questionIndex) => {
        const questionType = normalizeQuestionType(question);
        const answer = playState.answers.get(questionIndex) || (
            questionType === "open_text_manual"
                ? {
                    type: "open_text_manual",
                    question: question.question,
                    studentAnswer: "",
                    acceptedAnswers: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [],
                    isCorrect: null,
                    needsManualReview: true
                }
                : questionType === "open_text_auto"
                    ? {
                        type: "open_text_auto",
                        question: question.question,
                        studentAnswer: "",
                        acceptedAnswers: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [],
                        isCorrect: false
                    }
                    : {
                        type: "single_choice",
                        question: question.question,
                        selectedIndex: -1,
                        selectedOption: "",
                        correctAnswerIndex: question.correctAnswerIndex,
                        isCorrect: false
                    }
        );

        if (answer.type === "open_text_manual") {
            pendingManualCount++;
            return answer;
        }

        autoCheckedQuestions++;
        if (answer.isCorrect) {
            score++;
        }

        return answer;
    });

    return { answers, score, pendingManualCount, autoCheckedQuestions };
}

function renderResultReviewList(answers, rawQuestions) {
    const reviewList = document.getElementById("resultReviewList");
    reviewList.innerHTML = "";

    const fragment = document.createDocumentFragment();

    answers.forEach((answer, index) => {
        const question = rawQuestions[index];
        const item = document.createElement("div");
        item.className = `review-item ${
            answer.type === "open_text_manual"
                ? "pending"
                : answer.isCorrect
                    ? "correct"
                    : "wrong"
        }`;

        const title = document.createElement("div");
        title.className = "review-question";
        title.textContent = `${index + 1}. ${question.question}`;

        const meta = document.createElement("div");
        meta.className = "review-meta";

        if (answer.type === "single_choice") {
            const correctOption = Array.isArray(question.options)
                ? question.options[question.correctAnswerIndex] || "Не указан"
                : "Не указан";
            meta.textContent = answer.isCorrect
                ? `Ваш ответ: ${answer.selectedOption || "Нет ответа"}`
                : `Ваш ответ: ${answer.selectedOption || "Нет ответа"} • Правильный ответ: ${correctOption}`;
        } else if (answer.type === "open_text_manual") {
            meta.textContent = `Ваш ответ: ${answer.studentAnswer || "Нет ответа"} • Этот ответ ждёт ручной проверки учителя.`;
        } else {
            meta.textContent = answer.isCorrect
                ? `Ваш ответ: ${answer.studentAnswer || "Нет ответа"}`
                : `Ваш ответ: ${answer.studentAnswer || "Нет ответа"} • Допустимые ответы: ${(answer.acceptedAnswers || []).join(", ") || "не указаны"}`;
        }

        item.appendChild(title);
        item.appendChild(meta);
        fragment.appendChild(item);
    });

    reviewList.appendChild(fragment);
}

async function submitTest({ forcedByTimer = false, forcedByControlMode = false, forcedByAntiCheat = false } = {}) {
    if (playState.submitted) {
        return;
    }

    playState.submitted = true;

    try {
        await collectPendingOpenAnswersBeforeFinish();
    } catch (error) {
        playState.submitted = false;
        console.error("Ошибка фиксации открытых ответов:", error);
        appShowToast("Не удалось зафиксировать открытые ответы перед завершением.", "error");
        return;
    }

    const { answers, score, pendingManualCount, autoCheckedQuestions } = buildFinalAnswersAndStats();
    const shouldSkipSaving = shouldHideAdminAttempt(auth.currentUser);
    const durationSeconds = getElapsedSeconds();
    const percent = getPercent(score, playState.testData.questions.length);
    if (!shouldSkipSaving) {
        try {
            await saveFinalResult(
                playState.testData,
                score,
                answers,
                durationSeconds,
                autoCheckedQuestions,
                pendingManualCount
            );
            if (playState.retakeRequestId) {
                try {
                    await markRetakeRequestUsed(playState.retakeRequestId);
                } catch (retakeError) {
                    console.warn("Результат сохранён, но заявку на повтор не удалось пометить использованной.", retakeError);
                }
            }
        } catch (error) {
            playState.submitted = false;
            console.error("Ошибка сохранения результата:", error);
            appShowToast("Не удалось сохранить результат в Firebase. Попробуйте ещё раз.", "error");
            return;
        }
    }

    stopAttemptTimer();
    if (playState.copyProtectionCleanup) {
        playState.copyProtectionCleanup();
        playState.copyProtectionCleanup = null;
    }
    if (playState.focusProtectionCleanup) {
        playState.focusProtectionCleanup();
        playState.focusProtectionCleanup = null;
    }
    if (playState.fullscreenProtectionCleanup) {
        playState.fullscreenProtectionCleanup();
        playState.fullscreenProtectionCleanup = null;
    }
    if (playState.pasteProtectionCleanup) {
        playState.pasteProtectionCleanup();
        playState.pasteProtectionCleanup = null;
    }
    await exitTestFullscreen();
    const watermark = document.getElementById("studentWatermark");
    if (watermark) {
        watermark.style.display = "none";
    }
    hideControlWarning();

    document.getElementById("resultBox").style.display = "block";
    document.getElementById("resultScore").textContent = `Ваш результат: ${score} из ${playState.testData.questions.length}`;
    document.getElementById("resultPercent").textContent = `Процент выполнения: ${percent}%. Время: ${formatDuration(durationSeconds)}`;

    const notes = [];
    if (autoCheckedQuestions < playState.testData.questions.length) {
        notes.push(`Автоматически проверено вопросов: ${autoCheckedQuestions}. Ожидают ручной проверки: ${pendingManualCount}.`);
    }
    if (forcedByTimer) {
        notes.push("Время вышло, поэтому тест завершился автоматически.");
    }
    if (forcedByControlMode) {
        notes.push("Тест завершён автоматически из-за ухода со вкладки.");
    }
    if (forcedByAntiCheat) {
        notes.push("Тест завершен из-за слишком большого количества нарушений.");
    }
    if (playState.focusWarnings > 0) {
        notes.push(`Предупреждений за уход со вкладки: ${playState.focusWarnings}.`);
    }
    if (playState.cheatWarningsCount > 0) {
        notes.push(`Анти-чит предупреждений: ${playState.cheatWarningsCount}.`);
    }
    if (shouldSkipSaving) {
        notes.push("Как администратор, вы не попали в результаты автора.");
    }

    document.getElementById("resultNote").textContent = notes.join(" ");
    document.getElementById("testForm").style.display = "none";
}

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user || null);
        });
    });

    const introBox = document.getElementById("introBox");
    const startTestBtn = document.getElementById("startTestBtn");
    const studentNameInput = document.getElementById("studentName");
    const testForm = document.getElementById("testForm");
    const codeLookupBox = document.getElementById("codeLookupBox");
    const testCodeInput = document.getElementById("testCodeInput");
    const findByCodeBtn = document.getElementById("findByCodeBtn");
    const adminModeBox = document.getElementById("adminModeBox");
    const adminGhostModeCheckbox = document.getElementById("adminGhostMode");
    const retakeRequestBox = document.getElementById("retakeRequestBox");
    const sendRetakeRequestBtn = document.getElementById("sendRetakeRequestBtn");
    const returnToTestBtn = document.getElementById("returnToTestBtn");

    if (isAdminUser(currentUser)) {
        adminModeBox.style.display = "block";
        playState.adminGhostMode = true;
        adminGhostModeCheckbox.checked = true;
        adminGhostModeCheckbox.addEventListener("change", () => {
            playState.adminGhostMode = adminGhostModeCheckbox.checked;
        });
    } else {
        playState.adminGhostMode = false;
    }

    const directCode = getCodeFromUrl();
    if (!getTestIdFromUrl()) {
        document.getElementById("loadingText").style.display = "none";
        codeLookupBox.style.display = "block";
        if (directCode) {
            testCodeInput.value = directCode;
        }
    }

    const testData = await loadTest(currentUser);
    if (getTestIdFromUrl() && !testData) return;

    if (testData) {
        playState.testData = testData;
    }

    findByCodeBtn.addEventListener("click", async () => {
        await findTestByCode(testCodeInput.value, currentUser);
    });

    testCodeInput.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            await findTestByCode(testCodeInput.value, currentUser);
        }
    });

    startTestBtn.addEventListener("click", async () => {
        const studentName = studentNameInput.value.trim();
        if (!studentName) {
            appShowToast("Введите ваше имя перед началом теста.", "error");
            return;
        }

        resetAntiCheatState();
        const initialAdminGhostMode = isAdminUser(currentUser) ? adminGhostModeCheckbox.checked : false;
        const shouldBypassInitialControl = canBypassStudentControlMode(currentUser, playState.testData, initialAdminGhostMode);
        const fullscreenRequestPromise = shouldBypassInitialControl
            ? Promise.resolve(false)
            : requestTestFullscreen();
        const cancelFullscreenStart = async () => {
            await fullscreenRequestPromise;
            await exitTestFullscreen();
        };

        try {
            const latestSnapshot = await getLatestTestSnapshot(playState.testData.id || getTestIdFromUrl());
            if (!latestSnapshot.exists) {
                await cancelFullscreenStart();
                showError("Тест больше не существует.");
                return;
            }

            const latestTestData = { id: latestSnapshot.id, ...latestSnapshot.data() };
            if (!canAccessTest(latestTestData, auth.currentUser)) {
                await cancelFullscreenStart();
                showError("Доступ к этому тесту сейчас закрыт.");
                return;
            }

            const controlMode = getControlMode(latestTestData);
            const attemptDeviceId = getOrCreateAttemptDeviceId();
            const normalizedStudentName = normalizeStudentNameForAttempt(studentName);
            const adminGhostEnabled = isAdminUser(currentUser) ? adminGhostModeCheckbox.checked : false;
            const shouldBypassControl = canBypassStudentControlMode(auth.currentUser, latestTestData, adminGhostEnabled);

            playState.retakeRequestId = "";
            playState.retakeMode = false;
            if (controlMode.requireRetakeApproval && !shouldBypassControl) {
                const existingAttempt = await findExistingFinalAttempt(latestTestData, normalizedStudentName, attemptDeviceId);
                if (existingAttempt) {
                    const approvedRetake = await findRetakeRequestByStatus(
                        latestTestData,
                        normalizedStudentName,
                        attemptDeviceId,
                        RETAKE_STATUSES.APPROVED
                    );

                    if (!approvedRetake) {
                        playState.testData = latestTestData;
                        playState.studentName = studentName;
                        playState.normalizedStudentName = normalizedStudentName;
                        playState.attemptDeviceId = attemptDeviceId;

                        introBox.style.display = "none";
                        retakeRequestBox.style.display = "block";
                        document.getElementById("retakeRequestText").textContent =
                            "Вы уже проходили этот тест с этого устройства и имени. Можно отправить заявку учителю.";
                        await cancelFullscreenStart();
                        return;
                    }

                    playState.retakeRequestId = approvedRetake.id;
                    playState.retakeMode = true;
                }
            }

            playState.testData = latestTestData;
            playState.preparedQuestions = prepareQuestionsForAttempt(latestTestData);
            playState.timeLimitSeconds = Number.isInteger(latestTestData.timeLimitMinutes) && latestTestData.timeLimitMinutes > 0
                ? latestTestData.timeLimitMinutes * 60
                : null;
            playState.controlMode = controlMode;
            playState.focusWarnings = 0;
            playState.autoSubmittedByControlMode = false;
            playState.attemptDeviceId = attemptDeviceId;
            playState.normalizedStudentName = normalizedStudentName;

            renderQuestions(playState.preparedQuestions);
            renderSourceText(latestTestData);
            updateTestMeta(latestTestData);
        } catch (error) {
            await cancelFullscreenStart();
            console.error("Ошибка проверки доступа перед стартом:", error);
            appShowToast("Не удалось проверить доступ к тесту. Попробуйте ещё раз.", "error");
            return;
        }

        playState.studentName = studentName;
        playState.started = true;
        playState.submitted = false;
        playState.timedOut = false;
        playState.answers.clear();
        playState.adminGhostMode = isAdminUser(currentUser) ? adminGhostModeCheckbox.checked : false;
        playState.attemptId = db.collection("results").doc().id;
        const shouldBypassActiveControl = canBypassStudentControlMode(currentUser, playState.testData, playState.adminGhostMode);
        document.getElementById("timerBox").style.display = "block";
        startAttemptTimer();

        introBox.style.display = "none";
        retakeRequestBox.style.display = "none";
        testForm.style.display = "block";
        if (playState.copyProtectionCleanup) {
            playState.copyProtectionCleanup();
            playState.copyProtectionCleanup = null;
        }
        if (playState.focusProtectionCleanup) {
            playState.focusProtectionCleanup();
            playState.focusProtectionCleanup = null;
        }
        if (playState.fullscreenProtectionCleanup) {
            playState.fullscreenProtectionCleanup();
            playState.fullscreenProtectionCleanup = null;
        }
        if (playState.pasteProtectionCleanup) {
            playState.pasteProtectionCleanup();
            playState.pasteProtectionCleanup = null;
        }

        if (playState.controlMode.preventCopy && !shouldBypassActiveControl) {
            playState.copyProtectionCleanup = enableCopyProtection();
        }
        if (!shouldBypassActiveControl) {
            playState.pasteProtectionCleanup = enableOpenAnswerPasteProtection();
            playState.fullscreenProtectionCleanup = enableFullscreenProtection();
            await fullscreenRequestPromise;
        }
        if (playState.controlMode.hideOnBlur && !shouldBypassActiveControl) {
            playState.focusProtectionCleanup = enableFocusProtection();
        }

        const watermark = document.getElementById("studentWatermark");
        if (watermark) {
            watermark.textContent = playState.controlMode.showWatermark ? playState.studentName : "";
            watermark.style.display = playState.controlMode.showWatermark ? "grid" : "none";
        }
        appShowToast("Тест начался. Первый ответ по каждому вопросу фиксируется сразу.", "info");
    });

    sendRetakeRequestBtn.addEventListener("click", async () => {
        sendRetakeRequestBtn.disabled = true;
        try {
            const request = await createRetakeRequest(
                playState.testData,
                playState.studentName,
                playState.normalizedStudentName,
                playState.attemptDeviceId
            );

            if (request.status === RETAKE_STATUSES.REJECTED) {
                document.getElementById("retakeRequestText").textContent =
                    "Учитель уже отклонил повторную попытку для этого имени и устройства.";
                appShowToast("Повторная попытка отклонена учителем.", "info");
                return;
            }

            if (request.status === RETAKE_STATUSES.USED) {
                document.getElementById("retakeRequestText").textContent =
                    "Разрешённая повторная попытка уже была использована.";
                appShowToast("Повтор уже использован.", "info");
                return;
            }

            appShowToast("Заявка отправлена учителю.", "success");
            document.getElementById("retakeRequestText").textContent =
                "Заявка уже отправлена. Когда учитель разрешит повтор, откройте тест снова с этим же именем.";
        } catch (error) {
            console.error("Ошибка заявки на повтор:", error);
            sendRetakeRequestBtn.disabled = false;
            appShowToast("Не удалось отправить заявку. Попробуйте ещё раз.", "error");
        }
    });

    returnToTestBtn.addEventListener("click", async () => {
        hideControlWarning();
        if (
            playState.started
            && !playState.submitted
            && playState.fullscreenWasRequested
            && !getFullscreenElement()
            && !shouldBypassAntiCheat()
        ) {
            await requestTestFullscreen();
        }
    });

    testForm.addEventListener("change", async (event) => {
        const input = event.target;
        if (!input.matches('input[type="radio"]')) {
            return;
        }

        await handleChoiceAnswerSelection(input);
    });

    testForm.addEventListener("click", async (event) => {
        const button = event.target.closest(".lock-open-answer-btn");
        if (button) {
            await handleOpenAnswerLock(button);
            return;
        }

        const revealButton = event.target.closest(".answer-toggle-btn");
        if (!revealButton) {
            return;
        }

        const questionIndex = revealButton.dataset.questionReveal;
        const preview = document.querySelector(`[data-answer-preview="${questionIndex}"]`);
        if (!preview) {
            return;
        }

        const isHidden = preview.hidden;
        preview.hidden = !isHidden;
        revealButton.textContent = isHidden ? "Cavabı gizlət" : "Cavabı göstər";
    });

    testForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!playState.started) {
            appShowToast("Сначала начните тест и введите имя.", "error");
            return;
        }

        await submitTest();
    });
});
