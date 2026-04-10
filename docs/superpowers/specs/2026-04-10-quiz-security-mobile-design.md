# Quiz Security And Mobile Upgrade Design

## Goal

Improve Kazakh Quiz in stages without breaking the current static Firebase site:

- keep tests available without registration;
- add better mobile layout for existing pages;
- add a per-test control mode for anti-cheating behavior;
- add teacher-controlled repeat attempts;
- keep Firebase email verification and password reset for now;
- leave a future backend plus Resend email system as a separate project.

## Current Context

The project is a static HTML/CSS/JavaScript site backed by Firebase Auth and Firestore. It is deployed on a VPS behind Cloudflare. Main pages are:

- `index.html` for registration;
- `pages/login.html` for login;
- `pages/home.html` for the main dashboard;
- `pages/create.html` for test creation and editing;
- `pages/play.html` for taking a test;
- `pages/results.html` for teacher results;
- `pages/profile.html` for the profile;
- `pages/admin.html` for admin tools.

The current implementation already supports Firebase Auth, profiles, tests, draft/published state, test links/codes, results, admin roles, light/dark theme, and mixed question types.

## Scope

This design covers three implementation stages:

1. Responsive mobile layout for the existing site.
2. Per-test control mode for anti-cheating settings.
3. Teacher-approved repeat attempts for guest test takers.

Custom Resend emails are explicitly out of scope for this implementation. Firebase email verification and password reset stay in use for now. A backend email service can be planned later.

## User Model

Guest students can open a test by link or code, enter their name, and take the test without creating an account.

Registered users get extra benefits, but registration is not required for taking tests. Future account benefits can include saved history, profile identity, avatar, quick name fill, personal statistics, and certificates.

Authors and admins can moderate tests without being blocked by anti-cheating restrictions. If an admin intentionally takes a test as a student, the existing visible/hidden result behavior should continue to apply.

## Stage 1: Responsive Mobile Layout

The site should remain one codebase with adaptive CSS instead of a separate mobile site.

Target pages:

- `pages/home.html`: test rows become stacked cards on small screens; action buttons wrap cleanly; draft tests should not show copy-link or results controls.
- `pages/create.html`: setup fields, settings cards, question cards, answer rows, and save buttons become one-column layouts.
- `pages/play.html`: question, answer options, timer, warning overlay, and answer-reveal button remain readable and do not overflow.
- `pages/results.html`: result rows and repeat-request rows render as mobile-friendly cards instead of wide table-like rows.
- `pages/admin.html`: counters, status cards, user list, and test list stack vertically.
- `pages/profile.html`: avatar, display name, account info, and theme controls do not overflow.
- `index.html` and `pages/login.html`: registration and login forms stay centered and readable on narrow screens.

Desktop layout should stay visually familiar. Mobile changes should be driven mainly by shared CSS and targeted media queries.

## Stage 2: Per-Test Control Mode

Test creation and editing should include a `Control mode` settings block. The settings are saved on each test document so one test can be strict while another stays casual.

Initial settings:

- `preventCopy`: disables text selection, copying, cutting, context menu, and dragging while the student is taking the test.
- `hideOnBlur`: hides the test behind an overlay when the tab or window loses focus.
- `autoSubmitAfterWarnings`: automatically submits the test after a configured number of focus-loss warnings. The first version should use `3`.
- `requireRetakeApproval`: blocks repeat attempts from the same student name and device until the teacher approves.
- `showWatermark`: optionally displays a subtle watermark with the student's entered name while taking the test.

The browser cannot reliably block screenshots. The product should not claim that screenshots are impossible. The realistic behavior is to discourage cheating through copy blocking, focus-loss logging, warning overlays, auto-submit after repeated violations, and optional watermarking.

Admin and author moderation should bypass restrictive control behavior unless the user chooses to take the test as a normal student.

## Stage 3: Repeat Attempts

Repeat-attempt control should avoid IP-based blocking because a full classroom can share one public IP through the same network.

The system should instead use a soft guest identity:

- generate and store a local `attemptDeviceId` in the student's browser;
- combine `testId`, normalized `studentName`, and `attemptDeviceId` to detect repeat attempts;
- check Firebase before starting the test;
- if no previous completed attempt exists, allow the test to start;
- if a completed attempt exists and no approved retake is available, show a message and offer to request a repeat attempt;
- create a `retakeRequests` document when the student asks for another attempt;
- let the teacher approve or reject that request from the test results page;
- after approval, allow one additional attempt for the same `testId + studentName + attemptDeviceId`;
- save the new result with a `retake: true` marker.

The teacher-facing results page should add tabs:

- `Results`: normal result list with name, score, percent, duration, answer details, warning count, and auto-submit status.
- `Repeat attempts`: requests with student name, request time, device marker, status, and actions to approve or reject.

