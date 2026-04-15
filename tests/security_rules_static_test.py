from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
RULES = (ROOT / "docs" / "firebase-rules-security-mobile.rules").read_text(encoding="utf-8")
PLAY_JS = (ROOT / "scripts" / "play.js").read_text(encoding="utf-8")
RESULTS_JS = (ROOT / "scripts" / "results.js").read_text(encoding="utf-8")
ADMIN_JS = (ROOT / "scripts" / "admin.js").read_text(encoding="utf-8")
FIREBASE_INIT_JS = (ROOT / "scripts" / "firebase-init.js").read_text(encoding="utf-8")
ADMIN_HTML = (ROOT / "pages" / "admin.html").read_text(encoding="utf-8")
HOME_HTML = (ROOT / "pages" / "home.html").read_text(encoding="utf-8")
PLAY_HTML = (ROOT / "pages" / "play.html").read_text(encoding="utf-8")
VIEWER_ADMIN_UID = "CuReeRAxmqYLPXLmWXvMEHBBqoj2"


class SecurityRulesStaticTest(unittest.TestCase):
    def test_tests_collection_is_not_publicly_listable(self):
        self.assertNotIn("allow read: if true;", RULES)
        self.assertRegex(RULES, r"allow get: if[\s\S]*visibilityStatus.*active")
        self.assertRegex(RULES, r"allow list: if[\s\S]*visibilityStatus.*active")

    def test_test_create_requires_verified_owner(self):
        self.assertRegex(RULES, r"allow create: if verifiedSignedIn\(\)")
        self.assertIn("request.resource.data.authorId == request.auth.uid", RULES)

    def test_result_writes_reject_extra_fields(self):
        self.assertIn("request.resource.data.keys().hasOnly", RULES)
        self.assertIn("entryType in [\"answer\", \"final\"]", RULES)

    def test_public_lookup_queries_only_active_tests(self):
        share_lookup = re.search(
            r'where\("shareId", "==", shareId\).*?limit\(1\)',
            PLAY_JS,
            re.DOTALL,
        )
        code_lookup = re.search(
            r'where\("accessCode", "==", normalizedCode\).*?limit\(1\)',
            PLAY_JS,
            re.DOTALL,
        )

        self.assertIsNotNone(share_lookup)
        self.assertIsNotNone(code_lookup)
        self.assertIn('where("visibilityStatus", "==", "active")', share_lookup.group(0))
        self.assertIn('where("visibilityStatus", "==", "active")', code_lookup.group(0))

    def test_firestore_cache_is_bounded(self):
        self.assertNotIn("CACHE_SIZE_UNLIMITED", FIREBASE_INIT_JS)

    def test_play_has_anti_cheat_integration_hooks(self):
        self.assertIn("requestTestFullscreen", PLAY_JS)
        self.assertIn("fullscreenchange", PLAY_JS)
        self.assertIn("enableOpenAnswerPasteProtection", PLAY_JS)
        self.assertIn("pasteAttemptCount", PLAY_JS)
        self.assertIn("cheatWarningsCount", PLAY_JS)
        self.assertIn("forcedByAntiCheat", PLAY_JS)

    def test_result_rules_allow_anti_cheat_fields(self):
        for field_name in (
            "cheatWarningsCount",
            "fullscreenExitCount",
            "pasteAttemptCount",
            "suspiciousEvents",
        ):
            with self.subTest(field_name=field_name):
                self.assertIn(f'"{field_name}"', RULES)

    def test_results_page_surfaces_anti_cheat_summary(self):
        self.assertIn("cheatWarningsCount", RESULTS_JS)
        self.assertIn("fullscreenExitCount", RESULTS_JS)
        self.assertIn("pasteAttemptCount", RESULTS_JS)

    def test_admin_cache_fallback_has_timeout(self):
        self.assertNotIn('query.get({ source: "cache" })', ADMIN_JS)
        self.assertIn('query.get({ source: "server" })', ADMIN_JS)
        self.assertIn("Admin server query failed", ADMIN_JS)

    def test_admin_auth_wait_has_timeout(self):
        self.assertIn("function waitForAdminAuth", ADMIN_JS)
        self.assertIn("Firebase Auth не ответил за 8 секунд", ADMIN_JS)

    def test_admin_pages_use_fresh_admin_scripts(self):
        self.assertIn("/scripts/firebase-init.js?v=20260415a", HOME_HTML)
        self.assertIn("/scripts/firebase-init.js?v=20260415a", ADMIN_HTML)
        self.assertIn("/scripts/admin.js?v=20260413c", ADMIN_HTML)

    def test_play_page_uses_fresh_admin_identity_script(self):
        self.assertIn("/scripts/firebase-init.js?v=20260415a", PLAY_HTML)

    def test_new_viewer_admin_uid_is_not_full_admin(self):
        self.assertIn(f'"{VIEWER_ADMIN_UID}"', FIREBASE_INIT_JS)
        self.assertIn(f'"{VIEWER_ADMIN_UID}"', RULES)

        full_admin_js = re.search(r"const FULL_ADMIN_UIDS = \[([\s\S]*?)\];", FIREBASE_INIT_JS)
        viewer_admin_js = re.search(r"const VIEWER_ADMIN_UIDS = \[([\s\S]*?)\];", FIREBASE_INIT_JS)
        full_admin_rules = re.search(r"function isFullAdmin\(\) \{[\s\S]*?request\.auth\.uid in \[([\s\S]*?)\]", RULES)
        viewer_admin_rules = re.search(r"function isViewerAdmin\(\) \{[\s\S]*?request\.auth\.uid in \[([\s\S]*?)\]", RULES)

        self.assertIsNotNone(full_admin_js)
        self.assertIsNotNone(viewer_admin_js)
        self.assertIsNotNone(full_admin_rules)
        self.assertIsNotNone(viewer_admin_rules)
        self.assertNotIn(VIEWER_ADMIN_UID, full_admin_js.group(1))
        self.assertIn(VIEWER_ADMIN_UID, viewer_admin_js.group(1))
        self.assertNotIn(VIEWER_ADMIN_UID, full_admin_rules.group(1))
        self.assertIn(VIEWER_ADMIN_UID, viewer_admin_rules.group(1))


if __name__ == "__main__":
    unittest.main()
