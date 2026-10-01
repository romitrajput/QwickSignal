# Setting up real push notifications

This is a bigger change than the usual file swap — it needs two manual steps in addition to
deploying the code, because push notifications involve a secret key that can't live in the
repo, and a new Firestore collection that needs its own security rule published.

## 1. Add the VAPID keys as GitHub Actions secrets/variables

Go to: your repo → Settings → Secrets and variables → Actions

Add these **secrets** (click "New repository secret"):
- `VAPID_PRIVATE_KEY` = `zaQO9vhjUbkBjGc_v87xvSBB2nmtN1GQuWIFmxLOMp4`
- `VAPID_PUBLIC_KEY` = `BLoqORqoNU8nV8DYIq70_t11_XaiwkhELAT_QBtFyoz9c8sWnYd0Ibg8Pp1sr_87C0s0iHq9FKQxZsk5wo4mh8w`

(Both as **secrets** is fine even though the public key isn't sensitive — it just needs to be
readable by the pipeline run. It's also already hardcoded into `app.js`, so the frontend doesn't
need this variable at all — this is only for `pipeline.py` to sign outgoing pushes.)

Optionally add a **variable** (not secret) if you want push "from" a different email than the
owner email already in the code:
- `VAPID_SUBJECT` = `mailto:rrrajput2101@gmail.com` (this is the default if you skip it)

**Important:** these are a matched pair. Don't regenerate new keys without also updating the
`VAPID_PUBLIC_KEY` constant in `app.js` — if they ever stop matching, every existing
subscription breaks and everyone has to turn notifications on again.

## 2. Publish the updated Firestore rules

Go to: Firebase Console → your project → Firestore Database → Rules

Paste the full contents of the updated `firestore.rules` file (sent with this message) and click
**Publish**. This adds the new `qs_push_subs` collection the notification feature needs — without
this step, turning on notifications in the app will fail silently or show a permission error.

## 3. Deploy the code as usual

Apply `index.html`, `app.js`, `sw.js`, `pipeline.py`, `requirements.txt`,
`.github/workflows/pipeline.yml` (and `.env.example` if you want the local-dev notes). Either:

- Drag `qwicksignal-netlify-deploy-v2.zip` onto Netlify (frontend only — fastest), **and**
  separately push `pipeline.py`, `requirements.txt`, `.github/workflows/pipeline.yml`,
  `firestore.rules` to GitHub so the next scheduled pipeline run can send pushes, or
- Push everything to GitHub (updates both the pipeline and, once GitHub Pages/your other
  deployment picks it up, the frontend too).

```
git add index.html app.js sw.js pipeline.py firestore.rules requirements.txt .env.example .github/workflows/pipeline.yml
git commit -m "Add real OS-level push notifications"
git push origin main
```

(There's already a local commit with this exact message — if your local copy has it, you can
just `git push origin main` directly; only pull/rebase first if GitHub shows commits you don't
have locally yet.)

## 4. Turn it on and test

1. Open the app → Settings → Notifications → "Turn on notifications".
2. Your browser will ask for notification permission — allow it.
3. Wait for the next pipeline run (every ~5 minutes) to publish a **Critical or High importance**
   story — by design, Low/Medium stories don't trigger a push (see `PUSH_MIN_IMPORTANCE` in
   `pipeline.py`), only the in-app toast. You can close the app entirely; the notification should
   still arrive.
4. Tapping the notification should open the app and jump straight to that story.

If nothing arrives after a Critical/High story is published, check the pipeline's GitHub Actions
log for a line starting with `push:` — it logs how many devices it tried, how many succeeded,
and will say plainly if `VAPID_PRIVATE_KEY`/`VAPID_PUBLIC_KEY` aren't set yet.

## Why only Critical/High stories?

A real OS notification is a bigger interruption than an in-app toast, so it's reserved for
stories worth being interrupted for. Every new story — including Low/Medium — still gets the
in-app "Waveform Arrival" toast whenever the app happens to be open. If you'd rather push on
*every* new story regardless of importance, change `PUSH_MIN_IMPORTANCE` near the top of
`pipeline.py`'s push section to include `"Medium"` and `"Low"` too.
