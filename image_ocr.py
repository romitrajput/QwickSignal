#!/usr/bin/env python3
"""QwickSignal: OCR for image-only Telegram posts.

Some Telegram channels post news as a photo (a screenshot of a headline, a scanned clipping, an
infographic) with little or no caption text. parse_telegram_html() in pipeline.py already finds the
post's photo URL for these (see tg_photo_url()), but without any text the post has nothing for the
extraction model to read, so it was previously dropped entirely (pipeline.py: "if not text: continue").

This module downloads that photo and runs local OCR (pytesseract, no API key, no per-call cost) to
pull out whatever text is printed on the image. The OCR text is then treated exactly like a normal
caption - it goes through the same extract_batch() / Claude tool-call / dedup / merge pipeline as
every other post, with no separate code path downstream.

    Telegram photo-only post -> download image -> OCR (eng+hin) -> post["text"] -> normal pipeline

Design rules (mirrored from video_intel.py / image_intel.py)
    * Local and free: no external API, no key, no daily budget to manage.
    * An OCR problem can never break the news feed: every failure in here is caught and logged, and
      the post is skipped exactly like a caption-less post was before this module existed.
    * OCR is noisy by nature (garbled words, wrong reading order on multi-column images, holes in
      non-Latin scripts). It is not corrected here - the post's OCR text is handed to the same AI
      extraction step used for every other post, which already writes English summaries from messy
      source text and already treats post text as untrusted data.
"""
from __future__ import annotations

import io
import re

# Every value can be overridden under "settings:" in sources.yml.
DEFAULTS = {
    "ocr_enabled": True,               # master switch (it also needs pytesseract + tesseract-ocr installed)
    "ocr_languages": "eng+hin",        # tesseract language packs to use, e.g. "eng", "eng+hin"
    "ocr_min_chars": 20,               # OCR results shorter than this are treated as "nothing readable"
    "ocr_max_per_run": 40,             # image-only posts OCR'd per pipeline run (OCR is local/free, but not instant)
    "ocr_timeout_seconds": 20,         # per-image download timeout
}

_WS = re.compile(r"[ \t]+")
_BLANKLINES = re.compile(r"\n{3,}")
_WORDCHARS = re.compile(r"[^\W\d_]", re.UNICODE)       # letters only (any script) - used by looks_like_prose()
_WORD_TOKENS = re.compile(r"[^\W\d_]+|\d+", re.UNICODE)  # letter-runs or digit-runs, used by looks_like_prose()
_MONTHS = {
    "january", "february", "march", "april", "may", "june", "july", "august", "september",
    "october", "november", "december",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
}


class OcrUnavailable(Exception):
    """pytesseract or the tesseract binary isn't installed. Caller should skip OCR for this run."""


def _engine():
    """Import pytesseract lazily so the whole pipeline still runs without it installed."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise OcrUnavailable(f"pytesseract/Pillow not installed: {exc}") from exc
    return pytesseract, Image


def clean_ocr_text(raw: str) -> str:
    """Tidy up tesseract's raw output: collapse repeated spaces/blank lines, drop empty lines."""
    lines = [ _WS.sub(" ", ln).strip() for ln in raw.splitlines() ]
    text = "\n".join(ln for ln in lines if ln)
    return _BLANKLINES.sub("\n\n", text).strip()


def looks_like_prose(text: str) -> bool:
    """A cheap sanity gate on tesseract's output, separate from the ocr_min_chars length check.

    A real printed headline/caption is mostly letters with occasional digits/punctuation. A bad OCR read
    off a low-text or non-text image (a chart screenshot, a logo, a calendar strip, a photo with sparse
    scattered captions) often comes back long enough to pass the length check while actually being noise -
    one real case this was written for looked exactly like "<All dates October 2026 November 2026 Utkal
    Speciality T 7 October 2026" and was used, unfixed, as a story's actual headline/body. None of these
    checks need a real language model - they're cheap structural signals a genuine sentence won't trip:

    1. date-token dominance - a run of text made mostly of month names and bare year/day numbers reads as
       a scraped calendar artifact, not a sentence about anything. A real headline often DOES mention a
       date, but as a minority of its words, not most of them.
    2. single-character "words" - stray OCR noise (a leftover punctuation mark misread as a letter) should
       be rare in real prose; a pile of them signals junk.
    3. letters should be the majority of non-whitespace characters overall - a pure number/punctuation dump
       skews the other way.
    4. the text should mostly be one flowing block, not a pile of very short fragment-lines (avg line
       under ~12 chars across 3+ lines) - the signature of OCR picking up scattered unrelated text.
    """
    stripped = text.strip()
    if not stripped:
        return False
    words = _WORD_TOKENS.findall(stripped)
    if len(words) >= 4:
        date_tokens = sum(1 for w in words if w.lower() in _MONTHS or (w.isdigit() and (len(w) == 4 or len(w) <= 2)))
        if date_tokens / len(words) > 0.45:
            return False
        singles = sum(1 for w in words if len(w) == 1)
        if singles / len(words) > 0.2:
            return False
    letters = len(_WORDCHARS.findall(stripped))
    non_space = len(re.sub(r"\s", "", stripped))
    if non_space and (letters / non_space) < 0.55:
        return False
    lines = [ln for ln in stripped.splitlines() if ln.strip()]
    if len(lines) >= 3 and (sum(len(ln) for ln in lines) / len(lines)) < 12:
        return False
    return True


