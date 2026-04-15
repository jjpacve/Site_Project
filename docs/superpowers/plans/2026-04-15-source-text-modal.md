# Source Text Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional modal textarea for source text on the test creation page.

**Architecture:** Keep the feature local to the existing static create page. Store the text in `editorState.sourceText`, mirror it to the modal textarea, and include it in `buildTestPayload` as `sourceText`.

**Tech Stack:** Plain HTML, CSS, browser JavaScript, Firebase compat SDK, Node `assert` and `vm` for tests.

---

### Task 1: Source Text Persistence

**Files:**
- Create: `tests/test-create-source-text.test.js`
- Modify: `scripts/create.js`

- [ ] **Step 1: Write the failing test**

```javascript
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const scriptPath = path.join(__dirname, "..", "scripts", "create.js");
const script = fs.readFileSync(scriptPath, "utf8");

const values = {
    timeLimitMinutes: "",
    accessCode: "",
    shuffleQuestions: false,
    shuffleOptions: false,
    sourceTextInput: "  Абай туралы мәтін  "
};

const context = {
    console,
    Math,
    Date,
    window: {
        location: { search: "" },
        history: { replaceState: () => {} },
        addEventListener: () => {}
    },
    document: {
        addEventListener: () => {},
        getElementById: (id) => ({
            value: values[id] || "",
            checked: Boolean(values[id])
        })
    },
    firebase: {
        firestore: {
            FieldValue: {
                serverTimestamp: () => "server-timestamp"
            }
        }
    },
    DEFAULT_CONTROL_MODE: {
        preventCopy: false,
        hideOnBlur: false,
        autoSubmitAfterWarnings: 3,
        requireRetakeApproval: false,
        showWatermark: false
    },
    getControlMode: ({ controlMode }) => controlMode
};

vm.createContext(context);
vm.runInContext(script, context);

const payload = vm.runInContext(
    `buildTestPayload({ uid: "teacher-1", email: "teacher@example.com" }, [{ question: "Q", type: "open_text_manual", acceptedAnswers: [] }], "draft")`,
    context
);

assert.strictEqual(payload.sourceText, "Абай туралы мәтін");
console.log("create source text tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test-create-source-text.test.js`

Expected: FAIL because `payload.sourceText` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

Add helper functions in `scripts/create.js`:

```javascript
function getSourceTextInput() {
    return document.getElementById("sourceTextInput");
}

function readSourceText() {
    return (getSourceTextInput()?.value || editorState.sourceText || "").trim();
}
```

Add `sourceText: readSourceText()` to the object returned by `buildTestPayload`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/test-create-source-text.test.js`

Expected: PASS with `create source text tests passed`.

### Task 2: Modal UI

**Files:**
- Modify: `pages/create.html`
- Modify: `scripts/create.js`

- [ ] **Step 1: Add modal markup and styles**

Add a setup button, a status line, and a hidden modal containing `textarea#sourceTextInput`, close, and save buttons.

- [ ] **Step 2: Wire modal behavior**

In `DOMContentLoaded`, find `sourceTextOpenBtn`, `sourceTextModal`, `sourceTextCloseBtn`, and `sourceTextSaveBtn`. Open the modal on button click, close it on cancel, and on save update `editorState.sourceText` from `readSourceText()`.

- [ ] **Step 3: Load existing tests**

In `fillSettingsFromTest`, set `editorState.sourceText` from `testData.sourceText || ""` and mirror it to `sourceTextInput` when present.

- [ ] **Step 4: Verify**

Run:

```bash
node tests/test-create-source-text.test.js
```

Expected: PASS.
