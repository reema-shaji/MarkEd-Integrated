# MarkEd Integrated — Change Log & Rationale

This document records the substantive changes made while integrating the three
source dissertations — **Group Marking (Haoyu Wang)**, **Self-Assessment
(Mingyue Qin)** and **Peer Feedback (Tomas Maillo Rodriguez)** — into the
unified MarkEd platform, and while fixing the issues found in end-to-end testing.

For each change it records **what was there before**, **what we changed**, and
**why**. Tags:

- **[Restored]** — a feature the source dissertations had that unification had
  dropped; brought back faithfully.
- **[New]** — net-new behaviour not present in any source codebase (usually
  driven by the unified design prototype).
- **[Fix]** — a bug fix.
- **[Design]** — alignment to the unified design prototype.

---

## 1. Marking

### 1.1 Individual per-criterion scoring — [Restored]
- **Before:** In the unified build, individual marking was *annotations-only* —
  the marking page rendered only the PDF annotation viewer. Per-criterion scores
  existed in the data (`SubmissionCriteria`) but could only be seeded; there was
  no UI or API to enter them. The original dissertations (`teacher/mark.html`)
  had numeric score inputs per criterion, a "Save Marks" button, and a
  finalise/lock rule.
- **Change:** Added `getSubmissionMarking` / `saveSubmissionMarking` (writes
  `SubmissionCriteria` scores + feedback) and a scoring panel on the marking
  page (numeric entry per criterion, live total, **Save marks** / **Finalise
  marks**), above the annotation viewer.
- **Why:** A marking tool that cannot enter marks is incomplete; this restores
  the source behaviour on the unified schema.

### 1.2 Marker-lock / academic-override — [Restored]
- **Before:** Unification made marking shared/last-write-wins. Hao's rule (a
  finalised criterion is read-only to markers; only a course organiser can
  override) had been dropped.
- **Change:** Re-applied the rule in both group marking (`saveGroupMarking`) and
  the new individual `saveSubmissionMarking`: finalised criteria return 403 to
  markers and are editable only by an Academic.
- **Why:** Preserves Hao's moderation model; prevents markers overwriting
  finalised marks.

### 1.3 Marking list shows real status & score — [Fix]
- **Before:** The Marking-tab list hard-coded every row to "Submitted" with a
  "—" score, and the status filter didn't filter.
- **Change:** `getAllSubmissions` now returns `marking_status`
  (Unmarked / In progress / Marked) and `score`/`total`; the list renders them
  and the status filter works.
