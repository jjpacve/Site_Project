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

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");

    if (auth) {
        auth.onAuthStateChanged((user) => {
            if (user && window.location.pathname.includes("/pages/login.html") && !requiresEmailVerification(user)) {
                window.location.href = "/pages/home.html";
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("login").value.trim();
            const password = document.getElementById("password").value;

            if (!email || !password) {
                showToast("Заполни email и пароль", "error");
                return;
            }

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                if (requiresEmailVerification(user)) {
                    try {
                        await user.sendEmailVerification();
                    } catch (verificationError) {
                        console.warn("Не удалось повторно отправить письмо подтверждения:", verificationError);
                    }

                    await auth.signOut();
                    showToast("Почта ещё не подтверждена. Мы отправили письмо ещё раз.", "error");
                    return;
                }

                if (user) {
                    await db.collection("users").doc(user.uid).set({
                        email: user.email || email,
                        provider: "email",
                        emailVerified: Boolean(user.emailVerified),
                        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }

                showToast("Вход выполнен!", "success");

                setTimeout(() => {
                    window.location.href = "/pages/home.html";
                }, 900);
            } catch (error) {
                console.error("Ошибка входа:", error);

                let message = "Не удалось войти";

                if (error.code === "auth/user-not-found") {
                    message = "Пользователь не найден";
                } else if (error.code === "auth/wrong-password") {
                    message = "Неверный пароль";
                } else if (error.code === "auth/invalid-email") {
                    message = "Неверный формат email";
                } else if (error.code === "auth/invalid-credential") {
                    message = "Неверный email или пароль";
                }

                showToast(message, "error");
            }
        });
    }
});