def ocr_image_bytes(data: bytes, languages: str = "eng+hin") -> str:
    """Run tesseract OCR on raw image bytes and return cleaned text (empty string if nothing found)."""
    pytesseract, Image = _engine()
    with Image.open(io.BytesIO(data)) as im:
        im = im.convert("RGB")
        try:
            raw = pytesseract.image_to_string(im, lang=languages)
        except pytesseract.TesseractError:
            # A requested language pack (e.g. "hin") may not be installed on this runner - fall back
            # to English only rather than losing the post entirely.
            raw = pytesseract.image_to_string(im, lang="eng")
    return clean_ocr_text(raw)


def ocr_posts(posts: list[dict], settings: dict, http, log=lambda *a, **k: None) -> dict:
    """For posts with an image_url and little/no caption text, fill in post["text"] from OCR.

    posts: the list of post dicts collected this run (mutated in place - "text" and "ocr" keys are set
           on posts that get OCR'd; posts with existing real text, or no image, are left untouched).
    http:  the pipeline's own http_get(url) helper, reused so proxy/timeout/User-Agent handling stays
           in one place.
    Returns a small stats dict for logging. Never raises - any failure just means fewer posts get an
    OCR pass this run, same fallback behaviour as video_intel.py / image_intel.py.
    """
    stats = {"attempted": 0, "ok": 0, "empty": 0, "garbled": 0, "failed": 0, "skipped_no_tesseract": 0}
    if not settings.get("ocr_enabled", True):
        return stats
    min_chars = int(settings.get("ocr_min_chars", 20))
    languages = settings.get("ocr_languages", "eng+hin")
    budget = int(settings.get("ocr_max_per_run", 40))

    candidates = [p for p in posts if p.get("image_url") and len(p.get("text") or "") < min_chars]
    if not candidates:
        return stats

    try:
        _engine()  # fail fast once, with one clear log line, instead of once per image
    except OcrUnavailable as exc:
        log(f"  ! OCR: {exc} - image-only posts will be skipped. Add pytesseract+Pillow to requirements.txt "
            f"and 'tesseract-ocr tesseract-ocr-hin' to the CI runner to enable this.")
        stats["skipped_no_tesseract"] = len(candidates)
        return stats

    for p in candidates[:budget]:
        stats["attempted"] += 1
        try:
            r = http(p["image_url"])
            if r.status_code != 200 or not r.content:
                stats["failed"] += 1
                continue
            text = ocr_image_bytes(r.content, languages)
        except Exception as exc:  # noqa: BLE001 - OCR must never take the whole run down
            log(f"  ! OCR failed for {p.get('key', '?')}: {exc}")
            stats["failed"] += 1
            continue
        if len(text) < min_chars:
            stats["empty"] += 1
            continue
        if not looks_like_prose(text):
            # Long enough to pass the length check above, but doesn't read as real sentences - a date
            # strip, scattered watermark text, a chart screenshot's axis labels. Treated the same as "OCR
            # found nothing usable" (skip, don't use it as this post's text) rather than letting a human
            # reader see something like "<All dates October 2026 November 2026 ..." as a story's headline
            # or body - see looks_like_prose()'s own docstring for the real case this fixes.
            stats["garbled"] += 1
            continue
        # Keep any real caption the post already had (rare for image-only posts, but cheap to preserve)
        # ahead of the OCR text, clearly labelled, so the extraction model can tell them apart.
        existing = (p.get("text") or "").strip()
        p["text"] = (existing + "\n\n[Text read from image]\n" + text).strip() if existing else text
        p["ocr"] = True
        stats["ok"] += 1
    return stats


def check(settings: dict, log=lambda *a, **k: None) -> None:
    """Called by pipeline.py's 'check' command to report OCR readiness alongside the other integrations."""
    if not settings.get("ocr_enabled", True):
        log("Image OCR: disabled in settings")
        return
    try:
        _engine()
        log(f"Image OCR: pytesseract available (languages: {settings.get('ocr_languages', 'eng+hin')})")
    except OcrUnavailable as exc:
        log(f"Image OCR: NOT available - {exc}")
