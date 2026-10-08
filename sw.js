/* Service worker: keeps the app working offline.
   Own files: network first (so updates arrive), cache as fallback.
   Libraries and fonts from a short list of hosts: cache first. Everything else is not touched. */
const VERSION = 'gni-phase3-55-v1';  // This round: rebuilt the bottom tab bar as 5 separate, directly-
                                      // tappable, always-visible tabs - Signals, Saved, Investment, Community,
                                      // Settings - replacing the old 3-tabs-plus-1-combined-mode-toggle layout.
                                      // The retired #modeSym button swapped between a Signal icon and a
                                      // candlestick icon via a two-tap arm/switch gesture (tap once to "arm" it,
                                      // tap again within 600ms to actually flip mode), sitting inside a
                                      // permanent filled red circle so it read as visually distinct from the
                                      // three plain icons around it - reported as confusing/hard to use ("this
                                      // doesn't look [right]"). Investment is now its own plain tab (setTab()
                                      // pins S.mode to match whichever of Signals/Investment is open, instead
                                      // of mode being a separate thing toggled by its own gesture), and
                                      // sentiment Pulse - previously a row inline inside each of Investment's
                                      // company story groups - moved to a brand-new dedicated Community tab:
                                      // one card per tracked company with its collective bull/bear crowd read
                                      // and vote buttons, listed whether or not that company has news today
                                      // (renderCommunity() in app.js). Settings' destinations list now always
                                      // shows both the News-channels and Investment-watchlist entries, rather
                                      // than only whichever one matched the old mode toggle's position.
                                      //
                                      // Previous round (gni-phase3-54-v1): four fixes - (1) redesigned sentiment
                                      // Pulse from PER STORY to PER COMPANY - voting on individual stories meant
                                      // a company with 3 separate news items could show 3 unrelated little polls
                                      // (e.g. Marico: 2 Bullish + 1 Bearish across 3 different headlines), which
                                      // looked like "the crowd can't make up its mind" when really it was just 3
                                      // different headlines each getting one honest reaction - not a real read
                                      // on the company at all. Voting became one Bullish/Bearish choice per
                                      // person per COMPANY (qs_pulse/qs_pulse_votes keyed by a slugified company
                                      // name, not a story id - see Pulse.companySlug()/firestore.rules).
                                      // (2) Fixed a real headline bug: image_ocr.py's "[Text read from image]"
                                      // marker line (prepended ahead of OCR text when a post already had a
                                      // short caption) could itself get picked as a story's headline by
                                      // pipeline.py's first_headline(), since at 23 characters it cleared the
                                      // "looks like a real line" bar on its own. first_headline() now skips
                                      // that exact marker line. Also added image_ocr.py's looks_like_prose()
                                      // gate so OCR output that's long enough to pass the length check but
                                      // reads as scattered noise (a calendar-strip artifact, not a sentence)
                                      // is rejected the same as "OCR found nothing usable," instead of
                                      // becoming a story's actual headline/body text.
                                      // (3) Removed the "Indian exchange data is end-of-day..." and "Wrong
                                      // listing? Click the ticker name..." hint text from the chart modal
                                      // (owner's call - no longer wanted in the app).
                                      //
                                      // Previous round (gni-phase3-53-v1): fixed a real "deployed but not showing up" bug - a tab
                                      // left open across a deploy (or even refreshed soon after one) could
                                      // keep running the OLD cached app.js for a long time with no sign
                                      // anything was wrong, because nothing ever forced a service-worker
                                      // update check or reloaded the page once a new one took over. This is
                                      // exactly why last round's Pulse feature looked completely missing
                                      // even once the right files were live on the server. app.js now calls
                                      // reg.update() right after registering (forces an immediate check
                                      // instead of waiting on the browser's own, much lazier timer) and
                                      // reloads the page exactly once when a new service worker actually
                                      // takes control (guarded so a brand-new visitor's first-ever load
                                      // never reloads, and so a tab can never loop). One-time catch-up for
                                      // anyone already stuck on an old cached version before this fix
                                      // shipped: a hard refresh (or closing every tab of the app and
                                      // reopening it) gets them unstuck; after this round, it should never
                                      // be necessary again.
                                      //
                                      // Previous round (gni-phase3-52-v1): Phase 1 sentiment pulse (Community feature) - a one-tap
                                      // bullish/bearish vote on Investment-mode, company-tagged stories. New
                                      // Pulse module in app.js reads the public qs_pulse/{storyId} aggregate
                                      // plus (if signed in) the caller's own qs_pulse_votes/{storyId_uid}
                                      // doc, and writes both together on vote() - create on a story's first
                                      // vote (Firestore's increment transform can't create a doc), increment
                                      // transform on every vote after that, with a switch (bull<->bear)
                                      // moving one vote between the two fields. Deliberately rendered ONLY
                                      // inside the expanded card details (pulseHTML() inside detailsHTML()),
                                      // never on every closed card - Investment mode can show 300+ cards at
                                      // once, and eagerly fetching a Firestore doc per card for a number most
                                      // people won't look at isn't worth the read cost; opening a card is
                                      // already the signal this one's worth a closer look. Voting requires
                                      // sign-in (openAuthGate, same pattern as tracking a company), so one
                                      // vote per person is a real server-enforced constraint, not a client
                                      // convention - see firestore.rules' qs_pulse/qs_pulse_votes rules.
                                      //
                                      // Previous round (gni-phase3-51-v1): unread stories now sort above read ones everywhere a
                                      // story list is shown (byPriority in app.js), including ABOVE
                                      // importance - a read Critical story sinks below an unread Low one,
                                      // not the reverse, since 300+ stories/day made "already read" the
                                      // thing worth getting out of the way first. The Country/Company
                                      // Status rings already worked this way (countryGroups()/
                                      // companyGroups() both had unread-first sorting from an earlier
                                      // round); this round is the main Signals/Investment list and each
                                      // Investment company's own story list catching up to match.
                                      // New in this round: a story can now become "read" just by being
                                      // scrolled past and dwelt on, not only by being tapped open - most
                                      // people skim headlines without opening every card, so requiring a
                                      // tap left "read" almost meaningless at this volume. See the new
                                      // SeenTracker block in app.js (seenArm/seenDisarm/seenObserveVisible)
                                      // for the mechanism: an IntersectionObserver watches for a card
                                      // sitting >=60% on-screen, gated on scroll having actually settled
                                      // (not mid-flick) for 1.5s running, before marking it reviewed.
                                      // Explicit product call: marking a card reviewed never re-sorts the
                                      // list immediately - that would shuffle cards under a scrolling
                                      // user's thumb. The reorder only shows up next time the list
                                      // naturally re-renders (pull-to-refresh, the 60s auto-poll, a tab
                                      // switch), same as how Country/Company Status already behaved.
                                      //
                                      // Previous round (gni-phase3-50-v1): removed "Deeper reading" entirely (owner's call - didn't
                                      // want to add a new search-provider key right now). Pulled
                                      // search_substack_articles()/write_longform_match()/find_deeper_reading()
                                      // from pipeline.py, the Longform module/deeperReadingHTML()/its card-open
                                      // fetch hookup from app.js, the qs_longform match block from
                                      // firestore.rules, the .deeper/.dr-* CSS from index.html, and
                                      // longform_importance/longform_monthly_query_budget from sources.yml and
                                      // DEFAULTS - no dead code or settings left behind referencing it. Story
                                      // threads (qs_archive, the Archive module) are untouched - that feature
                                      // doesn't use any search API and was explicitly kept. If this returns
                                      // later, see the git history around the Serper-then-Tavily switch for
                                      // the full design reasoning (no reliable Substack article-search API
                                      // exists, so it has to be a scoped live web search, not a curated feed).
                                      //
                                      // Previous round (gni-phase3-49-v1): two new features addressing a real gap - feed.json keeps
                                      // only 24h of stories (pipeline.py's prune() rewrites it every run), so
                                      // once a story aged out, there was no way to reconstruct "what happened
                                      // a few days ago" - the data was simply gone, for everyone, permanently.
                                      // (1) Story threads: the pipeline now writes a small permanent record
                                      // to a new qs_archive Firestore collection at the exact moment prune()
                                      // would otherwise discard a story (see write_archive() in pipeline.py).
                                      // A story's detail view (app.js's new Archive module) groups archived
                                      // stories sharing a company with the current one into a timeline - "part
                                      // of an ongoing situation" - computed client-side using the same
                                      // findCompanies() logic every item already uses, so there's one source
                                      // of truth for company matching rather than a second copy in Python.
                                      // Grouping-by-shared-company is a deliberate starting point, not a
                                      // finished algorithm - it'll over/under-group sometimes; refining it
                                      // needs real accumulated archive data to tune against. (2) Deeper
                                      // reading: the pipeline now runs a real web search (site:substack.com,
                                      // via Serper.dev - see find_deeper_reading() in pipeline.py) for every
                                      // genuinely new story and attaches the top 2 matching Substack articles
                                      // to a new qs_longform collection. This is a live search, not a curated
                                      // feed list, because Substack has no reliable way to search articles by
                                      // topic otherwise (its own search finds newsletters, not posts). Both
                                      // features are attached to a story's own detail view, not a new
                                      // standalone tab - deeper reading stays scoped to the specific story it
                                      // adds context to, keeping Signals the fast, scored feed it's meant to
                                      // be. Deeper reading is inert (skipped, logged once) until a
                                      // SERPER_API_KEY secret is added - nothing else depends on it running.
                                      // Also: fixed the ticket-attachment Firestore rules (qs_tickets) to
                                      // validate the base64 attachment_data/attachment_type/attachment_name
                                      // fields from the earlier Storage-to-base64 pivot, instead of the old
                                      // (now-removed) attachment_url field - this was a carried-over gap from
                                      // that round, not new this round.
                                      //
                                      // Previous round: moved Export out of the bottom tab bar entirely - it's an
                                      // occasional action (a few times a month, at most), not something checked
                                      // daily like Signals/Saved, so it no longer takes a permanent slot next to
                                      // controls people use constantly. It now lives as a destination inside
                                      // Settings (SETTINGS_SECTIONS in app.js), opened the same way as
                                      // Notifications/Get the app/Feedback - same settingspage markup, same
                                      // back button, same renderExport() populating #exportCount/#pdfBtn/#csvBtn
                                      // as before. The tab bar is now Signals/Saved/mode-switch/Settings (4
                                      // buttons instead of 5). The onboarding tour's old separate Export step
                                      // was folded into its Settings step, since both now point at the same
                                      // tab-bar button.
                                      //
                                      // Previous round, two fixes: (1) Onboarding walkthrough made noticeably
                                      // smaller (owner's explicit request) and expanded from 5 to 8 steps - it
                                      // now also covers the country-wise news cards, the search box, the
                                      // country/sector/priority filters, and a sample news card (tap/swipe), not
                                      // just the 4 tab-bar controls, and waits briefly for the live feed to load
                                      // before starting so those two new early steps have real content to point
                                      // at. (2) Investment-tab search "wasn't working": the matching/filtering
                                      // logic itself was already correct, but a company with stories that just
                                      // didn't match the search term showed the exact same "No recent news for
                                      // this company" text as a company with no stories at all - indistinguishable
                                      // from search having no effect. Now shows a distinct message
                                      // ("No stories match your search...") when a search is active and the
                                      // company does have stories, just none matching.
                                      //
                                      // Earlier round: a 5-step onboarding walkthrough (Onboarding module in app.js) shown
                                      // once per device right after the landing screen is dismissed (sign-in,
                                      // sign-up, Google, or guest) - a dark spotlight overlay pointing at the
                                      // real Signals/Saved/mode-switch/Export/Settings tab-bar controls in turn,
                                      // skippable at any point, never shown again once seen (qs-onboard-seen-v1
                                      // in localStorage). Addresses real feedback from an Instagram ad campaign
                                      // that new visitors didn't understand what the app does.
                                      //
                                      // Previous round: Feedback & support redesigned: Bug/Feedback only (Support dropped),
                                      // picking a bubble pre-fills the textarea with a literal "Bug: "/
                                      // "Feedback: " prefix the user types after (switching bubbles mid-draft
                                      // swaps just that prefix, keeping whatever was typed), an optional
                                      // attachment (uploads to Firebase Storage - see Tickets.uploadAttachment()
                                      // in app.js and the new storage.rules in the repo), "Send" renamed to
                                      // "Submit", and every ticket now gets a short reference number
                                      // (ticket_number, e.g. QS-7F3K-9XJ2) shown to the user on success and
                                      // tagged to their account (user_id) so the owner can tell who reported
                                      // what in the admin ticket list.
                                      //
                                      // Previous round: Investment-tab "No recent news" empty state now carries a short
                                      // reassuring second line (investNoNewsHint) explaining this updates
                                      // automatically rather than reading as a stuck/broken screen - a
                                      // stopgap while a separate pipeline.py fix (not cached by this service
                                      // worker - see that file's own changelog) backfills the `companies`
                                      // field the extraction step had been leaving empty almost always.
                                      //
                                      // Before that: Settings redesign (Option 2: drill-down list) and a News-feed card
                                      // refinement (Style A: priority chip), both picked from a set of
                                      // mockups generated for review. (1) Settings used to be one long
                                      // scroll of every block in a fixed order (Account, Get the app,
                                      // Notifications, Telegram channels, Investment watchlist, Sync,
                                      // Feedback, owner-only Tickets) - it's now a short list of destinations
                                      // (#settingsHome, built by renderSettingsNav() in app.js), each opening
                                      // its own sub-screen with a "< Settings" back button. Every existing
                                      // block kept its id and is still populated by exactly the same render
                                      // function as before (renderAccount(), renderChannels(),
                                      // renderInvestmentBox(), renderNotifBox(), renderGetApp(),
                                      // renderTicketBox(), renderTicketAdmin()), called from the same places
                                      // (setTab('settings'), setMode()'s mode-swap block) - only which
                                      // wrapper is visible changed, never how a block's content is produced.
                                      // The News-channels / Investment-watchlist destinations are mode-scoped
                                      // (SETTINGS_SECTIONS' own `mode` field), same split as the old
                                      // #settingsSignalGroup/#settingsInvestmentGroup it replaces. (2) Every
                                      // news card (Signals, Saved) already had a left accent border colored
                                      // by priority (.entry.imp-*) but never named the level in words - a
                                      // new small chip in the card footer (impChipHTML() in app.js) now
                                      // reads "●●● Critical" / "●● High" / "● Medium" / "Low" next to the
                                      // existing sources-count/relative-time metadata, using the same
                                      // IMP_VAR colors and wording already used elsewhere in the app (the
                                      // Signals priority-group headers, the importance bar) - a new
                                      // rendering of existing vocabulary, not a new taxonomy.
                                      //
                                      // Previous round's three fixes, still in effect, all on the #modeSym mode-switch button:
                                      // (1) BUG: a single tap on #modeSym switched mode immediately, so one
                                      // accidental tap (easy to land on, between Saved and Export in the tab
                                      // bar) could drop a visitor straight onto Investment mode's "Track
                                      // companies to see investment-related news / Add companies to track"
                                      // empty state with no warning - reported as an unwanted screen
                                      // appearing out of nowhere. Fixed by requiring two taps within 600ms
                                      // to actually switch (tryModeSwitch() in app.js): a lone first tap now
                                      // only "arms" the button (a brief ring-pulse so the tap still visibly
                                      // registers) and leaves mode untouched; a second tap within the window
                                      // completes the switch, same as before. (2) The button is now filled
                                      // with a light-red circle across the whole tab (not just a thin border
                                      // ring), with both the wifi and candlestick icons set to white so they
                                      // read clearly against it - previously a CSS specificity bug (the
                                      // shared .tabs button rule was more specific than a plain .modesym
                                      // rule and silently won) left the icon grey regardless of what was set;
                                      // fixed by keying the color/fill rules off #modeSym's id instead.
                                      //
                                      // Previous round's two fixes, still in effect:
                                      // (1) BUG: tracked companies (Investment watchlist) could vanish on a
                                      // fast tab/app switch. Sync.pushSoon() used to do nothing synchronous
                                      // at all - it only scheduled a 600ms-debounced network push, and the
                                      // local cache was only ever written inside that same debounced push,
                                      // and only for guests. Backgrounding the app inside that 600ms window
                                      // (common on mobile - timers on a backgrounded page are often paused
                                      // or the page discarded) meant the addition was never saved anywhere,
                                      // so the next load's Sync.init() restored the server's older,
                                      // company-less copy with no error shown. Fixed by writing the local
                                      // cache synchronously and unconditionally (both guest and signed-in)
                                      // on every pushSoon() call, before the debounced network push - the
                                      // cache Sync.init() reads first, before pull(), now always reflects
                                      // the latest in-memory state regardless of whether the network push
                                      // ever completes. (Also clears that cache on sign-out, so a second
                                      // account signing in on the same browser can't briefly see the first
                                      // account's cached watchlist before its own pull() lands.)
                                      // (2) BUG: articles saved under the Saved tab were disappearing after
                                      // roughly a day. Not a lifecycle-expiry bug (saved items were already
                                      // correctly exempted from that check) - loadLive() was unconditionally
                                      // replacing S.live with whatever feed.json's rolling window currently
                                      // contains, on every load and every ~2 minute auto-refresh, silently
                                      // dropping any saved story old enough to have scrolled out of that
                                      // upstream window. Fixed by carrying forward any saved story that's
                                      // present in the old S.live but missing from the new feed, instead of
                                      // letting the replacement discard it.
                                      // (3) The mode-switch button (#modeSym) is now filled with a reddish
                                      // tint across the whole tab, not just a thin border ring, so the
                                      // button itself reads as "the red one" at a glance rather than a grey
                                      // icon with a faint outline.
                                      //
                                      // Previous round's three fixes, still in effect:
                                      // (1) Company Status is back - Investment mode was missing its
                                      // equivalent of the News-mode country ring row entirely. Added
                                      // #companyStatus: one ring per tracked company (companyGroups()),
                                      // opening the SAME shared story viewer the country ring row uses
                                      // (generalized via S.cv.kind, with a round initial badge standing in
                                      // for the flag a company doesn't have). (2) The #modeSym button now
                                      // has a permanent reddish ring so it reads as different from the four
                                      // plain tab icons at rest, not just while mid-animation; and the
                                      // wifi-sweep/candle-tick animation no longer loops forever - it was
                                      // set to run "infinite" by mistake, so it now plays once per tap
                                      // (pulseModeSym() toggles a .pulse-once class for ~1s) and sits still
                                      // otherwise. (3) "Export report" was always exporting News-mode data
                                      // even while the user was in Investment mode - exportCSV()/exportPDF()
                                      // now read a new exportItems() that switches source by S.mode, so
                                      // Investment mode exports the stories matched to tracked companies
                                      // (titled "Investment Report" in the PDF, tagged -investment- in the
                                      // filename), and the Export tab's on-screen count is labeled
                                      // "(Investment)" to make the distinction visible before downloading.
                                      //
                                      // Previous round's changes, still in effect: the News/Investment mode
                                      // switch moved out of the Signals screen (the old #modeSeg segmented
                                      // control is gone) into the bottom tab bar; Saved and Settings split
                                      // their content by the same mode - Saved shows either saved news
                                      // stories or saved items tied to tracked companies; Settings shows
                                      // either the News Telegram-channel block or a separate Investment
                                      // block (watchlist + its own Telegram channels, kept apart from the
                                      // News channel list - a simple personal list, not the shared
                                      // owner-curated pool News channels use). The Investment tab's
                                      // per-company cards were restyled to match the round icon-chip look
                                      // of the News-mode country cards.
                                      //
                                      // Earlier round's changes, still in effect:
                                      // (1) The ticker-accuracy work continues:
                                      // guessSymbol() now checks a full BSE equity scrip lookup
                                      // (BSE_SCRIP_LOOKUP in app.js) - ~4,800 companies built from BSE's own
                                      // official master equity list (bseindia.com, user-supplied), not
                                      // guessed or scraped. Previously only ~115 companies had a verified
                                      // real ticker; every other BSE-listed company fell through to a
                                      // name-stripping guess that kept producing wrong/nonexistent symbols.
                                      // Tickers are derived with a confirmed, mechanical rule: TradingView
                                      // replaces any run of non-alphanumeric characters in BSE's raw Security
                                      // Id with a single underscore (BSE's own data says Mahindra & Mahindra's
                                      // Security Id is literally "M&M"; TradingView shows it as M_M -
                                      // confirmed directly against live TradingView pages). Two real bugs
                                      // caught while building this: "Jio Financial Services" (a real company
                                      // demerged from Reliance in 2023, ticker JIOFIN) was being swallowed by
                                      // the existing "Jio" alias's own partial match and incorrectly routed
                                      // to Reliance's ticker - now has its own entry. And the partial/
                                      // freehand-match fallback used to do a raw substring check, so short
                                      // real tickers that are also common English letter sequences (SIS, ANS,
                                      // REC - "Persistent" containing "sis" was an actual case this surfaced)
                                      // could misfire on totally unrelated input; it now matches whole words
                                      // only.
                                      //
                                      // (2) Removed the priority filter (All priorities/Critical/High/
                                      // Medium/Low dropdown) from Investment mode, at the user's request -
                                      // it's News-mode chrome that had no clear purpose once Investment mode
                                      // is already grouped by sector/company, and it's now hidden there (same
                                      // as the country/sector dropdowns already were) rather than left
                                      // showing with no visible way to tell it was still filtering stories.
                                      //
                                      // Bumped for the same reason as every prior bump - the service worker
                                      // caches index.html/app.js itself, so without a new VERSION an
                                      // already-installed visitor can keep seeing the old page. app.js is
                                      // also by far the largest it's been (BSE_SCRIP_LOOKUP alone is ~150KB
                                      // of data) - still well within normal PWA page-weight budgets and
                                      // cached once by this same service worker, not re-downloaded per visit.
