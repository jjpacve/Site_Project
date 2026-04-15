function getTestIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("test");
}

function showError(message) {
    document.getElementById("loadingText").style.display = "none";
    document.getElementById("resultsContent").style.display = "none";

    const errorText = document.getElementById("errorText");
    errorText.style.display = "block";
    errorText.textContent = message;
}

function formatResultDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Дата неизвестна";
    }

    return timestamp.toDate().toLocaleString("ru-RU");
}

function formatDuration(seconds) {
    const safeSeconds = Math.max(0, seconds || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getReviewKey(attemptId, questionIndex) {
    return `${attemptId}_${questionIndex}`;
}

function getCorrectOptionText(question) {
    if (!Array.isArray(question?.options)) {
        return "Не указан";
    }

    return question.options[question.correctAnswerIndex] || "Не указан";
}

function enrichResult(testData, result) {
    if (!Array.isArray(result.answers)) {
        return {
            ...result,
            answers: [],
            pendingManualCount: typeof result.pendingManualCount === "number" ? result.pendingManualCount : 0,
            score: typeof result.score === "number" ? result.score : 0,
            percent: typeof result.percent === "number" ? result.percent : 0
        };
    }

    const reviewMap = testData.manualReviewMap || {};
    const answers = result.answers.map((answer, questionIndex) => {
        if (answer.type !== "open_text_manual") {
            return answer;
        }

        const review = reviewMap[getReviewKey(result.attemptId, questionIndex)];
        if (!review) {
            return {
                ...answer,
                reviewStatus: "pending",
                isCorrect: null
            };
        }

        return {
            ...answer,
            reviewStatus: "reviewed",
            isCorrect: Boolean(review.isCorrect)
        };
    });

    const score = answers.reduce((sum, answer) => sum + (answer.isCorrect === true ? 1 : 0), 0);
    const pendingManualCount = answers.filter((answer) => answer.type === "open_text_manual" && answer.reviewStatus !== "reviewed").length;
    const totalQuestions = result.totalQuestions || (Array.isArray(testData.questions) ? testData.questions.length : 0);
    const percent = totalQuestions ? Math.round((score / totalQuestions) * 100) : 0;

    return {
        ...result,
        answers,
        score,
        pendingManualCount,
        percent
    };
}

async function updateManualReview(testData, result, questionIndex, isCorrect) {
    const reviewKey = getReviewKey(result.attemptId, questionIndex);

    await db.collection("tests").doc(testData.id).update({
        [`manualReviewMap.${reviewKey}`]: {
            isCorrect: Boolean(isCorrect),
            reviewedBy: auth.currentUser.uid,
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
    });
}

function setResultsTab(tabName) {
    const showingRetakes = tabName === "retakes";
    document.getElementById("resultsPanel").style.display = showingRetakes ? "none" : "block";
    document.getElementById("retakesPanel").style.display = showingRetakes ? "block" : "none";
    document.getElementById("resultsTabBtn").classList.toggle("active", !showingRetakes);
    document.getElementById("retakesTabBtn").classList.toggle("active", showingRetakes);
}

function getRetakeStatusText(status) {
    if (status === RETAKE_STATUSES.APPROVED) return "Разрешено";
    if (status === RETAKE_STATUSES.REJECTED) return "Отклонено";
    if (status === RETAKE_STATUSES.USED) return "Использовано";
    return "Ожидает решения";
}

async function loadRetakeRequests(testId, teacherId) {
    try {
        const snap = await db.collection("retakeRequests")
            .where("testId", "==", testId)
            .where("teacherId", "==", teacherId)
            .get();

        return snap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
    } catch (error) {
        console.warn("Не удалось загрузить заявки на повтор:", error);
        appShowToast("Заявки на повтор недоступны. Проверь Firestore Rules.", "info");
        return [];
    }
}

async function updateRetakeRequestStatus(testData, request, nextStatus) {
    if (testData.authorId !== auth.currentUser.uid && !isFullAdminUser(auth.currentUser)) {
        appShowToast("Можно управлять только заявками к своим тестам.", "error");
        return;
    }

    await db.collection("retakeRequests").doc(request.id).update({
        status: nextStatus,
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        resolvedBy: auth.currentUser.uid
    });
}

function renderAnswerDetails(testData, result, container, refreshResults) {
    container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    (result.answers || []).forEach((answer, index) => {
        const question = testData.questions[index] || {};
        const card = document.createElement("div");
        card.className = `detail-card ${
            answer.type === "open_text_manual"
                ? (answer.reviewStatus === "reviewed" ? (answer.isCorrect ? "correct" : "wrong") : "pending")
                : answer.isCorrect
                    ? "correct"
                    : "wrong"
        }`;

        const title = document.createElement("div");
        title.className = "detail-question";
        title.textContent = `${index + 1}. ${question.question || "Без текста"}`;

        const meta = document.createElement("div");
        meta.className = "detail-meta";

        if (answer.type === "single_choice") {
            meta.textContent = answer.isCorrect
                ? `Ответ ученика: ${answer.selectedOption || "Нет ответа"}`
                : `Ответ ученика: ${answer.selectedOption || "Нет ответа"} • Правильный ответ: ${getCorrectOptionText(question)}`;
        } else if (answer.type === "open_text_manual") {
            meta.textContent = `Ответ ученика: ${answer.studentAnswer || "Нет ответа"}${answer.reviewStatus === "reviewed" ? ` • Проверка: ${answer.isCorrect ? "засчитан" : "не засчитан"}` : " • Ожидает ручной проверки"}`;
        } else {
            meta.textContent = answer.isCorrect
                ? `Ответ ученика: ${answer.studentAnswer || "Нет ответа"}`
                : `Ответ ученика: ${answer.studentAnswer || "Нет ответа"} • Допустимые ответы: ${(answer.acceptedAnswers || []).join(", ") || "не указаны"}`;
        }

        card.appendChild(title);
        card.appendChild(meta);

        if (answer.type === "open_text_manual") {
            const actions = document.createElement("div");
            actions.className = "result-actions";

            const approveBtn = document.createElement("button");
            approveBtn.type = "button";
            approveBtn.className = "review-btn approve";
            approveBtn.textContent = "Засчитать";

            const rejectBtn = document.createElement("button");
            rejectBtn.type = "button";
            rejectBtn.className = "review-btn reject";
            rejectBtn.textContent = "Не засчитывать";

            approveBtn.addEventListener("click", async () => {
                try {
                    await updateManualReview(testData, result, index, true);
                    appShowToast("Ответ засчитан.", "success");
                    await refreshResults();
                } catch (error) {
                    console.error("Ошибка ручной проверки:", error);
                    appShowToast("Не удалось сохранить ручную проверку.", "error");
                }
            });

            rejectBtn.addEventListener("click", async () => {
                try {
                    await updateManualReview(testData, result, index, false);
                    appShowToast("Ответ отмечен как неверный.", "success");
                    await refreshResults();
                } catch (error) {
                    console.error("Ошибка ручной проверки:", error);
                    appShowToast("Не удалось сохранить ручную проверку.", "error");
                }
            });

            actions.appendChild(approveBtn);
            actions.appendChild(rejectBtn);
            card.appendChild(actions);
        }

        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

function renderResults(testData, results, refreshResults) {
    const list = document.getElementById("resultsList");
    const emptyText = document.getElementById("emptyText");
    const summaryCount = document.getElementById("summaryCount");

    list.innerHTML = "";
    summaryCount.textContent = `Всего прохождений: ${results.length}`;

    if (results.length === 0) {
        emptyText.style.display = "block";
        return;
    }

    emptyText.style.display = "none";
    const fragment = document.createDocumentFragment();

    results.forEach((result) => {
        const card = document.createElement("div");
        card.className = "result-card";

        const main = document.createElement("div");
        main.className = "result-main";

        const name = document.createElement("div");
        name.className = "student-name";
        name.textContent = result.studentName || "Без имени";

        const meta = document.createElement("div");
        meta.className = "student-meta";
        meta.textContent = `Прошёл тест: ${formatResultDate(result.createdAt)}`;

        const percent = document.createElement("div");
        percent.className = "student-meta";
        percent.textContent = `Процент: ${typeof result.percent === "number" ? result.percent : 0}%`;

        const duration = document.createElement("div");
        duration.className = "student-meta";
        duration.textContent = `Время: ${formatDuration(result.durationSeconds)}`;

        main.appendChild(name);
        main.appendChild(meta);
        main.appendChild(percent);
        main.appendChild(duration);

        if (result.retake) {
            const retake = document.createElement("div");
            retake.className = "student-meta";
            retake.textContent = "Повторная попытка";
            main.appendChild(retake);
        }

        if (typeof result.focusWarnings === "number" && result.focusWarnings > 0) {
            const warnings = document.createElement("div");
            warnings.className = "student-meta";
            warnings.textContent = `Уходов со вкладки: ${result.focusWarnings}`;
            main.appendChild(warnings);
        }

        if (typeof result.cheatWarningsCount === "number" && result.cheatWarningsCount > 0) {
            const cheatWarnings = document.createElement("div");
            cheatWarnings.className = "student-meta";
            cheatWarnings.textContent = `Анти-чит: ${result.cheatWarningsCount} предупрежд. • fullscreen: ${result.fullscreenExitCount || 0} • вставка: ${result.pasteAttemptCount || 0}`;
            main.appendChild(cheatWarnings);
        }

        if (result.autoSubmitted) {
            const autoSubmitted = document.createElement("div");
            autoSubmitted.className = "student-meta";
            autoSubmitted.textContent = result.autoSubmitReason === "anti_cheat"
                ? "Автосдано анти-читом"
                : result.autoSubmitReason === "focus_warnings"
                    ? "Автосдано из-за ухода со вкладки"
                    : "Автосдано системой";
            main.appendChild(autoSubmitted);
        }

        if (result.pendingManualCount > 0) {
            const pending = document.createElement("div");
            pending.className = "student-meta";
            pending.textContent = `Ждут ручной проверки: ${result.pendingManualCount}`;
            main.appendChild(pending);
        }

        const side = document.createElement("div");
        side.style.display = "flex";
        side.style.flexDirection = "column";
        side.style.gap = "10px";
        side.style.alignItems = "stretch";

        const score = document.createElement("div");
        score.className = "score-badge";
        score.textContent = `${result.score} / ${result.totalQuestions || testData.questions.length}`;
        side.appendChild(score);

        if (result.pendingManualCount > 0) {
            const pendingBadge = document.createElement("div");
            pendingBadge.className = "pending-badge";
            pendingBadge.textContent = `Ожидает проверки: ${result.pendingManualCount}`;
            side.appendChild(pendingBadge);
        }

        const actions = document.createElement("div");
        actions.className = "result-actions";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "toggle-details-btn";
        toggleBtn.textContent = "Открыть разбор";
        actions.appendChild(toggleBtn);
        main.appendChild(actions);

        const details = document.createElement("div");
        details.className = "details-list";
        details.style.display = "none";

        toggleBtn.addEventListener("click", () => {
            const isHidden = details.style.display === "none";
            details.style.display = isHidden ? "flex" : "none";
            toggleBtn.textContent = isHidden ? "Скрыть разбор" : "Открыть разбор";

            if (isHidden) {
                renderAnswerDetails(testData, result, details, refreshResults);
            }
        });

        const wrapper = document.createElement("div");
        wrapper.style.width = "100%";
        wrapper.appendChild(card);
        wrapper.appendChild(details);

        card.appendChild(main);
        card.appendChild(side);
        fragment.appendChild(wrapper);
    });

    list.appendChild(fragment);
}

function renderRetakeRequests(testData, requests, refreshResults) {
    const list = document.getElementById("retakeRequestsList");
    const empty = document.getElementById("retakeEmptyText");

    list.innerHTML = "";

    if (requests.length === 0) {
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";
    const fragment = document.createDocumentFragment();

    requests.forEach((request) => {
        const card = document.createElement("div");
        card.className = "result-card";

        const main = document.createElement("div");
        main.className = "result-main";

        const name = document.createElement("div");
        name.className = "student-name";
        name.textContent = request.studentName || "Без имени";

        const requestedAt = document.createElement("div");
        requestedAt.className = "student-meta";
        requestedAt.textContent = `Запрос: ${formatResultDate(request.requestedAt)}`;

        const device = document.createElement("div");
        device.className = "student-meta";
        device.textContent = `Устройство: ${request.attemptDeviceId || "не указано"}`;

        const status = document.createElement("div");
        status.className = "retake-status";
        status.textContent = getRetakeStatusText(request.status);

        main.appendChild(name);
        main.appendChild(requestedAt);
        main.appendChild(device);
        main.appendChild(status);

        const actions = document.createElement("div");
        actions.className = "result-actions";

        if (request.status === RETAKE_STATUSES.PENDING) {
            const approveBtn = document.createElement("button");
            approveBtn.type = "button";
            approveBtn.className = "review-btn approve";
            approveBtn.textContent = "Разрешить";
            approveBtn.addEventListener("click", async () => {
                try {
                    await updateRetakeRequestStatus(testData, request, RETAKE_STATUSES.APPROVED);
                    appShowToast("Повторная попытка разрешена.", "success");
                    await refreshResults();
                    setResultsTab("retakes");
                } catch (error) {
                    console.error("Ошибка разрешения повтора:", error);
                    appShowToast("Не удалось разрешить повтор.", "error");
                }
            });

            const rejectBtn = document.createElement("button");
            rejectBtn.type = "button";
            rejectBtn.className = "review-btn reject";
            rejectBtn.textContent = "Отклонить";
            rejectBtn.addEventListener("click", async () => {
                try {
                    await updateRetakeRequestStatus(testData, request, RETAKE_STATUSES.REJECTED);
                    appShowToast("Повторная попытка отклонена.", "success");
                    await refreshResults();
                    setResultsTab("retakes");
                } catch (error) {
                    console.error("Ошибка отклонения повтора:", error);
                    appShowToast("Не удалось отклонить повтор.", "error");
                }
            });

            actions.appendChild(approveBtn);
            actions.appendChild(rejectBtn);
        }

        card.appendChild(main);
        card.appendChild(actions);
        fragment.appendChild(card);
    });

    list.appendChild(fragment);
}

async function loadResultsPage(user) {
    const testId = getTestIdFromUrl();

    if (!testId) {
        showError("В ссылке нет ID теста.");
        return;
    }

    try {
        const testDoc = await db.collection("tests").doc(testId).get();

        if (!testDoc.exists) {
            showError("Тест не найден.");
            return;
        }

        const testData = { id: testDoc.id, ...testDoc.data() };
        if (testData.authorId !== user.uid) {
            showError("Результаты этого теста доступны только его автору.");
            return;
        }

        const ownerResultsSnap = await db
            .collection("users")
            .doc(user.uid)
            .collection("testResults")
            .where("testId", "==", testId)
            .get();

        const fallbackResultsSnap = ownerResultsSnap.empty
            ? await db.collection("results").where("testId", "==", testId).get()
            : null;

        const sourceDocs = ownerResultsSnap.empty && fallbackResultsSnap
            ? fallbackResultsSnap.docs
            : ownerResultsSnap.docs;

        const results = sourceDocs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((result) => result.entryType === "final" || (!result.entryType && typeof result.score === "number"))
            .map((result) => enrichResult(testData, result))
            .sort((a, b) => {
                const bSeconds = b.createdAt?.seconds || 0;
                const aSeconds = a.createdAt?.seconds || 0;
                return bSeconds - aSeconds;
            });
        const retakeRequests = await loadRetakeRequests(testId, user.uid);

        document.getElementById("loadingText").style.display = "none";
        document.getElementById("resultsContent").style.display = "block";
        document.getElementById("testTitle").textContent = `Результаты: ${testData.title || "Без названия"}`;
        document.getElementById("testMeta").textContent =
            `Вопросов в тесте: ${Array.isArray(testData.questions) ? testData.questions.length : 0}`;

        renderResults(testData, results, async () => {
            await loadResultsPage(user);
        });
        renderRetakeRequests(testData, retakeRequests, async () => {
            await loadResultsPage(user);
        });
    } catch (error) {
        console.error("Ошибка загрузки результатов:", error);
        showError("Не удалось загрузить результаты теста.");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
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

    document.getElementById("resultsTabBtn").addEventListener("click", () => setResultsTab("results"));
    document.getElementById("retakesTabBtn").addEventListener("click", () => setResultsTab("retakes"));

    await loadResultsPage(user);
});
