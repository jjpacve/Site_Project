function showAdminError(message) {
    document.getElementById("loadingText").style.display = "none";
    document.getElementById("adminContent").style.display = "none";

    const errorText = document.getElementById("errorText");
    errorText.style.display = "block";
    errorText.textContent = message;
}

function showAdminWarning(message) {
    const errorText = document.getElementById("errorText");
    errorText.style.display = "block";
    errorText.textContent = message;
}

function formatTimestamp(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Дата неизвестна";
    }

    return timestamp.toDate().toLocaleString("ru-RU");
}

function normalizeQuestionType(question) {
    if (question?.type === "open_text") {
        return "open_text";
    }

    if (Array.isArray(question?.acceptedAnswers) && question.acceptedAnswers.length > 0) {
        return "open_text";
    }

    return "single_choice";
}

async function getQuerySnapshotPreferServer(query) {
    const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("timeout"));
        }, timeoutMs);

        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });

    if (typeof db.enableNetwork === "function") {
        await db.enableNetwork().catch((error) => {
            console.warn("Не удалось принудительно включить сеть Firestore:", error);
        });
    }

    try {
        return await withTimeout(query.get({ source: "server" }), 6000);
    } catch (serverError) {
        console.warn("Admin server query failed:", serverError);
        throw serverError;
    }
}

function updateStatusLine(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}

function waitForAdminAuth(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Firebase Auth не ответил за 8 секунд. Проверь, что загружен свежий firebase-init.js и домен разрешён в Firebase Auth."));
        }, timeoutMs);

        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            clearTimeout(timer);
            unsubscribe();
            resolve(currentUser);
        }, (error) => {
            clearTimeout(timer);
            unsubscribe();
            reject(error);
        });
    });
}

function createQuestionCard(question, questionIndex) {
    const card = document.createElement("div");
    card.className = "question-card";

    const title = document.createElement("div");
    title.className = "question-title";
    title.textContent = `${questionIndex + 1}. ${question.question || "Без текста"}`;
    card.appendChild(title);

    const typeLine = document.createElement("div");
    typeLine.className = "meta-line";

    if (normalizeQuestionType(question) === "open_text") {
        typeLine.textContent = question.type === "open_text_manual"
            ? "Тип: открытый вопрос с ручной проверкой"
            : "Тип: открытый вопрос";
        card.appendChild(typeLine);

        const acceptedAnswers = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];
        if (acceptedAnswers.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty-text";
            empty.textContent = "Допустимые ответы не указаны.";
            card.appendChild(empty);
            return card;
        }

        acceptedAnswers.forEach((answer, answerIndex) => {
            const answerRow = document.createElement("div");
            answerRow.className = "option-item correct";
            answerRow.textContent = `${answerIndex + 1}. ${answer}`;
            card.appendChild(answerRow);
        });

        return card;
    }

    typeLine.textContent = "Тип: вопрос с вариантами ответа";
    card.appendChild(typeLine);

    (question.options || []).forEach((option, optionIndex) => {
        const optionRow = document.createElement("div");
        optionRow.className = `option-item ${optionIndex === question.correctAnswerIndex ? "correct" : ""}`;
        optionRow.textContent = `${optionIndex + 1}. ${option}`;
        card.appendChild(optionRow);
    });

    return card;
}

function createSourceTextCard(test) {
    const sourceText = String(test?.sourceText || "").trim();
    if (!sourceText) {
        return document.createDocumentFragment();
    }

    const card = document.createElement("div");
    card.className = "source-text-card";

    const title = document.createElement("div");
    title.className = "source-text-title";
    title.textContent = "Текст к тесту";

    const sourceTextContent = document.createElement("div");
    sourceTextContent.className = "source-text-content";
    sourceTextContent.textContent = sourceText;

    card.appendChild(title);
    card.appendChild(sourceTextContent);
    return card;
}

