function ensureAppUiStyles() {
    if (document.getElementById("appUiStyles")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "appUiStyles";
    style.textContent = `
        .app-toast-container {
            position: fixed;
            top: 25px;
            right: 25px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 99999;
        }

        .app-toast {
            min-width: 280px;
            max-width: 420px;
            padding: 16px 18px;
            border-radius: 16px;
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            opacity: 0;
            transform: translateX(30px);
            transition: all 0.3s ease;
        }

        .app-toast.show {
            opacity: 1;
            transform: translateX(0);
        }

        .app-toast.success {
            background: linear-gradient(135deg, #2e7d32, #43a047);
        }

        .app-toast.error {
            background: linear-gradient(135deg, #c62828, #e53935);
        }

        .app-toast.info {
            background: linear-gradient(135deg, #1565c0, #1e88e5);
        }

        .app-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 100000;
        }

        .app-modal {
            width: min(460px, 100%);
            background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 24px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
            padding: 24px;
            color: #f8fafc;
        }

        .app-modal-title {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 12px;
        }

        .app-modal-message {
            color: #cbd5e1;
            line-height: 1.6;
            margin-bottom: 20px;
            white-space: pre-line;
        }

        .app-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            flex-wrap: wrap;
        }

        .app-modal-btn {
            border: none;
            border-radius: 12px;
            padding: 11px 16px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
        }

        .app-modal-btn.cancel {
            background: #334155;
            color: #f8fafc;
        }

        .app-modal-btn.confirm {
            background: #2563eb;
            color: #fff;
        }

        .app-modal-btn.danger {
            background: #b91c1c;
            color: #fff;
        }

        @media (max-width: 640px) {
            .app-toast-container {
                top: 15px;
                right: 15px;
                left: 15px;
            }

            .app-toast {
                min-width: unset;
                max-width: unset;
                width: 100%;
            }

            .app-modal-actions {
                flex-direction: column-reverse;
            }

            .app-modal-btn {
                width: 100%;
            }
        }
    `;

    document.head.appendChild(style);
}

function ensureAppToastContainer() {
    ensureAppUiStyles();

    let container = document.getElementById("appToastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "appToastContainer";
        container.className = "app-toast-container";
        document.body.appendChild(container);
    }

    return container;
}

window.appShowToast = function appShowToast(message, type = "info") {
    const container = ensureAppToastContainer();
    const toast = document.createElement("div");
    toast.className = `app-toast ${type}`;
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
};

window.appConfirmDialog = function appConfirmDialog({
    title = "Подтверждение",
    message = "",
    confirmText = "Подтвердить",
    cancelText = "Отмена",
    variant = "default"
} = {}) {
    ensureAppUiStyles();

    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "app-modal-overlay";

        const modal = document.createElement("div");
        modal.className = "app-modal";

        const titleEl = document.createElement("div");
        titleEl.className = "app-modal-title";
        titleEl.textContent = title;

        const messageEl = document.createElement("div");
        messageEl.className = "app-modal-message";
        messageEl.textContent = message;

        const actions = document.createElement("div");
        actions.className = "app-modal-actions";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "app-modal-btn cancel";
        cancelBtn.textContent = cancelText;

        const confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = `app-modal-btn ${variant === "danger" ? "danger" : "confirm"}`;
        confirmBtn.textContent = confirmText;

        const close = (value) => {
            overlay.remove();
            resolve(value);
        };

        cancelBtn.addEventListener("click", () => close(false));
        confirmBtn.addEventListener("click", () => close(true));

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                close(false);
            }
        });

        window.addEventListener("keydown", function onKeyDown(event) {
            if (!document.body.contains(overlay)) {
                window.removeEventListener("keydown", onKeyDown);
                return;
            }

            if (event.key === "Escape") {
                window.removeEventListener("keydown", onKeyDown);
                close(false);
            }
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        modal.appendChild(titleEl);
        modal.appendChild(messageEl);
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
};
