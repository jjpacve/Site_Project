(function () {
    let isCleaningHistory = false;
    let isUpdatingEditor = false;

    function isDraftText(value) {
        return String(value || "").toLowerCase().includes("черновик");
    }

    function stripDraftCodeFromSubtitle(subtitle) {
        if (!subtitle || !isDraftText(subtitle.textContent)) {
            return;
        }

        subtitle.textContent = subtitle.textContent.replace(/\s*•\s*Код:\s*[A-Z0-9]+/gi, "");
    }

    function cleanupDraftRows() {
        if (isCleaningHistory) {
            return;
        }

        const historyBox = document.getElementById("historyBox");
        if (!historyBox) {
            return;
        }

        isCleaningHistory = true;

        try {
            const rows = historyBox.querySelectorAll(".test-row");
            rows.forEach((row) => {
                const subtitle = row.querySelector(".test-row-subtitle");
                if (!subtitle || !isDraftText(subtitle.textContent)) {
                    return;
                }

                const nextSubtitleText = subtitle.textContent.replace(/\s*•\s*Код:\s*[A-Z0-9]+/gi, "");
                if (subtitle.textContent !== nextSubtitleText) {
                    subtitle.textContent = nextSubtitleText;
                }

                row.querySelectorAll("button").forEach((button) => {
                    if (button.textContent.trim() === "Скопировать ссылку") {
                        button.remove();
                    }
                });
            });
        } finally {
            isCleaningHistory = false;
        }
    }

    async function clearDraftAccessCodeFromEditor() {
        const currentStatusChip = document.getElementById("currentStatusChip");
        const accessCodeInput = document.getElementById("accessCode");
        const editTestId = new URLSearchParams(window.location.search).get("edit");

        if (!currentStatusChip || !accessCodeInput || !editTestId || !isDraftText(currentStatusChip.textContent)) {
            return;
        }

        if (!accessCodeInput.value.trim() || typeof db === "undefined" || typeof firebase === "undefined") {
            accessCodeInput.value = "";
            return;
        }

        accessCodeInput.value = "";

        try {
            await db.collection("tests").doc(editTestId).update({
                accessCode: "",
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (_) {
            // Ignore background cleanup failures.
        }
    }

    function enforceDraftEditorState() {
        if (isUpdatingEditor) {
            return;
        }

        const currentStatusChip = document.getElementById("currentStatusChip");
        const linkBox = document.getElementById("linkBox");
        const testLink = document.getElementById("testLink");
        const testCodeBox = document.getElementById("testCodeBox");
        const copyLinkBtn = document.getElementById("copyLinkBtn");
        const accessCodeInput = document.getElementById("accessCode");

        if (!currentStatusChip || !linkBox || !testLink || !testCodeBox || !copyLinkBtn) {
            return;
        }

        isUpdatingEditor = true;

        if (!isDraftText(currentStatusChip.textContent)) {
            copyLinkBtn.style.display = "inline-flex";
            isUpdatingEditor = false;
            return;
        }

        linkBox.style.display = "block";
        if (testLink.textContent !== "Ссылка появится после публикации теста.") {
            testLink.textContent = "Ссылка появится после публикации теста.";
        }
        if (testCodeBox.textContent !== "Код для входа появится после публикации теста.") {
            testCodeBox.textContent = "Код для входа появится после публикации теста.";
        }
        copyLinkBtn.dataset.link = "";
        copyLinkBtn.style.display = "none";
        if (accessCodeInput) {
            accessCodeInput.value = "";
        }

        clearDraftAccessCodeFromEditor();
        isUpdatingEditor = false;
    }

    document.addEventListener("DOMContentLoaded", () => {
        cleanupDraftRows();
        enforceDraftEditorState();

        const historyBox = document.getElementById("historyBox");
        if (historyBox) {
            const historyObserver = new MutationObserver(() => {
                cleanupDraftRows();
            });
            historyObserver.observe(historyBox, { childList: true, subtree: true });
        }

        const currentStatusChip = document.getElementById("currentStatusChip");
        if (currentStatusChip) {
            const editorObserver = new MutationObserver(() => {
                enforceDraftEditorState();
            });

            if (currentStatusChip) {
                editorObserver.observe(currentStatusChip, { childList: true, subtree: true, characterData: true });
            }
        }
    });
})();