async function deleteTestAsAdmin(test) {
    const currentUser = auth.currentUser;
    if (!isFullAdminUser(currentUser)) {
        showAdminError("Удаление доступно только администратору.");
        return;
    }

    const confirmed = await appConfirmDialog({
        title: "Удаление теста",
        message: `Удалить тест "${test.title || "Без названия"}" и все его результаты?`,
        confirmText: "Удалить",
        cancelText: "Отмена",
        variant: "danger"
    });
    if (!confirmed) {
        return;
    }

    try {
        const resultsSnap = await db.collection("results")
            .where("testId", "==", test.id)
            .get();

        let ownerResultsSnap = null;
        if (test.authorId) {
            ownerResultsSnap = await db
                .collection("users")
                .doc(test.authorId)
                .collection("testResults")
                .where("testId", "==", test.id)
                .get();
        }

        const batch = db.batch();
        batch.delete(db.collection("tests").doc(test.id));

        resultsSnap.forEach((resultDoc) => {
            batch.delete(resultDoc.ref);
        });

        if (ownerResultsSnap) {
            ownerResultsSnap.forEach((resultDoc) => {
                batch.delete(resultDoc.ref);
            });
        }

        await batch.commit();
        appShowToast("Тест удалён из админки.", "success");
        await loadAdminDashboard(currentUser);
    } catch (error) {
        console.error("Ошибка удаления теста админом:", error);
        appShowToast("Не удалось удалить тест. Проверь Firestore Rules для администратора.", "error");
    }
}

