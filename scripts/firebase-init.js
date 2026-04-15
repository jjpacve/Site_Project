const firebaseConfig = {
    apiKey: "AIzaSyB9CLM6sOFc4o1OcrYx5mbvgikppkMzN18",
    authDomain: "kazakhquiz-32449.firebaseapp.com",
    projectId: "kazakhquiz-32449",
    storageBucket: "kazakhquiz-32449.firebasestorage.app",
    messagingSenderId: "311511992705",
    appId: "1:311511992705:web:3964e20454bc37a51cc080"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const FULL_ADMIN_UIDS = [
    "Cu5SKekfbmNqEKJg7IumrB7L8HJ2",
    "7Zzoq0WtGBVhV66hzN1wGVM0Fw52"
];
const VIEWER_ADMIN_UIDS = [
    "wQnldzxokzfbrCKjDabOkV4kAcg2",
    "CuReeRAxmqYLPXLmWXvMEHBBqoj2"
];
const ANSWER_HIGHLIGHT_UIDS = ["YlkIvbnZOOYpbkaXXpK3DX0R9bT2"];

function isAdminUser(user) {
    return Boolean(
        user &&
        (FULL_ADMIN_UIDS.includes(user.uid) || VIEWER_ADMIN_UIDS.includes(user.uid))
    );
}

function isFullAdminUser(user) {
    return Boolean(user && FULL_ADMIN_UIDS.includes(user.uid));
}

function getAdminRole(user) {
    if (isFullAdminUser(user)) {
        return "full";
    }

    if (user && VIEWER_ADMIN_UIDS.includes(user.uid)) {
        return "viewer";
    }

    return "none";
}

function canSeeAnswerHighlights(user) {
    return Boolean(
        user &&
        (isAdminUser(user) || ANSWER_HIGHLIGHT_UIDS.includes(user.uid))
    );
}

function requiresEmailVerification(user) {
    if (!user) {
        return false;
    }

    const providers = Array.isArray(user.providerData) ? user.providerData : [];
    const hasPasswordProvider = providers.some((provider) => provider?.providerId === "password");

    return hasPasswordProvider && !user.emailVerified;
}

db.settings({
    cacheSizeBytes: 40 * 1024 * 1024,
    ignoreUndefinedProperties: true,
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
});

db.enablePersistence({ synchronizeTabs: true }).catch((error) => {
    if (error.code === "failed-precondition") {
        console.warn("Firestore persistence skipped: multiple tabs are already open.");
    } else if (error.code === "unimplemented") {
        console.warn("Firestore persistence is not supported in this browser.");
    } else {
        console.warn("Firestore persistence error:", error);
    }
});

console.log("Firebase инициализирован");
