# Quiz Security Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add responsive mobile fixes, per-test control mode, and teacher-approved repeat attempts while keeping guest test taking and Firebase built-in emails.

**Architecture:** Add a small shared browser helper for control-mode defaults and guest attempt identity, then wire it into the existing vanilla HTML/JS pages. Keep Firestore as the persistence layer for results and repeat-attempt requests, with test owners approving retakes from the results page.

**Tech Stack:** Static HTML/CSS/JavaScript, Firebase Auth compat SDK, Firebase Firestore compat SDK, existing `ui.js` toast/modal helpers, VPS plus Cloudflare deployment.

---

## File Structure

- Create: `scripts/test-security.js` for control-mode defaults, student-name normalization, device id storage, and retake constants.
- Modify: `pages/create.html` and `scripts/create.js` for test settings UI and Firestore `controlMode`.
- Modify: `pages/play.html` and `scripts/play.js` for guest taking, soft retake gate, anti-copy, focus warnings, watermark, and attempt metadata.
- Modify: `pages/results.html` and `scripts/results.js` for `Результаты` and `Повторные попытки` tabs.
- Modify: `style.css`, `pages/home.html`, `pages/admin.html`, `pages/profile.html`, `index.html`, `pages/login.html` for focused mobile layout fixes.
- Manual update: Firebase Console Firestore Rules for guest result writes and retake-request permissions.

---

### Task 1: Shared Security Helper

**Files:**
- Create: `scripts/test-security.js`
- Modify: `pages/create.html`
- Modify: `pages/play.html`
- Modify: `pages/results.html`

- [ ] **Step 1: Create `scripts/test-security.js`**

Use this exact file:

```javascript
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
    const rawMode = testData && typeof testData.controlMode === "object" ? testData.controlMode : {};
    const warningLimit = Number.parseInt(rawMode.autoSubmitAfterWarnings, 10);

    return {
        preventCopy: Boolean(rawMode.preventCopy),
        hideOnBlur: Boolean(rawMode.hideOnBlur),
        autoSubmitAfterWarnings: Number.isInteger(warningLimit) && warningLimit > 0 ? warningLimit : DEFAULT_CONTROL_MODE.autoSubmitAfterWarnings,
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
        if (existing) return existing;

        const nextId = createLocalDeviceId();
        localStorage.setItem(TEST_SECURITY_STORAGE_KEY, nextId);
        return nextId;
    } catch (error) {
        console.warn("localStorage недоступен, используем временный device id.", error);
        return createLocalDeviceId();
    }
}

function canBypassStudentControlMode(user, testData, adminGhostModeEnabled = true) {
    if (!user || !testData) return false;
    if (testData.authorId && testData.authorId === user.uid) return true;
    return typeof isAdminUser === "function" && isAdminUser(user) && adminGhostModeEnabled;
}
```

- [ ] **Step 2: Load helper before page scripts**

In `pages/create.html`:

```html
<script src="/scripts/test-security.js?v=20260410a"></script>
<script src="/scripts/create.js?v=20260410a"></script>
```

In `pages/play.html`:

```html
<script src="/scripts/test-security.js?v=20260410a"></script>
<script src="/scripts/play.js?v=20260410a"></script>
```

In `pages/results.html`:

```html
<script src="/scripts/test-security.js?v=20260410a"></script>
<script src="/scripts/results.js?v=20260410a"></script>
```

- [ ] **Step 3: Verify helper loading**

Run in browser console on `pages/play.html`:

```javascript
typeof getControlMode === "function" && typeof getOrCreateAttemptDeviceId === "function"
```

Expected: `true`.

- [ ] **Step 4: Commit**

```bash
git add scripts/test-security.js pages/create.html pages/play.html pages/results.html
git commit -m "feat: add test security helpers"
```

---

### Task 2: Control Settings In Create/Edit

**Files:**
- Modify: `pages/create.html`
- Modify: `scripts/create.js`

- [ ] **Step 1: Add control settings to `pages/create.html`**

Inside `.settings-grid`, after shuffle settings, add checkbox/input cards for:

```html
<input type="checkbox" id="preventCopy">
<input type="checkbox" id="hideOnBlur">
<input type="text" id="autoSubmitAfterWarnings" placeholder="3" inputmode="numeric" autocomplete="off">
<input type="checkbox" id="requireRetakeApproval">
<input type="checkbox" id="showWatermark">
```

