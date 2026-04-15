const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const scriptPath = path.join(__dirname, "..", "scripts", "test-security.js");
const script = fs.readFileSync(scriptPath, "utf8");

function createContext({ storedDeviceId = "" } = {}) {
    const storage = new Map(storedDeviceId ? [["kazakhQuizAttemptDeviceId", storedDeviceId]] : []);

    const context = {
        console,
        Math,
        Date,
        window: {
            crypto: {
                randomUUID: () => "uuid-from-test"
            }
        },
        localStorage: {
            getItem: (key) => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value)
        },
        isAdminUser: (user) => Boolean(user && user.admin === true)
    };

    vm.createContext(context);
    vm.runInContext(script, context);
    return context;
}

{
    const context = createContext();
    assert.strictEqual(context.normalizeStudentNameForAttempt("  Alihan   Test  "), "alihan test");
}

{
    const context = createContext();
    const mode = context.getControlMode({
        controlMode: {
            preventCopy: 1,
            hideOnBlur: true,
            autoSubmitAfterWarnings: "5",
            requireRetakeApproval: true,
            showWatermark: false
        }
    });

    assert.deepStrictEqual(mode, {
        preventCopy: true,
        hideOnBlur: true,
        autoSubmitAfterWarnings: 5,
        requireRetakeApproval: true,
        showWatermark: false
    });
}

{
    const context = createContext();
    assert.strictEqual(context.getOrCreateAttemptDeviceId(), "uuid-from-test");
    assert.strictEqual(context.getOrCreateAttemptDeviceId(), "uuid-from-test");
}

{
    const context = createContext({ storedDeviceId: "existing-device" });
    assert.strictEqual(context.getOrCreateAttemptDeviceId(), "existing-device");
}

{
    const context = createContext();
    assert.strictEqual(
        context.canBypassStudentControlMode({ uid: "teacher" }, { authorId: "teacher" }, false),
        true
    );
    assert.strictEqual(
        context.canBypassStudentControlMode({ uid: "admin", admin: true }, { authorId: "teacher" }, true),
        true
    );
    assert.strictEqual(
        context.canBypassStudentControlMode({ uid: "admin", admin: true }, { authorId: "teacher" }, false),
        false
    );
}

console.log("test-security tests passed");
