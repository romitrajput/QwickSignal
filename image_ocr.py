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
    stats = {"attempted": 0, "ok": 0, "empty": 0, "failed": 0, "skipped_no_tesseract": 0}
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
