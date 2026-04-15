(function () {
    const THEME_STORAGE_KEY = "kazakhQuizTheme";
    const LIGHT_THEME = "light";
    const DARK_THEME = "dark";
    const root = document.documentElement;

    function getStoredTheme() {
        try {
            const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
            return savedTheme === LIGHT_THEME ? LIGHT_THEME : DARK_THEME;
        } catch (_) {
            return DARK_THEME;
        }
    }

    function injectThemeStyles() {
        const existingStyles = document.getElementById("themeStyles");
        if (existingStyles) {
            document.head.appendChild(existingStyles);
            return;
        }

        const style = document.createElement("style");
        style.id = "themeStyles";
        style.textContent = `
            html[data-theme="dark"] {
                color-scheme: dark;
            }

            html[data-theme="light"] {
                color-scheme: light;
            }

            .theme-toggle-btn {
                position: fixed;
                right: 18px;
                bottom: 18px;
                z-index: 100000;
                border: none;
                border-radius: 999px;
                padding: 12px 16px;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                color: #f8fafc;
                background: rgba(15, 23, 42, 0.88);
                box-shadow: 0 14px 30px rgba(0,0,0,0.28);
            }

            .theme-toggle-btn:hover {
                transform: translateY(-1px);
            }

            html[data-theme="light"],
            html[data-theme="light"] body {
                background:
                    radial-gradient(circle at 12% 8%, rgba(180, 116, 54, 0.16), transparent 30%),
                    radial-gradient(circle at 88% 18%, rgba(223, 181, 109, 0.20), transparent 28%),
                    linear-gradient(180deg, #fbf3e4 0%, #fffaf1 48%, #f4e7d4 100%) !important;
                color: #2f251b !important;
            }

            html[data-theme="light"] body,
            html[data-theme="light"] .container,
            html[data-theme="light"] .form-container,
            html[data-theme="light"] .content-area,
            html[data-theme="light"] .create-container,
            html[data-theme="light"] .results-container,
            html[data-theme="light"] .play-container,
            html[data-theme="light"] .admin-shell {
                color: #2f251b !important;
            }

            html[data-theme="light"] .container,
            html[data-theme="light"] .form-container,
            html[data-theme="light"] .content-area,
            html[data-theme="light"] .create-container,
            html[data-theme="light"] .results-container,
            html[data-theme="light"] .play-container {
                background:
                    radial-gradient(circle at top left, rgba(180, 116, 54, 0.14), transparent 28%),
                    radial-gradient(circle at bottom right, rgba(232, 197, 137, 0.28), transparent 30%),
                    linear-gradient(180deg, #fbf3e4 0%, #fff9ef 55%, #f3e5cf 100%) !important;
            }

            html[data-theme="light"] .main-wrapper,
            html[data-theme="light"] .content-area,
            html[data-theme="light"] .container,
            html[data-theme="light"] .form-container {
                background:
                    radial-gradient(circle at 16% 14%, rgba(180, 116, 54, 0.13), transparent 26%),
                    linear-gradient(180deg, #fbf3e4 0%, #fff8ed 100%) !important;
            }

            html[data-theme="light"] .profile-card,
            html[data-theme="light"] .profile-header,
            html[data-theme="light"] .profile-body {
                background: linear-gradient(180deg, #fff8ec 0%, #f8ead6 100%) !important;
            }

            html[data-theme="light"] .admin-shell {
                background:
                    radial-gradient(circle at top left, rgba(180, 116, 54, 0.20), transparent 30%),
                    radial-gradient(circle at top right, rgba(245, 197, 106, 0.18), transparent 26%),
                    linear-gradient(180deg, #fbf3e4 0%, #f4e5cf 100%) !important;
            }

            html[data-theme="light"] .side-menu,
            html[data-theme="light"] .sidebar {
                background: linear-gradient(180deg, #efe0c7 0%, #d8bd94 100%) !important;
                box-shadow: 16px 0 38px rgba(116, 76, 34, 0.14);
            }

            html[data-theme="light"] .side-menu a {
                background: rgba(255, 248, 236, 0.54) !important;
                color: #4b2e15 !important;
            }

            html[data-theme="light"] .side-menu a,
            html[data-theme="light"] label,
            html[data-theme="light"] .back-link,
            html[data-theme="light"] .social-login p,
            html[data-theme="light"] .social-login a,
            html[data-theme="light"] .info-label,
            html[data-theme="light"] .question-mode-label,
            html[data-theme="light"] .question-subhint,
            html[data-theme="light"] .question-type-hint,
            html[data-theme="light"] .student-meta,
            html[data-theme="light"] .meta-line,
            html[data-theme="light"] .soft-note,
            html[data-theme="light"] .section-subtitle,
            html[data-theme="light"] .hero-text,
            html[data-theme="light"] .helper-text,
            html[data-theme="light"] .summary-label,
            html[data-theme="light"] .status-line,
            html[data-theme="light"] #modeHint,
            html[data-theme="light"] .hint-text {
                color: #6f5b43 !important;
            }

            html[data-theme="light"] .title-box,
            html[data-theme="light"] .profile-header,
            html[data-theme="light"] .logout-btn,
            html[data-theme="light"] .admin-badge,
            html[data-theme="light"] .profile-card {
                background: linear-gradient(180deg, #fff8ec 0%, #f3dfc1 100%) !important;
                color: #2f251b !important;
                border-color: rgba(160, 116, 63, 0.30) !important;
            }

            html[data-theme="light"] .title-box,
            html[data-theme="light"] .logout-btn,
            html[data-theme="light"] .admin-badge,
            html[data-theme="light"] .action-btn,
            html[data-theme="light"] .google-btn {
                box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08) !important;
            }

            html[data-theme="light"] .glass-box {
                background: rgba(255, 248, 236, 0.94) !important;
                border-color: rgba(160, 116, 63, 0.28) !important;
                color: #2f251b !important;
                box-shadow: 0 18px 40px rgba(116, 76, 34, 0.12) !important;
                backdrop-filter: none !important;
            }

            html[data-theme="light"] .hero-card,
            html[data-theme="light"] .section-card,
            html[data-theme="light"] .test-card,
            html[data-theme="light"] .user-card,
            html[data-theme="light"] .helper-card,
            html[data-theme="light"] .summary-card,
            html[data-theme="light"] .status-panel,
            html[data-theme="light"] .history-box,
            html[data-theme="light"] .question-card,
            html[data-theme="light"] .result-card,
            html[data-theme="light"] .summary-card,
            html[data-theme="light"] .intro-box,
            html[data-theme="light"] .student-box,
            html[data-theme="light"] .result-box,
            html[data-theme="light"] .timer-box,
            html[data-theme="light"] .profile-card,
            html[data-theme="light"] .choice-section,
            html[data-theme="light"] .open-section,
            html[data-theme="light"] .link-box,
            html[data-theme="light"] .setting-card,
            html[data-theme="light"] .manual-review-box,
            html[data-theme="light"] .status-chip,
            html[data-theme="light"] .detail-card,
            html[data-theme="light"] .review-item,
            html[data-theme="light"] .admin-mode-box,
            html[data-theme="light"] .retake-request-box,
            html[data-theme="light"] .control-warning-card {
                background:
                    linear-gradient(180deg, rgba(255, 250, 241, 0.96) 0%, rgba(248, 234, 214, 0.94) 100%) !important;
                color: #2f251b !important;
                border: 1px solid rgba(160, 116, 63, 0.24) !important;
                box-shadow: 0 18px 40px rgba(116, 76, 34, 0.12) !important;
            }

            html[data-theme="light"] .test-row,
            html[data-theme="light"] .test-row-title,
            html[data-theme="light"] .student-name,
            html[data-theme="light"] .test-title,
            html[data-theme="light"] .question-title,
            html[data-theme="light"] .hero-title,
            html[data-theme="light"] .section-title,
            html[data-theme="light"] .user-email,
            html[data-theme="light"] .test-title,
            html[data-theme="light"] .summary-value,
            html[data-theme="light"] .status-title,
            html[data-theme="light"] .helper-title,
            html[data-theme="light"] .user-name-label,
            html[data-theme="light"] .user-login-label,
            html[data-theme="light"] .test-meta,
            html[data-theme="light"] .result-title,
            html[data-theme="light"] .result-score,
            html[data-theme="light"] .result-percent,
            html[data-theme="light"] .summary-count,
            html[data-theme="light"] .detail-question,
            html[data-theme="light"] .review-question,
            html[data-theme="light"] .option-label,
            html[data-theme="light"] .checkbox-title,
            html[data-theme="light"] .control-warning-title {
                color: #2f251b !important;
            }

            html[data-theme="light"] .test-row-subtitle,
            html[data-theme="light"] .detail-meta,
            html[data-theme="light"] .review-meta,
            html[data-theme="light"] .timer-label,
            html[data-theme="light"] .result-note,
            html[data-theme="light"] .retake-request-text,
            html[data-theme="light"] .admin-mode-hint,
            html[data-theme="light"] .control-warning-text {
                color: #7a664d !important;
            }

            html[data-theme="light"] .history-section > div,
            html[data-theme="light"] .loading-text,
            html[data-theme="light"] .empty-text {
                color: #2f251b !important;
            }

            html[data-theme="light"] .history-box {
                background: linear-gradient(180deg, #fff8ec 0%, #f6e7cf 100%) !important;
            }

            html[data-theme="light"] .content-area .history-section > div {
                color: #2f251b !important;
            }

            html[data-theme="light"] input,
            html[data-theme="light"] textarea,
            html[data-theme="light"] .info-value,
            html[data-theme="light"] .option-text,
            html[data-theme="light"] .open-answer-text,
            html[data-theme="light"] .open-answer-input {
                background: linear-gradient(180deg, #fffaf1 0%, #f7ead7 100%) !important;
                color: #2f251b !important;
                border: 1px solid rgba(160, 116, 63, 0.34) !important;
                box-shadow: inset 0 2px 8px rgba(116, 76, 34, 0.08) !important;
            }

            html[data-theme="light"] input::placeholder,
            html[data-theme="light"] textarea::placeholder {
                color: #9a8467 !important;
            }

            html[data-theme="light"] .option-row,
            html[data-theme="light"] .option-item,
            html[data-theme="light"] .open-answer-wrap {
                background: rgba(255, 248, 236, 0.86) !important;
                color: #2f251b !important;
                border: 1px solid rgba(160, 116, 63, 0.18) !important;
            }

            html[data-theme="light"] .option-item.correct,
            html[data-theme="light"] .score-badge,
            html[data-theme="light"] .review-item.correct,
            html[data-theme="light"] .detail-card.correct {
                background: rgba(34, 197, 94, 0.12) !important;
                color: #166534 !important;
                border: 1px solid rgba(34, 197, 94, 0.26) !important;
            }

            html[data-theme="light"] .review-item.wrong,
            html[data-theme="light"] .detail-card.wrong {
                background: rgba(239, 68, 68, 0.10) !important;
                color: #7f1d1d !important;
                border: 1px solid rgba(239, 68, 68, 0.22) !important;
            }

            html[data-theme="light"] .review-item.pending,
            html[data-theme="light"] .detail-card.pending,
            html[data-theme="light"] .pending-badge,
            html[data-theme="light"] .retake-status {
                background: rgba(245, 158, 11, 0.12) !important;
                color: #78350f !important;
                border: 1px solid rgba(245, 158, 11, 0.24) !important;
            }

            html[data-theme="light"] .avatar-circle,
            html[data-theme="light"] .avatar {
                background: linear-gradient(135deg, #f8dfb9, #d89b56) !important;
                border-color: rgba(160, 116, 63, 0.34) !important;
                color: #7b3e19 !important;
            }

            html[data-theme="light"] .logo-pin {
                background: linear-gradient(180deg, #d89b56, #8b4a22) !important;
            }

            html[data-theme="light"] .logo-circle {
                background: #fff8ec !important;
                color: #7b3e19 !important;
            }

            html[data-theme="light"] .google-btn {
                background: linear-gradient(180deg, #fffaf1 0%, #f6e6cd 100%) !important;
                color: #2f251b !important;
                border-color: rgba(160, 116, 63, 0.44) !important;
            }

            html[data-theme="light"] .submit-btn {
                box-shadow: 0 16px 28px rgba(123, 62, 25, 0.16);
            }

            html[data-theme="light"] .action-btn {
                background: linear-gradient(180deg, #fff9ef 0%, #ead2ad 100%) !important;
                color: #2f251b !important;
                border: 1px solid rgba(160, 116, 63, 0.26) !important;
            }

            html[data-theme="light"] .row-btn.copy-btn,
            html[data-theme="light"] .copy-btn {
                background: #9a5a2a !important;
                color: #fffaf1 !important;
            }

            html[data-theme="light"] .row-btn.edit-btn,
            html[data-theme="light"] .add-open-answer-btn,
            html[data-theme="light"] .lock-open-answer-btn {
                background: #0f766e !important;
                color: #ffffff !important;
            }

            html[data-theme="light"] .row-btn.results-btn,
            html[data-theme="light"] .add-option-btn,
            html[data-theme="light"] .toggle-details-btn,
            html[data-theme="light"] .results-tab,
            html[data-theme="light"] .control-settings-toggle,
            html[data-theme="light"] .answer-toggle-btn {
                background: #2563eb !important;
                color: #ffffff !important;
            }

            html[data-theme="light"] .results-tab.active {
                background: #1d4ed8 !important;
                color: #ffffff !important;
            }

            html[data-theme="light"] .row-btn.access-btn {
                background: #7c3aed !important;
                color: #ffffff !important;
            }

            html[data-theme="light"] .row-btn.publish-btn,
            html[data-theme="light"] .save-btn,
            html[data-theme="light"] .review-btn.approve {
                background: #15803d !important;
                color: #ffffff !important;
            }

            html[data-theme="light"] .row-btn.delete-btn,
            html[data-theme="light"] .option-remove-btn,
            html[data-theme="light"] .review-btn.reject,
            html[data-theme="light"] .delete-btn {
                background: #b91c1c !important;
                color: #ffffff !important;
            }

            html[data-theme="light"] .secondary-save-btn {
                background: #8a6a45 !important;
                color: #fffaf1 !important;
            }

            html[data-theme="light"] .start-btn {
                background: #16a34a !important;
                color: #ffffff !important;
                border-color: rgba(22, 163, 74, 0.2) !important;
            }

            html[data-theme="light"] .logout-btn {
                background: linear-gradient(180deg, #fff9ef 0%, #ead2ad 100%) !important;
            }

            html[data-theme="light"] .theme-toggle-btn {
                background: rgba(75, 46, 21, 0.92);
                color: #fff8ec;
                border: 1px solid rgba(255, 248, 236, 0.28);
            }

            html[data-theme="light"] *,
            html[data-theme="light"] *::before,
            html[data-theme="light"] *::after {
                -webkit-backdrop-filter: none !important;
                backdrop-filter: none !important;
                text-shadow: none !important;
            }

            html[data-theme="light"] body {
                isolation: isolate;
            }

            html[data-theme="light"],
            html[data-theme="light"] body,
            html[data-theme="light"] .main-wrapper,
            html[data-theme="light"] .content-area,
            html[data-theme="light"] .container,
            html[data-theme="light"] .form-container,
            html[data-theme="light"] .create-container,
            html[data-theme="light"] .results-container,
            html[data-theme="light"] .play-container,
            html[data-theme="light"] .admin-shell {
                background-image: none !important;
                background-color: #f6ead8 !important;
            }

            html[data-theme="light"] .title-box,
            html[data-theme="light"] .profile-header,
            html[data-theme="light"] .logout-btn,
            html[data-theme="light"] .admin-badge,
            html[data-theme="light"] .profile-card,
            html[data-theme="light"] .hero-card,
            html[data-theme="light"] .section-card,
            html[data-theme="light"] .test-card,
            html[data-theme="light"] .helper-card,
            html[data-theme="light"] .summary-card,
            html[data-theme="light"] .status-panel,
            html[data-theme="light"] .history-box,
            html[data-theme="light"] .question-card,
            html[data-theme="light"] .result-card,
            html[data-theme="light"] .intro-box,
            html[data-theme="light"] .student-box,
            html[data-theme="light"] .result-box,
            html[data-theme="light"] .timer-box,
            html[data-theme="light"] .choice-section,
            html[data-theme="light"] .open-section,
            html[data-theme="light"] .link-box,
            html[data-theme="light"] .setting-card,
            html[data-theme="light"] .detail-card,
            html[data-theme="light"] .review-item,
            html[data-theme="light"] .admin-mode-box,
            html[data-theme="light"] .retake-request-box,
            html[data-theme="light"] .control-warning-card,
            html[data-theme="light"] .glass-box {
                background-image: none !important;
                background-color: #fff8ea !important;
                box-shadow: 0 10px 24px rgba(90, 57, 26, 0.10) !important;
            }

            html[data-theme="light"] .side-menu,
            html[data-theme="light"] .sidebar {
                background-image: none !important;
                background-color: #ead8bd !important;
            }

            html[data-theme="light"] input,
            html[data-theme="light"] textarea,
            html[data-theme="light"] .info-value,
            html[data-theme="light"] .option-text,
            html[data-theme="light"] .open-answer-text,
            html[data-theme="light"] .open-answer-input,
            html[data-theme="light"] .google-btn,
            html[data-theme="light"] .action-btn:not(.start-btn),
            html[data-theme="light"] .logout-btn {
                background-image: none !important;
                background-color: #fff2dd !important;
            }

            @media (max-width: 720px) {
                .theme-toggle-btn {
                    right: 12px;
                    bottom: 12px;
                    padding: 11px 14px;
                    font-size: 13px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function updateToggleLabel() {
        const button = document.getElementById("themeToggleBtn");
        if (!button) {
            return;
        }

        const currentTheme = root.getAttribute("data-theme") || DARK_THEME;
        button.textContent = currentTheme === LIGHT_THEME ? "Тёмная тема" : "Светлая тема";
    }

    function applyTheme(theme) {
        const normalizedTheme = theme === LIGHT_THEME ? LIGHT_THEME : DARK_THEME;
        root.setAttribute("data-theme", normalizedTheme);

        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
        } catch (_) {
            // ignore
        }

        updateToggleLabel();
    }

    function ensureToggleButton() {
        if (document.getElementById("themeToggleBtn")) {
            updateToggleLabel();
            return;
        }

        const button = document.createElement("button");
        button.id = "themeToggleBtn";
        button.type = "button";
        button.className = "theme-toggle-btn";
        button.addEventListener("click", () => {
            const currentTheme = root.getAttribute("data-theme") || DARK_THEME;
            applyTheme(currentTheme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME);
        });

        document.body.appendChild(button);
        updateToggleLabel();
    }

    injectThemeStyles();
    root.setAttribute("data-theme", getStoredTheme());

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            injectThemeStyles();
            ensureToggleButton();
        });
    } else {
        injectThemeStyles();
        ensureToggleButton();
    }
})();
