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
    const existingToasts = Array.from(document.querySelectorAll(".toast"));
    const hasDuplicateToast = existingToasts.some((toast) => toast.textContent === message);
    if (hasDuplicateToast) {
        return;
    }

    const container = ensureToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function createGoogleProvider() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
        prompt: "select_account"
    });
    return provider;
}

const GOOGLE_AUTH_PENDING_KEY = "kq_google_auth_pending";
const GOOGLE_AUTH_MODE_KEY = "kq_google_auth_mode";
let authPersistencePromise = null;

function ensureAuthPersistence() {
    if (!authPersistencePromise) {
        authPersistencePromise = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch((error) => {
                console.warn("Не удалось установить LOCAL persistence:", error);
            });
    }

    return authPersistencePromise;
}

function markGoogleAuthPending(mode) {
    sessionStorage.setItem(GOOGLE_AUTH_PENDING_KEY, "1");
    sessionStorage.setItem(GOOGLE_AUTH_MODE_KEY, mode);
}

function clearGoogleAuthPending() {
    sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY);
    sessionStorage.removeItem(GOOGLE_AUTH_MODE_KEY);
}

function isGoogleAuthPending() {
    return sessionStorage.getItem(GOOGLE_AUTH_PENDING_KEY) === "1";
}

function setGoogleButtonState(button, isLoading, label = "Войти через Google") {
    if (!button) {
        return;
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? "Входим..." : label;
}

function isTelegramInAppBrowser() {
    const userAgent = navigator.userAgent || "";
    return /Telegram|TelegramBot/i.test(userAgent);
}

function isRedirectPreferred() {
    const userAgent = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const isInAppBrowser = /FBAN|FBAV|Instagram|Line|wv|WebView/i.test(userAgent);

    return isMobile || isSafari || isInAppBrowser;
}

async function syncGoogleUser(user) {
    const defaultNickname =
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "") ||
        "Пользователь";

    await db.collection("users").doc(user.uid).set({
        email: user.email || "",
        name: user.displayName || "",
        nickname: defaultNickname,
        photoURL: user.photoURL || "",
        uid: user.uid,
        provider: "google",
        emailVerified: Boolean(user.emailVerified),
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

function redirectToHome() {
    window.location.replace("/pages/home.html");
}

async function handleGoogleResult(result) {
    if (!result || !result.user) {
        return false;
    }

    await syncGoogleUser(result.user);
    clearGoogleAuthPending();
    redirectToHome();
    return true;
}

function getGoogleErrorMessage(error) {
    if (error.code === "auth/popup-blocked") {
        return "Браузер заблокировал окно входа. Переключаемся на безопасный редирект.";
    }
    if (error.code === "auth/popup-closed-by-user") {
        return "Окно входа было закрыто.";
    }
    if (error.code === "auth/operation-not-allowed") {
        return "Google-вход отключён в Firebase.";
    }
    if (error.code === "auth/unauthorized-domain") {
        return "Этот домен не разрешён в Firebase.";
    }
    if (error.code === "auth/account-exists-with-different-credential") {
        return "Этот email уже используется с другим способом входа.";
    }
    if (error.code === "auth/operation-not-supported-in-this-environment") {
        return "Этот браузер не поддерживает Google-вход. Открой сайт в Safari или Chrome.";
    }
    if (error.code === "auth/network-request-failed") {
        return "Не удалось подключиться к Google. Проверь интернет и попробуй ещё раз.";
    }
    return "Ошибка входа через Google.";
}

async function signInWithGoogle() {
    const provider = createGoogleProvider();
    await ensureAuthPersistence();

    if (isTelegramInAppBrowser()) {
        clearGoogleAuthPending();
        showToast("Встроенный браузер Telegram мешает Google-входу. Открой сайт в Safari или Chrome.", "error");
        return false;
    }

    if (isRedirectPreferred()) {
        try {
            markGoogleAuthPending("redirect");
            await auth.signInWithRedirect(provider);
            return true;
        } catch (error) {
            console.error("Ошибка запуска Google redirect:", error);
            clearGoogleAuthPending();
            showToast(getGoogleErrorMessage(error), "error");
            return false;
        }
    }

    try {
        markGoogleAuthPending("popup");
        const result = await auth.signInWithPopup(provider);
        await handleGoogleResult(result);
        return true;
    } catch (error) {
        console.error("Ошибка Google входа:", error);

        if (
            error.code === "auth/popup-blocked" ||
            error.code === "auth/cancelled-popup-request" ||
            error.code === "auth/web-storage-unsupported"
        ) {
            showToast("Пробуем более стабильный вход через редирект...", "info");

            try {
                markGoogleAuthPending("redirect");
                await auth.signInWithRedirect(provider);
                return true;
            } catch (redirectError) {
                console.error("Ошибка fallback Google redirect:", redirectError);
                clearGoogleAuthPending();
                showToast(getGoogleErrorMessage(redirectError), "error");
                return false;
            }
        }

        clearGoogleAuthPending();
        showToast(getGoogleErrorMessage(error), "error");
        return false;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const googleBtn = document.getElementById("googleLoginBtn");
    const defaultLabel = googleBtn?.textContent?.trim() || "Войти через Google";

    await ensureAuthPersistence();

    try {
        const redirectResult = await auth.getRedirectResult();
        const handled = await handleGoogleResult(redirectResult);
        if (handled) {
            return;
        }
    } catch (error) {
        console.error("Ошибка обработки Google redirect:", error);
        clearGoogleAuthPending();
        showToast(getGoogleErrorMessage(error), "error");
    }

    auth.onAuthStateChanged(async (user) => {
        if (!user || !isGoogleAuthPending()) {
            return;
        }

        try {
            await syncGoogleUser(user);
            clearGoogleAuthPending();
            redirectToHome();
        } catch (error) {
            console.error("Ошибка завершения Google-входа через onAuthStateChanged:", error);
            clearGoogleAuthPending();
            showToast("Не удалось завершить вход через Google.", "error");
        }
    });

    if (!googleBtn) {
        return;
    }

    googleBtn.addEventListener("click", async () => {
        setGoogleButtonState(googleBtn, true, defaultLabel);

        try {
            const started = await signInWithGoogle();
            if (!started) {
                setGoogleButtonState(googleBtn, false, defaultLabel);
            }
        } catch (error) {
            console.error("Неожиданная ошибка запуска Google-входа:", error);
            clearGoogleAuthPending();
            showToast("Не удалось начать вход через Google.", "error");
            setGoogleButtonState(googleBtn, false, defaultLabel);
            return;
        }

        if (!isGoogleAuthPending()) {
            setGoogleButtonState(googleBtn, false, defaultLabel);
        }
    });
});
