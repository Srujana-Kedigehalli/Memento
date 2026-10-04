# Quickstart: Validating Identity, Trust & Media Handling

A run-and-verify guide, not implementation. Contracts: [contracts/api.md](./contracts/api.md).
Schema: [data-model.md](./data-model.md).

## Prerequisites

- Local Postgres or a Supabase database, with `db/migrations/003_identity_trust_media.sql` applied.
- A **private** Supabase Storage bucket with a 25 MB file size limit.
- `.env.local` values: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_STORAGE_BUCKET`, `VERIFICATION_CHANNEL=email`, `VERIFICATION_PEPPER` (long random),
  optional `VERIFICATION_DAILY_CAP` (default 400), `CRON_SECRET`,
  `MAIL_PROVIDER` (`gmail`; `console` prints only template names and cannot show verification codes), `MAIL_FROM`,
  `OPERATOR_EMAIL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` (a Google app password, needs 2-Step
  Verification), `APP_BASE_URL` (for example `http://localhost:3000`, used in emailed links),
  `EXPECTED_PEAK_GUESTS` (the real event's guest count, used by scenario 32).
  `SESSION_SECRET` is no longer used.
- Migration 003 truncates `events` and `photos`; use a database where that is acceptable.
- `npm install` then `npm run dev`. Guest verification sends real email, so use `MAIL_PROVIDER=gmail`
  and an inbox you can read.

## Scenarios

1. **Host and multiple events (SC-001)**: sign up host A, create two events, confirm both listed.
   Sign up host B, confirm B sees none of A's events and gets `404` opening A's event by id.
2. **Guest persistence (SC-002, SC-011)**: open event 1's link unauthenticated and confirm photos
   are viewable. Try to upload: prompted to verify. Enter an email address, then enter the 6-digit code from the email
   (check spam). The send response must not contain the code.
   Open event 2's link in the same browser: no second verification.
3. **Per-event consent**: in event 1, consent then upload. In event 2, upload attempt returns
   `consent_required`; consent there, then upload succeeds.
4. **Processing (SC-005)**: upload a phone photo containing GPS EXIF and an iPhone HEIC. Check the
   displayed file has no GPS EXIF, is JPEG, and a thumbnail exists. Confirm no raw original remains
   in Storage.
5. **Duplicate race (SC-004)**: upload the same file twice, then from two guests simultaneously
   (two concurrent requests). Expect exactly one `media` row. Then report a photo (hiding it) and upload the same file again: the
   response is `{duplicate:true}` with **no `mediaId`**; for a match against a visible photo it includes
   `mediaId`.
6. **Single uploader (SC-006)**: attempt a direct SQL insert with both or neither of
   `guest_id`/`host_id`; the CHECK must reject it.
7. **Report hides at once (SC-007)**: as a guest, report a visible photo; reload the gallery as
   another viewer: the photo is gone before any host action.
8. **Review**: as the host, open the report queue, dismiss one (photo returns) and uphold another.
9. **Fail-safe (SC-008)**: back-date a report past the window, call the sweep with the bearer
   secret. Report becomes `auto_held`, photo stays hidden.
10. **Evidence survives (SC-010)**: file a `harmful` report, uphold it, soft-delete the event, set
    `purge_after` to the past, run the sweep. Confirm media and event rows are gone while the
    report row remains with `media_id` and `event_id` null and `reporter_guest_id`, `reviewed_by`, the
    uploader (`uploader_guest_id` or `uploader_host_id`), and `content_hash` all still set. Repeat
    with a non-harmful report and confirm it is deleted. Also delete the uploader's identity first and
    confirm evidence still points to them (tombstoned: email address gone, id and name kept).
11. **Deletion split**: as a guest, delete one photo (identity intact), then delete identity.
    The email address is cleared, and the guest's remaining photos still display exactly as before under their
    name (or anonymous), with no "deleted" label.
12. **Verification is real and secret**: request a code for an address: the response is `202` with no
    code in it, for known and unknown addresses alike; the code arrives by email; a wrong, expired, or
    reused code fails with a generic `401`; a session exists only after a correct code. Confirm a new
    send does not cancel an older still-valid code. Confirm `MAIL_PROVIDER=console` refuses to start in
    production. **Channel swap (SC via T071)**: run the automated channel-swap test, which registers a
    test-only phone provider against the real schema with **no migration**: a phone guest and an email
    guest verify in the same run as separate rows keyed by `(identifier, channel)`, consent, upload,
    report, evidence, and identity deletion work for the phone guest with no other code change, and the
    email guest's row is untouched.
13. **No secret logging**: run scenarios 2 and 9 with server output captured; grep for the guest's email address,
    the verification code, and the session token. Expect zero matches.
14. **Login lockout**: fail host login 5 times; the 6th attempt with the correct password still
    returns the same generic `401`; after `locked_until` passes, login works and the counter resets.
15. **Verification throttles**: request a code for a new address 5 times in an hour with no valid code
    pending (let each expire): the sixth new request returns `429` with `Retry-After`. While a code is
    pending, press resend: it sends again, does not use up the new-code limit, and a resend within 30
    seconds returns `429`. As a "stranger", request codes for a real guest's address repeatedly, then as
    the real guest request one while an earlier code is still valid: you still receive a code and can
    verify. Burn attempts across several codes for one address until the total in the last hour reaches
    10: the next confirm returns `429`. Send 300 verification requests for 300 different addresses within
    an hour (test addresses or a fake mailer): none is refused by a system-wide limit. Lower
    `VERIFICATION_DAILY_CAP` in a test run and confirm that once it is reached other addresses get `429`,
    while a `harmful` report still emails the host and the operator and a host password reset still works.
16. **Harmful email**: file a `harmful` report; a message for the event owner and one for
    `OPERATOR_EMAIL` arrive in real inboxes (with `MAIL_PROVIDER=gmail`) within a minute, contain no guest email address beyond the recipient's own, and no token, and
    the photo was already hidden. Make the mailer fail once: photo stays hidden and the sweep later
    sends the alert (`alerted_at` set).
17. **Auto-resolve for all reasons**: back-date open reports of two different reasons (for
    example `other` and `harmful`) past 72 hours and run the sweep. Both become `auto_held` and the
    host receives one digest. Only the harmful one keeps its row after event purge.
18. **Signed URL lifetime**: fetch a photo's signed URL, wait past 5 minutes, confirm it no longer
    works, and confirm the gallery refreshes its URLs on its own.
19. **Migration truncate**: after migration, `events` and `photos` contain no Phase 1 rows.
20. **Close and reopen (SC-014)**: as the owner, close an event. Upload attempts by a guest and by
    the host return `409 event_closed` with nothing stored; the gallery still shows visible photos
    and reporting still works. Start an upload, close the event, then finalize: refused and the temp
    object is gone. Reopen: uploads work again. A non-owner host cannot close or reopen it.
21. **Password reset (SC-013)**: request a reset for a real account and for an unknown email: both
    return the identical `202`. The real one emails a link (`#token=…` in the fragment). Open it, set a
    new password: old password and old sessions stop working, lockout is cleared, and the link cannot
    be reused. Request a second reset and confirm the first link no longer works. Request four resets
    within an hour and confirm the fourth sends nothing. Confirm the token never appears in server logs.
22. **Report limit (SC-012)**: as one guest, file 5 reports in an event within 15 minutes; the 6th
    returns `429 report_limit`, the first 5 photos stay hidden, and the same guest can still report in
    a different event. Fire two reports simultaneously as the 5th and 6th to confirm the advisory lock
    holds the limit.
23. **Name prompt (FR-039)**: after a guest's first successful upload, an optional name prompt
    appears; skipping leaves photos anonymous and does not affect the upload; entering a name shows it
    on the photos. Verification and upload never require a name.
24. **Email verification (SC-015)**: sign up a host. The dashboard shows the unverified reminder,
    and creating an event, uploading, and reviewing reports all still work. A confirmation email
    arrives (real inbox, check spam) with a `#token=…` link. Follow it: the reminder disappears. Request
    a new link and confirm the earlier one no longer works, and that a fourth request within an hour is
    refused. Confirm a host who never verifies is never blocked, and that a password reset on an
    unverified account also clears the reminder. Confirm the token never appears in server logs.
25. **Upload limit (SC-016)**: as one guest, upload 100 photos in one sitting in one event: all are
    accepted. Create 200 upload intents within an hour in one event; the 201st returns `429
    upload_limit` with `Retry-After`, earlier photos are unaffected, and the same guest can still
    upload to a different event and can still view and report. The host can upload without being
    limited.
26. **Gallery (SC-017, SC-018)**: open an event link with no sign-in. The count equals the visible
    photos. Open a photo: previous/next work by button, arrow keys, and swipe on a phone, with no
    previous on the first photo and no next on the last. Download a photo and confirm the file has no
    location metadata; wait past 5 minutes and confirm the same download URL fails while a fresh
    request works. Hide a photo by reporting it and confirm it drops out of the count, the viewer, and
    the download route (`404`). Use share (share sheet on a phone, copy on a desktop) and open the
    shared link in a private window. Confirm the QR code appears on the host dashboard beside the link
    and decodes to the event link, and that the guest gallery shows no QR. Repeat on a closed event.
27. **Host removes a photo (SC-019)**: as the owning host, delete an unreported photo: it vanishes
    at once and no evidence row exists after purge. Delete another and mark it harmful: after purge, a
    report row remains with `reporter_host_id` and `reviewed_by` both the host, the uploader, and
    `content_hash`, and no email was sent. With a guest report open on a third photo, have the host
    delete it: the report closes as `upheld`. A host who does not own the event gets `403`. The guest
    report limit is unaffected.
28. **Guest identity deletion confirmation (SC-020)**: start deleting identity and confirm the message
    (photos remain; you can't delete them afterward unless you remove them first). Cancel: nothing is
    deleted. Call the API without `confirm:true`: `400`. Confirm, then check the email address is gone, the
    photos still display under the name (or anonymous), the guest can no longer delete them, and the
    host still can.
29. **Timed checks (SC-003, SC-007, SC-009)**: measure, don't estimate.
    - **SC-003**: on a phone with a never-used email address, start a stopwatch when the event link opens
      and stop when the first uploaded photo shows in the gallery, including requesting the emailed code, entering it, consent, and upload. Record how long the code email took to arrive and whether it landed in spam.
      Run 3 times; every run must be **under 120 seconds**.
    - **SC-007**: from a script, submit a report and record the time the request is sent (t0); poll
      `GET /api/e/:token` as a second viewer every 250 ms until the photo is absent. Run 10 times; the
      photo must be gone **within 2 seconds of t0 in every run** (this depends only on the database
      transaction, not on email).
    - **SC-009**: file a `harmful` report and note t0 (`reports.created_at`). Record when the host's
      and the operator's emails arrive (message `Date` and inbox arrival). Run 5 times; both must arrive
      **within 60 seconds**. Also slow the mail server on purpose (for example a wrong SMTP host) and
      confirm the report request still returns in about 2 seconds, the photo is hidden, and the alert is
      sent by the next sweep (`alerted_at` set).
    - **SC-013 (reset time)**: start a stopwatch at "send reset link" for a real inbox and stop when you
      are logged in with the new password. Run 3 times; every run must be **under 5 minutes**, and note
      the email arrival time and spam placement.
    - **SC-017 (no permanent public address)**: for a stored photo, request the Storage object's public
      URL form (`/storage/v1/object/public/<bucket>/<path>`) with no signature: it must be refused
      (not `200`). Fetch a download URL at about 4 minutes 30 seconds (works) and at 5 minutes 30 seconds
      (must fail), then request a fresh one (works). Run 3 times.
30. **Sweep failure alert**: in a test database make one sweep step fail (for example rename a table
    it uses), call the sweep with the bearer secret. The operator receives an email naming the failed
    step and time with no personal data, the other steps still ran, the route returned `500`, and the
    sweep works again after restoring the table.
31. **Actor precedence and report race**: log in as a host and also verify as a guest in the same
    browser, then upload to an event you own: the photo's uploader is the host. Upload to someone else's
    event: you act as a guest (consent required). Then run a report and an uploader delete of the same
    photo at the same instant, 20 times: never a report on removed media and never two outcomes.
    Also open your own event's link while logged in as its host: the page is in **owner-host mode**
    (host controls visible, upload acts as the host with no verification, consent, or name prompt) and
    `GET /api/e/:token` returns `isOwnerHost: true` only for the owner (another host's session gets
    `false`).
32. **Mail capacity rehearsal (release gate, task T077)**: set `EXPECTED_PEAK_GUESTS` to the real event's
    guest count. Using the real Gmail account, send a realistic batch of verification emails to inboxes
    you control (several addresses and providers, never third parties), spread like a real reception, plus
    a few harmful-alert and digest emails. Record messages delivered, any Gmail throttling or
    daily-limit errors, spam placement, median delivery time, and the number the account actually sends
    in a day. **Pass** only if it covers the expected peak with at least 20% headroom plus an alert
    reserve and there are no throttling errors. **Fail**: move to a verified-domain provider (for example
    Resend) as a new `Mailer` implementation behind `MAIL_PROVIDER` before the event; this is a release
    gate, not a later upgrade.

## Expected outcomes

All scenarios pass as described. Any failure of scenarios 5, 7, 10, 12, 13, 16, 17, 20, 21, 22, 25, 27, 28, 29, 30, 31 or 32
blocks release, as they map to constitution principles IX, X, XI, and XII and the fail-safe guarantee.
Scenario 16 must be run with `MAIL_PROVIDER=gmail` against real inboxes before real use; check the
spam folder too, since mail from a personal Gmail address can be filtered.