Use Russian labels:

```text
Запретить копирование текста
Скрывать тест при уходе со вкладки
Автосдача после предупреждений
Повтор только с разрешения учителя
Водяной знак с именем
```

- [ ] **Step 2: Add control helpers in `scripts/create.js`**

Add near other helpers:

```javascript
function getControlInput(id) {
    return document.getElementById(id);
}

function collectControlMode() {
    const rawLimit = sanitizePositiveInteger(getControlInput("autoSubmitAfterWarnings")?.value || "");
    const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : DEFAULT_CONTROL_MODE.autoSubmitAfterWarnings;

    return {
        preventCopy: Boolean(getControlInput("preventCopy")?.checked),
        hideOnBlur: Boolean(getControlInput("hideOnBlur")?.checked),
        autoSubmitAfterWarnings: Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_CONTROL_MODE.autoSubmitAfterWarnings,
        requireRetakeApproval: Boolean(getControlInput("requireRetakeApproval")?.checked),
        showWatermark: Boolean(getControlInput("showWatermark")?.checked)
    };
}

function fillControlMode(controlMode) {
    const mode = getControlMode({ controlMode });
    if (getControlInput("preventCopy")) getControlInput("preventCopy").checked = mode.preventCopy;
    if (getControlInput("hideOnBlur")) getControlInput("hideOnBlur").checked = mode.hideOnBlur;
    if (getControlInput("autoSubmitAfterWarnings")) getControlInput("autoSubmitAfterWarnings").value = String(mode.autoSubmitAfterWarnings);
    if (getControlInput("requireRetakeApproval")) getControlInput("requireRetakeApproval").checked = mode.requireRetakeApproval;
    if (getControlInput("showWatermark")) getControlInput("showWatermark").checked = mode.showWatermark;
}
```

- [ ] **Step 3: Restore and save control mode**

In `fillSettingsFromTest(testData)`, after shuffle fields:

```javascript
fillControlMode(testData.controlMode);
```

In `buildTestPayload(...)`, add:

```javascript
controlMode: collectControlMode(),
```

In `DOMContentLoaded`, sanitize the warning input:

```javascript
const autoSubmitAfterWarningsInput = document.getElementById("autoSubmitAfterWarnings");
if (autoSubmitAfterWarningsInput) {
    autoSubmitAfterWarningsInput.addEventListener("input", () => {
        autoSubmitAfterWarningsInput.value = sanitizePositiveInteger(autoSubmitAfterWarningsInput.value);
    });
}
fillControlMode(DEFAULT_CONTROL_MODE);
```

- [ ] **Step 4: Manual check**

Create and publish a test with all control settings enabled.

Expected Firestore field:

```json
{
  "controlMode": {
    "preventCopy": true,
    "hideOnBlur": true,
    "autoSubmitAfterWarnings": 3,
    "requireRetakeApproval": true,
    "showWatermark": true
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add pages/create.html scripts/create.js
git commit -m "feat: add per-test control settings"
```

---

### Task 3: Guest Taking And Retake Gate

**Files:**
- Modify: `pages/play.html`
- Modify: `scripts/play.js`

- [ ] **Step 1: Add retake request UI in `pages/play.html`**

Add after `#introBox`:

```html
<div id="retakeRequestBox" class="intro-box retake-request-box" style="display:none;">
    <h2>Повторная попытка</h2>
    <p id="retakeRequestText" class="retake-request-text">Вы уже проходили этот тест с этого устройства.</p>
    <div class="intro-actions">
        <button type="button" id="sendRetakeRequestBtn" class="submit-btn">Попросить разрешение</button>
    </div>
</div>
```

- [ ] **Step 2: Extend `playState` in `scripts/play.js`**

Add these fields:

```javascript
attemptDeviceId: "",
normalizedStudentName: "",
retakeRequestId: "",
retakeMode: false,
```

- [ ] **Step 3: Add retake Firestore helpers**

Add after `sanitizeAccessCode`:

