#!/usr/bin/env python3
"""QwickSignal: headline images.

For an important, recent story, search Google's Custom Search JSON API for a real news photo and
attach the result to the story in feed.json, so the app can show it in the Country Story viewer
(and, later, elsewhere). This mirrors Phase 2.5's video intelligence (video_intel.py) on purpose -
same shape, same safety rules, same "never break the news feed" guarantee - just for a cheaper,
much more rate-limited API.

    news story  ->  search query (the headline)  ->  Google Image Search  ->  first usable result

How it is used
    python pipeline.py images       (pipeline.py calls enrich_feed() below)

Design rules (mirrored from video_intel.py's docstring)
    * Official API only (Google Custom Search JSON API). Nothing is scraped; the app just points an
      <img> tag at the URL Google's own index returned - QwickSignal never re-hosts anyone's photo.
    * The API key and Search Engine ID are read from the environment (GOOGLE_SEARCH_API_KEY,
      GOOGLE_SEARCH_CX) and never written to any file or log.
    * An image problem can never break the news feed: every failure in here is caught and logged,
      and the story simply keeps showing with no image, exactly like a story with no video.
    * The free tier is 100 queries/day - a much tighter budget than YouTube's 10,000 units/day, so
      Budget below defaults to a conservative daily cap with a safety margin, and only the most
      important, newest stories are searched first.
"""
from __future__ import annotations

import datetime as dt
import json
import time
from pathlib import Path

# Every value can be overridden under "settings:" in sources.yml.
DEFAULTS = {
    "image_enabled": True,                     # master switch (it also needs GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX)
    "image_importance": ["Critical", "High", "Medium", "Low"],  # every story is searched; image_daily_query_budget
                                                # (not this list) is what actually paces things within the free tier
    "image_max_age_hours": 36,                 # only stories newer than this get an image search
    "image_max_per_run": 8,                    # searches per pipeline run (cadence set by pipeline.yml's cron)
    "image_max_attempts": 3,                   # tries per story before giving up
    "image_retry_minutes": 180,                # wait between tries for a story with no match yet
    "image_daily_query_budget": 95,            # Google's free tier is 100/day; keep a small safety margin under it
    "image_time_budget_seconds": 60,           # stop searching after this long in one run
    "image_safe_search": "active",             # Google SafeSearch level for image results
}

CSE_API = "https://www.googleapis.com/customsearch/v1"
IMP_RANK = {"Critical": 3, "High": 2, "Medium": 1, "Low": 0}


class ImageError(Exception):
    """Base class: anything that goes wrong while looking for an image."""


class AuthError(ImageError):
    """The API key or Search Engine ID is missing, invalid, or not allowed. Stop for this run."""


class QuotaError(ImageError):
    """Daily query budget or rate limit reached. Stop and try again later."""


class TemporaryError(ImageError):
    """Network trouble or a timeout. Skip this story for now."""


# ----------------------------------------------------------------------------- small helpers
def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso(d: dt.datetime) -> str:
    return d.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_dt(s):
    if not s:
        return None
    try:
        return dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None


def redact(text, secrets=()) -> str:
    s = str(text)
    for sec in secrets:
        if sec:
            s = s.replace(sec, "***")
    return s


def image_none(attempts: int, now: dt.datetime) -> dict:
    return {"status": "none", "attempts": attempts + 1, "checked_at": iso(now)}


# ----------------------------------------------------------------------------- quota
class Budget:
    """Counts Custom Search queries per day and remembers a cool-down after a quota error. Lives in state.json,
    the exact same pattern as video_intel.py's Budget - just counting queries instead of YouTube units."""

    def __init__(self, store: dict, limit: int, now: dt.datetime):
        self.s, self.limit, self.now = store, int(limit), now
        day = now.strftime("%Y-%m-%d")
        if self.s.get("day") != day:
            self.s["day"], self.s["queries"] = day, 0

    @property
    def used(self) -> int:
        return int(self.s.get("queries", 0))

    def blocked(self) -> bool:
        until = parse_dt(self.s.get("blocked_until"))
        return bool(until and until > self.now)

    def spend(self, n: int = 1) -> None:
        if self.blocked():
            raise QuotaError("waiting after a quota error")
        if self.used + n > self.limit:
            raise QuotaError(f"daily budget of {self.limit} queries reached")
        self.s["queries"] = self.used + n

    def block(self, hours: float) -> None:
        self.s["blocked_until"] = iso(self.now + dt.timedelta(hours=hours))


