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
    const regForm = document.getElementById("registrationForm");
    const dobInput = document.getElementById("dob");
    const isRegistrationPage =
        window.location.pathname === "/" ||
        window.location.pathname.endsWith("/index.html");
    const MAX_DOB = "2026-12-31";

    if (dobInput) {
        dobInput.max = MAX_DOB;
        dobInput.addEventListener("input", () => {
            if (dobInput.value && dobInput.value > MAX_DOB) {
                dobInput.value = MAX_DOB;
            }
        });
    }

    if (auth) {
        auth.onAuthStateChanged((user) => {
            if (user && isRegistrationPage && !requiresEmailVerification(user)) {
                window.location.href = "/pages/home.html";
            }
        });
    }

    if (regForm) {
        regForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("login").value.trim();
            const password = document.getElementById("password").value;
            const dob = document.getElementById("dob").value;

            if (!email || !password || !dob) {
                showToast("Заполни все поля", "error");
                return;
            }

            if (dob > MAX_DOB) {
                showToast("Дата рождения не может быть позже 2026 года.", "error");
                if (dobInput) {
                    dobInput.value = MAX_DOB;
                }
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                const defaultNickname = email.split("@")[0] || "Пользователь";

                await user.sendEmailVerification();

                await db.collection("users").doc(user.uid).set({
                    email: email,
                    nickname: defaultNickname,
                    dob: dob,
                    provider: "email",
                    uid: user.uid,
                    emailVerified: false,
                    lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await auth.signOut();
                showToast("Мы отправили письмо для подтверждения почты. Подтверди email и потом войди.", "success");

                setTimeout(() => {
                    window.location.href = "/pages/login.html";
                }, 1400);
            } catch (error) {
                console.error("Ошибка регистрации:", error);

                let message = "Не удалось зарегистрироваться";

                if (error.code === "auth/email-already-in-use") {
                    message = "Этот email уже зарегистрирован";
                } else if (error.code === "auth/invalid-email") {
                    message = "Неверный формат email";
                } else if (error.code === "auth/weak-password") {
                    message = "Пароль слишком слабый";
                } else if (error.code === "auth/too-many-requests") {
                    message = "Слишком много попыток. Попробуйте чуть позже.";
                }

                showToast(message, "error");
            }
        });
    }
});