```javascript
async function findExistingFinalAttempt(testData, normalizedStudentName, attemptDeviceId) {
    const snap = await db.collection("results")
        .where("entryType", "==", "final")
        .where("testId", "==", testData.id)
        .where("normalizedStudentName", "==", normalizedStudentName)
        .where("attemptDeviceId", "==", attemptDeviceId)
        .limit(1)
        .get();

    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function findRetakeRequestByStatus(testData, normalizedStudentName, attemptDeviceId, status) {
    const snap = await db.collection("retakeRequests")
        .where("testId", "==", testData.id)
        .where("normalizedStudentName", "==", normalizedStudentName)
        .where("attemptDeviceId", "==", attemptDeviceId)
        .where("status", "==", status)
        .limit(1)
        .get();

    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function createRetakeRequest(testData, studentName, normalizedStudentName, attemptDeviceId) {
    const pending = await findRetakeRequestByStatus(testData, normalizedStudentName, attemptDeviceId, RETAKE_STATUSES.PENDING);
    if (pending) return pending;

    const payload = {
        testId: testData.id,
        teacherId: testData.authorId || "",
        studentName,
        normalizedStudentName,
        attemptDeviceId,
        status: RETAKE_STATUSES.PENDING,
        requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
        resolvedAt: null,
        resolvedBy: null
    };

    const ref = await db.collection("retakeRequests").add(payload);
    return { id: ref.id, ...payload };
}

async function markRetakeRequestUsed(requestId) {
    if (!requestId) return;
    await db.collection("retakeRequests").doc(requestId).update({
        status: RETAKE_STATUSES.USED,
        usedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}
```

- [ ] **Step 4: Allow guests instead of redirecting to login**

Replace the auth block in `DOMContentLoaded` with:

```javascript
const currentUser = await new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user || null);
    });
});
```

Keep admin UI behind:

```javascript
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
```

- [ ] **Step 5: Add retake gate before rendering questions**

In the start button handler, after `latestTestData` is loaded and access is checked:

```javascript
const controlMode = getControlMode(latestTestData);
const attemptDeviceId = getOrCreateAttemptDeviceId();
const normalizedStudentName = normalizeStudentNameForAttempt(studentName);
const shouldBypassControl = canBypassStudentControlMode(
    auth.currentUser,
    latestTestData,
    isAdminUser(currentUser) ? adminGhostModeCheckbox.checked : false
);

if (controlMode.requireRetakeApproval && !shouldBypassControl) {
    const existingAttempt = await findExistingFinalAttempt(latestTestData, normalizedStudentName, attemptDeviceId);
    if (existingAttempt) {
        const approvedRetake = await findRetakeRequestByStatus(latestTestData, normalizedStudentName, attemptDeviceId, RETAKE_STATUSES.APPROVED);
        if (!approvedRetake) {
            playState.testData = latestTestData;
            playState.studentName = studentName;
            playState.normalizedStudentName = normalizedStudentName;
            playState.attemptDeviceId = attemptDeviceId;
            introBox.style.display = "none";
            document.getElementById("retakeRequestBox").style.display = "block";
            document.getElementById("retakeRequestText").textContent = "Вы уже проходили этот тест с этого устройства и имени. Можно отправить заявку учителю.";
            return;
        }

        playState.retakeRequestId = approvedRetake.id;
        playState.retakeMode = true;
    }
}

playState.attemptDeviceId = attemptDeviceId;
playState.normalizedStudentName = normalizedStudentName;
```

- [ ] **Step 6: Wire retake request button**

Add constants:

```javascript
const sendRetakeRequestBtn = document.getElementById("sendRetakeRequestBtn");
```

Add listener:

```javascript
sendRetakeRequestBtn.addEventListener("click", async () => {
    sendRetakeRequestBtn.disabled = true;
    try {
        await createRetakeRequest(playState.testData, playState.studentName, playState.normalizedStudentName, playState.attemptDeviceId);
        appShowToast("Заявка отправлена учителю.", "success");
        document.getElementById("retakeRequestText").textContent = "Заявка уже отправлена. Когда учитель разрешит повтор, откройте тест снова с этим же именем.";
    } catch (error) {
        console.error("Ошибка заявки на повтор:", error);
        sendRetakeRequestBtn.disabled = false;
        appShowToast("Не удалось отправить заявку. Попробуйте ещё раз.", "error");
    }
});
```

- [ ] **Step 7: Mark approved retake as used**

In `submitTest`, after `saveFinalResult(...)` succeeds:

