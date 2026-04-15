# Source Text Modal Design

## Goal

Add an optional text area to the test creation screen so a teacher can paste source material for a test without making test creation depend on that text.

## Behavior

- The setup screen gets a button labeled for adding source text.
- Pressing the button opens a modal with a large textarea.
- The teacher can save or close the modal without changing the question creation flow.
- The "Create questions" action continues to require only the test title and question count.
- The pasted text is saved with the test as `sourceText`.
- Existing tests load their saved `sourceText` back into the modal.

## Files

- `pages/create.html` owns the new button, modal markup, and local styles.
- `scripts/create.js` owns modal state, loading existing source text, and adding `sourceText` to saved test payloads.
- `tests/test-create-source-text.test.js` verifies the optional text is stored independently of question creation.

## Testing

Run `node tests/test-create-source-text.test.js`.
