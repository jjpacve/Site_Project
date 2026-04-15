from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
CREATE_HTML = ROOT / "pages" / "create.html"
CREATE_JS = ROOT / "scripts" / "create.js"
PLAY_HTML = ROOT / "pages" / "play.html"
PLAY_JS = ROOT / "scripts" / "play.js"
ADMIN_HTML = ROOT / "pages" / "admin.html"
ADMIN_JS = ROOT / "scripts" / "admin.js"


class SourceTextStaticTest(unittest.TestCase):
    def test_create_page_contains_optional_source_text_modal(self):
        html = CREATE_HTML.read_text(encoding="utf-8")

        self.assertIn('id="sourceTextOpenBtn"', html)
        self.assertIn('id="sourceTextModal"', html)
        self.assertIn('id="sourceTextInput"', html)
        self.assertIn('id="sourceTextSaveBtn"', html)
        self.assertIn('id="sourceTextCloseBtn"', html)

    def test_create_script_saves_source_text_without_requiring_it_for_questions(self):
        script = CREATE_JS.read_text(encoding="utf-8")

        self.assertIn("sourceText:", script)
        self.assertIn("function readSourceText()", script)
        self.assertIn("sourceTextInput", script)
        self.assertIn("return sourceTextInput.value.trim();", script)
        self.assertNotIn("sourceTextInput?.value || editorState.sourceText", script)
        self.assertIn("showEditor(title, questionCount)", script)

    def test_play_page_shows_source_text_above_questions(self):
        html = PLAY_HTML.read_text(encoding="utf-8")
        script = PLAY_JS.read_text(encoding="utf-8")

        self.assertIn('id="sourceTextBox"', html)
        self.assertIn('id="sourceTextContent"', html)
        self.assertLess(html.index('id="sourceTextBox"'), html.index('id="questionsContainer"'))
        self.assertIn("function renderSourceText(testData)", script)
        self.assertIn("sourceTextContent.textContent = sourceText;", script)
        self.assertIn("renderSourceText(latestTestData);", script)

    def test_admin_answer_reveal_label_is_smaller_and_azerbaijani(self):
        html = PLAY_HTML.read_text(encoding="utf-8")
        script = PLAY_JS.read_text(encoding="utf-8")

        self.assertIn("font-size: 10px;", html)
        self.assertIn('revealBtn.textContent = "Cavabı göstər";', script)
        self.assertIn('revealButton.textContent = isHidden ? "Cavabı gizlət" : "Cavabı göstər";', script)
        self.assertNotIn("Показать ответ", script)
        self.assertNotIn("Скрыть ответ", script)
        self.assertNotIn("Жауапты көрсету", script)
        self.assertNotIn("Жауапты жасыру", script)

    def test_admin_test_view_can_show_source_text_above_questions(self):
        html = ADMIN_HTML.read_text(encoding="utf-8")
        script = ADMIN_JS.read_text(encoding="utf-8")

        self.assertIn(".source-text-card", html)
        self.assertIn(".source-text-content", html)
        self.assertIn("function createSourceTextCard(test)", script)
        self.assertIn("sourceTextContent.textContent = sourceText;", script)
        self.assertIn("questionList.appendChild(createSourceTextCard(test));", script)


if __name__ == "__main__":
    unittest.main()