# ----------------------------------------------------------------------------- Google Custom Search
def search_image(query: str, key: str, cx: str, http, budget: Budget, safe: str, timeout: int = 10):
    """Returns {"url", "source", "width", "height"} for the first usable result, or None if nothing fit."""
    budget.spend(1)
    try:
        r = http(CSE_API, params={
            "key": key, "cx": cx, "q": query, "searchType": "image", "num": 5,
            "safe": safe, "imgSize": "large",
        }, timeout=timeout)
    except Exception as exc:  # noqa: BLE001  (timeouts, DNS, TLS ... any network trouble)
        raise TemporaryError(redact(exc, [key, cx])) from None
    if r.status_code == 200:
        try:
            data = r.json()
        except ValueError:
            raise TemporaryError("Custom Search returned unreadable data") from None
        for it in (data.get("items") or []):
            link = it.get("link")
            if link and link.startswith("https://"):
                img = it.get("image") or {}
                return {"url": link, "source": it.get("displayLink") or "", "width": img.get("width"), "height": img.get("height")}
        return None
    reason = ""
    try:
        reason = ((r.json().get("error") or {}).get("errors") or [{}])[0].get("reason", "")
    except Exception:  # noqa: BLE001
        pass
    if r.status_code == 429 or reason in ("rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded", "quotaExceeded"):
        budget.block(8 if reason in ("dailyLimitExceeded", "quotaExceeded") else 1)
        raise QuotaError(f"Custom Search quota or rate limit ({reason or r.status_code})")
    if r.status_code in (400, 401, 403):
        raise AuthError(f"Custom Search rejected the request (HTTP {r.status_code} {reason})")
    raise TemporaryError(f"Custom Search HTTP {r.status_code} {reason}".strip())


# ----------------------------------------------------------------------------- main entry
def enrich_feed(feed: dict, state: dict, settings: dict, *, now: dt.datetime, http, env: dict, log=print) -> dict:
    """Attach a real news image to each important, recent story. Never raises: failures become a status,
    exactly like video_intel.enrich_feed()."""
    cfg = {**DEFAULTS, **{k: v for k, v in settings.items() if k in DEFAULTS}}
    stats = {"checked": 0, "found": 0, "none": 0, "queries": 0, "status": "ok", "changed": False}
    before_meta = json.dumps(feed.get("image_meta"), sort_keys=True)

    def finish(status: str) -> dict:
        stats["status"] = status
        feed["image_meta"] = {"enabled": status in ("ok", "quota"), "status": status, "importance": list(cfg["image_importance"])}
        stats["changed"] = stats["changed"] or json.dumps(feed["image_meta"], sort_keys=True) != before_meta
        return stats

    key = (env.get("GOOGLE_SEARCH_API_KEY") or "").strip()
    cx = (env.get("GOOGLE_SEARCH_CX") or "").strip()
    secrets = [key, cx]
    try:
        if not cfg["image_enabled"]:
            log("Image search: switched off (image_enabled: false).")
            return finish("disabled")
        if not key or not cx:
            log("Image search: no GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_CX, so stories keep working without images. See .env.example.")
            return finish("no_key")

        istate = state.setdefault("image", {})
        budget = Budget(istate, cfg["image_daily_query_budget"], now)
        units_at_start = budget.used

        items = feed.get("items", [])
        max_age = dt.timedelta(hours=float(cfg["image_max_age_hours"]))
        recent = [i for i in items if (now - (parse_dt(i.get("published")) or parse_dt(i.get("updated")) or now)) <= max_age]

        want = set(cfg["image_importance"])
        retry = dt.timedelta(minutes=float(cfg["image_retry_minutes"]))
        queue = []
        for i in recent:
            if i.get("importance") not in want:
                continue
            im = i.get("image") or {}
            if im.get("status") == "found":
                continue
            if im.get("status") == "none":
                if int(im.get("attempts", 0)) >= int(cfg["image_max_attempts"]) or now - (parse_dt(im.get("checked_at")) or now - retry * 2) < retry:
                    continue
            queue.append((IMP_RANK.get(i.get("importance"), 0), parse_dt(i.get("published")) or now, i))
        queue.sort(key=lambda q: (-q[0], -q[1].timestamp()))

        t0 = time.monotonic()
        for _, _, item in queue[: int(cfg["image_max_per_run"])]:
            if time.monotonic() - t0 > float(cfg["image_time_budget_seconds"]):
                log("  time budget for this run reached")
                break
            stats["checked"] += 1
            attempts = int((item.get("image") or {}).get("attempts", 0))
            try:
                result = search_image(item.get("headline", ""), key, cx, http, budget, cfg["image_safe_search"])
                if result:
                    item["image"] = {**result, "status": "found", "checked_at": iso(now)}
                    stats["found"] += 1
                else:
                    item["image"] = image_none(attempts, now)
                    stats["none"] += 1
                stats["changed"] = True
            except (QuotaError, AuthError) as exc:
                log(f"  image search stopped: {redact(exc, secrets)}")
                stats["queries"] = budget.used - units_at_start
                return finish("quota" if isinstance(exc, QuotaError) else "no_key")
            except TemporaryError as exc:
                log(f"  {item.get('id', '?')}: temporary problem, will retry ({redact(exc, secrets)})")
        stats["queries"] = budget.used - units_at_start
        return finish("ok")
    except Exception as exc:  # noqa: BLE001
        log(f"Image search skipped: {redact(exc, secrets)}. The news feed is unaffected.")
        return finish("error")


def check(env: dict, log=print) -> None:
    """Lines for `python pipeline.py check`. Does not spend any of the daily query budget - the free tier
    (100/day) is tight enough that a health check shouldn't eat into it."""
    key = (env.get("GOOGLE_SEARCH_API_KEY") or "").strip()
    cx = (env.get("GOOGLE_SEARCH_CX") or "").strip()
    log(f"Image search: GOOGLE_SEARCH_API_KEY {'found' if key else 'NOT set'}, GOOGLE_SEARCH_CX {'found' if cx else 'NOT set'} "
        f"({'images stay off, everything else works' if not (key and cx) else 'ready'})")