```javascript
if (!shouldSkipSaving && playState.retakeRequestId) {
    await markRetakeRequestUsed(playState.retakeRequestId);
}
```

- [ ] **Step 8: Manual check**

Open a protected test in a private window, complete it as `Test Student`, reopen it in the same private window, and enter `Test Student` again.

Expected: second start is blocked and the repeat-request box appears.

- [ ] **Step 9: Commit**

```bash
git add pages/play.html scripts/play.js
git commit -m "feat: add guest retake request gate"
```

---

### Task 4: Control Mode During Play

**Files:**
- Modify: `pages/play.html`
- Modify: `scripts/play.js`

- [ ] **Step 1: Add overlay and watermark to `pages/play.html`**

Add before `#testForm`:

```html
<div id="controlWarningOverlay" class="control-warning-overlay" style="display:none;">
    <div class="control-warning-card">
        <div class="control-warning-title">Тест скрыт</div>
        <div id="controlWarningText" class="control-warning-text">Вернитесь к тесту, чтобы продолжить.</div>
        <button type="button" id="returnToTestBtn" class="submit-btn">Продолжить</button>
    </div>
</div>
<div id="studentWatermark" class="student-watermark" style="display:none;"></div>
```

- [ ] **Step 2: Add CSS in `pages/play.html`**

Add:

```css
.control-warning-overlay {
    position: fixed;
    inset: 0;
    z-index: 90000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.82);
    backdrop-filter: blur(8px);
}

.control-warning-card {
    width: min(520px, 100%);
    padding: 26px;
    border-radius: 24px;
    background: #1f2937;
    border: 1px solid rgba(148, 163, 184, 0.24);
    text-align: center;
}

.student-watermark {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 10;
    opacity: 0.08;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: clamp(34px, 9vw, 110px);
    font-weight: 900;
    transform: rotate(-18deg);
    text-align: center;
}

.copy-protected {
    user-select: none;
    -webkit-user-select: none;
}
```

- [ ] **Step 3: Extend `playState`**

Add:

```javascript
controlMode: DEFAULT_CONTROL_MODE,
focusWarnings: 0,
autoSubmittedByControlMode: false,
copyProtectionCleanup: null,
focusProtectionCleanup: null,
```

- [ ] **Step 4: Add copy and focus protection helpers**

Add:

```javascript
function enableCopyProtection() {
    const protectedArea = document.getElementById("testForm");
    if (!protectedArea) return () => {};

    protectedArea.classList.add("copy-protected");
    const blockedEvents = ["copy", "cut", "contextmenu", "dragstart", "selectstart"];
    const blockEvent = (event) => {
        event.preventDefault();
        appShowToast("В этом тесте копирование отключено.", "info");
    };

    blockedEvents.forEach((eventName) => protectedArea.addEventListener(eventName, blockEvent));
    return () => {
        protectedArea.classList.remove("copy-protected");
        blockedEvents.forEach((eventName) => protectedArea.removeEventListener(eventName, blockEvent));
    };
}

function hideControlWarning() {
    const overlay = document.getElementById("controlWarningOverlay");
    if (overlay) overlay.style.display = "none";
}

function showControlWarning() {
    const overlay = document.getElementById("controlWarningOverlay");
    const text = document.getElementById("controlWarningText");
    playState.focusWarnings += 1;
    if (text) text.textContent = `Вы покинули вкладку теста. Предупреждение ${playState.focusWarnings} из ${playState.controlMode.autoSubmitAfterWarnings}.`;
    if (overlay) overlay.style.display = "flex";
}

function enableFocusProtection() {
    let hiddenByProtection = false;
    const handleLeave = async () => {
        if (!playState.started || playState.submitted || hiddenByProtection) return;
        hiddenByProtection = true;
        showControlWarning();
        if (playState.focusWarnings >= playState.controlMode.autoSubmitAfterWarnings) {
            playState.autoSubmittedByControlMode = true;
            await submitTest({ forcedByControlMode: true });
        }
    };
    const handleReturn = () => { hiddenByProtection = false; };
    const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") handleLeave();
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
```

- [ ] **Step 5: Start and stop protections**

On test start, set:

```javascript
playState.controlMode = getControlMode(latestTestData);
playState.focusWarnings = 0;
playState.autoSubmittedByControlMode = false;
```

After `testForm.style.display = "block";`, run:

```javascript
if (playState.copyProtectionCleanup) playState.copyProtectionCleanup();
if (playState.focusProtectionCleanup) playState.focusProtectionCleanup();

if (playState.controlMode.preventCopy && !canBypassStudentControlMode(currentUser, playState.testData, playState.adminGhostMode)) {
    playState.copyProtectionCleanup = enableCopyProtection();
}

if (playState.controlMode.hideOnBlur && !canBypassStudentControlMode(currentUser, playState.testData, playState.adminGhostMode)) {
    playState.focusProtectionCleanup = enableFocusProtection();
}

const watermark = document.getElementById("studentWatermark");
if (watermark) {
    watermark.textContent = playState.controlMode.showWatermark ? playState.studentName : "";
    watermark.style.display = playState.controlMode.showWatermark ? "grid" : "none";
}
```

In `submitTest`, after `stopAttemptTimer();`, clean up:

```javascript
if (playState.copyProtectionCleanup) {
    playState.copyProtectionCleanup();
    playState.copyProtectionCleanup = null;
}
if (playState.focusProtectionCleanup) {
    playState.focusProtectionCleanup();
    playState.focusProtectionCleanup = null;
}
const watermark = document.getElementById("studentWatermark");
if (watermark) watermark.style.display = "none";
hideControlWarning();
```

- [ ] **Step 6: Save attempt metadata**

In answer and final result payloads, add:

```javascript
normalizedStudentName: playState.normalizedStudentName || normalizeStudentNameForAttempt(playState.studentName),
attemptDeviceId: playState.attemptDeviceId || "",
retake: Boolean(playState.retakeMode),
focusWarnings: playState.focusWarnings,
autoSubmitted: Boolean(playState.autoSubmittedByControlMode || playState.timedOut),
autoSubmitReason: playState.autoSubmittedByControlMode ? "focus_warnings" : playState.timedOut ? "timer" : "",
```

Change submit signature:

```javascript
async function submitTest({ forcedByTimer = false, forcedByControlMode = false } = {}) {
```

Add result notes for `forcedByControlMode` and `focusWarnings`.

- [ ] **Step 7: Manual check**

Expected: copy/right-click are blocked, watermark shows, tab switch shows overlay, the third warning auto-submits, Firestore final result has `focusWarnings` and `autoSubmitReason`.

- [ ] **Step 8: Commit**

```bash
git add pages/play.html scripts/play.js
git commit -m "feat: apply test control mode"
```

---

### Task 5: Results Tabs And Retake Review

**Files:**
- Modify: `pages/results.html`
- Modify: `scripts/results.js`

- [ ] **Step 1: Add tabs in `pages/results.html`**

After `.summary-card`, add:

```html
<div class="results-tabs">
    <button type="button" id="resultsTabBtn" class="results-tab active">Результаты</button>
    <button type="button" id="retakesTabBtn" class="results-tab">Повторные попытки</button>
</div>
```

Wrap current list markup as:

```html
<div id="resultsPanel" class="results-panel">
    <div id="emptyText" class="empty-text" style="display:none;">Пока никто не прошёл этот тест.</div>
    <div id="resultsList" class="results-list"></div>
</div>
<div id="retakesPanel" class="results-panel" style="display:none;">
    <div id="retakeEmptyText" class="empty-text" style="display:none;">Пока нет заявок на повторную попытку.</div>
    <div id="retakeRequestsList" class="results-list"></div>
</div>
```

- [ ] **Step 2: Add tab CSS**

Add to `pages/results.html`:

```css
.results-tabs {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 18px;
}

.results-tab {
    border: none;
    border-radius: 999px;
    padding: 11px 16px;
    background: #334155;
    color: #dbeafe;
    font-weight: 800;
    cursor: pointer;
}

.results-tab.active {
    background: #2563eb;
    color: #ffffff;
}

.retake-status {
    display: inline-flex;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.18);
    color: #bfdbfe;
    font-weight: 800;
}
```

- [ ] **Step 3: Add retake helpers in `scripts/results.js`**

Add:

```javascript
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

async function loadRetakeRequests(testId) {
    const snap = await db.collection("retakeRequests").where("testId", "==", testId).get();
    return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
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
```

- [ ] **Step 4: Render retake requests**

Add `renderRetakeRequests(testData, requests, refreshResults)` that creates `.result-card` entries with:

