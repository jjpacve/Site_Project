const TEST_SECURITY_STORAGE_KEY = "kazakhQuizAttemptDeviceId";

const DEFAULT_CONTROL_MODE = Object.freeze({
    preventCopy: false,
    hideOnBlur: false,
    autoSubmitAfterWarnings: 3,
    requireRetakeApproval: false,
    showWatermark: false
});

const RETAKE_STATUSES = Object.freeze({
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    USED: "used"
});

function normalizeStudentNameForAttempt(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getControlMode(testData = {}) {
    const rawMode = testData && typeof testData.controlMode === "object"
        ? testData.controlMode
        : {};
    const warningLimit = Number.parseInt(rawMode.autoSubmitAfterWarnings, 10);

    return {
        preventCopy: Boolean(rawMode.preventCopy),
        hideOnBlur: Boolean(rawMode.hideOnBlur),
        autoSubmitAfterWarnings: Number.isInteger(warningLimit) && warningLimit > 0
            ? warningLimit
            : DEFAULT_CONTROL_MODE.autoSubmitAfterWarnings,
        requireRetakeApproval: Boolean(rawMode.requireRetakeApproval),
        showWatermark: Boolean(rawMode.showWatermark)
    };
}

function createLocalDeviceId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `device_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateAttemptDeviceId() {
    try {
        const existing = localStorage.getItem(TEST_SECURITY_STORAGE_KEY);
        if (existing) {
            return existing;
        }

        const nextId = createLocalDeviceId();
        localStorage.setItem(TEST_SECURITY_STORAGE_KEY, nextId);
        return nextId;
    } catch (error) {
        console.warn("localStorage недоступен, используем временный device id.", error);
        return createLocalDeviceId();
    }
}

function canBypassStudentControlMode(user, testData, adminGhostModeEnabled = true) {
    if (!user || !testData) {
        return false;
    }

    if (testData.authorId && testData.authorId === user.uid) {
        return true;
    }

    return typeof isAdminUser === "function" && isAdminUser(user) && adminGhostModeEnabled;
}