- **Why:** The list contradicted the actual marking data (students saw marks the
  academic list didn't).

### 1.4 Release marks — [New] (functional version of a source placeholder)
- **Before:** Both source dissertations showed a **"Release marks"** button, but
  it was a *disabled, no-op placeholder*. Mark visibility was implicitly tied to
  finishing marking.
- **Change:** Added `Assignment.results_released` (migration 0005), a
  course-organiser-only `setResultsReleased` endpoint, and a **Release marks /
  Hide marks** control on the academic dashboard. Students now see marks only
  when marking is **finished AND** results are **released**; the individual
  result, dashboard mark chip and group result all withhold the numbers until
  then. Already-marked demo assignments were auto-released so nothing regressed.
- **Why:** The button existed in the source UIs but never worked; this makes
  "who sees marks, when" a real, deliberate course-organiser decision, separate
  from a marker finishing scoring.

---

## 2. Results (student-facing)

### 2.1 Individual result view + rubric breakdown — [Restored]
- **Before:** The individual results tab showed only the PDF annotation viewer;
  no numeric mark. The original had a dedicated `student/feedback.html` with the
  mark and a per-criterion breakdown.
- **Change:** Added `getMySubmissionResult` and a mark card on `/results`
  (score/total, percentage, per-criterion breakdown + feedback), shown only once
  marking is finished (and, since §1.4, released).
- **Why:** Restores the student's mark view that unification dropped.

### 2.2 Mark on the dashboard row — [Restored]
- **Before:** The original student home listed each assignment's mark; the
  unified dashboard showed only a status badge.
- **Change:** `getMyAssignmentStatus` returns the individual mark (finished +
  released); the dashboard row shows a percentage chip.
- **Why:** Matches the original student-home behaviour.

---

## 3. Feedback Bank

### 3.1 Restored shared, crowd-rated bank — [Restored]
- **Before:** Unification had reduced the Feedback Bank to a **private
  per-marker list** with **vestigial 👍/👎 counters** (displayed but never
  wired; the backend `react` endpoint was owner-only and unbounded) and a
  Copy-only action. Hao's original was a **shared** bank with real per-user
  reactions (`Reaction`), favourites (`SavedFeedback`), sort-by-likes and
  insert-into-the-marking-field.
- **Change:** Re-modelled to the original: **course-shared** entries; real
  per-user reactions (`FeedbackBankReaction`, one per user, switchable, totals
  derived) with wired 👍/👎; favourites (`FeedbackBankFavourite`) + "My
  Favourites" filter; sort by newest/most-liked/most-used; **Apply** inserts the
  snippet into the field you're editing (Copy kept as fallback); delete is
  author-or-academic. Dropped the fake up/down columns.
- **Why:** The drifted version's reactions could never accrue and the bank
  wasn't shared; this restores Hao's design on the unified schema.

---

## 4. Peer Review

### 4.1 Anonymised submission labels — [Fix]
- **Before:** `getPeerReviews` returned the real author name as the review
  label, breaking anonymity for individual peer review.
- **Change:** Returns stable "Submission A/B (anon.)" labels; the author's name
  never leaves the server. The review list, sub-tabs and detail header now all
  agree.
- **Why:** Anonymity is the point of peer review; the name leak was a real bug.

### 4.2 WebSocket authentication — [Fix]
- **Before:** The AI-suggestion WebSocket authenticated only via Django session,
  but the SPA is bearer-token based, so the socket was always rejected and live
  AI suggestions never reached the browser.
- **Change:** `WebSocketAuthMiddleware` now also accepts the token via the
  handshake query string (browsers can't set WS headers), mirroring the HTTP
  auth; session kept as fallback.
- **Why:** Restores real-time delivery of AI suggestions.

### 4.3 "Generating AI suggestion" indicator — [New]/[Design]
- **Before:** After a student posted a peer comment, nothing indicated that an
  AI suggestion was coming (it arrives 20–90s later via Celery); it appeared
  only on refresh.
- **Change:** A pending spinner ("AI Suggestions / Generating…") shows on the
  comment until the suggestion arrives (matching the prototype).
- **Why:** The wait previously looked like a dead end.

---

## 5. PDF Viewer

### 5.1 Text selection fixed — [Fix]
- **Before:** react-pdf's TextLayer/AnnotationLayer CSS was imported inside the
  lazily-loaded viewer chunks and sometimes didn't apply, so the invisible
  selectable text spans collapsed and text couldn't be selected.
- **Change:** Hoisted both stylesheets into the root layout (global bundle).
- **Why:** Text selection is required to anchor comments.

### 5.2 Restyle to prototype "PDF Review" — [Design]
- **Before:** Flat gray-bordered pages, a sidebar that blended into the page
  background, off-centre layout.
- **Change:** Full-bleed 56px header, a `#F5F3EF` page area with floating white
  page cards (rounded-14, warm border, soft shadow), and a distinct white 384px
  sidebar panel with a left divider.
- **Why:** Match the updated design prototype.

---

## 6. Self-Assessment

### 6.1 Staff overview (role-aware SA tab) — [Fix]
- **Before:** Opening the SA tab as staff tried to render the *student* form and
  errored ("Could not load the self-assessment form").
- **Change:** The SA tab is now role-aware: staff get a submissions overview
  (`listSelfAssessmentSubmissions`); students get the form.
- **Why:** Staff need to see who submitted, not the student form.

### 6.2 Empty-submission gate — [Fix]
- **Before:** The student SA form was submittable while empty/unconfigured.
- **Change:** Sections and Submit are gated on the assignment's configured
  components actually having input; unconfigured SA shows a message.
- **Why:** Prevents meaningless empty self-assessments.

---

## 7. Assignments

### 7.1 Edit assignment after creation — [Restored]/[Fix]
- **Before:** No way to edit an assignment after creation (the original had only
  partial editing).
- **Change:** An "Edit assignment" form on the Structure tab (staff) edits
  title, description, website and deadline via `updateAssignment`
  (`assignmentWebsite` was added to `AssignmentSchema` so it prefills/clears);
  type and PR/SA toggles stay fixed at creation.
- **Why:** Course organisers routinely adjust deadlines/descriptions.

### 7.2 Not-found for bad assignment ids — [Fix]
- **Before:** `getAssignment` did `.objects.get()`, so a non-existent id 500'd
  and every `/assignments/[id]` page sat on a broken skeleton + error toast.
- **Change:** `getAssignment` returns 404; a shared `[id]` layout swaps the
  whole subtree for a clean "Assignment not found" card on a 404.
- **Why:** A missing assignment should read as "not found", not a crash.

---

## 8. Dashboards, guards & display logic

- **Student course dashboard no longer hangs — [Fix]:** it awaited all
  per-assignment status calls before rendering, so one hanging request left
  students on an infinite skeleton. It now renders as soon as assignments load
  and fills status in as a non-blocking pass. The student assignment-detail page
  got the same treatment (was blocked behind the heavier status call).
- **Accurate dashboard summary — [Fix]:** replaced vague "a few students
  submitted" phrasing with an accurate "N of M students submitted" derived from
  the real counts.
- **Peer-review cards hidden when PR is off — [Fix]:** the dashboard no longer
  shows a "Review progress 0%" card on assignments without peer review.

---

## 9. Copy & terminology (cross-codebase drift)

- **[Fix]** Scoring units standardised to **"marks"** (was mixed "pts"/"marks").
- **[Fix]** Role wording standardised to **"course organiser"** in student-facing
  copy (was "Teacher"/"instructor" from Mingyue's codebase).
- **[Fix]** Student text says **"group categories"**, not the backend term
  "group sets".
- **[Fix]** Login uses one verb ("Sign in") for heading and button.
- **[Fix]** Marker empty-state distinguishes "no peer feedback yet" from "no
  reviewers selected" (the latter referenced filter controls that weren't shown).
- **[Fix]** Header help (?) icon now opens a Support / About-AI menu (was inert).

---

## 10. Dates — [Fix]
- **Before:** Five different date formats across the app (each codebase
  formatted independently), including `DD/MM/YYYY, HH:MM:SS`.
- **Change:** A shared `lib/date.ts` (`formatDateTime` → "23 Jul 2026, 15:08";
  `formatDate` → "23 Jul 2026"), applied across the assignment list, detail,
  submissions, workspace, submit, self-assessment, dashboards and countdown card.
- **Why:** Consistent, readable dates everywhere.

---

## 11. Local development / infrastructure

- **Local file storage — [New]:** dev-gated local-upload / local-file endpoints
  so uploads and submissions work against local storage instead of S3 during
  local testing.
- **AI suggestions wired to ELM/OpenAI — [config]:** `OPENAI_API_KEY` is read
  from the git-ignored root `.env` and injected into the backend + celery
  services; the celery image was rebuilt to include `django-cors-headers` (it
  was crash-looping on a stale image, which would have stopped the AI task).
- **react-pdf pinned — [Fix]:** pinned `react-pdf` 9.2.1 + `pdfjs-dist` 4.8.69
  to stop a 5.x ESM error in the viewer.

---

## Notes on things deliberately *not* changed

- **Notifications** — intentionally out of scope for this pass.
- **B4 skeleton perf** — addressed for the assignment detail (see §8); other
  short skeletons were acceptable.
- **"Release marks" is assignment-level**, matching the source placeholder's
  single-button model, not per-submission.