```javascript
name.textContent = request.studentName || "Без имени";
requestedAt.textContent = `Запрос: ${formatResultDate(request.requestedAt)}`;
device.textContent = `Устройство: ${request.attemptDeviceId || "не указано"}`;
status.textContent = getRetakeStatusText(request.status);
```

For `request.status === RETAKE_STATUSES.PENDING`, add buttons:

```javascript
approveBtn.textContent = "Разрешить";
rejectBtn.textContent = "Отклонить";
```

Button handlers call:

```javascript
await updateRetakeRequestStatus(testData, request, RETAKE_STATUSES.APPROVED);
await updateRetakeRequestStatus(testData, request, RETAKE_STATUSES.REJECTED);
```

After each successful update, call:

```javascript
await refreshResults();
setResultsTab("retakes");
```

- [ ] **Step 5: Show attempt metadata on result cards**

In `renderResults`, after duration:

```javascript
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

if (result.autoSubmitted) {
    const autoSubmitted = document.createElement("div");
    autoSubmitted.className = "student-meta";
    autoSubmitted.textContent = result.autoSubmitReason === "focus_warnings"
        ? "Автосдано из-за ухода со вкладки"
        : "Автосдано системой";
    main.appendChild(autoSubmitted);
}
```

- [ ] **Step 6: Load requests inside `loadResultsPage`**

After `results` is built:

```javascript
const retakeRequests = await loadRetakeRequests(testId);
```

After `renderResults(...)`:

```javascript
renderRetakeRequests(testData, retakeRequests, async () => {
    await loadResultsPage(user);
});
```

In `DOMContentLoaded`, before `await loadResultsPage(user);`:

```javascript
document.getElementById("resultsTabBtn").addEventListener("click", () => setResultsTab("results"));
document.getElementById("retakesTabBtn").addEventListener("click", () => setResultsTab("retakes"));
```

- [ ] **Step 7: Manual check**

Create a retake request, open results, switch to `Повторные попытки`, approve it, and verify the same student can use one retake.

- [ ] **Step 8: Commit**

```bash
git add pages/results.html scripts/results.js
git commit -m "feat: add retake requests to results"
```

---

### Task 6: Mobile Layout Pass

**Files:**
- Modify: `style.css`
- Modify: `pages/home.html`
- Modify: `pages/create.html`
- Modify: `pages/play.html`
- Modify: `pages/results.html`
- Modify: `pages/admin.html`
- Modify: `pages/profile.html`
- Modify: `index.html`
- Modify: `pages/login.html`

- [ ] **Step 1: Add shared mobile safety in `style.css`**

Append:

```css
@media (max-width: 720px) {
    html,
    body {
        overflow-x: hidden;
    }

    img,
    video,
    canvas,
    svg {
        max-width: 100%;
    }

    button,
    input,
    textarea,
    select {
        font: inherit;
    }
}
```

- [ ] **Step 2: Fix auth layout in `style.css`**

Inside the existing `@media (max-width: 900px)` block:

```css
body,
html {
    min-height: 100%;
    height: auto;
}

.container {
    min-height: 100svh;
    height: auto;
}

form {
    gap: 18px;
}

.input-group,
.social-login {
    width: 100%;
}
```

- [ ] **Step 3: Fix page-specific mobile layouts**

Apply these focused changes:

```css
/* pages/home.html inside max-width 900px */
.test-actions { display: grid; grid-template-columns: 1fr; }
.row-btn { width: 100%; min-height: 42px; }
.test-row-title, .test-row-subtitle { word-break: break-word; }

/* pages/create.html inside max-width 720px */
.builder-actions { flex-direction: column; }
.builder-action-btn { width: 100%; }
.choice-section, .open-section { padding: 14px; }

/* pages/play.html inside max-width 720px */
.intro-actions { flex-direction: column; }
.question-tools { justify-content: flex-start; margin: 0 0 12px; }
.answer-toggle-btn { padding: 8px 10px; }

/* pages/results.html inside max-width 800px */
.results-container { padding: 28px 14px 56px; }
.test-title { font-size: 28px; }
.result-actions, .result-actions button { width: 100%; }

/* pages/admin.html inside max-width 1024px */
.admin-shell { padding: 22px 12px 44px; }
.hero-title { font-size: 30px; }
.top-bar { flex-direction: column; align-items: flex-start; }
.toggle-btn, .delete-btn { width: 100%; margin-left: 0; }
```