This approach is not impossible to bypass with a different browser or device, but it avoids blocking a full class and gives the teacher useful control.

## Data Model

Each test document should gain a `controlMode` object:

```json
{
  "preventCopy": false,
  "hideOnBlur": false,
  "autoSubmitAfterWarnings": 3,
  "requireRetakeApproval": false,
  "showWatermark": false
}
```

Existing tests without `controlMode` should default to the casual mode above.

Each result document should include attempt metadata:

```json
{
  "studentName": "Alihan",
  "attemptDeviceId": "local-device-id",
  "retake": false,
  "startedAt": "server timestamp",
  "submittedAt": "server timestamp",
  "durationSeconds": 420,
  "focusWarnings": 0,
  "autoSubmitted": false
}
```

Repeat requests should be stored in a collection that the teacher can query by test. A simple top-level collection is acceptable:

```json
{
  "testId": "internal-test-id",
  "teacherId": "creator-user-id",
  "studentName": "Alihan",
  "normalizedStudentName": "alihan",
  "attemptDeviceId": "local-device-id",
  "status": "pending",
  "requestedAt": "server timestamp",
  "resolvedAt": null,
  "resolvedBy": null
}
```

Valid statuses are `pending`, `approved`, `rejected`, and `used`.

## Flow

### Starting A Test

1. Student opens a published test link or code.
2. Student enters name.
3. Site reads or creates `attemptDeviceId` in `localStorage`.
4. If the user is an author/admin in moderation mode, skip repeat blocking.
5. If `requireRetakeApproval` is disabled, start the test.
6. If enabled, query existing results for the same `testId + normalizedStudentName + attemptDeviceId`.
7. If no completed result exists, start the test.
8. If a completed result exists, query approved unused retake requests.
9. If an approved unused request exists, start the retake and later mark the request `used`.
10. If no approved request exists, show the repeat-request screen.

### During A Controlled Test

If `preventCopy` is enabled, the play page blocks selection and copy-like browser events inside the test area.

If `hideOnBlur` is enabled, losing focus hides the questions behind an overlay and increments `focusWarnings`.

If the warning count reaches `autoSubmitAfterWarnings`, the test is submitted automatically with `autoSubmitted: true`.

If `showWatermark` is enabled, the student's entered name appears as a subtle watermark over the test area.

### Teacher Review

The teacher opens test results and can switch between `Results` and `Repeat attempts`.

In `Repeat attempts`, the teacher can approve or reject pending requests. Approved requests allow exactly one new attempt, then become `used`.

## Firebase Rules Impact

Rules must allow:

- guest or authenticated test takers to read published tests as they do today;
- authenticated teachers to read repeat requests for tests they own;
- guest repeat-request creation if the project allows unauthenticated test taking;
- result creation by guests if guest test taking remains supported;
- updates to repeat-request status only by the test owner or a full admin.

If Firestore rules currently require `request.auth != null` for result creation, guest testing with server-stored results and repeat requests will need a rules adjustment. The design should keep writes constrained by required fields such as `testId`, `teacherId`, `studentName`, `attemptDeviceId`, and allowed statuses.

## Email Plan

For this release, keep Firebase built-in email verification and password reset.

Resend and a VPS backend are deferred. The future backend can expose endpoints for custom verification, password reset, and notifications, using Firebase Admin SDK to generate action links and Resend to send branded emails.

## Error Handling

If repeat-attempt checks fail because Firebase is unavailable, the site should show a clear message and not silently start a protected attempt.

If warning auto-submit fails, the play page should keep the student's current answers locally and show a retry message.

If copy-prevention events are blocked or unsupported by a browser, the test should still be usable and the teacher should rely on focus warnings and results metadata.

If a retake request already exists and is pending, the student should see that the request was already sent instead of creating duplicates.

## Testing Strategy

Manual checks are required for:

- mobile layout on narrow widths for all major pages;
- creating a test with casual control settings;
- creating a test with strict control settings;
- taking a test as a guest for the first time;
- trying to take the same test again with the same name and browser;
- creating a retake request;
- approving the request as the teacher;
- using the approved retake once;
- verifying the retake cannot be reused;
- confirming admins/authors can moderate without being blocked;
- confirming copy prevention and focus-warning overlays do not break normal answering;
- confirming auto-submit after 3 warnings;
- confirming existing tests without `controlMode` still work.

## Non-Goals

- No reliable screenshot blocking claim.
- No IP-based single-attempt blocking.
- No Resend/backend implementation in this stage.
- No separate mobile website.
- No heavy fingerprinting.
- No export to Excel in this release.
- No per-question scoring changes in this release.