function renderTests(tests, adminRole) {
    const testsList = document.getElementById("testsList");
    testsList.innerHTML = "";

    if (tests.length === 0) {
        testsList.innerHTML = `<div class="empty-text">Тестов пока нет.</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    tests.forEach((test) => {
        const card = document.createElement("div");
        card.className = "test-card";

        const title = document.createElement("div");
        title.className = "test-title";
        title.textContent = test.title || "Без названия";

        const authorEmail = document.createElement("div");
        authorEmail.className = "meta-line";
        authorEmail.textContent = `Автор: ${test.authorEmail || "не указан"}`;

        const questionCount = document.createElement("div");
        questionCount.className = "meta-line";
        questionCount.textContent = `Вопросов: ${Array.isArray(test.questions) ? test.questions.length : 0}`;

        const createdAt = document.createElement("div");
        createdAt.className = "meta-line";
        createdAt.textContent = `Создан: ${formatTimestamp(test.createdAt)}`;

        const note = document.createElement("div");
        note.className = "soft-note";
        note.textContent = adminRole === "full"
            ? "Можно открыть вопросы, проверить ответы и при необходимости удалить тест."
            : "Можно только просматривать вопросы и правильные ответы.";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "toggle-btn";
        toggleBtn.textContent = "Открыть вопросы";

        const questionList = document.createElement("div");
        questionList.className = "question-list";
        questionList.style.display = "none";
        questionList.appendChild(createSourceTextCard(test));

        (test.questions || []).forEach((question, index) => {
            questionList.appendChild(createQuestionCard(question, index));
        });

        if (!Array.isArray(test.questions) || test.questions.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty-text";
            empty.textContent = "У этого теста нет вопросов.";
            questionList.appendChild(empty);
        }

        toggleBtn.addEventListener("click", () => {
            const isHidden = questionList.style.display === "none";
            questionList.style.display = isHidden ? "flex" : "none";
            toggleBtn.textContent = isHidden ? "Скрыть вопросы" : "Открыть вопросы";
        });

        card.appendChild(title);
        card.appendChild(authorEmail);

        if (adminRole === "full") {
            const authorId = document.createElement("div");
            authorId.className = "meta-line";
            authorId.textContent = `Author UID: ${test.authorId || "не указан"}`;

            const testId = document.createElement("div");
            testId.className = "meta-line";
            testId.textContent = `Test ID: ${test.id}`;

            card.appendChild(authorId);
            card.appendChild(testId);
        }

        card.appendChild(questionCount);
        card.appendChild(createdAt);
        card.appendChild(note);
        card.appendChild(toggleBtn);

        if (adminRole === "full") {
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "delete-btn";
            deleteBtn.textContent = "Удалить тест";
            deleteBtn.addEventListener("click", async () => {
                await deleteTestAsAdmin(test);
            });
            card.appendChild(deleteBtn);
        }

        card.appendChild(questionList);
        fragment.appendChild(card);
    });

    testsList.appendChild(fragment);
}

async function loadAdminDashboard(user = auth.currentUser) {
    if (!user) {
        throw new Error("Пользователь не найден.");
    }

    updateStatusLine("statusUid", `UID: ${user.uid}`);
    updateStatusLine(
        "statusRole",
        `Роль: ${
            getAdminRole(user) === "full"
                ? "полный администратор"
                : getAdminRole(user) === "viewer"
                    ? "админ просмотра"
                    : "нет доступа"
        }`
    );

    updateStatusLine("statusTests", "tests: запрос к серверу...");

    const testsResult = await Promise.resolve(getQuerySnapshotPreferServer(db.collection("tests")))
        .then((value) => ({ status: "fulfilled", value }))
        .catch((reason) => ({ status: "rejected", reason }));

    const tests = testsResult.status === "fulfilled"
        ? testsResult.value.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
                const bSeconds = b.createdAt?.seconds || 0;
                const aSeconds = a.createdAt?.seconds || 0;
                return bSeconds - aSeconds;
            })
        : [];

    const totalQuestions = tests.reduce((sum, test) => {
        return sum + (Array.isArray(test.questions) ? test.questions.length : 0);
    }, 0);

    updateStatusLine(
        "statusTests",
        testsResult.status === "fulfilled"
            ? `tests: успешно, документов ${tests.length}`
            : `tests: ошибка ${testsResult.reason?.code || "unknown"}`
    );

    document.getElementById("testsCount").textContent = String(tests.length);
    document.getElementById("questionsCount").textContent = String(totalQuestions);

    const warnings = [];

    if (testsResult.status === "rejected") {
        const code = testsResult.reason?.code || testsResult.reason?.message || "unknown";
        throw new Error(`Коллекция tests недоступна для админа: ${code}. Проверь, что актуальные Firestore Rules опубликованы именно в проекте kazakhquiz-32449.`);
    }

    if (warnings.length > 0) {
        showAdminWarning(`${warnings.join(". ")}. Обнови Firestore Rules для полного доступа администратора.`);
    } else if (tests.length === 0) {
        showAdminWarning("Админка читает тесты напрямую из Firestore коллекции tests. Если тут 0, проверь, что правила опубликованы, а затем обнови страницу без кеша.");
    }

    renderTests(tests, getAdminRole(user));
}

document.addEventListener("DOMContentLoaded", async () => {
    let user = null;

    try {
        user = await waitForAdminAuth();
    } catch (error) {
        console.error("Ошибка авторизации админки:", error);
        showAdminError(error.message || "Не удалось проверить вход в аккаунт.");
        return;
    }

    if (!user) {
        window.location.href = "/pages/login.html";
        return;
    }

    if (!isAdminUser(user)) {
        showAdminError("Доступ запрещён. Эта страница доступна только администратору.");
        return;
    }

    try {
        const adminRole = getAdminRole(user);
        const badge = document.getElementById("adminBadge");
        if (badge) {
            badge.textContent = adminRole === "full"
                ? "Полный администратор"
                : "Админ просмотра";
        }

        const heroText = document.getElementById("heroText");
        if (heroText) {
            heroText.textContent = adminRole === "full"
                ? "Здесь можно просматривать аккаунты, тесты и содержимое вопросов, а также выполнять административные действия."
                : "Здесь можно безопасно просматривать пользователей, тесты и правильные ответы без риска что-то удалить.";
        }

        await loadAdminDashboard(user);
        document.getElementById("loadingText").style.display = "none";
        document.getElementById("adminContent").style.display = "grid";
    } catch (error) {
        console.error("Ошибка загрузки админки:", error);
        showAdminError(error.message || "Не удалось загрузить админку.");
    }
});