const SHELL = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Real OS-level push notifications ("Waveform Arrival"), separate from the in-app toast in app.js (that one
   only shows while a tab is open). The pipeline (pipeline.py's send_push_notifications()) posts a Web Push
   message carrying one new story's id/flag/country/sector/headline after every publish; this is what actually
   turns that message into a notification the OS shows, even if no tab is open at all. */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { /* malformed payload: fall through to defaults below */ }
  const title = (data.flag ? data.flag + ' ' : '') + (data.country || 'QwickSignal');
  const body = data.headline || 'A new story just came in.';
  const id = data.id || '';
  e.waitUntil(self.registration.showNotification(title, {
    body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: id || 'qs-story',       // a second push for the same story replaces the first instead of stacking
    renotify: !!id,
    data: { id, kicker: data.sector ? (data.country || '') + ' · ' + data.sector : (data.country || '') }
  }));
});

// Tapping the notification: focus an already-open tab and hand it the story id to jump to, or open a fresh
// tab at #<id> which app.js reads on load (see the hashchange/DOMContentLoaded handling added there).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = (e.notification.data && e.notification.data.id) || '';
  e.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientsList) {
      if ('focus' in c) {
        await c.focus();
        if (id) c.postMessage({ type: 'qs-goto', id });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(id ? './#' + encodeURIComponent(id) : './');
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const LIBS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  if (!same && !LIBS.includes(url.hostname)) return; // live data (raw.githubusercontent.com) always goes to the network
  const keep = res => {
    if (res && (res.status === 200 || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  };
  if (same) {
    e.respondWith(fetch(req).then(keep).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(keep)));
  }
});