- [ ] **Step 4: Manual mobile check**

Use devtools widths `390px`, `430px`, and `768px` for:

```text
index.html
pages/login.html
pages/home.html
pages/create.html
pages/play.html
pages/results.html
pages/profile.html
pages/admin.html
```

Expected: no horizontal scroll, buttons fit inside cards, test rows stack, forms are readable, and the PC layout remains familiar at desktop width.

- [ ] **Step 5: Commit**

```bash
git add style.css pages/home.html pages/create.html pages/play.html pages/results.html pages/admin.html pages/profile.html index.html pages/login.html
git commit -m "fix: improve mobile layout"
```

---

### Task 7: Firestore Rules

**Files:**
- Manual update in Firebase Console Firestore Rules

- [ ] **Step 1: Publish rules that support guest results and retake requests**

Use this rules structure and keep admin UID lists aligned with `scripts/firebase-init.js`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isFullAdmin() {
      return signedIn() && request.auth.uid in [
        "Cu5SKekfbmNqEKJg7IumrB7L8HJ2",
        "7Zzoq0WtGBVhV66hzN1wGVM0Fw52"
      ];
    }

    function isViewerAdmin() {
      return signedIn() && request.auth.uid in [
        "wQnldzxokzfbrCKjDabOkV4kAcg2"
      ];
    }

    function isAnyAdmin() {
      return isFullAdmin() || isViewerAdmin();
    }

    function testExists(testId) {
      return exists(/databases/$(database)/documents/tests/$(testId));
    }

    function testAuthor(testId) {
      return get(/databases/$(database)/documents/tests/$(testId)).data.authorId;
    }

    function hasResultCreateShape() {
      return request.resource.data.keys().hasAll([
        "entryType",
        "testId",
        "teacherId",
        "studentName",
        "attemptId",
        "createdAt"
      ])
      && request.resource.data.testId is string
      && request.resource.data.teacherId is string
      && request.resource.data.studentName is string
      && request.resource.data.teacherId == testAuthor(request.resource.data.testId);
    }

    function hasRetakeCreateShape() {
      return request.resource.data.keys().hasAll([
        "testId",
        "teacherId",
        "studentName",
        "normalizedStudentName",
        "attemptDeviceId",
        "status",
        "requestedAt"
      ])
      && request.resource.data.testId is string
      && request.resource.data.teacherId is string
      && request.resource.data.studentName is string
      && request.resource.data.normalizedStudentName is string
      && request.resource.data.attemptDeviceId is string
      && request.resource.data.status == "pending"
      && request.resource.data.teacherId == testAuthor(request.resource.data.testId);
    }

    match /users/{userId} {
      allow read: if signedIn() && (request.auth.uid == userId || isAnyAdmin());
      allow create, update: if signedIn() && request.auth.uid == userId;
      allow delete: if isFullAdmin();

      match /testResults/{resultId} {
        allow create: if testExists(request.resource.data.testId)
          && request.resource.data.teacherId == userId
          && hasResultCreateShape();
        allow read: if signedIn() && (request.auth.uid == userId || isAnyAdmin());
        allow update: if false;
        allow delete: if signedIn() && (request.auth.uid == userId || isFullAdmin());
      }
    }

    match /tests/{testId} {
      allow read: if true;
      allow create: if signedIn();
      allow update, delete: if signedIn() && (
        request.auth.uid == resource.data.authorId || isFullAdmin()
      );
    }

    match /results/{resultId} {
      allow create: if testExists(request.resource.data.testId)
        && hasResultCreateShape();
      allow read: if signedIn() && (
        request.auth.uid == resource.data.teacherId || isAnyAdmin()
      );
      allow update: if false;
      allow delete: if signedIn() && (
        request.auth.uid == resource.data.teacherId || isFullAdmin()
      );
    }

    match /retakeRequests/{requestId} {
      allow create: if testExists(request.resource.data.testId)
        && hasRetakeCreateShape();
      allow read: if signedIn() && (
        request.auth.uid == resource.data.teacherId || isAnyAdmin()
      );
      allow update: if signedIn()
        && (request.auth.uid == resource.data.teacherId || isFullAdmin())
        && request.resource.data.status in ["approved", "rejected", "used"]
        && request.resource.data.testId == resource.data.testId
        && request.resource.data.teacherId == resource.data.teacherId
        && request.resource.data.studentName == resource.data.studentName
        && request.resource.data.normalizedStudentName == resource.data.normalizedStudentName
        && request.resource.data.attemptDeviceId == resource.data.attemptDeviceId;
      allow delete: if isFullAdmin();
    }
  }
}
```

- [ ] **Step 2: Verify rules**

Run these browser checks:

```text
Logged-out guest can submit a result.
Logged-out guest can create a retake request.
Test owner can read and approve the retake request.
Viewer admin can read users/tests but cannot delete tests.
Full admin can delete tests.
```

Expected: no `permission-denied` console errors in these flows.

---

### Task 8: Final Verification And Deployment

**Files:**
- Read-only verification across modified files
- Manual deploy to VPS

- [ ] **Step 1: Check worktree**

```bash
git status --short
```

Expected: only intentional files from this feature are modified.

- [ ] **Step 2: Check script loading**

```bash
rg "test-security.js|play.js|create.js|results.js" pages
```

Expected: `test-security.js?v=20260410a` loads before `create.js`, `play.js`, and `results.js`.

- [ ] **Step 3: Check no native browser dialogs were added**

```bash
rg "alert\\(|confirm\\(" .
```

Expected: no new native browser `alert()` or `confirm()` calls for this feature.

- [ ] **Step 4: End-to-end browser checks**

Run these flows:

```text
Create casual test -> publish -> logged-out guest completes -> teacher sees result.
Create strict test -> logged-out guest sees watermark -> copy is blocked -> tab switch shows warning.
Strict test -> third tab switch auto-submits -> result stores focusWarnings and autoSubmitReason.
Strict test -> same name and browser tries again -> retake request screen appears.
Teacher results -> Repeat attempts tab -> approve request.
Same student reopens test -> one retake works -> request becomes used.
Author/admin moderation -> not blocked by retake or focus restrictions.
Mobile widths 390px, 430px, 768px -> no horizontal scrolling.
```

- [ ] **Step 5: Upload files to VPS**

From PowerShell in `C:\Users\user\Site_Project`:

```powershell
scp .\scripts\test-security.js root@2.26.80.99:/var/www/html/scripts/test-security.js
scp .\scripts\create.js root@2.26.80.99:/var/www/html/scripts/create.js
scp .\scripts\play.js root@2.26.80.99:/var/www/html/scripts/play.js
scp .\scripts\results.js root@2.26.80.99:/var/www/html/scripts/results.js
scp .\style.css root@2.26.80.99:/var/www/html/style.css
scp .\pages\create.html root@2.26.80.99:/var/www/html/pages/create.html
scp .\pages\play.html root@2.26.80.99:/var/www/html/pages/play.html
scp .\pages\results.html root@2.26.80.99:/var/www/html/pages/results.html
scp .\pages\home.html root@2.26.80.99:/var/www/html/pages/home.html
scp .\pages\admin.html root@2.26.80.99:/var/www/html/pages/admin.html
scp .\pages\profile.html root@2.26.80.99:/var/www/html/pages/profile.html
scp .\index.html root@2.26.80.99:/var/www/html/index.html
scp .\pages\login.html root@2.26.80.99:/var/www/html/pages/login.html
```

- [ ] **Step 6: Reload Nginx on VPS**

```bash
nginx -t
systemctl reload nginx
```

Expected:

```text
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

- [ ] **Step 7: Purge Cloudflare**

In Cloudflare for `quizqwerty.lol`: `Caching` -> `Configuration` -> `Purge Everything` -> confirm.

- [ ] **Step 8: Production smoke test**

Open:

```text
https://quizqwerty.lol/pages/home.html
https://quizqwerty.lol/pages/play.html
```

Expected: pages load without stale cached scripts, `test-security.js` has no 404, and guest test taking works.

- [ ] **Step 9: Final commit**

```bash
git status --short
git add scripts/test-security.js scripts/create.js scripts/play.js scripts/results.js style.css pages/create.html pages/play.html pages/results.html pages/home.html pages/admin.html pages/profile.html index.html pages/login.html
git commit -m "feat: add mobile control mode and retake flow"
```
