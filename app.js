/* Global News Intelligence, Phase 1
   Everything runs in the browser. No accounts, no server, no AI calls.
   Part 1: the engine (pure logic). Part 2: the interface. */
'use strict';

const Engine = (function () {
  /* ---------- text helpers ---------- */
  const STOP = new Set(('a an the and or but if then of to in on at by for with from as is are was were be been being it its ' +
    'this that these those he she they we you i not no nor so than too very can will would could should may might must has have ' +
    'had do does did done into over under about after before during between against per via also more most other such only own ' +
    'same just up down out off again further once here there when where why how all any both each few some what which who whom ' +
    'said says say new one two mr mrs ms dr according reported report reports today yesterday tomorrow week month year years ' +
    'while amid however their them his her our your than then still even much many made make makes').split(' '));

  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reCache = new Map();

  // Keyword syntax: "chip" (plural allowed), "sanction*" (wildcard), "cs:AI" (case-sensitive)
  function rx(term) {
    if (reCache.has(term)) return reCache.get(term);
    let t = term, cs = false;
    if (t.startsWith('cs:')) { cs = true; t = t.slice(3); }
    let body = escRe(t).replace(/\\\*/g, '[A-Za-z0-9]*').replace(/\s+/g, '\\s+');
    if (!cs && !t.includes('*') && /^[a-z][a-z &-]*[a-z]$/i.test(t)) body += '(?:s|es)?';
    const re = new RegExp('(?<![A-Za-z0-9_])' + body + '(?![A-Za-z0-9_])', cs ? 'g' : 'gi');
    reCache.set(term, re);
    return re;
  }
  const count = (text, term) => (text.match(rx(term)) || []).length;

  function stem(t) {
    t = t.replace(/'s$/, '').replace(/\./g, '');
    if (t.length > 5) {
      if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
      if (t.endsWith('ing')) return t.slice(0, -3);
      if (t.endsWith('ed')) return t.slice(0, -2);
      if (t.endsWith('es')) return t.slice(0, -2);
    }
    if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
    return t;
  }
  function tokens(str) {
    const m = str.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+(?:[.'][a-z0-9]+)*/g) || [];
    return m.map(stem).filter(t => t.length > 2 && !STOP.has(t));
  }
  function topTerms(toks, n) {
    const f = new Map();
    toks.forEach((t, i) => { const e = f.get(t); if (e) e.c++; else f.set(t, { c: 1, i }); });
    return [...f.entries()].sort((a, b) => b[1].c - a[1].c || a[1].i - b[1].i).slice(0, n).map(e => e[0]);
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  /* ---------- countries ---------- */
  // code | name | aliases (cs: = case-sensitive)
  const COUNTRY_ROWS = [
    'US|United States|United States|cs:US|cs:U.S.|USA|America|American|Americans|Washington|White House|Federal Reserve|FOMC|cs:Fed|Pentagon|Wall Street|Nasdaq|S&P 500|Dow Jones|Capitol Hill|US Treasury|Treasury Department',
    'CN|China|China|Chinese|Beijing|PBOC|People\'s Bank of China|Shanghai|Shenzhen|Xi Jinping|Yuan|Renminbi|Guangdong|CSRC',
    'IN|India|India|Indian|Indians|New Delhi|Delhi|Mumbai|RBI|Reserve Bank of India|SEBI|Sensex|Nifty|Rupee|NITI Aayog|Lok Sabha|Modi|Bengaluru|Bangalore|Chennai|Hyderabad|Gujarat|Maharashtra',
    'RU|Russia|Russia|Russian|Moscow|Kremlin|Putin|Rouble|Ruble',
    'UA|Ukraine|Ukraine|Ukrainian|Kyiv|Kiev|Zelensky|Zelenskyy|Donbas|Crimea',
    'JP|Japan|Japan|Japanese|Tokyo|Bank of Japan|cs:BOJ|Nikkei|Yen|Osaka',
    'DE|Germany|Germany|German|Berlin|Bundesbank|DAX|Frankfurt|Bavaria',
    'FR|France|France|French|Paris|Macron|Elysee',
    'GB|United Kingdom|United Kingdom|cs:UK|cs:U.K.|Britain|British|London|Bank of England|cs:BoE|FTSE|Sterling|Downing Street|England|Scotland',
    'IT|Italy|Italy|Italian|Rome|Milan',
    'ES|Spain|Spain|Spanish|Madrid',
    'NL|Netherlands|Netherlands|Dutch|Amsterdam|The Hague',
    'CH|Switzerland|Switzerland|Swiss|Zurich|Geneva',
    'SE|Sweden|Sweden|Swedish|Stockholm',
    'NO|Norway|Norway|Norwegian|Oslo',
    'DK|Denmark|Denmark|Danish|Copenhagen',
    'PL|Poland|Poland|Polish|Warsaw',
    'IE|Ireland|Ireland|Irish|Dublin',
    'GR|Greece|Greece|Greek|Athens',
    'TR|Turkey|Turkey|Turkish|Turkiye|Ankara|Istanbul',
    'EU|European Union|European Union|cs:EU|Eurozone|Euro area|Brussels|European Commission|European Parliament|ECB|European Central Bank',
    'CA|Canada|Canada|Canadian|Ottawa|Toronto|Bank of Canada',
    'MX|Mexico|Mexico|Mexican|Mexico City|Banxico',
    'BR|Brazil|Brazil|Brazilian|Brasilia|Sao Paulo',
    'AR|Argentina|Argentina|Argentine|Buenos Aires',
    'CL|Chile|Chile|Chilean|Santiago',
    'PE|Peru|Peru|Peruvian|Lima',
    'CO|Colombia|Colombia|Colombian|Bogota',
    'VE|Venezuela|Venezuela|Venezuelan|Caracas',
    'AU|Australia|Australia|Australian|Canberra|Sydney|Melbourne|cs:RBA',
    'NZ|New Zealand|New Zealand|Wellington|Auckland',
    'KR|South Korea|South Korea|South Korean|Seoul|KOSPI',
    'KP|North Korea|North Korea|North Korean|Pyongyang',
    'TW|Taiwan|Taiwan|Taiwanese|Taipei',
    'SG|Singapore|Singapore|Singaporean',
    'ID|Indonesia|Indonesia|Indonesian|Jakarta',
    'MY|Malaysia|Malaysia|Malaysian|Kuala Lumpur',
    'TH|Thailand|Thailand|Thai|Bangkok',
    'VN|Vietnam|Vietnam|Vietnamese|Hanoi',
    'PH|Philippines|Philippines|Philippine|Filipino|Manila',
    'PK|Pakistan|Pakistan|Pakistani|Islamabad|Karachi',
    'BD|Bangladesh|Bangladesh|Bangladeshi|Dhaka',
    'LK|Sri Lanka|Sri Lanka|Sri Lankan|Colombo',
    'NP|Nepal|Nepal|Nepali|Kathmandu',
    'AF|Afghanistan|Afghanistan|Afghan|Kabul|Taliban',
    'MM|Myanmar|Myanmar|Burma|Burmese|Yangon',
    'IR|Iran|Iran|Iranian|Tehran',
    'IQ|Iraq|Iraq|Iraqi|Baghdad',
    'IL|Israel|Israel|Israeli|Tel Aviv|Jerusalem|Knesset|cs:IDF',
    'PS|Palestine|Gaza|Palestinian|Palestinians|Palestine|West Bank|Hamas',
    'LB|Lebanon|Lebanon|Lebanese|Beirut|Hezbollah',
    'SY|Syria|Syria|Syrian|Damascus',
    'YE|Yemen|Yemen|Yemeni|Houthi|Houthis',
    'SA|Saudi Arabia|Saudi Arabia|Saudi|Riyadh',
    'AE|UAE|United Arab Emirates|cs:UAE|Dubai|Abu Dhabi|Emirati',
    'QA|Qatar|Qatar|Qatari|Doha',
    'KW|Kuwait|Kuwait|Kuwaiti',
    'OM|Oman|Oman|Omani|Muscat',
    'EG|Egypt|Egypt|Egyptian|Cairo|Suez',
    'ZA|South Africa|South Africa|South African|Johannesburg|Pretoria',
    'NG|Nigeria|Nigeria|Nigerian|Lagos|Abuja',
    'KE|Kenya|Kenya|Kenyan|Nairobi',
    'ET|Ethiopia|Ethiopia|Ethiopian|Addis Ababa',
    'GH|Ghana|Ghana|Ghanaian|Accra',
    'MA|Morocco|Morocco|Moroccan|Rabat',
    'DZ|Algeria|Algeria|Algerian|Algiers',
    'LY|Libya|Libya|Libyan|Tripoli',
    'CD|DR Congo|Democratic Republic of Congo|DR Congo|cs:DRC|Kinshasa'
  ];
  const COUNTRIES = COUNTRY_ROWS.map(r => {
    const p = r.split('|');
    return { code: p[0], name: p[1], aliases: p.slice(2) };
  });
  const COUNTRY_BY_NAME = Object.fromEntries(COUNTRIES.map(c => [c.name, c]));
  COUNTRY_BY_NAME['Global'] = { code: 'GL', name: 'Global', aliases: [] };
  const COUNTRY_NAMES = ['Global'].concat(COUNTRIES.map(c => c.name).sort());

  function flag(code) {
    if (!code || code === 'GL' || code.length !== 2) return '\u{1F310}';
    return String.fromCodePoint(...[...code.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0)));
  }

  const GLOBAL_CUES = ['global', 'globally', 'worldwide', 'world economy', 'across the world', 'around the world',
    'world trade', 'international markets', 'OPEC', 'IMF', 'World Bank', 'WTO', 'G20', 'G7', 'oil prices', 'shipping rates'];

  /* ---------- companies (name | home country code | sector | extra aliases | real BSE ticker) ----------
     The 5th field is a VERIFIED real ticker (as it appears on TradingView's BSE listing, e.g. BSE:TICKER),
     used instead of guessSymbol()'s name-stripping guess whenever present - added after two real bugs this
     stripping produced: "Reliance Industries" guessed as the 12-char-truncated RELIANCEINDU (real ticker:
     RELIANCE) and "Maruti" fell through to a NASDAQ default entirely (see guessSymbol()'s comments). Every
     Indian (IN) entry below now carries one, each checked individually against a live TradingView symbol
     page before being added - including catching that Tata Motors' own ticker changed from the once-correct
     TATAMOTORS to TMPV after a 2025 demerger, and that BSE spells Mahindra & Mahindra's ticker M_M (not M&M -
     that's the NSE spelling). Non-Indian entries don't have one yet - guessSymbol()'s plain heuristic is
     right often enough for short single-word Western names (AAPL, TSLA-style) that it wasn't worth claiming
     verification this pass didn't actually do; add one here, the same way, if a specific one turns out wrong. */
  const COMPANY_ROWS = [
    'Tata Motors|IN|Automotive||TMPV', 'Maruti Suzuki|IN|Automotive|Maruti|MARUTI', 'Mahindra & Mahindra|IN|Automotive|Mahindra;M&M|M_M', 'Ashok Leyland|IN|Automotive||ASHOKLEY',
    'Bajaj Auto|IN|Automotive||BAJAJ_AUTO', 'Tata Steel|IN|Metals & Mining||TATASTEEL', 'JSW Steel|IN|Metals & Mining||JSWSTEEL', 'Hindalco|IN|Metals & Mining||HINDALCO',
    'Reliance Industries|IN|Energy|Reliance;RIL|RELIANCE', 'Infosys|IN|Technology||INFY', 'Tata Consultancy Services|IN|Technology|TCS|TCS', 'Wipro|IN|Technology||WIPRO',
    'HCLTech|IN|Technology|HCL|HCLTECH', 'HDFC Bank|IN|Banking||HDFCBANK', 'ICICI Bank|IN|Banking||ICICIBANK', 'State Bank of India|IN|Banking|SBI|SBIN',
    // "Adani" isn't one stock - the Adani Group has ~8 separately-listed companies (Adani Enterprises, Adani
    // Ports, Adani Green, Adani Power, ...), each with its own ticker and price, so there's no single symbol
    // this freehand name could correctly mean. Pointed at the flagship/most commonly meant entity (Adani
    // Enterprises) rather than left to guess a fabricated "BSE:ADANI" that doesn't exist - the chart modal's
    // existing "wrong listing? search" hint is the real correction path if a different Adani entity is meant.
    // The other Adani Group entities are listed in their own right below, each with its own real ticker, so
    // typing the specific name (e.g. "Adani Ports") no longer falls through to this flagship default either.
    'Adani|IN|Infrastructure||ADANIENT',
    'Adani Enterprises|IN|Infrastructure||ADANIENT', 'Adani Ports|IN|Infrastructure|Adani Ports and SEZ;APSEZ|ADANIPORTS',
    'Adani Green Energy|IN|Energy|Adani Green;AGEL|ADANIGREEN', 'Adani Power|IN|Energy||ADANIPOWER',
    // BSE's own listing still shows the legacy "Adani Gas" company name even though the group rebranded this
    // entity "Adani Total Gas" after Total Energies took a stake - ATGL is the current ticker either way.
    'Adani Total Gas|IN|Energy|Adani Gas;ATGL|ATGL',
    'Bharti Airtel|IN|Telecom|Airtel|BHARTIARTL',
    // "Jio" has no listed stock of its own to point at - Reliance Jio Infocomm is a subsidiary of Reliance
    // Industries, so the only real, currently tradable listing behind the bare name "Jio" is its parent,
    // Reliance - same RELIANCE ticker as the Reliance Industries entry above. Previously this guessed a
    // fabricated "BSE:JIO" that doesn't exist.
    'Jio|IN|Telecom||RELIANCE',
    // Jio Financial Services is DIFFERENT from the above - a real, separately-listed company (demerged from
    // Reliance Industries in 2023, verified against BSE's own master list: ticker JIOFIN). This needs its
    // own explicit entry, not just reliance on the broad BSE_SCRIP_LOOKUP table, because without it the
    // "Jio" entry's own alias/partial-match fallback would catch "Jio Financial Services" first (it
    // contains "jio") and incorrectly route it to Reliance's ticker before ever reaching the broad lookup -
    // a real bug caught while adding this entry, not a hypothetical one.
    'Jio Financial Services|IN|Telecom||JIOFIN',
    // ---- Banking & Financial Services (verified against BSE/TradingView symbol pages) ----
    'Kotak Mahindra Bank|IN|Banking|Kotak|KOTAKBANK', 'Axis Bank|IN|Banking|Axis|AXISBANK',
    'Bajaj Finance|IN|Banking||BAJFINANCE', 'Bajaj Finserv|IN|Banking||BAJAJFINSV',
    'IndusInd Bank|IN|Banking|IndusInd|INDUSINDBK', 'Punjab National Bank|IN|Banking|PNB|PNB',
    'Bank of Baroda|IN|Banking|BoB;BOB|BANKBARODA', 'HDFC Life Insurance|IN|Banking|HDFC Life|HDFCLIFE',
    'SBI Life Insurance|IN|Banking|SBI Life|SBILIFE',
    // Ticker is LICI, not "LIC" - easy to get wrong since everyone just calls it LIC.
    'Life Insurance Corporation|IN|Banking|LIC;LIC India|LICI',
    // ---- IT / Technology ----
    'Tech Mahindra|IN|Technology|Tech M|TECHM',
    // Formerly two separate companies (L&T Infotech + Mindtree) that merged - "Mindtree" alias covers users
    // still searching the pre-merger name.
    'LTIMindtree|IN|Technology|LTI Mindtree;Mindtree|LTIM',
    'Persistent Systems|IN|Technology|Persistent|PERSISTENT', 'Mphasis|IN|Technology||MPHASIS',
    // ---- FMCG / Consumer ----
    'Hindustan Unilever|IN|Consumer|HUL;Unilever India|HINDUNILVR', 'ITC|IN|Consumer||ITC',
    'Nestle India|IN|Consumer|Nestle|NESTLEIND', 'Britannia|IN|Consumer||BRITANNIA', 'Dabur|IN|Consumer||DABUR',
    'Godrej Consumer Products|IN|Consumer|GCPL;Godrej Consumer|GODREJCP', 'Marico|IN|Consumer||MARICO',
    // Formerly Tata Tea - kept as an alias since the ticker/root name predates the current brand.
    'Tata Consumer Products|IN|Consumer|Tata Consumer;Tata Tea|TATACONSUM',
    'Asian Paints|IN|Consumer||ASIANPAINT',
    // ---- Pharmaceuticals / Healthcare ----
    'Sun Pharma|IN|Pharmaceuticals|Sun Pharmaceutical|SUNPHARMA', 'Dr Reddys Laboratories|IN|Pharmaceuticals|Dr Reddy;DRL|DRREDDY',
    'Cipla|IN|Pharmaceuticals||CIPLA', 'Divis Laboratories|IN|Pharmaceuticals|Divis;Divi’s Lab|DIVISLAB',
    'Apollo Hospitals|IN|Healthcare|Apollo|APOLLOHOSP', 'Lupin|IN|Pharmaceuticals||LUPIN',
    // Ticker is the abbreviated AUROPHARMA, not the full squashed name.
    'Aurobindo Pharma|IN|Pharmaceuticals|Aurobindo|AUROPHARMA',
    // Formerly Cadila Healthcare - alias covers the pre-rename name some users still search.
    'Zydus Lifesciences|IN|Pharmaceuticals|Zydus;Cadila|ZYDUSLIFE',
    // ---- Energy / Oil & Gas / Power ----
    'ONGC|IN|Energy|Oil and Natural Gas Corporation|ONGC', 'Indian Oil Corporation|IN|Energy|IOC;IOCL|IOC',
    'Bharat Petroleum|IN|Energy|BPCL|BPCL', 'NTPC|IN|Energy||NTPC',
    'Power Grid Corporation|IN|Energy|Power Grid;PGCIL|POWERGRID', 'Coal India|IN|Energy|CIL|COALINDIA',
    // ---- Auto (additional) ----
    'Eicher Motors|IN|Automotive|Eicher;Royal Enfield|EICHERMOT', 'TVS Motor|IN|Automotive|TVS|TVSMOTOR',
    // Ticker is truncated HEROMOTOCO, missing the final "RP" you'd expect from the full name.
    'Hero MotoCorp|IN|Automotive|Hero|HEROMOTOCO', 'Bosch|IN|Automotive|Bosch India|BOSCHLTD',
    // Formerly Motherson Sumi Systems - ticker stayed the single word MOTHERSON (no "Samvardhana" prefix)
    // through the 2022 corporate restructuring/rename.
    'Samvardhana Motherson|IN|Automotive|Motherson;Motherson Sumi|MOTHERSON',
    // ---- Metals & Mining (additional) ----
    // Ticker is VEDL, not the squashed full name "VEDANTA".
    'Vedanta|IN|Metals & Mining||VEDL', 'Jindal Steel and Power|IN|Metals & Mining|Jindal Steel;JSPL|JINDALSTEL',
    'SAIL|IN|Metals & Mining|Steel Authority of India|SAIL', 'NMDC|IN|Metals & Mining||NMDC',
    // ---- Telecom / Media ----
    // Ticker is the short IDEA, kept from the pre-merger Idea Cellular name.
    'Vodafone Idea|IN|Telecom|Vi;Vodafone|IDEA', 'Zee Entertainment|IN|Telecom|Zee;ZEEL|ZEEL',
    // ---- Conglomerates / Infrastructure / Realty ----
    // Ticker is the bare two-letter LT (not "L_T" the way M&M uses an underscore) - a short root like this is
    // exactly the kind of ticker the partial-match fallback in guessSymbol() could mis-trigger on unrelated
    // input, so matching here relies on the exact-name/alias check winning first.
    'Larsen and Toubro|IN|Infrastructure|L&T;LT|LT',
    'UltraTech Cement|IN|Infrastructure|UltraTech|ULTRACEMCO', 'Grasim Industries|IN|Infrastructure|Grasim|GRASIM',
    'DLF|IN|Infrastructure||DLF', 'Godrej Properties|IN|Infrastructure||GODREJPROP',
    'Ambuja Cements|IN|Infrastructure|Ambuja|AMBUJACEM', 'ACC|IN|Infrastructure||ACC',
    // US companies: exchange defaults to NASDAQ (EXCHANGE_BY_COUNTRY's US entry) which is right for most of
    // these - Apple, Microsoft, Alphabet, Amazon, Meta, Nvidia, Tesla, and the semiconductor names (Intel
    // through KLA) are all genuinely NASDAQ-listed, individually confirmed. But that default is WRONG for
    // the older industrial/financial/energy names below - each is actually NYSE-listed, confirmed against
    // TradingView's own symbol pages, so each gets an explicit exchange override (field 6) rather than
    // silently guessing a nonexistent NASDAQ:XOM-style symbol the same way "JPMorgan" was before this fix.
    'Apple|US|Technology', 'Microsoft|US|Technology', 'Alphabet|US|Technology|Google',
    'Amazon|US|Consumer', 'Meta|US|Technology', 'Nvidia|US|Semiconductors', 'Tesla|US|Automotive', 'Intel|US|Semiconductors',
    'AMD|US|Semiconductors', 'Micron|US|Semiconductors', 'Qualcomm|US|Semiconductors', 'Broadcom|US|Semiconductors',
    'Applied Materials|US|Semiconductors', 'Lam Research|US|Semiconductors', 'KLA|US|Semiconductors',
    'Boeing|US|Aerospace||BA|NYSE', 'Ford|US|Automotive||F|NYSE', 'General Motors|US|Automotive||GM|NYSE',
    'ExxonMobil|US|Energy|Exxon|XOM|NYSE', 'Chevron|US|Energy||CVX|NYSE', 'JPMorgan|US|Banking||JPM|NYSE',
    'Goldman Sachs|US|Finance||GS|NYSE', 'Pfizer|US|Pharmaceuticals||PFE|NYSE',
    // OpenAI is NOT publicly traded as of this check (no IPO yet - what shows up searching for it is pages
    // describing an upcoming/rumored listing, not a live one), so there is no real ticker to point this at.
    // Left without one deliberately rather than invent a placeholder - guessSymbol() falls back to its
    // generic guess (NASDAQ:OPENAI), which won't resolve to a real chart; that's an honest "we don't have
    // this yet" rather than a wrong answer dressed up as a right one.
    'OpenAI|US|Technology',
    // ASML trades as a US-listed ADR on NASDAQ, not on its home Euronext market the way NL normally maps -
    // explicit override for the same reason as the NYSE names above.
    'ASML|NL|Semiconductors||ASML|NASDAQ', 'TSMC|TW|Semiconductors',
    'Samsung|KR|Technology', 'SK Hynix|KR|Semiconductors', 'Hyundai|KR|Automotive', 'Toyota|JP|Automotive', 'Honda|JP|Automotive',
    'Nissan|JP|Automotive', 'Sony|JP|Technology', 'Tokyo Electron|JP|Semiconductors', 'SoftBank|JP|Finance', 'BYD|CN|Automotive',
    'Huawei|CN|Technology', 'Alibaba|CN|Consumer', 'Tencent|CN|Technology', 'CATL|CN|Automotive', 'SMIC|CN|Semiconductors',
    'Xiaomi|CN|Technology', 'Volkswagen|DE|Automotive', 'BMW|DE|Automotive', 'Siemens|DE|Manufacturing', 'Bosch|DE|Automotive',
    'Mercedes-Benz|DE|Automotive', 'Stellantis|NL|Automotive', 'Airbus|FR|Aerospace', 'Saudi Aramco|SA|Energy|Aramco', 'Gazprom|RU|Energy',
    'Shell|GB|Energy', 'BP|GB|Energy', 'Rio Tinto|GB|Metals & Mining', 'BHP|AU|Metals & Mining', 'Glencore|CH|Metals & Mining',
    'Vale|BR|Metals & Mining', 'Nestle|CH|Consumer', 'Unilever|GB|Consumer', 'Novo Nordisk|DK|Pharmaceuticals', 'Novartis|CH|Pharmaceuticals',
    'Roche|CH|Pharmaceuticals'
  ];
  const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map(c => [c.code, c.name]));
  const COMPANIES = COMPANY_ROWS.map(r => {
    const p = r.split('|');
    // 6th field (p[5]): explicit exchange override - e.g. "NYSE" for US names that are NYSE-listed, not
    // NASDAQ (the EXCHANGE_BY_COUNTRY default for US). Only a handful of entries carry this; everyone else
    // falls back to EXCHANGE_BY_COUNTRY[code] in guessSymbol() as before.
    return { name: p[0], code: p[1], sector: p[2], aliases: [p[0]].concat(p[3] ? p[3].split(';') : []), ticker: p[4] || null, exchange: p[5] || null };
  });
  // Self-check, runs once at load: flags in the console (never to the user - this is a dev signal, not a
  // user-facing error) any IN company in COMPANY_ROWS still missing a verified ticker (field 5). This is the
  // guard against the exact class of bug "Reliance Industries" and "Maruti" both were - guessSymbol()'s
  // name-stripping guess silently producing a wrong or nonexistent symbol for a company this app already
  // knows about. New IN entries get caught here automatically instead of only after a user hits the bug
  // live. Not extended to non-IN companies yet (see COMPANY_ROWS' comment on why) - add the same check for
  // those here if/when they get verified tickers too, rather than leaving it IN-only indefinitely.
  (function checkCompanyTickers() {
    const missing = COMPANIES.filter(c => c.code === 'IN' && !c.ticker).map(c => c.name);
    if (missing.length) {
      console.warn('[QwickSignal] IN compan' + (missing.length === 1 ? 'y' : 'ies') + ' without a verified '
        + 'BSE ticker (View Chart will fall back to a name-stripping guess, which has produced wrong/'
        + 'nonexistent symbols before - see guessSymbol()): ' + missing.join(', '));
    }
  })();

  /* ---------- ticker guessing (View Chart, Investment tab) ----------
     No hand-maintained ticker list: instead, guessSymbol() below makes a best-effort guess straight from
     the company's name (and, where it helps, its home country from COMPANIES) and hands that to
     TradingView's Advanced Chart widget as the opening symbol. If the guess is wrong, the widget's own
     built-in symbol search (click the ticker name at the top-left of the chart - a standard feature of
     every TradingView embed) lets the user correct it in one click, right there, without leaving the chart.
     This covers every tracked company, known or freehand, with nothing to keep updated on this end.

     IN -> BSE, not NSE: confirmed via TradingView's own widget-docs Data FAQ and their Available Markets
     list that NSE isn't among the exchanges TradingView is licensed to show in the free embeddable widget
     AT ALL (any plan, any timeframe - "This symbol is only available on TradingView"), which is exactly the
     dialog this was hitting for every Indian stock. BSE IS on that list and uses the same plain-ticker
     format as NSE (BSE:TATAMOTORS, BSE:HDFCBANK, ...) so guessSymbol()'s existing ticker-guessing logic
     below needs no change - only this exchange prefix. The one real trade-off: BSE data in the free widget
     is end-of-day only (no live intraday candles), not a bug, a licensing limit on TradingView's side. */
  /* ---------- BSE_SCRIP_LOOKUP: full BSE equity scrip list (second-tier ticker lookup) ----------
     Built from BSE's own official master equity list (downloaded from bseindia.com, supplied by the user
     this round as Equity.csv) - every "Active" status equity BSE currently lists, ~4,800 companies after
     removing ~260 mutual-fund/ETF-house rows (their "Issuer Name" is the AMC, e.g. "ICICI Prudential Mutual
     Fund", never what someone searching for a COMPANY would type) and collapsing a handful of genuine
     multi-listing duplicates (DVR shares, partly-paid variants, re-listed symbols) down to one primary entry
     each. Keys are the company name lowercased with "Limited"/"Ltd" stripped (so "Hindalco Industries Ltd."
     becomes the lookup key "hindalco industries"); values are the real TradingView ticker.

     Ticker derivation rule (not a guess - a confirmed, mechanical transformation): BSE's own raw "Security
     Id" field can contain characters TradingView's symbol format can't (&, hyphens, spaces/periods in a few
     cases) - e.g. BSE's own data says Mahindra & Mahindra's Security Id is literally "M&M" and Bajaj Auto's
     is "BAJAJ-AUTO". TradingView replaces every such run of non-alphanumeric characters with a single
     underscore when forming its own symbol - confirmed directly against live TradingView chart/symbol pages
     for exactly this pattern (M&M -> chart/M_M/..., BAJAJ-AUTO -> chart/BAJAJ_AUTO/..., NAM-INDIA ->
     symbols/BSE-NAM_INDIA, J&KBANK -> chart/J_KBANK/...), so this file stores the already-transformed
     ticker, not BSE's raw Security Id.

     This is a SECOND-tier lookup, checked in guessSymbol() only when the hand-curated COMPANIES list above
     doesn't already have a verified ticker for the matched company. COMPANIES still wins on any conflict
     and is where the richer short-name aliases live (RIL/Reliance, HUL, LIC, L&T, M&M, ...) - this table
     trades that alias richness for breadth: it's what turns "we verified ~70 companies by hand" into
     "actually covers the exchange", so a real BSE-listed company we haven't individually hand-curated still
     resolves to its real ticker instead of falling through to a fabricated one.

     Deliberately excluded from this table: Tata Motors. BSE's own data shows TWO separate current listings
     under this name after the 2025 demerger - "Tata Motors Passenger Vehicles Limited" (TMPV) and the
     renamed parent "Tata Motors Limited" (TMCV, the former commercial-vehicles business) - and COMPANIES
     above already makes a deliberate, commented choice (TMPV) for a bare "Tata Motors" search. Letting this
     bulk table silently resolve to whichever one BSE's row order happens to produce would quietly override
     that deliberate choice without anyone noticing, so it's left out here on purpose; COMPANIES's own entry
     is what actually serves that name. */
  const BSE_SCRIP_LOOKUP = {"20 microns":"20MICRONS","360 one wam":"360ONE","3b blackbio dx":"3BBLACKBIO","3b films":"3BFILMS","3c it solutions and telecoms (india)":"3CIT","3i infotech":"3IINFOLTD","3m india":"3MINDIA","3p land holdings":"3PLAND","5paisa capital":"5PAISA","63 moons technologies":"63MOONS","7nr retail":"7NR","7seas entertainment":"7SEASL","a b cotspin india":"ABCOTS","a b infrabuild":"ABINFRA","a-1":"A1L","a-one steels india":"AONESTEELS","a.d.s. diagnostics":"ADSDIAG","a.f. enterprises":"AFEL","a.k.capital services":"AKCAPIT","a2z infra engineering":"A2ZINFRA","aa plus tradelink":"AAPLUSTRAD","aaa technologies":"AAATECH","aadhar housing finance":"AADHARHFC","aadi industries":"AADIIND","aanchal ispat":"AANCHALISP","aar shyam india investment company":"AARSHYAM","aarcon facilities":"AARCON","aarey drugs & pharmaceuticals":"AAREYDRUGS","aarnav fashions":"AARNAV","aartech solonics":"AARTECH","aarti drugs":"AARTIDRUGS","aarti industries":"AARTIIND","aarti pharmalabs":"AARTIPHARM","aarti surfactants":"AARTISURF","aarvi encon":"AARVI","aashka hospitals":"AASHKA","aastamangalam finance":"AASTAFIN","aastha spintex":"AASTHA","aavas financiers":"AAVAS","aayush art and bullion":"AAYUSHBULL","aayush wellness":"AAYUSH","aban offshore":"ABAN","abans enterprises":"ABANSENT","abans financial services":"AFSL","abate as industries":"ABATEAS","abb india":"ABB","abbott india":"ABBOTINDIA","abc india":"ABCINDQ","abhinav capital services":"ABHICAP","abhinav leasing & finance":"ALFL","abhishek finlease":"ABHIFIN","abhishek infraventures":"ABHIINFRA","abirami financial services (india)":"ABIRAFN","abm knowledgeware":"ABMKNO","abram food":"ABRFL","abril paper tech":"ABRIL","acc":"ACC","accedere":"ACCEDERE","accel":"ACCEL","accelya solutions india":"ACCELYA","accord transformer & switchgear":"ACCORDTS","accretion nutraveda":"ANL","accuracy shipping":"ACCURACY","ace alpha tech":"ACEALPHA","ace engitech":"ACEENGITEC","ace men engg works":"ACEMEN","ace software exports":"ACESOFT","acevector":"ACEVECTOR","achyut healthcare":"ACHYUT","aci infocom":"ACIIN","acknit industries":"ACKNIT","acme resources":"ACME","acme solar holdings":"ACMESOLAR","acme universal safezone 9":"ACMEUNIV","acrow (india)":"ACROW","acs technologies":"ACSTECH","action construction equipments":"ACE","active clothing co":"ACTIVE","acutaas chemicals":"ACUTAAS","ad-manum finance":"ADMANUM","adani energy solutions":"ADANIENSOL","adani enterprises":"ADANIENT","adani green energy":"ADANIGREEN","adani ports and special economic zone":"ADANIPORTS","adani power":"ADANIPOWER","adani total gas":"ATGL","adarsh plant project":"ADARSHPL","adc india communications":"ADCINDIA","adcon capital services":"ADCON","adcounty media india":"ADCOUNTY","add-shop e-retail":"ASRL","addi industries":"ADDIND","adeshwar meditex":"ADESHWAR","adf foods":"ADFFOODS","adhata global":"ADHHATA","adhbhut infrastructure":"ADHBHUTIN","adhiraj distributors":"ADHIRAJ","adinath textiles":"ADINATH","adishakti loha and ispat":"ADISHAKTI","aditya birla capital":"ABCAPITAL","aditya birla fashion and retail":"ABFRL","aditya birla lifestyle brands":"ABLBL","aditya birla money":"BIRLAMONEY","aditya birla real estate":"ABREL","aditya birla sun life amc":"ABSLAMC","aditya consumer marketing":"ACML","aditya forge":"ADTYFRG","aditya infotech":"CPPLUS","aditya ispat":"ADITYA","aditya spinners":"ADITYASP","aditya vision":"AVL","adjia technologies":"ADJIA","admach systems":"ADMACH","adon agro commodities":"ADON","ador welding":"ADOR","adroit industries (india)":"ADROITIND","adroit infotech":"ADROITINFO","adtech systems":"ADTECH","advait energy transitions":"ADVAIT","advance agrolife":"ADVANCE","advance lifestyles":"ADVLIFE","advance metering technology":"AMTL","advance multitech":"ADVMULT","advance petrochemicals":"ADVPETR_B","advance technoforge":"ADVANCETL","advanced enzyme technologies":"ADVENZYMES","advani hotels & resorts (india)":"ADVANIHOTR","advent hotels international":"ADVENTHTL","advik capital":"ADVIKCA","advit jewels":"RAMBHAJO","aegeus technologies":"AEGEUS","aegis logistics":"AEGISLOG","aegis vopak terminals":"AEGISVOPAK","aelea commodities":"ACLD","aeonx digital technology":"AEONXDIGI","aequs":"AEQUS","aeroflex enterprises":"AEROENTER","aeroflex industries":"AEROFLEX","aeroflex neu":"AERONEU","aerpace industries":"AERPACE","aether industries":"AETHER","afcom holdings":"AFCOM","afcons infrastructure":"AFCONS","affle 3i":"AFFLE","affordable robotic & automation":"AFFORDABLE","ag ventures":"AGVENTURES","agarwal fortune india":"AGARWAL","agarwal industrial corporation":"AGARIND","agi greenpac":"AGI","agi infra":"AGIIL","agio paper & industries":"AGIOPAPER","agri-tech india":"AGRITECH","agribio spirits":"AGRIBIO","ags transact technologies":"AGSTRA","ahasolar technologies":"AHASOLAR","ahluwalia contracts (india)":"AHLUCONT","ahmedabad steelcraft":"AHMDSTE","ai champdany industries":"AICHAMP","aia engineering":"AIAENG","aik pipes and polymers":"AIKPIPES","aimco pesticides":"AIMCOPEST","aion tech solutions":"GOLDTECH","airan":"AIRAN","airfloa rail technology":"AIRFLOA","ajanta pharma":"AJANTPHARM","ajanta soya":"AJANTSOY","ajax engineering":"AJAXENGG","ajc jewel manufacturers":"AJCJEWEL","ajcon global services":"AJCON","ajmera realty & infra india":"AJMERA","ajwa fun world & resorts":"AJWAFUN","akar auto industries":"AAIL","aki india":"AKI","akme fintrade (india)":"AFIL","aksh optifibre":"AKSHOPTFBR","akshar spintex":"AKSHAR","aksharchem (india)":"AKSHARCHEM","akums drugs and pharmaceuticals":"AKUMS","alacrity securities":"ALSL","alan scott enterprises":"ALANSCOTT","alankit":"ALANKIT","albert david":"ALBERTDAVD","alembic":"ALEMBICLTD","alembic pharmaceuticals":"APLLTD","alexander stamps and coin":"ALEXANDER","alfa ica (india)":"ALFAICA","alfa transformers":"ALFATRAN","alfavision overseas (india)":"ALFAVIO","alfred herbert (india)":"ALFREDHE","algoquant fintech":"ALGOQUANT","alicon castalloy":"ALICON","alivus life sciences":"ALIVUS","alkali metals":"ALKALI","alkem laboratories":"ALKEM","alkosign":"ALKOSIGN","alkyl amines chemicals":"ALKYLAMINE","all time plastics":"ALLTIME","allcargo global":"AGL","allcargo logistics":"ALLCARGO","allcargo terminals":"ATL","alldigi tech":"ALLDIGI","alliance integrated metaliks":"AIML","allied blenders and distillers":"ABDL","allied digital services":"ADSL","almondz global securities":"ALMONDZ","alna trading & exports":"ALNATRD","alok industries":"ALOKINDS","alpa laboratories":"ALPA","alphageo (india)":"ALPHAGEO","alphalogic industries":"ALPHAIND","alphalogic techsys":"ALPHALOGIC","alpine housing development corporat":"ALPINEHOU","alpine texworld":"ALPINETEX","alufluoride":"ALUFLUOR","amagi media labs":"AMAGI","amal":"AMAL","amanaya ventures":"AMANAYA","amanta healthcare":"AMANTA","amara raja energy & mobility":"ARE_M","amarjothi spinning mills":"AMARJOTHI","amba enterprises":"AEL","ambalal sarabhai enterprise":"AMBALALSA","ambar protein industries":"AMBARPIL","ambassador intra holdings":"AIHL","amber enterprises india":"AMBER","ambica agarbathies & aroma ind.":"AMBICAAGAR","ambika cotton mills":"AMBIKCO","ambitious plastomac":"AMBIT","ambo agritec":"AMBOAGRI","ambuja cements":"AMBUJACEM","amco india":"AMCOIND","amd industries":"AMDIND","ameenji rubber":"AMEENJI","amerise biosciences":"AMERISE","amforge industries":"AMFORG","amic forging":"AMIC","amin tannery":"AMINTAN","amines & plasticizers":"AMNPLST","amir chand jagdish kumar (exports)":"AEROPLANE","amit securities":"AMITSEC","amj land holdings":"AMJLAND","amkay products":"AMKAY","ampl capital":"AMPL","ampvolts":"AMPVOLTS","amrapali capital and finance services":"ACFSL","amrapali fincap":"AMRAFIN","amrapali industries":"AMRAPLIN","amraworld agrico":"AMRAAGRI","amrutanjan health care":"AMRUTANJAN","ams polymers":"AMS","amtech esters":"AMTECH","amwill health care":"AMWILL","anand rathi share and stock brokers":"ARSSBL","anand rathi wealth":"ANANDRATHI","anand rayons":"ARL","anand seamless":"ANAND","anant raj":"ANANTRAJ","andhra cement":"ACL","andhra paper":"ANDHRAPAP","andhra petrochemicals":"ANDHRAPET","andrew yule & company":"ANDREWYU","ang lifesciences india":"ANG","angel fibers":"ANGEL","angel one":"ANGELONE","anik industries":"ANIKINDS","anirit ventures":"ANIRIT","anjani finance":"ANJANIFIN","anjani foods":"ANJANIFOODS","anjani portland cement":"APCL","anjani synthetics":"ANJANI","anka india":"ANKIN","ankit metal & power":"ANKITMETAL","anlon healthcare":"AHCL","anmol india":"ANMOL","anna infrastructures":"ANNAINFRA","annu projects":"ANNU","annvrridhhi ventures":"ANVRDHI","ans":"ANSINDUS","ansal buildwell":"ANSALBU","ansal housing":"ANSALHSG","ansal properties & infrastructure":"ANSALAPI","antariksh industries":"ANTARIKSH","antelopus selan energy":"ANTELOPUS","anthem biosciences":"ANTHEM","antony waste handling cell":"AWHCL","anubhav plast":"ANUBHAV","anuh pharma":"ANUHPHR","anupam finserv":"ANUPAM","anupam rasayan india":"ANURAS","anuroop packaging":"ANUROOP","apana logistics":"APANA","apar industries":"APARINDS","apcotex industries":"APCOTEXIND","apeejay surrendra park hotels":"PARKHOTELS","apex capital and finance":"ACFL","apex frozen foods":"APEX","apis india":"APIS","apl apollo tubes":"APLAPOLLO","aplab":"APLAB","apm industries":"APMIN","apollo finvest (india)":"APOLLOFI","apollo hospitals enterprises":"APOLLOHOSP","apollo ingredients":"APOLLOIN","apollo micro systems":"APOLLO","apollo pipes":"APOLLOPIPE","apollo techno industries":"ATIL","apollo tyres":"APOLLOTYRE","apoorva leasing finance & investment company":"APOORVA","apt packaging":"APTPACK","aptech":"APTECHT","aptus pharma":"APPL","aptus value housing finance india":"APTUS","aqylon nexus":"AQYLON","aravali securities & finance":"ARAVALIS","arc finance":"ARCFIN","arcee indusrtries":"ARCEEIN","archean chemical industries":"ACI","archidply decor":"ADL","archidply industries":"ARCHIDPLY","archies":"ARCHIES","archit organosys":"ARCHITORG","arcl organics":"ARCL","arco leasing":"ZARCOLEA","ardee industries":"ARDEE","ardi alliances":"ARDIALL","arex industries":"AREXMIS","arfin india":"ARFIN","aries agro":"ARIES","arigato universe":"ARIGATO","arihant capital markets":"ARIHANTCAP","arihant foundations & housing":"ARIHANT","arihant superstructures":"ARIHANTSUP","arihants securities":"ARISE","arisinfra solutions":"ARIS","aritas vinyl":"ARITAS","arkade developers":"ARKADE","arman financial services":"ARMANFIN","arman holdings":"ARMAN","armee infotech":"ARMEE","arnold holdings":"ARNOLD","aro granite industries":"AROGRANITE","arrow greentech":"ARROWGREEN","arrowhead seperation engineering":"ARROWHEAD","arshiya":"ARSHIYA","artefact projects":"ARTEFACT","artemis adr marketplace":"ARTEMISADR","artemis electricals and projects":"AEPL","artemis medicare services":"ARTEMISMED","artificial electronics intelligent material":"AEIM","artson":"ARTSON","aruna hotels":"ARUNAHTEL","arunjyoti bio ventures":"ABVL","arvaya healthcare":"ARVAYA","arvind":"ARVIND","arvind fashions":"ARVINDFASN","arvind smartspaces":"ARVSMART","aryaman capital markets":"ARYACAPM","aryaman financial services":"ARYAMAN","aryan share & stock brokers":"ARYAN","asahi india glass":"ASAHIINDIA","asahi songwon colors":"ASAHISONG","asarfi hospital":"ASARFI","ascensive educare":"ASCENSIVE","asgard alcobev":"ASGARD","ashapura minechem":"ASHAPURMIN","ashapuri gold ornament":"AGOL","ashiana agro industries":"ASHAI","ashiana housing":"ASHIANA","ashika global securities":"ASHIKAG","ashima":"ASHIMASYN","ashirwad capital":"ASHCAP","ashirwad steels & industries":"ASHSI","ashish polyplast":"ASHISHPO","ashnisha industries":"ASHNI","ashnoor textiles mills":"ASHNOOR","ashok leyland":"ASHOKLEY","ashoka buildcon":"ASHOKA","ashoka metcast":"ASHOKAMET","ashram online.com":"ASHRAM","asi industries":"ASIIL","asia capital":"ASIACAP","asia pack":"ASIAPAK","asian energy services":"ASIANENE","asian granito india":"ASIANTILES","asian hotels (east)":"AHLEAST","asian hotels (north)":"ASIANHOTNR","asian hotels (west)":"AHLWEST","asian paints":"ASIANPAINT","asian petroproducts & exports":"ASINPET","asian star co.":"ASTAR","asian tea & exports":"ASIANTNE","asian warehousing":"ASIAN","asit c mehta financial services":"ASITCFIN","ask automotive":"ASKAUTOLTD","asm technologies":"ASMTEC","aspira pathlab & diagnostics":"ASPIRA","assam entrade":"ASSAMENT","asset reconstruction company (india)":"ARCIL","associated alcohols & breweries":"ASALCBR","associated ceramics":"ASSOCER","associated coaters":"ASSOCIATED","asston pharmaceuticals":"APL","astal laboratories":"ASTALLTD","astec lifesciences":"ASTEC","aster dm quality care":"ASTERDM","astonea labs":"ASTONEALAB","astra microwave products":"ASTRAMICRO","astral":"ASTRAL","astrazeneca pharma india":"ASTRAZEN","astron multigrain":"ASTRONMULT","astron paper & board mill":"ASTRON","asutosh enterprise":"ASUTENT","atal realtech":"ATALREAL","atam valves":"ATAM","aten papers & foam":"ATENPAPERS","atharv enterprises":"ATHARVENT","atharva poly-plast":"ATHARVA","athena constructions":"ATHCON","athena global technologies":"ATHENAGLO","ather energy":"ATHERENERG","atishay":"ATISHAY","atlanta electricals":"ATLANTAELE","atlantaa":"ATLANTAA","atlas cycles (haryana)":"ATLASCYCLE","atul":"ATUL","atul auto":"ATULAUTO","atv projects india":"ATVPR","atvo enterprises":"ATVOENT","au small finance bank":"AUBANK","audroc":"AUDROC","augmont enterprises":"AUGMONT","aureate tradde":"AUREATE","aurionpro solutions":"AURIONPRO","aurique":"AURIQUE","auro laboratories":"AUROLAB","aurobindo pharma":"AUROPHARMA","aurum proptech":"AURUM","aurus gem corporation":"AURUS","ausom enterprise":"AUSOMENT","austere systems":"AUSTERE","austin engineering co.":"AUSTENG","authum investment & infrastructure":"AIIL","auto pins (india)":"AUTOPINS","autofurnish":"AFLTD","autoline industries":"AUTOIND","automobile corpn. of goa":"ACGL","automotive axles":"AUTOAXLES","automotive stampings and assemblies":"ASAL","autoriders international":"AUTOINT","avadh sugar & energy":"AVADHSUGAR","available finance":"AVAILFC","avalon technologies":"AVALON","avance technologies":"AVANCE","avantel":"AVANTEL","avanti feeds":"AVANTIFEED","avax apparels and ornaments":"AVAX","aveer foods":"AVEER","avenue supermarts":"DMART","avenuesai":"CCAVENUE","avg logistics":"AVG","avio smart market stack":"ASMS","aviva industries":"AVIVA","avon mercantile":"AVONMERC","avonmore capital & management services":"AVONMORE","avro india":"AVROIND","avt natural products":"AVTNPL","awfis space solutions":"AWFIS","awl agri business":"AWL","axel polymers":"AXELPOLY","axis bank":"AXISBANK","axis solutions":"AXISOL","axiscades technologies":"AXISCADES","axita cotton":"AXITA","axtel industries":"AXTEL","aye finance":"AYE","aym syntex":"AYMSYNTEX","azad engineering":"AZAD","azad india mobility":"AZADIND","aztec fluids & machinery":"AZTEC","b & a":"BNALTD","b l kashyap and sons":"BLKASHYAP","b&a packaging india":"BAPACK","b&b triplewall containers":"BBTCL","b-right realestate":"BRRL","b. d. industries (pune)":"BDI","b.a.g. films & media":"BAGFILMS","b.c. power controls":"BCP","b.n.rathi securities":"BNRSEC","b.r.goyal infrastructure":"BRGIL","b2b software technologies":"B2BSOFT","baazar style retail":"STYLEBAAZA","baba arts":"BABA","bacil pharma":"BACPHAR","bafna pharmaceuticals":"BAFNAPH","bai-kakaji polymers":"BAIKAKAJI","baid finserv":"BAIDFIN","bajaj auto":"BAJAJ_AUTO","bajaj consumer care":"BAJAJCON","bajaj electricals":"BAJAJELEC","bajaj finance":"BAJFINANCE","bajaj finserv":"BAJAJFINSV","bajaj global":"BAJGLOB","bajaj healthcare":"BAJAJHCARE","bajaj hindusthan sugar":"BAJAJHIND","bajaj holdings & investment":"BAJAJHLDNG","bajaj housing finance":"BAJAJHFL","bajaj steel industries":"BAJAJST","bajel projects":"BAJEL","bal pharma":"BALPHARMA","balaji amines":"BALAMINES","balaji telefilms":"BALAJITELE","balgopal commercial":"BALGOPAL","balkrishna industries":"BALKRISIND","balkrishna paper mills":"BALKRISHNA","balmer lawrie and company":"BALMLAWRIE","balmer lawrie investments":"BLIL","balrampur chini mills":"BALRAMCHIN","balu forge industries":"BALUFORGE","balurghat technologies":"BALTE","bambino agro industries":"BAMBINO","bampsl securities":"BAMPSL","banaras beads":"BANARBEADS","banas finance":"BANASFN","banco products (india)":"BANCOINDIA","bandaram pharma packtech":"BANDARAM","bandhan bank":"BANDHANBNK","bang overseas":"BANG","bank of baroda":"BANKBARODA","bank of india":"BANKINDIA","bank of maharashtra":"MAHABANK","bannari amman spinning mills":"BASML","bannari amman sugars":"BANARISUG","bansal roofing products":"BRPL","bansal wire industries":"BANSALWIRE","banswara syntex":"BANSWRAS","barak valley cements":"BVCL","baroda extrusion":"BAROEXT","baroda rayon corpn.":"BARODARY","basant agro-tech (india)":"BASANTGL","basf india":"BASF","bata india":"BATAINDIA","batliboi":"BATLIBOI","bayer cropscience":"BAYERCROP","bazel international":"BAZELINTER","bcc fuba india":"BCCFUBA","bcl enterprises":"BCLENTERPR","bcl industries":"BCLIND","bcpl railway infrastructure":"BCPL","bdh industries":"BDH","bedmutha industries":"BEDMUTHA","beekay steel industries":"BEEKAY","beeyu overseas":"BEEYU","beezaasan explotech":"BEEZAASAN","befound movement":"BEFOUNDMOL","behari lal engineering":"BLEL","belding india":"BELDING","bella casa fashion & retail":"BELLACASA","belrise industries":"BELRISE","bemco hydraulics":"BEMHY","beml":"BEML","beml land assets":"BLAL","benara bearings and pistons":"BENARA","benares hotels":"BENARAS","benchmark computer solutions":"BENCHMARK","bengal & assam company":"BENGALASM","bengal steel industries":"BENGALS","bengal tea & fabrics":"BENGALT","bentley commercial enterprises":"BENTCOM","berger paints india":"BERGEPAINT","bervin investments and leasing":"BERVINL","beryl drugs":"BERLDRG","beryl securities":"BERYLSE","best agrolife":"BESTAGRO","best eastern hotels":"BESTEAST","betala global securities":"BETALA","betex india":"BETXIND","bf investment":"BFINVEST","bf utilities":"BFUTILITIE","bfl asset finvest":"BFLAFL","bgil films & technologies":"BGIL","bgr energy systems":"BGRENERGY","bhagawati gas":"BHAGGAS","bhageria industries":"BHAGERIA","bhagiradha chemicals and industries":"BHAGCHEM","bhagwati autocast":"BGWTATO","bhagwati oxygen":"BHAGWOX","bhagyanagar india":"BHAGYANGR","bhandari hosiery exports":"BHANDARI","bhanderi infracon":"BHANDERI","bhansali engineering polymers":"BEPL","bharat agri fert and realty":"BHARATAGRI","bharat bhushan finance & commodity brokers":"BHARAT","bharat bijlee":"BBL","bharat coking coal":"BHARATCOAL","bharat dynamics":"BDL","bharat electronics":"BEL","bharat forge":"BHARATFORG","bharat gears":"BHARATGEAR","bharat global developers":"BGDL","bharat heavy electricals":"BHEL","bharat immunologicals & biologicals":"BIBCL","bharat parenterals":"BPLPHARMA","bharat petroleum corpn.":"BPCL","bharat rasayan":"BHARATRAS","bharat road network":"BRNL","bharat seats":"BHARATSE","bharat wire ropes":"BHARATWIRE","bharatrohan airborne innovations":"BHARATROHAN","bharti airtel":"BHARTIARTL","bharti hexacom":"BHARTIHEXA","bhartiya international":"BIL","bhaskar agrochemicals":"BHASKAGR","bhatia colour chem":"BCCL","bhatia communications & retail (india)":"BHATIA","bhavik enterprises":"BHAVIK","bhilwara spinners":"BHILSPIN","bhilwara technical textiles":"BTTL","bhudevi infra projects":"BHUDEVI","bigbloc construction":"BIGBLOC","bihar sponge iron":"BIHSPONG","bikaji foods international":"BIKAJI","bil vyapar":"BILVYAPAR","bilcare":"BI","billionbrains garage ventures":"GROWW","billwin industries":"BILLWIN","bimetal bearings":"BIMETAL","binayak tex processors":"ZBINTXPP","bindal exports":"BINDALEXPO","binny mills":"BINNYMILLS","biocon":"BIOCON","biofil chemicals & pharmaceuticals":"BIOFILCHEM","biogen pharmachem industries":"BIOGEN","birla cable":"BIRLACABLE","birla corporation":"BIRLACORPN","birla cotsyn (india)":"BIRLACOT","birla precision technologies":"BIRLAPREC","birlanu":"BIRLANU","birlasoft":"BSOFT","bits":"BITS","bizotic commercial":"BIZOTIC","bkv industries":"BKV","black box":"BBOX","black rose industries":"BLACKROSE","blackbuck":"BLACKBUCK","blb":"BLBLIMITED","bliss gvs pharma":"BLISSGVS","bloom industries":"BLOIN","bls e-services":"BLSE","bls international services":"BLS","blt logistics":"BLT","blue chip tex industries":"BLUECHIPT","blue cloud softech solutions":"BLUECLOUDS","blue coast hotels":"BLUECOAST","blue dart express":"BLUEDART","blue jet healthcare":"BLUEJET","blue pearl agriventures":"BPAGRI","blue star":"BLUESTARCO","bluestone jewellery and lifestyle":"BLUESTONE","bluspring enterprises":"BLUSPRING","bmb music & magnetics":"BMBMUMG","bmw industries":"BMW","bmw ventures":"BMWVENTLTD","bn agrochem":"BNAGROCHEM","bnr udyog":"BNRUDY","bodal chemicals":"BODALCHEM","bodhi tree multimedia":"BTML","bodhtree consulting":"BODHTREE","bombay cycle & motor agency":"BOMBCYC","bombay dyeing & mfg. co.":"BOMDYEING","bombay oxygen investments":"BOMOXY_B1","bombay potteries & tiles":"BOMBPOT","bombay super hybrid seeds":"BSHSL","bombay talkies":"BOMTALKIES","bombay wire ropes":"BOMBWIR","bondada engineering":"BONDADA","bonlon industries":"BONLON","borana weaves":"BORANA","borosil":"BOROLTD","borosil renewables":"BORORENEW","borosil scientific":"BOROSCI","bosch":"BOSCHLTD","bosch home comfort india":"BOSCH_HCIL","boston commerce":"BOSTON","bothra metals & alloys":"BMAL","bpl":"BPL","brady & morris engineering co.":"BRADYM","brahmaputra infrastructure":"BRAHMINFRA","brainbees solutions":"FIRSTCRY","brand concepts":"BCONCEPTS","brawn biotech":"BRAWN","bridge securities":"BRIDGESE","brigade enterprises":"BRIGADE","brigade hotel ventures":"BRIGHOTEL","bright brothers":"BRIGHTBR","bright outdoor media":"BRIGHT","brightcom group":"BCG","brijlaxmi leasing & finance":"BRIJLEAS","brilliant portfolios":"BRIPORT","brisk technovision":"BRISK","britannia industries":"BRITANNIA","broach lifecare hospital":"BROACH","brooks laboratories":"BROOKS","bsel algo":"BSELALGO","bsl":"BSL","burnpur cement":"BURNPUR","butterfly gandhimathi appliances":"BUTTERFLY","c.e. info systems":"MAPMYINDIA","c.j. gelatine products":"CJGEL","calcom vision":"CALCOM","caliber mining and logistics":"CMLL","california software co.":"CALSOFT","cambridge technology enterprises":"CTE","camex":"CAMEXLTD","camlin fine sciences":"CAMLINFINE","campus activewear":"CAMPUS","can fin homes":"CANFINHOME","canara bank":"CANBK","canara hsbc life insurance company":"CANHLIFE","canara robeco asset management company":"CRAMC","candour techtex":"CANDOUR","cantabil retail india":"CANTABIL","capacite infraprojects":"CAPACITE","capillary technologies india":"CAPILLARY","capital india finance":"CIFL","capital small finance bank":"CAPITALSFB","capital trade links":"CTL","capital trust":"CAPTRUST","capitalnumbers infotech":"CNINFOTECH","caplin point laboratories":"CAPLIPOINT","capri global capital":"CGCL","capricorn systems global solutions":"CAPRICORN","caprihans india":"CAPRIHANS","caprolactam chemicals":"CAPRO","captain pipes":"CAPPIPES","captain polyplast":"CPL","captain technocast":"CTCL","carborundum universal":"CARBORUNIV","care ratings":"CARERATING","career point edutech":"CPEDU","cargosol logistics":"CARGOSOL","cargotrans maritime":"CARGOTRANS","carraro india":"CARRARO","cartrade tech":"CARTRADE","carysil":"CARYSIL","caspian corporate services":"CASPIAN","castora agri commodities":"CASTORA","castrol india":"CASTROLIND","catvision":"CATVISION","ccl international":"CCLINTER","ccl products (india)":"CCL","ccme global":"CCME","ceat":"CEATLTD","ceejay finance":"CEEJAY","ceenik exports (india)":"CEENIK","ceeta industries":"CEETAIN","ceigall india":"CEIGALL","ceinsys tech":"CEINSYS","celebrity fashions":"CELEBRITY","cella space":"CELLA","cello world":"CELLO","cemantic infra-tech":"CEMAINFRA","cemindia projects":"CEMPRO","cenlub industries":"CENLUB","centenial surgical suture":"CSURGSU","central bank of india":"CENTRALBK","central mine planning & design institute":"CMPDI","centrum capital":"CENTRUM","centum electronics":"CENTUM","centuple global":"CENTUPLE","century business media":"CENTURYOOH","century enka":"CENTENKA","century extrusions":"CENTEXT","century plyboards (india)":"CENTURYPLY","cera sanitaryware":"CERA","cesc":"CESC","cff fluid control":"CFF","cg power and industrial solutions":"CGPOWER","cg-vak software & exports":"CGVAK","chadha papers":"CHADPAP","chalet hotels":"CHALET","challani capital":"CHALLANI","chaman lal setia exports":"CLSEL","chambal breweries & distilleries li":"CHMBBRW","chambal fertilisers & chemicals":"CHAMBLFERT","chandni machines":"CHANDNIMACH","chandra bhagat pharma":"CBPL","chandra prabhu international":"CHANDRAP","chandrima mercantiles":"CHANDRIMA","chartered capital & investment":"CHRTEDCA","chartered logistics":"CHLOGIST","chatha foods":"CHATHA","chatterbox technologies":"CHTR","chd chemicals":"CHDCHEM","chembond chemicals":"CHEMBONDCH","chembond material technologies":"CHEMBOND","chemcon speciality chemicals":"CHEMCON","chemcrux enterprises":"CHEMCRUX","chemfab alkalis":"CHEMFAB","chemiesynth (vapi)":"CHEMIESYNT","chemkart india":"CHEMKART","chemplast sanmar":"CHEMPLASTS","chemtech industrial valves":"CHEMTECH","chennai ferrous industries":"CHENFERRO","chennai meenakshi multispeciality hospital":"CMMHOSP","chennai petroleum corporation":"CHENNPETRO","cheviot co.":"CHEVIOT","chiraharit":"CHIRAHARIT","chl":"CHLLTD","choice international":"CHOICEIN","choksi asia":"CHOKSI","choksi laboratories":"CHOKSILA","cholamandalam financial holdings":"CHOLAHLDNG","cholamandalam investment and finance company":"CHOLAFIN","chordia food products":"CHORDIA","chothani foods":"CHOTHANI","chowgule steamships":"CHOWGULSTM","chrome silicon":"CHROME","cian agro industries & infrastructure":"CIANAGRO","cian healthcare":"CHCL","cie automotive india":"CIEINDIA","cil securities":"CILSEC","cindrella financial services":"CINDRELL","cindrella hotels":"CINDHO","cineline india":"CINELINE","cinevista":"CINEVISTA","cipla":"CIPLA","citadel realty and developers":"CITADEL","citichem india":"CITICHEM","citiport financial services":"CITIPOR","citizen solar":"CITIZEN","city crops agro":"CCAL","city online services":"CITYONLINE","city pulse multiventures":"CPML","city union bank":"CUB","cityman":"CITYMAN","cl educate":"CLEDUCATE","clara industries":"CLARA","classic electricals":"CLASELE","classic filaments":"CFL","classic leasing & finance":"CLFL","clean max enviro energy solutions":"CLEANMAX","clean science and technology":"CLEAN","clinitech laboratory":"CTLLAB","clio infotech":"CLIOINFO","cln energy":"CLN","cmr green technologies":"CMRGREEN","cms info systems":"CMSINFO","cmx holdings":"CMXLTD","coal india":"COALINDIA","coastal corporation":"COASTCORP","coastal roadways":"COARO","cochin malabar estates & indus.":"COCHMAL","cochin minerals & rutile":"COCHINM","cochin shipyard":"COCHINSHIP","coffee day enterprises":"COFFEEDAY","coforge":"COFORGE","cohance lifesciences":"COHANCE","colgate-palmolive (india)":"COLPAL","colinz laboratories":"COLINZ","colorchips new media":"COLORCHIPS","comfort commotrade":"COMCL","comfort fincap":"COMFINCAP","comfort intech":"COMFINTE","command polymers":"COMMAND","commercial syn bags":"COMSYN","competent automobiles co.":"COMPEAU","complete sports and management india":"CSML","compuage infocom":"COMPINFO","compucom software lt":"COMPUSOFT","computer age management services":"CAMS","computer point":"COMPUPN","comrade appliances":"COMRADE","conart engineers":"CONART","concord biotech":"CONCORDBIO","concord control systems":"CNCRD","concord drugs":"CONCORD","concord enviro systems":"CEWATER","confidence futuristic energetech":"CFEL","confidence petroleum india":"CONFIPET","consecutive commodities":"CCDL","consolidated construction consortium":"CCCL","constronics infra":"CONSTRONIC","containe technologies":"CONTAINE","container corporation of india":"CONCOR","containerway international":"CONTAINER","contil india":"CONTILI","continental chemicals":"CONTCHM","continental controls":"CONTICON","continental petroleums":"CONTPTR","continental securities":"CSL","control print":"CONTROLPR","coral india finance and housing":"CORALFINAC","coral laboratories":"CORALAB","coral newsprints":"CORNE","cords cable industries":"CORDSCABLE","coromandel agro products & oils":"CORAGRO","coromandel engineering company":"COROENGG","coromandel international":"COROMANDEL","corona remedies":"CORONA","corporate merchant bankers":"CMBL","cosco (india)":"COSCO","cosmic crf":"COSMICCRF","cosmo ferrites":"COSMOFE","cosmo first":"COSMOFIRST","cospower engineering":"COSPOWER","cosyn":"COSYN","country club hospitality & holidays":"CCHHL","country condo's":"COUNCODOS","covance softsol":"COVANCE","cp capital":"CPCAP","craftroot retail":"CRAFTROOT","craftsman automation":"CRAFTSMAN","crane infrastructure":"CRANEINFRA","cranes software international":"CRANESSOFT","cranex":"CRANEX","cravatex":"CRAVATEX","crazy snacks":"CRAZY","creative castings":"CREATIVE","creative eye":"CREATIVEYE","creative newtech":"CNL","creditaccess grameen":"CREDITACC","credo brands marketing":"MUFTI","crescentis capital":"CRESCENTIS","cressanda railway solutions":"CRSL","crest ventures":"CREST","crestchem":"CRSTCHM","crimson metal engineering company":"CRIMSON","crisil":"CRISIL","crizac":"CRIZAC","croissance":"CROISSANCE","crompton greaves consumer electricals":"CROMPTON","cropster agro":"CROPSTER","cryogenic ogs":"CRYOGENIC","crystal business system":"CRYSTAL","csb bank":"CSBBANK","csl finance":"CSLFINANCE","csm technologies":"CSM","cubex tubings":"CUBEXTUB","cubical financial services":"CUBIFIN","cummins india":"CUMMINSIND","cupid":"CUPID","cupid breweries and distilleries":"CUPIDALBV","cura technologies":"CURAA","cwd":"CWD","cybele industries":"CYBELEIND","cyber media (india)":"CYBERMEDIA","cybertech systems and software":"CYBERTECH","cyient":"CYIENT","cyient dlm":"CYIENTDLM","d & h india":"DHINDIA","d p abhushan":"DPABHUSHAN","d-link (india)":"DLINKINDIA","d.b.corp":"DBCORP","d.p. wires":"DPWIRES","d.s.kulkarni developers":"DSKULKARNI","dabur india":"DABUR","dachepalli publishers":"DACHEPALLI","dai-ichi karkaria":"DAICHI","daikaffil chemicals india":"DAIKAFFI","dalal street investments":"DSINVEST","dalmia bharat":"DALBHARAT","dalmia bharat sugar and industries":"DALMIASUG","dalmia industrial development":"DIDL","dam capital advisors":"DAMCAPITAL","damodar industries":"DAMODARIND","danlaw technologies india":"DANLAW","danube industries":"DANUBE","daps advertising":"DAPS","darjeeling industriies":"DARJEELING","darshan orna":"DARSHANORNA","data patterns (india)":"DATAPATTNS","datamatics global services":"DATAMATICS","datiware maritime infra":"DATIWARE","daulat securities":"DAULAT","davangere sugar company":"DAVANGERE","davin sons retail":"DAVIN","db(international)stock brokers":"DBSTOCKBRO","dc infotech and communication":"DCI","dcb bank":"DCBBANK","dcm":"DCM","dcm financial services":"DCMFINSERV","dcm nouvelle":"DCMNVL","dcm shriram":"DCMSHRIRAM","dcm shriram fine chemicals":"DSFCL","dcm shriram industries":"DCMSRIND","dcm shriram international":"DCMSIL","dcw":"DCW","dcx systems":"DCXINDIA","ddev plastiks industries":"DDEVPLSTIK","de nora india":"DENORA","deccan cements":"DECCANCE","deccan gold mines":"DECNGOLD","deccan health care":"DECCAN","deccan polypacks":"DECPO","decillion finance":"DFL","decipher labs":"DECIPHER","deco-mica":"DECOMIC","decorous investment and trading co.":"DITCO","dee development engineers":"DEEDEV","deep health ai india":"DEEPAI","deep industries":"DEEPINDS","deep polymers":"DEEP","deepa jewellers":"DEEPA","deepak builders and engineers india":"DBEIL","deepak chemtex":"DEEPAKCHEM","deepak fertilizers &petrochemicals":"DEEPAKFERT","deepak nitrite":"DEEPAKNTR","deepak spinners":"DEEPAKSP","defrail technologies":"DEFRAIL","delhivery":"DELHIVERY","delphi world money":"DELPHIFX","delta corp":"DELTACORP","delta industrial resources":"DELTA","delta manufacturing":"DELTAMAGNT","delton cables":"DLTNCBL","den networks":"DEN","denis chem lab":"DENISCHEM","denta water and infra solutions":"DENTA","desco infratech":"DESCO","desh rakshak aushdhalaya":"DESHRAK","dev accelerator":"DEVX","dev information technology":"DEVIT","dev labtech venture":"DEVLAB","devine impex":"DEVINE","devinsu trading":"DEVITRD","devson catalyst":"DEVSON","devyani international":"DEVYANI","dhabriya polywood":"DHABRIYA","dhampur bio organics":"DBOL","dhampur sugar mills":"DHAMPURSUG","dhampure speciality sugars":"DHAMPURE","dhanalaxmi roto spinners":"DHANROTO","dhanashree electronics":"DEL","dhanlaxmi bank":"DHANBANK","dhanlaxmi cotex":"DHANCOT","dhanlaxmi fabrics":"DHANFAB","dhansafal finserve":"DHANSAFAL","dhanuka agritech":"DHANUKA","dhanvantri jeevan rekha":"ZDHJERK","dhanwel hybrid seeds":"DHANWEL","dharan infra-epc":"DHARAN","dharani finance":"DHARFIN","dharmaj crop guard":"DHARMAJ","dharni capital services":"DHARNI","dhatre udyog":"DHATRE","dhaval packaging":"DHAVAL","dhenu buildcon infra":"DHENUBUILD","dhillon freight carrier":"DHILLON","dhoot industrial finance":"DHOOTIN","dhoot transmission":"DHOOTTRANS","dhp india":"DHPIND","dhruv consultancy services":"DHRUV","dhruva capital services":"DHRUVCA","dhunseri investments":"DHUNINV","dhunseri tea & industries":"DTIL","dhunseri ventures":"DVL","dhvija finance":"DHVIJAFIN","dhyaani tradeventtures":"DHYAANITR","diamines & chemicals":"DIAMINESQ","diamond power infrastructure":"DIACABS","diana tea co.":"DIANATEA","dic india":"DICIND","diffusion engineers":"DIFFNKG","diggi multitrade":"DML","digicontent":"DGCONTENT","digidrive distributors":"DIGIDRIVE","digilogic systems":"DIGILOGIC","digispice technologies":"DIGISPICE","digitide solutions":"DIGITIDE","digjam":"DIGJAMLMTD","diksat transworld":"DIKSAT","diksha greens":"DGL","diksha polymers":"DIKSHA","diligent industries":"DILIGENT","diligent media corporation":"DNAMEDIA","dilip buildcon":"DBL","dindigul farm product":"DFPL","dipna pharmachem":"DPL","disa india":"DISAQ","dish tv india":"DISHTV","disha resources":"DRL","dishman carbogen amcis":"DCAL","divgi torqtransfer systems":"DIVGIITTS","divi's laboratories":"DIVISLAB","divyashakti":"DIVSHKT","dixon technologies (india)":"DIXON","dj mediaprint & logistics":"DJML","dlf":"DLF","dmcc speciality chemicals":"DMCC","dmr engineering":"DMR","dodla dairy":"DODLA","dolat algotech":"DOLATALGO","dolfin rubbers":"DOLFIN","dollar industries":"DOLLAR","dollex agrotech":"DOLLEX","dolphin kitchen utencils and appliances":"DKUAL","dolphin offshore enterprises (india)":"DOLPHIN","doms industries":"DOMS","donear industries":"DONEAR","dr lalchandani labs":"DLCL","dr. agarwal's health care":"AGARWALEYE","dr. lal pathlabs":"LALPATHLAB","dr. reddy's laboratories":"DRREDDY","dr.agarwals eye hospital":"DRAGARWQ","dra consultants":"DRA","drc systems india":"DRCSYSTEMS","dreamfolks services":"DREAMFOLKS","dredging corporation of india":"DREDGECORP","droneacharya aerial innovations":"DRONACHRYA","dsj keep learning":"KEEPLEARN","dsm fresh foods":"ZAPPFRESH","ducon infratechnologies":"DUCON","dudani retail":"DUDANI","duke offshore":"DUKEOFS","duncan engineering":"DUNCANENG","duropack":"DUROPACK","duroply industries":"DUROPLY","dutron polymers":"DUTRON","dwarikesh sugar industries":"DWARKESH","dynacons systems & solutions":"DSSL","dynamatic technologies":"DYNAMATECH","dynamic archistructures":"DAL","dynamic cables":"DYCL","dynamic industries":"DYNAMIND","dynamic protfolio management & serv":"DYNAMICP","dynavision":"DYNAVSN","dynemic products":"DYNPRO","e and e enterprises":"EENTER","e-land apparel":"ELAND","e.i.d. parry (india)":"EIDPARRY","e2e networks":"E2E","earkart":"EARKART","earthstahl & alloys":"EARTH","east buildtech":"EASTBUILD","east coast steel":"ECSTSTL","east india drums and barrels manufacturing":"EASTINDIA","east west freight carriers":"EASTWEST","eastern silk industries":"EASTSILK","eastern treads":"EASTRED","easun capital markets":"EASUN","easy fincorp":"EASYFIN","easy trip planners":"EASEMYTRIP","ebix":"EBIX","eclerx services":"ECLERX","eco hotels and resorts":"ECOHOTELS","eco recycling":"ECORECO","ecoboard industries":"ECOBOAR","ecofinity atomix":"ECOFINITY","econo trade (india)":"ETIL","ecoplast":"ECOPLAST","ecos (india) mobility & hospitality":"ECOSMOBLTY","edelweiss financial services":"EDELWEISS","edvenswa enterprises":"EDVENSWA","efc (i)":"EFCIL","eforu entertainment":"EFORU","eicher motors":"EICHERMOT","eighty jewellers":"EIGHTY","eih":"EIHOTEL","eih associated hotels":"EIHAHOTELS","eiko lifesciences":"EIKO","eimco elecon india":"EIMCOELECO","ekam leasing & finance co.":"EKAMLEA","ekansh concepts":"EKANSH","ekennis software service":"EKENNIS","eki energy services":"EKI","el forge":"ELFORGE","elango industries":"ELANGO","elantas beck india":"ELANTAS","elcid investments":"ELCIDIN","eldeco housing & ind.":"ELDEHSG","elecon engineering co.":"ELECON","electronics mart india":"EMIL","electrosteel castings":"ELECTCAST","electrotherm (india)":"ELECTHERM","elegant floriculture & agrotech (in":"ELEFLOR","elegant marbles & grani industries":"ELEMARB","elevate campuses":"ELEVATE","elfin agro india":"ELFIN","elgi equipments":"ELGIEQUIP","elin electronics":"ELIN","elitecon international":"ELITECON","elixir capital":"ELIXIR","ellenbarrie industrial gases":"ELLEN","elnet technologies":"ELNET","elpro international":"ELPROINTL","ema india":"EMAINDIA","emami":"EMAMILTD","emami paper mills":"EMAMIPAP","emami realty":"EMAMIREAL","embassy developments":"EMBDL","emcure pharmaceuticals":"EMCURE","emerald finance":"EMERALD","emerald leisures":"EMERALL","emergent industrial solutions":"EMERGENT","emiac technologies":"EMIAC","emkay global financial services":"EMKAY","emmbi industries":"EMMBI","emmessar biotech & nutrition":"EMMESSA","emmforce autotech":"EMMFORCE","emmvee photovoltaic power":"EMMVEE","empire industries":"EMPIND","empower india":"EMPOWER","emrock corporation":"EMROCK","ems":"EMSLIMITED","emudhra":"EMUDHRA","enbee trade & finance":"ENBETRD","endurance technologies":"ENDURANCE","energy development company":"ENERGYDEV","engineers india":"ENGINERSIN","enkei wheels (india)":"ENKEIWHEL","ens enterprises":"ENS","entero healthcare solutions":"ENTERO","enterprise international":"ENTRINT","entertainment network (india)":"ENIL","envair electrodyne":"ENVAIREL","enviro infra engineers":"EIEL","ep biocomposites":"EPBIO","epack durable":"EPACK","epack prefab technologies":"EPACKPEB","epic energy":"EPIC","epigral":"EPIGRAL","epl":"EPL","epsom properties":"EPSOMPRO","epuja spiritech":"EPUJA","equilateral enterprises":"EQUILATERA","equippp social impact technologies":"EQUIPPP","equitas small finance bank":"EQUITASBNK","eris lifesciences":"ERIS","erp soft systems":"ERPSOFT","esaar (india)":"ESARIND","esab india":"ESABINDIA","esaf small finance bank":"ESAFSFB","escorp asset management":"ESCORP","escorts kubota":"ESCORTS","esds software solution":"ESDS","esha media research":"ESHAMEDIA","espire hospitality":"ESPIRE","esquire money guarantees":"ESQRMON","essar shipping":"ESSARSHPNG","essex marine":"ESSEX","ester industries":"ESTER","eternal":"ETERNAL","ethos":"ETHOSLTD","euphoria infotech (india)":"EUPHORIAIT","eureka forbes":"EUREKAFORB","eureka industries":"EUREKAI","euro leder fashion":"EUROLED","euro panel products":"EUROBOND","euro pratik sales":"EUROPRATIK","eurotex industries & exports":"EUROTEXIND","evans electric":"EVANS","eveready industries india":"EVEREADY","everest industries":"EVERESTIND","everest kanto cylinders":"EKC","everest organics":"EVERESTO","everlon financials":"EVERFIN","evexia lifecare":"EVEXIA","evoq remedies":"EVOQ","exato technologies":"EXATO","excell industries":"EXCELINDUS","excelsoft technologies":"EXCELSOFT","exhicon events media solutions":"EXHICON","exicom tele-systems":"EXICOM","exide industries":"EXIDEIND","expleo solutions":"EXPLEOSOL","explicit finance":"EXPLICITFIN","expo engineering and projects":"EXPOEAPL","exxaro tiles":"EXXARO","eyantra ventures":"EY","faalcon concepts":"FAALCON","fabino enterprises":"FABINO","fabtech cleanrooms":"FABCLEAN","fabtech technologies":"FABTECH","facor alloys":"FACORALL","fairchem organics":"FAIRCHEMOR","family care hospitals":"FAMILYCARE","farm peace":"FARMPEACE","faze three":"FAZE3Q","fcs software solutions":"FCSSOFT","fdc":"FDC","fedbank financial services":"FEDFINA","fedders holding":"FEDDERSHOL","federal bank":"FEDERALBNK","federal-mogul goetze (india)":"FMGOETZE","fermenta biotech":"FERMENTA","fertilizers and chemicals travancore":"FACT","fervent synergies":"FERVENTSYN","fgp":"FGP","fiberweb (india)":"FIBERWEB","fiem industries":"FIEMIND","filatex fashions":"FILATFASH","filatex india":"FILATEX","filmcity media":"FILME","filtra consultants and engineers":"FILTRA","filtron engineers":"FILTRON","fine organic industries":"FINEORG","fine-line circuits":"FINELINE","finelistings technologies":"FTL","fineotex chemical":"FCL","finkurve financial services":"FINKURVE","fino payments bank":"FINOPB","finolex cables":"FINCABLES","finolex industries":"FINPIPE","first custodian fund (india)":"1STCUS","first fintec":"FIRSTFIN","firstsource solutions":"FSL","fischer medical ventures":"FISCHER","five-star business finance":"FIVESTAR","flair writing industries":"FLAIR","flex foods":"FLEXFO","flexituff ventures international":"FLEXITUFF","flomic global logistics":"FLOMIC","flora corporation":"FLORACORP","fluidomat":"FLUIDOM","fly-hi maritime travels":"FLYHI","focus business solution":"FOCUS","fone4 communications (india)":"FONE4","foods & inns":"FOODSIN","forbes & company":"FORBESCO","forbes precision tools and machine parts":"TOTEM","force motors":"FORCEMOT","fortis healthcare":"FORTIS","fortis malar hospitals":"FORTISMLR","fortune international":"FORINTL","foseco crucible india":"FOSECOC","foseco india":"FOSECOIND","foundry fuel products":"FFPL","fractal analytics":"FRACTAL","fractal industries":"FIL","franklin industries":"FRANKLININD","franklin leasing and finance":"FRANKLIN","fraser and company":"FRASER","fratelli vineyards":"FRATELLI","fredun pharmaceuticals":"FREDUN","fresita proteins":"FRESITA","frontier capital":"FRONTCAP","frontier springs":"FRONTSP","frontline corporation":"FRONTCORP","frontline financial services":"FRONTFN","fruition venture":"FRUTION","fsn e-commerce ventures":"NYKAA","fujiyama power systems":"UTLSOLAR","fundviser capital (india)":"FUNDVISER","fusion finance":"FUSION","fusion klassroom edutech":"KLASSROOM","future enterprises":"FEL","future lifestyle fashions":"FLFL","future market networks":"FMNL","futuristic securities":"FUTURSEC","futuristic solutions":"FUTSOL","fx multitech":"FXML","fynx capital":"FYNX","g m polyplast":"GMPL","g n a axles":"GNA","g r infraprojects":"GRINFRA","g v electricals":"GVELECTRIC","g. g. dandekar properties":"GGDPROP","g. k. p. printing & packaging":"GKP","g.g.automotive gears":"GGAUTO","g.k.consultants":"GKCONS","g.m. breweries":"GMBREW","g.s. auto international":"GSAUTO","g.v. films":"GVFILM","gabion technologies india":"GTIL","gabriel india":"GABRIEL","gabriel pet straps":"GPSL","gacm technologies":"GATECH","gaekwar mills":"ZGAEKWAR","gagan gases":"GAGAN","gail (india)":"GAIL","gaja alternative asset management":"GAJA","gajanan securities services":"GAJANANSEC","gala global products":"GGPL","gala precision engineering":"GALAPREC","galactico corporate services":"GALACTICO","galada finance":"GALADAFIN","galada power & communication":"GALADA","galaxy agrico exports":"GALAGEX","galaxy bearings":"GALXBRG","galaxy supermarket":"GSLTD","galaxy surfactants":"GALAXYSURF","gallantt ispat":"GALLANTT","gallard steel":"GALLARD","gallops enterprise":"GALLOPENT","gamco":"GAMCO","game changers texfab":"TRADEUNO","gandhar oil refinery (india)":"GANDHAR","gandhi special tubes":"GANDHITUBE","ganesh benzoplast":"GANESHBE","ganesh consumer products":"GANESHCP","ganesh holding":"GANHOLD","ganesh housing":"GANESHHOU","ganesha ecosphere":"GANECOS","ganesha ecoverse":"GANVERSE","ganga papers india":"GANGAPA","ganga pharmaceuticals":"GANGAPHARM","ganges securities":"GANGESSECU","ganon products":"GANONPRO","garbi finvest":"GARBIFIN","garden reach shipbuilders & engineers":"GRSE","garg furnace":"GARGFUR","garment mantra lifestyle":"GARMNTMNTR","garnet construction":"GARNET","garnet international":"GARNETINT","garuda construction and engineering":"GARUDA","garware hi-tech films":"GRWRHITECH","garware marine industries":"GARWAMAR","garware offshore services":"GARWAOFFS","garware synthetics":"GARWSYN","garware technical fibres":"GARFIBRES","gateway distriparks":"GATEWAY","gaudium ivf and women health":"GAUDIUMIVF","gautam exim":"GEL","gautam gems":"GGL","gayatri bioorganics":"GAYATRIBI","gayatri highways":"GAYAHWS","gayatri projects":"GAYAPROJ","gayatri sugars":"GAYATRI","gb logistics commerce":"GBLOGISTIC","gcm capital advisors":"GCMCAPI","gcm commodity & derivatives":"GCMCOMM","gcm securities":"GCMSECU","gconnect logitech and supply chain":"GCONNECT","gdl leasing & finance":"GDLLEAS","ge power india":"GVPIL","ge vernova t&d india":"GVT_D","gee":"GEE","geecee ventures":"GEECEE","geetanjali credit and capital":"GEETANJ","gem aromatics":"GEMAROMA","gem enviro management":"GEMENVIRO","gem spinners india":"GEMSPIN","gemstone investments":"GEMSI","general insurance corporation of india":"GICRE","generic engineering construction and projects":"GENCON","genesys international corporation":"GENESYS","gennex laboratories":"GENNEX","genomic valley biotech":"GVBL","genpharmasec":"GENPHARMA","gensol engineering":"GENSOL","genus paper & boards":"GENUSPAPER","genus power infrastructures":"GENUSPOWER","genus prime infra":"GENUSPRIME","geojit financial services":"GEOJITFSL","german green steel and power":"GERMAN","getalong enterprise":"GETALONG","gfl":"GFLLIMITED","ghcl":"GHCL","ghcl textiles":"GHCLTEXTIL","ghushine fintrrade ocean":"GHUSHINE","ghv infra projects":"GHVINFRA","gian life care":"GIANLIFE","gic housing finance":"GICHSGFIN","gilada finance & investments":"GILADAFINS","gillanders arbuthnot & co.":"GILLANDERS","gillette india":"GILLETTE","gini silk mills":"GINISILK","ginni filaments":"GINNIFILA","gita renewable energy":"GITARENEW","gk energy":"GKENERGY","gkb ophthalmics":"GKB","glaam up jwel":"GLAAMUP","glance finance":"GLANCE","gland pharma":"GLAND","glass wall systems (india)":"GLASSWALL","glaxosmithkline pharmaceuticals":"GLAXO","glen industries":"GLEN","glenmark pharmaceuticals":"GLENMARK","glittek granites":"GLITTEKG","global capital markets":"GLOBALCA","global defence industries":"GDIL","global health":"MEDANTA","global longlife hospital and research":"GLHRL","global ocean logistics india":"GLOBALLOG","global surfaces":"GSLSU","global vectra helicorp":"GLOBALVECT","globale tessile":"GLOBALE","globalspace technologies":"GSTL","globe civil projects":"GLOBECIVIL","globe commercials":"GLCL","globtier infotech":"GLOBTIER","globus constructors & developers":"GLOBUSCON","globus spirits":"GLOBUSSPR","gloster":"GLOSTERLTD","glottis":"GLOTTIS","gmm pfaudler":"GMMPFAUDLR","gmr airports":"GMRAIRPORT","gmr power and urban infra":"GMRP_UI","gng electronics":"EBGNG","go digit general insurance":"GODIGIT","go fashion (india)":"GOCOLORS","goa carbon":"GOACARBON","goblin india":"GOBLIN","gocl corporation":"GOCLCORP","godavari biorefineries":"GODAVARIB","godavari drugs":"GODAVARI","godawari power and ispat":"GPIL","godfrey phillips india":"GODFRYPHLP","godrej agrovet":"GODREJAGRO","godrej consumer products":"GODREJCP","godrej industries":"GODREJIND","godrej properties":"GODREJPROP","goel construction company":"GOELCONS","goel food products":"GOEL","goenka business & finance":"GBFL","gogia capital growth":"GOGIACAPGL","gokak textiles":"GOKAKTEX","gokaldas exports":"GOKEX","gokul agro resources":"GOKULAGRO","gokul refoils and solvent":"GOKUL","gold rock investments":"ZGOLDINV","goldcoin health foods":"GOLDCOINHF","golden carpets":"GOLCA","golden crest education & services":"GOLDENCREST","golden legand leasing & finance":"GOLDLEG","golden tobacco":"GOLDENTOBC","goldiam international":"GOLDIAM","goldline pharmaceutical":"GLPL","golechha global finance":"GOLECHA","golkunda diamonds & jewellery":"GOLKUNDIA","goodluck india":"GOODLUCK","goodricke group":"GOODRICKE","goodyear india":"GOODYEAR","gopal snacks":"GOPAL","gorani industries":"GORANIN","gothi plascon (india)":"GOTHIPL","gourmet gateway india":"GOURMET","gowra leasing & finance":"GOWRALE","goyal aluminiums":"GOYALALUM","goyal associates":"GOYALASS","gp petroleums":"GULFPETRO","gpt healthcare":"GPTHEALTH","gpt infraprojects":"GPTINFRA","grameva":"GRAMEVA","grand foundry":"GFSTEELS","grand oak canyons distillery":"GRANDOAK","grandma trading & agencies":"GRANDMA","granules india":"GRANULES","graphite india":"GRAPHITE","grasim industries":"GRASIM","gratex industries":"GRATEXI","grauer & weil (india)":"GRAUWEIL","graviss hospitality":"GRAVISSHO","gravita india":"GRAVITA","gravity (india)":"GRAVITY","gre renew enertech":"GRERENEW","great eastern shipping co.":"GESHIP","greaves cotton":"GREAVESCOT","greencrest financial services":"GREENCREST","greenhitech ventures":"GVL","greenlam industries":"GREENLAM","greenpanel industries":"GREENPANEL","greenply industries":"GREENPLY","gretex corporate services":"GCSL","grindwell norton":"GRINDWELL","grm overseas":"GRMOVER","groarc industries india":"GROARC","grovy india":"GROVY","growington ventures india":"GROWINGTON","grp":"GRPLTD","gsb finance":"GSBFIN","gsp crop science":"GSPCROP","gspl transmission":"GSPLTRANS","gss infotech":"GSS","gtl":"GTL","gtl infrastructure":"GTLINFRA","gtn industries":"GTNINDS","gtn textiles ltd. (formerly known as gtn industries ltd.)":"GTNTEX","gtpl hathway":"GTPL","gtt data solutions":"GTTDATA","gtv engineering":"GTV","gufic biosciences":"GUFICBIO","gujarat alkalis & chemicals":"GUJALKALI","gujarat ambuja exports":"GAEL","gujarat apollo industries":"GUJAPOLLO","gujarat containers":"GUJCONT","gujarat cotex":"GUJCOTEX","gujarat craft industries":"GUJCRAFT","gujarat credit corporation":"GUJCRED","gujarat energy":"GUJENERGY","gujarat fluorochemicals":"FLUOROCHEM","gujarat hotels":"GUJHOTE","gujarat hy-spin":"GUJHYSPIN","gujarat industries power co.":"GIPCL","gujarat inject (kerala)":"GUJINJEC","gujarat intrux":"GUJINTRX","gujarat investa":"GUJINV","gujarat kidney and super speciality":"GKSL","gujarat lease financing":"GLFL","gujarat mineral development corpora":"GMDCLTD","gujarat narmada valley fert.co.":"GNFC","gujarat natural resources":"GNRL","gujarat peanut and agri products":"GPAPL","gujarat petrosynthese":"GUJPETR","gujarat pipavav port":"GPPL","gujarat poly electronics":"GUJARATPOLY","gujarat raffia ind.":"GUJRAFFIA","gujarat state fertilizers & chem.":"GSFC","gujarat state financial corporation":"GUJSTATFIN","gujarat terce laboratories":"GUJTERC","gujarat themis biosyn":"GUJTHEM","gujarat toolroom":"GUJTLRM","gujarat winding systems":"GUJWIND","gujjubhai industries":"GUJJUBHAI","gulf lloyds (india)":"GULFLLOYDS","gulf oil lubricants india":"GULFOILLUB","gulshan polyols":"GULPOLY","guru krupa gems and jewellery":"GKL","gvk power & infrastructure":"GVKPIL","gyan developers & builders":"GYANDEV","gyftr":"GYFTR","h. r. hygiene products":"HRHYGIENE","h.g. infra engineering":"HGINFRA","h.m. electro mech":"HMEML","h.p. cotton textile mills":"HPCOTTON","h.s.india":"HOTLSILV","halder venture":"HALDER","haldyn glass":"HALDYNGL","haleos labs":"HALEOSLABS","hamps bio":"HAMPS","hampton sky realty":"HAMPTON","handson global management (hgm)":"HGM","hanman fit":"HANMAN","hannah joseph hospital":"HANNAH","happiest minds technologies":"HAPPSTMNDS","happy forgings":"HAPPYFORGE","hardcastle & waud mfg. co.":"HARDCAS","hardwyn india":"HARDWYN","haria apparels":"HARIAAPL","haria exports":"HARIAEXPO","harig crankshafts":"HARCR","harikanta overseas":"HARIKANTA","hariom pipe industries":"HARIOMPIPE","harish textile engineers":"HARISH","hariyana ship breakers":"HRYNSHP","hariyana ventures":"HVL","harrisons malayalam":"HARRMALAYA","harsha engineers international":"HARSHA","harshdeep hortico":"HARSHDEEP","harshil agrotech":"HARSHILAGR","haryana capfin":"HARYNACAP","haryana financial corporation":"HARAFIN","haryana leather chemicals":"HARLETH","has lifestyle":"HASJUICE","hasti finance":"HASTIFIN","hathway bhawani cabletel & datacom":"HATHWAYB","hathway cable & datacom":"HATHWAY","hatsun agro products":"HATSUN","havells india":"HAVELLS","hawa engineers":"HAWAENG","hawkins cooker":"HAWKINCOOK","hazoor multi projects":"HAZOOR","hb estate developers":"HBESD","hb leasing & finance co.":"HBLEAS","hb portfolio":"HBPOR","hb stockholdings":"HBSL","hbg hotels":"HBGHOTELS","hbl engineering":"HBLENGINE","hckk ventures":"HCKKVENTURE","hcl infosystems":"HCL_INSYS","hcl technologies":"HCLTECH","hcp plastene bulkpack":"HPBL","hdb financial services":"HDBFS","hdfc asset management company":"HDFCAMC","hdfc bank":"HDFCBANK","hdfc life insurance company":"HDFCLIFE","heads up ventures":"HEADSUP","health x platform":"HEALTHX","healthcare global enterprises":"HCG","healthy investments":"HEALINV","healthy life agritec":"HEALTHYLIFE","heera ispat":"HEERAISP","heg advanced materials":"HEGAM","heidelbergcement india":"HEIDELBERG","helloji holidays":"HELLOJI","helpage finlease":"HELPAGE","hem holdings and trading":"ZHEMHOLD","hemang resources":"HEMANG","hemant surgical industries":"HSIL","hemisphere properties india":"HEMIPROP","heranba industries":"HERANBA","hercules investments":"HERCULES","heritage foods":"HERITGFOOD","hero motocorp":"HEROMOTOCO","hero motors":"HEROMOTORS","hester biosciences":"HESTERBIO","hexa tradex":"HEXATRADEX","hexagon nutrition":"HEXAGON","hexaware technologies":"HEXT","hfcl":"HFCL","hi-klass trading and investment":"HIKLASS","hi-tech pipes":"HITECH","high energy batteries (india)":"HIGHENE","highness microelectronics":"HIGHNESS","highway infrastructure":"HILINFRA","hikal":"HIKAL","hiliks technologies":"HILIKS","hilltone software and gases":"HILLTONE","hilton metal forging":"HILTON","him teknoforge":"HIMTEK","himadri speciality chemical":"HSCL","himalaya food international":"HFIL","himalaya nutravedics india":"HNIL","himatsingka seide":"HIMATSEIDE","hind aluminium industries":"HINDALUMI","hind commerce":"HCLTD","hindalco industries":"HINDALCO","hindoostan mills":"HINDMILL","hindprakash industries":"HPIL","hinduja global solutions":"HGS","hindustan adhesives":"HINDADH","hindustan aeronautics":"HAL","hindustan agrigenetics":"HINDUST","hindustan appliances":"HINDAPL","hindustan bio sciences":"HINDBIO","hindustan composites":"HINDCOMPOS","hindustan construction co.":"HCC","hindustan copper":"HINDCOPPER","hindustan foods":"HNDFDS","hindustan hardy":"HINDHARD","hindustan housing co.":"ZHINDHSG","hindustan media ventures":"HMVL","hindustan motors":"HINDMOTORS","hindustan oil exploration co.":"HINDOILEXP","hindustan organic chemicals":"HOCL","hindustan petroleum corporation":"HINDPETRO","hindustan tin works":"HINDTIN","hindustan unilever":"HINDUNILVR","hindustan zinc":"HINDZINC","hindusthan insulators and industries":"HIIL","hindusthan udyog":"ZHINUDYP","hindware home innovation":"HINDWAREAP","hipolin":"HIPOLIN","hira automobiles":"HIRAUTO","hirect":"HIRECT","hisar metal industries":"HISARMETAL","hisar spinning mills":"HISARSP","hit kit global solutions":"HITKITGLO","hitachi energy india":"POWERINDIA","hitech corporation":"HITECHCORP","hittco tools":"HITTCO","hle glascoat":"HLEGLAS","hlv":"HLVLTD","hma agro industries":"HMAAGRO","hmt":"HMT","home first finance company india":"HOMEFIRST","homre":"HOM","honasa consumer":"HONASA","honda india power products":"HONDAPOWER","honeywell automation india":"HONAUT","horizon industrial parks":"HORIZONIND","horizon reclaim (india)":"HORIZON","housing &urban development corporation":"HUDCO","housing development & infrastructure":"HDIL","howard hotels":"HOWARHO","hp adhesives":"HPAL","hpl electric & power":"HPL","hrs aluglaze":"HRS","ht media":"HTMEDIA","hubtown":"HUBTOWN","huhtamaki india":"HUHTAMAKI","humming bird education":"HBEL","hy-tech engineers":"HTEL","hybrid financial services":"HYBRIDFIN","hypersoft technologies":"HYPERSOFT","hyundai motor india":"HYUNDAI","ib infotech enterprises":"IBINFO","icds":"ICDSLTD","icici bank":"ICICIBANK","icici lombard general insurance company":"ICICIGI","icici prudential asset management company":"ICICIAMC","icici prudential life insurance company":"ICICIPRULI","icodex publishing solutions":"ICODEX","icon facilitators":"ICON","iconik sports and events":"ICONIKSPEV","icra":"ICRA","idbi bank":"IDBI","ideaforge technology":"IDEAFORGE","identixweb":"IDENTIXWEB","idfc first bank":"IDFCFIRSTB","idream film infrastructure company":"IDREAM","iec education":"IECEDU","iel":"INDXTRA","ifb agro industries":"IFBAGRO","ifb industries":"IFBIND","ifci":"IFCI","ifgl refractories":"IFGLEXPOR","ifl enterprises":"IFL","ig petrochemicals":"IGPL","igarashi motors india":"IGARASHI","igc industries":"IGCIL","iifl capital services":"IIFLCAPS","iifl finance":"IIFL","iirm holdings india":"IIRM","iitl projects":"IITLPROJ","ikio technologies":"IKIO","ikoma technologies":"IKOMA","il & fs investment managers":"IVC","il&fs engineering and construction company":"IL_FSENGG","il&fs transportation networks":"IL_FSTRANS","imagicaaworld entertainment":"IMAGICAA","imec services":"IMEC","impera worldwide":"IMPERA","inani marbles & industries":"INANI","incap":"INCAP","incon engineers":"INCON","incredible industries":"INCREDIBLE","ind bank housing":"INDBNK","ind renewable energy":"INDRENEW","ind-agiv commerce":"INDAGIV","ind-swift laboratories":"INDSWFTLAB","indag rubber":"INDAG","indbank merchant banking services l":"INDBANK","indef manufacturing":"BAJAJINDEF","indegene":"INDGN","indergiri finance":"INDERGR","india cements":"INDIACEM","india cements capital":"INDCEMCAP","india finsec":"IFINSEC","india gelatine & chemicals":"INDGELA","india glycols":"INDIAGLYCO","india home loan":"INDIAHOME","india homes":"INDIAHOMES","india lease devl.":"INDLEASE","india motor parts & accessories":"IMPAL","india nippon electricals":"INDNIPPON","india nivesh":"INDIANVSH","india pesticides":"IPL","india shelter finance corporation":"INDIASHLTR","india tourism development corporati":"ITDC","indiabulls":"IBULLSLTD","indiamart intermesh":"INDIAMART","indian acrylics":"INDIANACRY","indian bank":"INDIANB","indian card clothing":"INDIANCARD","indian energy exchange":"IEX","indian hume pipe co.":"INDIANHUME","indian infotech and software":"INDINFO","indian link chain mnfrs.":"INLCM","indian metals & ferro alloys":"IMFA","indian oil corporation":"IOC","indian overseas bank":"IOB","indian railway catering & tourism corporation":"IRCTC","indian railway finance corporation":"IRFC","indian renewable energy development agency":"IREDA","indian sucrose":"INDSUCR","indian terrain fashions":"INDTERRAIN","indian toners & developers":"INDTONER","indigo paints":"INDIGOPNTS","indiqube spaces":"INDIQUBE","indo amines":"INDOAMIN","indo borax & chemicals":"INDOBORAX","indo cotspin":"ICL","indo count industries":"ICIL","indo credit capital":"INDOCRED","indo euro indchem":"INDOEURO","indo farm equipment":"INDOFARM","indo gulf industries":"IGLFXPL_B","indo national":"NIPPOBATRY","indo rama synthetics (india)":"INDORAMA","indo smc":"INDOSMC","indo tech transformers":"INDOTECH","indo thai securities":"INDOTHAI","indo us bio-tech":"INDOUS","indo-city infotech":"INDOCITY","indo-mim":"INDOMIM","indobell insulations":"INDOBELL","indoco remedies":"INDOCO","indogulf cropsciences":"IGCL","indokem":"INDOKEM","indong tea company":"INDONG","indosolar":"WAAREEINDO","indostar capital finance":"INDOSTAR","indowind energy":"INDOWIND","indraprashtha gas":"IGL","indraprastha medical corporation lt":"INDRAMEDCO","indrayani biotech":"INDRANIB","indsil hydro power and manganese":"INDSILHYD","inducto steels":"INDCTST","indus finance":"INDUSFINL","indus towers":"INDUSTOWER","indusind bank":"INDUSINDBK","industrial & prudential inv. co. lt":"INDPRUD","industrial investment trust":"IITL","infinity infoway":"INFINITY","inflame appliances":"INFLAME","info edge(india)":"NAUKRI","infobeans technologies":"INFOBEAN","infomedia press":"INFOMEDIA","infonative solutions":"INFONATIVE","informed technologies india":"INFORTEC","infosys":"INFY","infrax renewable":"INFRAX","infronics systems":"INFRONICS","ingersoll-rand (india)":"INGERRAND","injecto polymers":"INJECTO","inland printers":"INLANPR","innocorp":"INNOCORP","innokaiz india":"INNOKAIZ","innova captab":"INNOVACAP","innovana thinklabs":"INNOVANA","innovassynth technologies (india)":"INOVSYNTH","innovative ideals and services (india)":"INNOVATIVE","innovative tech pack":"INNOVTEC","innovators facade systems":"INNOVATORS","innovision":"INNOVISION","inox green energy services":"INOXGREEN","inox india":"INOXINDIA","inox wind":"INOXWIND","insecticides india":"INSECTICID","insolation energy":"INA","inspirisys solutions":"INSPIRISYS","intec capital":"INTECCAP","integra capital":"INTCAPL","integra engineering india":"INTEGRAEN","integra essentia":"ESSENTIA","integrated capital services":"ICSL","integrated hi-tech":"INTEGHIT","integrated proteins":"INTEGFD","integrated thermoplastics":"INTETHR","intellect design arena":"INTELLECT","intense technologies":"INTENTECH","inter globe finance":"INTRGLB","inter state oil carrier":"INTSTOIL","interactive financial services":"IFINSER","interarch building solutions":"INTERARCH","interglobe aviation":"INDIGO","international combustion (india) lt":"INTLCOMBQ","international conveyors":"INTLCONV","international gemological institute":"IGIL","international travel house":"ITHL","intrasoft technologies":"ISFT","inventure growth & securities":"INVENTURE","inventurus knowledge solutions":"IKS","investment & precision castings":"INVPRECQ","invigorated business consulting":"INVIGO","iol chemicals & pharmaceuticals":"IOLCP","ion exchange (india)":"IONEXCHANG","ip rings":"IPRINGLTD","ipca laboratories":"IPCALAB","irb infrastructure developers":"IRB","ircon international":"IRCON","iris regtech solutions":"IRIS","irm energy":"IRMENERGY","ironwood education":"IRONWOOD","isera lifesciences":"ISERA","isf":"ISFL","isgec heavy engineering":"ISGEC","ishan dyes and chemicals":"ISHANCH","ishita drugs & industries":"ISHITADR","ishwarshakti holdings & traders":"ISHWATR","isl consulting":"ISLCONSUL","ist":"ISTLTD","istreet network":"ISTRNETWK","itc":"ITC","itc hotels":"ITCHOTELS","itcons e-solutions":"ITCONS","iti limited (indian teleph.ind.ltd)":"ITI","itl industries":"ITL","ivalue infosolutions":"IVALUE","ivp":"IVP","izmo":"IZMO","j. kumar infraprojects":"JKIL","j.a. finance":"JAFINANCE","j.g.chemicals":"JGCHEM","j.j. finance corporation":"JJFINCOR","j.k. cement":"JKCEMENT","jackson investments":"JACKSON","jagan lamps":"JAGANLAM","jagatjit industries":"JAGAJITIND","jagjanani textiles":"JAGJANANI","jagran prakashan":"JAGRAN","jagsonpal pharmaceuticals":"JAGSNPHARM","jagsonpal services":"JAGSONSER","jai balaji industries":"JAIBALAJI","jai corp":"JAICORPLTD","jai mata glass":"JAIMATAG","jaihind industries":"JAIHIND","jain irrigation systems":"JISLJALEQS","jain marmo industries":"JAINMARMO","jain resource recycling":"JAINREC","jainco projects (india)":"JAINCO","jainex aamcol":"JAINEX","jaipan industries":"JAIPAN","jaiprakash power ventures":"JPPOWER","james warren tea":"JAMESWARREN","jammu and kashmir bank":"J_KBANK","jamna auto industries":"JAMNAAUTO","jamshri realty":"JAMSHRI","jana small finance bank":"JSFB","jaro institute of technology management and research":"JARO","jasch gauging technologies":"JGTL","jasch industries":"JASCH","jash engineering":"JASH","jattashankar industries":"JATTAINDUS","jauss polymers":"JAUSPOL","jay ambe supermarkets":"CITYSQUARE","jay bharat maruti":"JAYBARMARU","jay kailash namkeen":"JAYKAILASH","jay shree tea & industries":"JAYSREETEA","jay ushin":"JAYUSH","jayabharat credit":"JAYBHCR","jayant agro-organics":"JAYAGROGN","jayant infratech":"JAYANT","jayaswal neco industries":"JAYNECOIND","jayatma enterprises":"JAYATMA","jayatma industries":"JAYIND","jaykay enterprises":"JAYKAY","jayshree chemicals":"JAYCH","jaysynth orgochem":"JAYSYNTH","jbm auto":"JBMA","jd cables":"JDCABLES","jeena sikho lifecare":"JSLL","jeet machine tools":"ZJEETMAC","jeevan scientific technology":"JSTL","jenburkt pharmaceuticals":"JENBURPH","jet freight logistics":"JETFREIGHT","jet solar":"JETSOLAR","jetking infotrain":"JETKINGQ","jhandewalas foods":"JFL","jhaveri credits & capital":"JHACC","jhs svendgaard laboratories":"JHS","jhs svendgaard retail ventures":"RETAIL","jigar cables":"JIGAR","jindal capital":"JINDCAP","jindal drilling & industries":"JINDRILL","jindal hotels":"JINDHOT","jindal leasefin":"JLL","jindal photo":"JINDALPHOT","jindal poly films":"JINDALPOLY","jindal poly investment and finance company":"JPOLYINVST","jindal saw":"JINDALSAW","jindal stainless":"JSL","jindal steel":"JINDALSTEL","jindal supreme (india)":"JSIPL","jindal worldwide":"JINDWORLD","jinkushal industries":"JKIPL","jio financial services":"JIOFIN","jitf infralogistics":"JITFINFRA","jivial industries":"JIVIAL","jiya eco-products":"JIYAECO","jk agri genetics":"JKAGRI","jk lakshmi cement":"JKLAKSHMI","jk paper":"JKPAPER","jk tyre & industries":"JKTYRE","jla infraville shoppers":"JSHL","jm financial":"JMFINANCIL","jmd ventures":"JMDVL","jmj fintech":"JMJFIN","jnk india":"JNKINDIA","john cockerill india":"COCKERILL","johnson pharmacare":"JOHNPHARMA","joindre capital services":"JOINDRE","jointeca education solutions":"JOINTECAED","jojo":"JOJO","jolly plastic industries":"JOLYPLS","jonjua overseas":"JONJUA","josts engineering co.":"JOSTS","jsl industries":"JSLINDL","jsw cement":"JSWCEMENT","jsw dulux":"JSWDULUX","jsw energy":"JSWENERGY","jsw holdings":"JSWHL","jsw infrastructure":"JSWINFRA","jsw steel":"JSWSTEEL","jtekt india":"JTEKTINDIA","jtl defence":"JTLDEFENCE","jtl industries":"JTLIND","jubilant agri and consumer products":"JUBLCPL","jubilant foodworks":"JUBLFOOD","jubilant ingrevia":"JUBLINGREA","jubilant pharmova":"JUBLPHARMA","jujhar logistics":"JUJHARLOGI","julien agro infratech":"JULIEN","jumbo bag":"JUMBO","jumbo finance":"JUMBFNL","jungle camps india":"JUNGLECAMP","juniper green energy":"JNPR","juniper hotels":"JUNIPER","jupiter industries & leasing":"JPTRLES","jupiter infomedia":"JUPITERIN","jupiter life line hospitals":"JLHL","jupiter wagons":"JWL","just dial":"JUSTDIAL","justo realfintech":"JUSTO","jyot international marketing":"JYOTIN","jyothy labs":"JYOTHYLAB","jyoti":"JYOTI","jyoti cnc automation":"JYOTICNC","jyoti resins & adhesives":"JYOTIRES","jyoti structures":"JYOTISTRUC","k c p sugar and industries corporation":"KCPSUGIND","k k silk mills":"KKSILK","k&r rail engineering":"KRRAIL","k. m. sugar mills":"KMSUGAR","k. v. toys india":"KVTOYS","k.c.p.":"KCP","k.g.denim":"KGDENIM","k.p. energy":"KPEL","k.p.r. mill":"KPRMILL","k.z.leasing & finance":"KZLFIN","kaarya facilities and services":"KAARYAFSL","kabra commercial":"KCL","kabra drugs":"KABRADG","kabra extrusion technik":"KABRAEXTRU","kabsons industries":"KABSON","kachchh minerals":"KACHCHH","kahan packaging":"KAHAN","kaira can co.":"KAIRA","kairosoft ai solutions":"VOLKAI","kaiser corporation":"KACL","kaizen agro infrabuild":"KAIZENAGRO","kajal synthetics and silk mills":"KAJALSY","kajaria ceramics":"KAJARIACER","kaka industries":"KAKA","kakatiya cement sugar & industries":"KAKATCEM","kakatiya textiles":"KAKTEX","kalind":"KALIND","kallam textiles":"KALLAM","kalpa commercial":"KALPACOMME","kalpataru":"KALPATARU","kalpataru projects international":"KPIL","kalyan capitals":"KALYANCAP","kalyan jewellers india":"KALYANKJIL","kalyani cast-tech":"KALYANI","kalyani forge":"KALYANIFRG","kalyani investment company":"KICL","kalyani steels":"KSL","kama holdings":"KAMAHOLD","kamadgiri fashion":"KAMADGIRI","kamanwala housing construction":"KAMANWALA","kamat hotels (india)":"KAMATHOTEL","kamdhenu":"KAMDHENU","kamdhenu ventures":"KAMOPAINTS","kanani industries":"KANANIIND","kanchi karpooram":"KANCHI","kanco tea & industries":"KANCOTEA","kanel industries":"KANELIND","kanishk aluminium india":"KANISHK","kanishk steel industries":"KANSHST","kanohar electricals":"KANOHAR","kanoria chemicals & industries":"KANORICHEM","kanoria energy and infrastructure":"KEIL","kanpur plastipack":"KANPRPLA","kansai nerolac paints":"KANSAINER","kanungo financiers":"KANUNGO","kapil raj finance":"KAPILRAJ","karamtara engineering":"KARAMTARA","karan woo-sin":"KARANWO","karbonsteel engineering":"KARBON","karma energy":"KARMAENG","karnataka bank":"KTKBANK","karnavati finance":"KARNAVATI","karnawati innovation":"KARNAWATI","karnimata cold storage":"KCSL","kartik investments trust":"KARTKIN","karur vysya bank":"KARURVYSYA","kasturi metal composite":"KASTURI","katare spinning mills":"KATRSPG","kati patang lifestyle":"KATIPATANG","kaushalya infrastructure development corporation":"KAUSHALYA","kaveri seed company":"KSCL","kavveri defence & wireless technologies":"KAVDEFENCE","kay power and paper":"KAYPOWR","kaya":"KAYA","kaycee industries":"KAYCEEI","kaynes technology india":"KAYNES","kbs india":"KBSINDIA","kcd industries india":"KCDGROUP","kcl infra projects":"KCLINFRA","kd green industries":"KDGREEN","kddl":"KDDL","kec international":"KEC","keerthi industries":"KEERTHI","kei industries":"KEI","kellton tech solutions":"KELLTONTEC","keltech energies":"KELENRG","kemistar corporation":"KEMISTAR","kemp & company":"KEMP","ken financial services":"KENFIN","kennametal india limtied":"KENNAMET","kenrik industries":"KENRIK","kenvi jewels":"KENVI","kerala ayurveda":"KERALAYUR","kernex microsystems (india)":"KERNEX","kesar enterprises":"KESARENT","kesar india":"KESAR","kesar petroproducts":"KESARPE","kesar terminals & infrastructure":"KTIL","kesoram industries":"KESORAMIND","keto motors":"KETOMOTORS","kewal kiran clothing":"KKCL","key corp":"KEYCORP","keynote financial services":"KEYFINSERV","keystone realtors":"RUSTOMJEE","kfin technologies":"KFINTECH","kg petrochem":"KGPETRO","khadim india":"KHADIM","khaitan (india)":"KHAITANLTD","khaitan chemicals & fertilizers":"KHAICHEM","khandwala securities":"KHANDSE","khazanchi jewellers":"KHAZANCHI","khemani distributors & marketing":"KDML","khoobsurat":"KHOOBSURAT","khyati global ventures":"KGVL","khyati multimedia-entertainment":"KHYATI","kiaasa retail":"KIAASA","kic metaliks":"KAJARIR","kiduja india":"KIDUJA","kifs financial services":"KIFS","kilburn engineering":"KLBRENG_B","kilitch drugs (i)":"KILITCH","kimia biosciences":"KIMIABL","kinetic engineering":"KINETICENG","kinetic trust":"KINETRU","kingfa science & technology (india)":"KINGFA","kings infra ventures":"KINGSINFR","kiocl":"KIOCL","kiran print-pack":"KIRANPR","kiran syntex":"KIRANSY_B","kiran vyapar":"KIRANVYPAR","kiri industries":"KIRIINDUS","kirloskar brothers":"KIRLOSBROS","kirloskar electric company":"KECL","kirloskar ferrous industries":"KIRLFER","kirloskar industries":"KIRLOSIND","kirloskar oil engines":"KIRLOSENG","kirloskar pneumatic co.":"KIRLPNU","kisaan parivar industries":"KISAAN","kisan mouldings":"KISAN","kitex garmenets":"KITEX","kizi apparels":"KIZI","kjmc corporate advisors (india)":"KJMCCORP","kjmc financial services":"KJMCFIN","kk shah hospitals":"KKSHL","kkalpana industries (india)":"KKALPANAIND","kmc speciality hospitals india":"KMCSHIL","kmf builders & developers":"KMFBLDR","kmg milk food":"KMGMILK","kms medisurgi":"KMSMEDI","knack packaging":"KNACK","knowledge marine & engineering works":"KMEW","knr constructions":"KNRCON","kobo biotech":"KOBO","kohinoor foods":"KOHINOOR","koiya international":"KOIYAIN","kokuyo camlin":"KOKUYOCMLN","kolte-patil developers":"KOLTEPATIL","konndor industries":"KONNDOR","kopran":"KOPRAN","kotak mahindra bank":"KOTAKBANK","kothari fermanatation & biochem":"KFBL","kothari industrial corpn.":"KOTIC","kothari products":"KOTHARIPRO","kotia enterprises":"KEL","kotyark industries":"KOTYARK","koura fine diamond jewelry":"KOURA","kovai medical center & hospital":"KOVAI","kovalam inv. & trading co.":"ZKOVALIN","kovilpatti lakshmi roller flour mills":"KLRFM","kp green engineering":"KPGEL","kpi green energy":"KPIGREEN","kpit technologies":"KPITTECH","kpt industries":"KPT","kranti industries":"KRANTI","kratikal tech":"KRATIKAL","krbl":"KRBL","krebs biochemicals & industries":"KREBSBIO","kreon finnancial services":"KREONFIN","kretto syscon":"KRETTOSYS","kridhan infra":"KRIDHANINF","krishanveer forge":"KVFORGE","krishival foods":"KRISHIVAL","krishna filament industries":"KRIFILIND","krishna institute of medical sciences":"KIMS","krishna ventures":"KRISHNA","kriti industries (india)":"KRITI","kriti nutrients":"KRITINUT","krn heat exchanger and refrigeration":"KRN","kronox lab sciences":"KRONOX","kross":"KROSS","krowniq":"KROWNIQ","krsnaa diagnostics":"KRSNAA","krupalu metals":"KRUPALU","krypton industries":"KRYPTONQ","krystal integrated services":"KRYSTAL","ks smart technologies":"KSSMART","ksb":"KSB","kse":"KSE","ksh international":"KSHINTL","ksolves india":"KSOLVES","ksr footwear":"KSR","kuantum papers":"KUANTUM","kuber udyog":"KUBERJI","kuberan global edu solutions":"KGES","kumbhat financial services":"KUMPFIN","kunststoffe industries":"KUNSTOFF","kusam electrical industies":"KUSUMEL","kush industries":"KUSHIND","kusumgar":"KUSUMGAR","kuwer industries":"KUWERIN","kvs castings":"KVSCASTING","kwality pharmaceuticals":"KPL","kwality wall\u2019s (india)":"KWIL","kwick forensic solutions":"KWICK","l&t finance":"LTF","l&t technology services":"LTTS","l. t. elevator":"LTELEVATOR","l.g.balkrishnan & bros.":"LGBBROSLTD","l.k.mehta polymers":"LKMEHTA","la opala rg":"LAOPALA","la tim metal & industries":"LATIMMETAL","labelkraft technologies":"LABELKRAFT","lactose (india)":"LACTOSE","ladam affortable housing":"LAHL","ladderup finance":"LADDERUP","laddu gopal online services":"LADDU","laffans petrochemicals":"LAFFANSQ","lahoti overseas":"LAHOTIOV","lake shore realty":"LAKESHORE","lakhotia polyesters (india)":"LAKHOTIA","lakshmi electrical control systems":"LAKSELEC","lakshmi engineering and warehousing":"LAKSHMIEW","lakshmi mills company":"LAKSHMIMIL","lakshmi precision screws":"LAKPRE","lalithaa jewellery mart":"LALITHAA","lambodhara textiles":"LAMBODHARA","lancer container lines":"LANCER","lancor holdings":"LANCORHOL","landmarc leisure corporation":"LANDMARC","landmark cars":"LANDMARK","landmark global learning":"LGLL","landmark property development company":"LPDC","landsmill green":"LANDSMILL","lapl automotive":"LAPL","larsen & toubro":"LT","laser power & infra":"LASERPOWER","last mile enterprises":"LASTMILE","latent view analytics":"LATENTVIEW","laurus labs":"LAURUSLABS","laxmi dental":"LAXMIDENTL","laxmi india finance":"LAXMIINDIA","laxmi organic industries":"LXCHEM","laxmipati engineering works":"LAXMIPATI","lcc infotech":"LCCINFOTEC","lcc projects":"LCCPROJECT","le lavoir":"LELAVOIR","le travenues technology":"IXIGO","lead financial services":"LEADFIN","leading leasing finance and investment co.":"LLFICL","leap india":"LEAPIND","leapfrog engineering services":"LESL","lee & nee softwares (exports)":"LEENEE","leela palaces hotels & resorts":"THELEELA","lehar footwears":"LEHAR","lemon tree hotels":"LEMONTREE","lenskart solutions":"LENSKART","leo dryfruits & spices trading":"VANDU","lerthai finance":"LERTHAI","lesha industries":"LESHAIND","lex nimble solutions":"LEX","lexora global":"LEXGLOBAL","lexoraa industries":"LEXORAA","lg electronics india":"LGEINDIA","lgb forge":"LGBFORGE","lgt global hospitality":"LGT","liberty shoes":"LIBERTSHOE","libord finance":"LIBORDFIN","libord securities":"LIBORD","lic housing finance":"LICHSGFIN","life insurance corporation of india":"LICI","likhami consulting":"LIKHAMI","likhitha infrastructure":"LIKHITHA","lime chemicals":"LIMECHM","linc":"LINC","lincoln pharmaceuticals":"LINCOLN","linde india":"LINDEINDIA","link pharma chem":"LINKPH","liotech industries":"LIOTECH","lippi systems":"LIPPISYS","liqvd digital india":"LIQVD","lkp securities":"LKPSEC","lloyds engineering works":"LLOYDSENGG","lloyds enterprises":"LLOYDSENT","lloyds metals and energy":"LLOYDSME","lmw":"LMW","lodha developers":"LODHA","logica infoway":"LOGICA","logiciel solutions":"LOGICIEL","lohia corp":"LCL","lokesh machines":"LOKESHMACH","longspur international ventures":"LONGSPUR","looks health services":"LOOKS","lords chloro alkali":"LORDSCHLO","lords ishwar hotels":"LORDSHOTL","lords mark industries":"LORDSMARK","lorenzini apparels":"LAL","lotus chocolate co.":"LOTUSCHO","lotus eye hospital and institute":"LOTUSEYE","lovable lingerie":"LOVABLE","loyal equipments":"LOYAL","loyal textiles mills":"LOYALTEX","lt foods":"LTFOODS","ltm":"LTM","ludlow jute & specialities":"LUDLOWJUT","lumax auto technologies":"LUMAXTECH","lumax industries":"LUMAXIND","lumino industries":"LUMINO","lupin":"LUPIN","lux industries":"LUXIND","luxury time":"LUXURY","lws knitwear":"LWSKNIT","lyka labs":"LYKALABS","lyons corporate market":"LYONSCO","m & b engineering":"MBEL","m lakhamsi industries":"MLINDLTD","m p k steels (i)":"MPKSTEELS","m. k. exim (india)":"MKEXIM","m.k.proteins":"MKPL","m.m. rubber company":"MMRUBBR_B","m.m.forgings":"MMFL","m.p. agro industries":"MPAGI","m.r.f.":"MRF","m.r.maniveni foods":"MANIVENI","maan aluminium":"MAANALU","mac charles (india)":"MCCHRLS_B","mac hotels":"MACH","macfos":"ROBU","mach travel solutions":"MACHLTD","machhar industries":"MACIND","machino plastics":"MACPLASQ","madala holdings":"MADALA","madhav infra projects":"MADHAVIPL","madhav marbles & granites":"MADHAV","madhucon projects":"MADHUCON","madhur industries":"MADHURIND","madhusudan industries":"MADHUDIN","madras fertilizers":"MADRASFERT","maestros electronics & telecommunications systems":"METSL","mafatlal industries":"MAFATIND","mafia trends":"MAFIA","magadh sugar & energy":"MAGADSUGAR","magellanic cloud":"MCLOUD","magenta lifecare":"MAGENTA","magna electro castings":"MAGNAELQ","magnanimous trade & finance":"MAGANTR","magnum ventures":"MAGNUM","magnus steel and infra":"MAGNUS","maha rashtra apex corporation":"MAHAPEXLTD","mahalaxmi fabric mills":"MFML","mahalaxmi rubtech":"MHLXMIRU","mahalaxmi seamless":"MAHALXSE","mahamaya lifesciences":"MAHALIFE","mahamaya steel industries":"MAHASTEEL","mahan industries":"MAHANIN","mahanagar gas":"MGL","mahanagar telephone nigam":"MTNL","maharaja & speedex india":"SPEEDEX","maharashtra corporation":"MAHACORP","maharashtra scooters":"MAHSCOOTER","maharashtra seamless":"MAHSEAMLES","mahasagar travels":"MHSGRMS","mahaveer infoway":"MAHAVEER","mahesh developers":"MAHESH","mahindra & mahindra":"M_M","mahindra & mahindra financial services":"M_MFIN","mahindra epc irrigation":"MAHEPC","mahindra holidays & resorts india":"MHRIL","mahindra lifespace developers":"MAHLIFE","mahindra logistics":"MAHLOG","mahip industries":"MAHIP","maiden forgings":"MAIDEN","maithan alloys":"MAITHANALL","maitri enterprises":"MAITRI","majestic auto":"MAJESAUT","makers laboratories":"MAKERSL","mallcom (india)":"MALLCOM","malpani pipes and fittings":"MALPANI","malt land distilleries":"MALTLAND","malu paper mills":"MALUPAPER","mamata machinery":"MAMATA","man industries (india)":"MANINDS","man infraconstruction":"MANINFRA","manaksia":"MANAKSIA","manaksia aluminium company":"MANAKALUCO","manaksia coated metals & industries":"MANAKCOAT","manaksia steels":"MANAKSTEEL","manali petrochemicals":"MANALIPETC","manappuram finance":"MANAPPURAM","manas properties":"MANAS","manba finance":"MANBA","mangal compusolution":"MANGALCOMP","mangal credit and fincorp":"MANCREDIT","mangal electrical industries":"MEIL","mangalam cement":"MANGLMCEM","mangalam drugs and organics":"MANGALAM","mangalam global enterprise":"MGEL","mangalam industrial finance":"MANGIND","mangalam organics":"MANORG","mangalam seeds":"MSL","mangalam worldwide":"MWL","mangalore refinery & petrochemicals":"MRPL","manglam global corporations":"MANGLAM","manika plastech":"MANIKA","manipal finance corporation":"MNPLFIN","manipal health enterprises":"MANIPALHOS","manipal payment and identity solutions":"MPIMANIPAL","mankind pharma":"MANKIND","manoj ceramic":"MCPL","manoj jewellers":"MANOJJEWEL","manoj vaibhav gems 'n' jewellers":"MVGJL","manomay tex india":"MANOMAY","manorama industries":"MANORAMA","manraj housing finance":"MANRAJH","mansi finance (chennai)":"MANSIFIN","mansoon trading co.":"ZMANSOON","mantra capital":"MANTRA","manugraph india":"MANUGRAPH","mapro industries":"MAPROIN","maral overseas":"MARALOVER","marathon nextgen realty":"MARATHON","marble city india":"MARBLE","marc loire fashions":"MARCLOIRE","mardia samyoung capillary tubes co":"MSCTC","marg techno projects":"MTPL","margo finance":"MARGOFIN","marico":"MARICO","maris spinners":"MARIS","market creators":"MKTCREAT","markolines pavement technologies":"MARKOLINES","marksans pharma":"MARKSANS","marsons":"MARSONS","martin burn":"MARBU","maruti global industries":"MGIL","maruti infrastructure":"MAINFRA","maruti interior products":"SPITZE","maruti suzuki india":"MARUTI","mas financial services":"MASFIN","mastek":"MASTEK","master trust":"MASTERTR","matrimony.com":"MATRIMONY","mauria udyog":"MUL","mawana sugars":"MAWANASUG","max estates":"MAXESTATES","max financial services":"MFSL","max healthcare institute":"MAXHEALTH","max heights infrastucture":"MAXHEIGHTS","max india":"MAXIND","maxgrow india":"MAXGROW","maximus international":"MAXIMUS","mayank cattle food":"MCFL","mayur floorings":"MAYURFL","mayur leather products":"MAYUR","mayur uniquoters":"MAYURUNIQ","mazagon dock shipbuilders":"MAZDOCK","mazda":"MAZDA","mbl infrastructure":"MBLINFRA","mcleod russel india":"MCLEODRUSS","mcnally bharat engineering company":"MBECL","medi assist healthcare services":"MEDIASSIST","medi-caps":"MEDICAPQ","media matrix worldwide":"MMWL","mediaone global entertainment":"MEDIAONE","medicamen biotech":"MEDICAMEQ","medico intercontinental":"MIL","medico remedies":"MEDICO","medplus health services":"MEDPLUS","meenakshi india":"MEEIND","meenakshi steel industries":"MEENST","meera industries":"MEERA","meesho":"MEESHO","mefcom capital markets":"MEFCOMCAP","mega corporation":"MEGACOR","mega nirman & industries":"MNIL","megamont":"MEGAMONT","megastar foods":"MEGASTAR","meghmani organics":"MOL","meghna infracon infrastructure":"MIIL","megri soft":"MEGRISOFT","mehai technology":"MEHAI","mehta integrated finance":"MEHIF","mehta securities":"MEHSECU","mehul colours":"MEHUL","mehul telecom":"MTL","mena mani industries":"MENAMANI","menon bearings":"MENONBE","menon pistons":"MENNPIS","mep infrastructure developers":"MEP","mercantile ventures":"MERCANTILE","mercury ev-tech":"MERCURYEV","mercury laboratories":"MERCURYLAB","mercury trade links":"MERCTRD","merritronix":"MRTX","meta infotech":"METAINFO","metal coatings (india)":"METALCO","methodhub software":"METHODHUB","metro brands":"METROBRAND","metroglobal":"METROGLOBL","metropolis healthcare":"METROPOLIS","mewar hi-tech engineering":"MHEL","meyer apparel":"MAL","mfl india":"MFLINDIA","mfs intercorp":"MFSINTRCRP","mic electronics":"MICEL","microse india":"MICROSE","mid east portfolio management":"MIDEASTP","mid india industries":"MIDINDIA","midaas fashions":"MIDAAS","midland polymers":"MIDPOLY","midwest":"MIDWESTLTD","midwest energy":"REMAGNET","mihika industries":"MIHIKA","milestone furniture":"MILEFUR","milestone global":"MILESTONE","milgrey finance & investment":"ZMILGFIN","milkfood":"MLKFOOD","milky mist dairy food":"MILKYMIST","millennium online solutions (india)":"MILLENNIUM","millworks technologies":"MILLWORKS","minal industries":"MINALIND","minaxi textiles":"MINAXI","minda corporation":"MINDACORP","mindteck (india)":"MINDTECK","mini diamonds (india)":"MINID","mipco seamless rings (gujarat)":"MPCOSEMB","mirza international":"MIRZAINT","mish designs":"MISHDESIGN","mishka exim":"MISHKA","mishra dhatu nigam":"MIDHANI","mishtann foods":"MISHTANN","misquita engineering":"MISQUITA","mitshi india":"MITSHI","mitsu chem plast":"MITSU","mittal sections":"MITTALSTL","miven machine tools":"MIVENMACH","mizzen ventures":"MIZVEN","mkp mobility":"MKPMOB","mkventures capital":"MKVENTURES","mmtc":"MMTC","mobavenue ai tech":"MOBAVENUE","modella woollens":"MODWOOL","modern dairies":"MODAIRY","modern diagnostic & research centre":"MDRC","modern engineering and projects":"MEAPL","modern insulators":"MODINSU","modern malleables":"MODMA","modern shares and stockbrokers":"MODRNSH","modern steels":"MDRNSTL","modern thread (india)":"MODTHREAD","modi naturals":"MODINATUR","modi rubber":"MODIRUBBER","modipon":"MODIPON","modison":"MODISONLTD","modi\u2019s navnirman":"MODIS","modulex construction technologies":"MODULEX","mohit industries":"MOHITIND","mohit paper mills":"MOHITPPR","mohite industries":"MOHITE","moil":"MOIL","molbio diagnostics":"MOLBIO","mold-tek packaging":"MOLDTKPAC","mold-tek technologies":"MOLDTECH","monarch networth capital":"MONARCH","monarch surveyors and engineering consultants":"MSECL","money masters leasing & finance":"MMLF","moneyboxx finance":"MONEYBOXX","moneyview":"MONEYVIEW","monika alcobev":"MONIKA","monind":"MONIND","monotype india":"MONOT","monte carlo fashions":"MONTECARLO","moongipa capital finance":"MONGIPA","mopshop distribution":"MOPSHOP","morarka finance":"MORARKFI","morepen laboratories":"MOREPENLAB","morgan ventures":"MORGAN","moschip technologies":"MOSCHIP","mother nutri foods":"MNFL","motherson sumi wiring india":"MSUMI","motilal oswal financial services":"MOTILALOFS","motisons jewellers":"MOTISONS","motor & general finance (m.g.f.) lt":"MOTOGENFIN","mount housing and infrastructure":"MOUNT","mpdl":"MPDL","mpf systems":"MPFSL","mphasis":"MPHASIS","mpil corporation":"MPILCORPL","mpl plastics":"MPL","mps":"MPSLTD","mrc agrotech":"MRCAGRO","mrp agro":"MRP","mrs. bectors food specialities":"BECTORFOOD","mrugesh trading":"MRUTR","msafe equipments":"MSAFE","msl global":"MSLGLOBAL","msp steel & power":"MSPL","mstc":"MSTCLTD","mt educare":"MTEDUCARE","mtar technologies":"MTARTECH","mudra financial services":"MUDRA","mudunuru":"MUDUNURU","mufin green finance":"MUFIN","mukand":"MUKANDLTD","mukat pipes":"MUKATPIP","mukesh babu financial services":"MUKESHB","mukka proteins":"MUKKA","mukta agriculture":"MUKTA","mukta arts":"MUKTAARTS","muller & phipps (india)":"MULLER","multi commodity exchange of india":"MCX","multibase india":"MULTIBASE","multiplus holdings":"MULTIIN","multipurpose trading & agencies":"ZMULTIPU","munjal auto industries":"MUNJALAU","munjal showa":"MUNJALSHOW","munoth capital market":"MUNCAPM","munoth communication":"MCLTD","munoth financial services":"MUNOTHFI","murudeshwar ceramics":"MURUDCERA","music broadcast":"RADIOCITY","muthoot capital services":"MUTHOOTCAP","muthoot finance":"MUTHOOTFIN","muthoot microfin":"MUTHOOTMF","mv electrosystems":"MVELECTRO","my money securities":"MYMONEY","mysore petro chemicals":"MYSORPETRO","mystic electronics":"MYSTICELE","n.b. footwear":"NBFOOT","n.g.industries":"NGIND","n.k.industries":"NKIND","n.r.agarwal industries":"NRAIL","naapbooks":"NBL","nacdac infrastructure":"NACDAC","nacl industries":"NACLIND","nagarjuna agritech":"NAGTECH","nagpur power & industries":"NAGPI","nagreeka capital & infrastructure":"NAGREEKCAP","nagreeka exports":"NAGREEKEXP","nahar capital & financial services":"NAHARCAP","nahar industrial enterprises":"NAHARINDUS","nahar polyfilms":"NAHARPOLY","nahar spinning mills":"NAHARSPING","nakoda group of industries":"NGIL","naksh precious metals":"NAKSH","nalin lease finance":"NLFL","nalwa sons investment":"NSIL","nam securities":"NAM","nanavati ventures":"NVENTURES","nandan denim":"NDL","nanta tech":"NANTA","naperol investments":"NAPEROL","naps global india":"NAPSGLOBAL","narayana hrudayalaya":"NH","narendra properties":"NARPROP","narmada agrobase":"NARMADA","narmada gelatines":"SHAWGELTIN","narmada macplast drip irrigation sy":"NARMP","narmadesh brass industries":"NARMADESH","natco pharma":"NATCOPHARM","nath biogene india":"NATHBIOGEN","nath industries":"NATHIND","national aluminium co.":"NATIONALUM","national fertilizers":"NFL","national fittings":"NATFIT","national general industries":"NATGENI","national oxygen":"NOL","national peroxide":"NPL","national plastic industries":"NATPLAS","national plastic technologies":"NATPLASTI","national plywood industries":"NATPLY","national securities depository":"NSDL","national standard (india)":"NATIONSTD","national stock exchange of india":"NSE","natraj proteins":"NATRAJPR","natura hue chem":"NATHUEC","natural biocon (india)":"NATURAL","natural capsules":"NATCAPSUQ","naturewings holidays":"NHL","naturite agro products":"NAPL","nava":"NAVA","navigant corporate advisors":"NAVIGANT","navin fluorine international":"NAVINFLUOR","navkar corporation":"NAVKARCORP","navkar urbanstructure":"NAVKARURB","navneet education":"NAVNETEDUL","nazara technologies":"NAZARA","nbcc (india)":"NBCC","ncc":"NCC","ncc bluewater products":"NCCBLUE","ncl industries":"NCLIND","ncl research and financial services":"NCLRESE","nda securities":"NDASEC","ndl ventures":"NDLVENTURE","ndr auto components":"NDRAUTO","nectar lifesciences":"NECLIFE","neelamalai agro industries":"NEAGI","neelkanth":"NEELKANTH","neelkanth rockminerals":"NEELKAN","neeraj paper marketing":"NEERAJ","neetu yoshi":"NEETUYOSHI","neil industries":"NEIL","nelcast":"NELCAST","nelco":"NELCO","neo infracon":"NEOINFRA","neogen chemicals":"NEOGEN","neopolitan pizza and foods":"NPFL","nephrocare health services":"NEPHROPLUS","neptune logitek":"NEPLOG","nesco":"NESCO","nestle india":"NESTLEIND","net pix shorts digital media":"NETPIX","netlink solutions (india)":"NETLINK","nettlinx":"NETTLINX","netweb technologies india":"NETWEB","network 18 media & investments":"NETWORK18","network people services technologies":"NPST","neueon corporation":"NEUEON","neuland laboratories":"NEULANDLAB","new delhi television":"NDTV","new light industries":"NEWLIGHT","new markets avenue":"NEWMKTAVE","new swan multitech":"SWANAGRO","newgen software technologies":"NEWGEN","newtime infrastructure":"NEWINFRA","newtrac foods & beverages":"NEWTRAC","nexome capital markets":"NEXOME","next mediaworks":"NEXTMEDIA","nexus surgical and medicare":"NEXUSSURGL","nexxus petro industries":"NEXXUS","ngl fine chem":"NGLFINE","nhc foods":"NHCFOODS","nhpc":"NHPC","nibe":"NIBE","nicco parks and resorts":"NICCOPAR","nidhi granites":"NIDHGRN","nihar info global":"NIHARINF","niit":"NIITLTD","niit learning systems":"NIITMTS","nikhil adhesives":"NIKHILAD","nikki global finance":"NIKKIGL","niks technology":"NIKSTECH","nila infrastructures":"NILAINFRA","nila spaces":"NILASPACES","nilachal carbo metalicks":"NCML","nilachal refractories":"NILACHAL","nile":"NILE","nilkamal":"NILKAMAL","nilkanth engineering":"ZNILKENG","nimbus projects":"NIMBSPROJ","nintec systems":"NINSYS","nippon life india asset management":"NAM_INDIA","niraj cement structurals":"NIRAJ","nirav commercials":"NIRAVCOM","nirlon":"NIRLON","nirmitee robotics india":"NIRMITEE","nis management":"NISMGMT","nisus finance services co":"NISUS","nitco":"NITCO","nitin castings":"NITINCAST","nitin spinners":"NITINSPIN","nitta gelatin india":"NITTAGELA","niva bupa health insurance company":"NIVABUPA","nivaka fashions":"NIVAKA","nivi trading":"ZNIVITRD","niyogin fintech":"NIYOGIN","nlc india":"NLCINDIA","nmdc":"NMDC","nmdc steel":"NSLNISP","nms global":"NMSGLOBAL","noble polymers":"NOBPOL","nocil":"NOCIL","noida toll bridge company":"NOIDATOLL","norben tea & exports":"NORBTEAEXP","norris medicines":"NORRIS","north eastern carrying corporation":"NECCLTD","northern arc capital":"NORTHARC","northern spirits":"NSL","northlink fiscal and capital services":"NORTHLINK","nouveau global ventures":"NOUVEAU","nova agritech":"NOVAAGRI","nova iron & steel":"NOVIS","novartis india":"NOVARTIND","novateor research laboratories":"NOVATEOR","novelix pharmaceuticals":"NOVELIX","novus loyalty":"NOVUS","novyra pharmachem":"NOVYRA","npr finance":"NPRFIN","nrb bearings":"NRBBEARING","nrb industrial bearings":"NIBL","nsb bpo solutions":"NSBBPO","ntc industries":"NTCIND","ntpc":"NTPC","ntpc green energy":"NTPCGREEN","nucleus software exports":"NUCLEUS","nukleus office solutions":"NUKLEUS","nureca":"NURECA","nurture well industries":"NWIL","nutech global":"NUTECGLOB","nutricircle":"NUTRICIRCLE","nuvama wealth management":"NUVAMA","nuvoco vistas corporation":"NUVOCO","nyssa corporation":"NYSSACORP","o. p. chains":"OPCHAINS","oasis securities":"OASISEC","obcl":"OBCL","oberoi realty":"OBEROIRLTY","objectone information systems":"OONE","occl":"OCCLLTD","oceanic foods":"OCEANIC","octal credit capital":"OCTAL","octavius plantations":"OCTAVIUSPL","octaware technologies":"OCTAWARE","odigma consultancy solutions":"ODIGMA","odyssey corporation":"ODYCORP","odyssey technologies":"ODYSSEY","oil and natural gas corporation":"ONGC","oil country tubular":"OILCOUNTUB","oil india":"OIL","ok play india":"OKPLA","ola electric mobility":"OLAELEC","olatech solutions":"OLATECH","olectra greentech":"OLECTRA","olympia industries":"OLYMPTX","olympic cards":"OLPCL","olympic oil industries":"OLYOI","om freight forwarders":"OMFREIGHT","om galaxy":"OMG","om infra":"OMINFRAL","om metallogic":"OML","om power transmission":"OMPOWER","omax autos":"OMAXAUTO","omaxe":"OMAXE","omega ag-seeds (punjab)":"OMEAG","omega interactive technologies":"OMEGAIN","omkar pharmachem":"OMKARPH","omni axs software":"OMNIAX","omnipotent industries":"OMNIPOTENT","omnitech engineering":"OMNI","omnitex industries (india)":"OMNITEX","one 97 communications":"PAYTM","one global service provider":"ONEGLOBAL","one mobikwik systems":"MOBIKWIK","one point one solutions":"ONEPOINT","oneindig technologies":"ONEINDIG","onelife capital advisors":"ONELIFECAP","onemi technology solutions":"KISSHT","onesource industries and ventures":"OIVL","onesource specialty pharma":"ONESOURCE","onida electronics":"ONIDA","onix solar energy":"ONIXSOLAR","onmobile global":"ONMOBILE","ontic finserve":"ONTIC","onward technologies":"ONWARDTEC","optiemus infracom":"OPTIEMUS","optimus finance":"OPTIFIN","oracle financial services software":"OFSS","orbit exports":"ORBTEXP","orchasp":"ORCHASP","orchid pharma":"ORCHPHARMA","organic coatings":"ORGCOAT","organic recycling systems":"ORGANICREC","oricon enterprises":"ORICONENT","orient bell":"ORIENTBELL","orient beverages":"ORIBEVER","orient cables(india)":"ORIENTCABL","orient cement":"ORIENTCEM","orient ceratech":"ORIENTCER","orient electric":"ORIENTELEC","orient green power company":"GREENPOWER","orient paper & industries":"ORIENTPPR","orient press":"ORIENTLTD","orient technologies":"ORIENTTECH","orient tradelink":"ORIENTTR","oriental aromatics":"OAL","oriental hotels":"ORIENTHOT","oriental rail infrastructure":"ORIRAIL","oriental trimex":"ORIENTALTL","orissa minerals development company":"ORISSAMINE","orkla india":"ORKLAINDIA","orosil smiths india":"OROSMITHS","ortin global":"ORTINGLOBE","oseaspre consultants":"OSEASPR","osiajee texfab":"OSIAJEE","oswal agro mills":"OSWALAGRO","oswal greentech":"OSWALGREEN","oswal pumps":"OSWALPUMPS","oval projects engineering":"OVAL","ovobel foods":"OVOBELE","oxford industries":"OXFORDIN","oxygenta pharmaceutical":"OXYGENTAPH","p h capital":"PHCAP","p n gadgil jewellers":"PNGJL","p. b. films":"PBFL","p.b.m. polytex":"PBMPOLY","p.g.foils":"PGFOILQ","pace digitek":"PACEDIGITK","pace e-commerce ventures":"PACE","pacific industries":"PACIFICI","padam cotton yarns":"PADAMCO","padmalaya telefilms":"PADMALAYAT","padmanabh alloys & polymers":"PADALPO","padmanabh industries":"PADMAIND","page industries":"PAGEIND","paisalo digital":"PAISALO","pajson agro india":"PAJSON","pakka":"PAKKA","palash securities":"PALASHSECU","palco metals":"PALCO","palm jewels":"PALMJEWELS","palred technologies":"PALREDTEC","paluck technologies":"PALUCK","pan electronics india":"PANELEC","pan hr solution":"PANHR","pan india corporation":"PANINDIAC","panabyte technologies":"PANABYTE","panacea biotec":"PANACEABIO","panafic industrials":"PANAFIC","panama petrochem":"PANAMAPET","panasonic carbon india co.":"PANCARBON","panasonic energy india co.":"PANAENERG","panchatv bharat":"PANCHATV","panchmahal steel":"PANCHMAHQ","panchsheel organic":"PANCHSHEEL","panjon":"PANJON","pankaj polymers":"PANKAJPO","panorama studios international":"PANORAMA","panth infinity":"PANTH","panther industrial products":"PANIDPR","panyam cements & mineral inds.":"PANCM","paos industries":"PAOS","paradeep parivahan":"PPARIVAH","paradeep phosphates":"PARADEEP","parag milk foods":"PARAGMILK","paragon finance":"PARAGONF","paramount communications":"PARACABLES","paramount cosmetics (india)":"PARMCOS_B","paras defence and space technologies":"PARAS","paras petrofils":"PARASPETRO","park medi world":"PARKHOSPS","parker agro chem export":"PARKERAC","parle industries":"PARLEIND","parmeshwar metal":"PARMESHWAR","parmeshwari silk mills":"PARMSILK","parnax lab":"PARNAXLAB","parshva enterprises":"PARSHVA","parshwanath corporation":"PARSHWANA","parsvnath developers":"PARSVNATH","parvati sweetners and power":"PARVATI","pasari spinning mills":"PASARI","pashupati cotspin":"PASHUPATI","pasupati acrylon":"PASUPTAC","pasupati fincap":"PASUFIN","pasupati spg. & wvg. mills":"PASUSPG","patanjali foods":"PATANJALI","patdiam jewellery":"PJL","patel chem specialities":"PATELCHEM","patel engineering":"PATELENG","patel integrated logistics":"PATINTLOG","patel retail":"PATELRMART","patels airtemp (i)":"PATELSAI","patidar buildcon":"PATIDAR","patron exim":"PATRON","patspin india":"PATSPINLTD","paul merchants":"PML","paushak limited (formerly known as darshak limited)":"PAUSHAKLTD","pavna industries":"PAVNAIND","pb fintech":"POLICYBZR","pb global":"PBGLOBAL","pba infrastructure":"PBAINFRA","pc jeweller":"PCJEWELLER","pcbl chemical":"PCBL","pcs technology":"PCS","pdp shipping & projects":"PSPL","pds":"PDSL","pearl global industries":"PGIL","pearl green clubs and resorts":"PGCRL","pearl polymers":"PEARLPOLY","pecos hotels and pubs":"PECOS","pee cee cosma sope":"PCCOSMA","peeti securities":"PEETISEC","peninsula land":"PENINLAND","pennar industries":"PENIND","pentokey organy (india)":"PNTKYOR","perfect-octave media projects":"OCTAVE","perfectpac":"PERFEPA","permanent magnets":"PERMAGN","persistent systems":"PERSISTENT","pervasive commodities":"PERVASIVE","peshwa wheat":"PESHWA","pet plastics":"PETPLST","petronet lng":"PETRONET","pfizer":"PFIZER","pfl infotech":"PFLINFOTC","pg electroplast":"PGEL","phaarmasia":"PHRMASI","pharmaids pharmaceuticals":"PHARMAID","phoenix international":"PHOENXINTL","photon capital advisors":"PHOTON","photoquip india":"PHOTOQUP","phychem technologies":"PHYCHEM","physicswallah":"PWL","phyto chem (india)":"PHYTO","pi industries":"PIIND","piccadily agro industries":"PICCADIL","piccadily sugar & allied":"PICCASUG","picturehouse media":"PICTUREHS","pidilite industries":"PIDILITIND","pil italica lifestyle":"PILITA","pilani investment and industries corporation":"PILANIINVS","pind hospitality":"PIND","pine labs":"PINELABS","pioneer agro extracts":"PIONAGR","pioneer embroideries":"PIONEEREMB","pioneer investcorp":"PIONRINV","piotex industries":"PIOTEX","piramal finance":"PIRAMALFIN","piramal pharma":"PPLPHARMA","pitti engineering":"PITTIENG","pix transmissions":"PIXTRANS","plastiblends india":"PLASTIBLEN","platinum industries":"PLATIND","platinumone business services":"POBS","plaza wires":"PLAZACABLE","pmc fincorp":"PMCFIN","pnb gilts":"PNBGILTS","pnb housing finance":"PNBHOUSING","pnc infratech":"PNCINFRA","pnc media and entertainment":"PNC","pngs gargi fashion jewellery":"GARGI","pngs reva diamond jewellery":"PNGSREVA","pocl enterprises":"POEL","poddar pigments":"PODDARMENT","pokarna":"POKARNA","polo queen industrial and fintech":"PQIF","polson":"POLSON","poly medicure":"POLYMED","polycab india":"POLYCAB","polychem":"POLYCHEM","polycon international":"POLYCON","polylink polymers (india)":"POLYLINK","polymac thermoformers":"POLYMAC","polymechplast machines":"POLYCHMP","polyplex corporation":"POLYPLEX","polyspin exports":"POLYSPIN","pondy oxides & chemicals":"POCL","ponni sugars (erode)":"PONNIERODE","poojaa precision engg.":"PPEL","poojawestern metaliks":"POOJA","poona dal and oil industries":"POONADAL","poonawalla fincorp":"POONAWALLA","popees baby care india":"POPEES","popular estate management":"POPULARES","popular foundations":"PFL","popular vehicles and services":"PVSL","porwal auto components":"PORWAL","power & instrumentation (gujarat)":"PIGL","power finance corporation":"PFC","power grid corporation of india":"POWERGRID","power mech projects":"POWERMECH","powerica":"POWERICA","ppap automotive":"PPAP","prabha energy":"PRABHA","prabhhans industries":"PRABHHANS","prabhu steel industries":"ZPRBHSTE","pradeep metals":"PRADPME","prag bosimi synthetics":"PRAGBOS","praj industries":"PRAJIND","prajay engineers syndicate":"PRAENG","prakash industries":"PRAKASH","prakash pipes":"PPL","prakash steelage":"PRAKASHSTL","prakash woollen & synthetic mills":"PWASML","pranav constructions":"PRANAV","praruh technologies":"PRARUH","prashant india":"PRSNTIN","prasol chemicals":"PRASOLCHEM","prataap snacks":"DIAMONDYD","pratik panels":"PRATIK","praveg":"PRAVEG","praxis home retail":"PRAXIS","precision camshafts":"PRECAM","precision electronics":"PRECISIO","precision wires india":"PRECWIRE","premco global":"PREMCO","premier":"PREMIER","premier capital services":"PREMCAP","premier energies":"PREMIERENE","premier energy and infrastructure":"PEIL","premier explosives":"PREMEXPLN","premier polyfilm":"PREMIERPOL","premier synthetics":"PREMSYN","prerna infrabuild":"PRERINFRA","prestige estates projects":"PRESTIGE","prevest denpro":"PREVEST","pricol":"PRICOLLTD","prima agro":"PRIMAGR","prima industries":"PRIMAIN","prima innovation":"PRIMAINNO","prima plastics":"PRIMAPLA","prime capital market":"PRIMECAPM","prime focus":"PFOCUS","prime fresh":"PRIMEFRESH","prime industries":"PRIMIND","prime property development corporation":"PRIMEPRO","prime securities":"PRIMESECU","prime urban development india":"PRIMEURB","primo chemicals":"PRIMO","prince pipes and fittings":"PRINCEPIPE","priority jewels":"PRIORITY","prism finance":"PRISMFN","prism johnson":"PRSMJOHNSN","prism medico and pharmacy":"PRISMMEDI","prismx global ventures":"PRISMX","prithvi exchange (india)":"PRITHVIEXCH","pritika auto industries":"PRITIKAUTO","privi speciality chemicals":"PRIVISCL","priya":"PRIYALT","pro clb global":"PROCLB","pro fin capital services":"PROFINC","procter & gamble health":"PGHL","procter & gamble hygiene & health care":"PGHH","prodocs solutions":"PRODOCS","promact plastics":"PROMACT","promax power":"PROMAX","prospect consumer products":"PCL","prostarm info systems":"PROSTARM","protean egov technologies":"PROTEAN","prozone realty":"PROZONER","prudent corporate advisory services":"PRUDENT","prudential sugar corporation":"PRUDMOULI","ps it infrastructure & services":"PSITINFRA","psp projects":"PSPPROJECT","ptc india":"PTC","ptc india financial services":"PFS","ptc industries":"PTCIL","ptl enterprises":"PTL","pudumjee paper products":"PDMJEPAPER","pulsar international":"PULSRIN","punctual trading":"PUNCTRD","pune e - stock broking":"PESB","punjab & sind bank":"PSB","punjab chemicals and crop protection":"PUNJABCHEM","punjab communications":"PUNJCOMMU","punjab national bank":"PNB","puravankara":"PURVA","puretrop fruits":"PURETROP","purity flex pack":"PURITY","purohit construction":"PUROHITCON","purple agrotech industries":"PURPLE","purple finance":"PURPLEFIN","purple style labs":"PERNIASPOP","purple wave infocom":"PURPLEWAVE","purshottam investofin":"PURSHOTTAM","pushpsons industries":"PUSHPIN","pvp ventures":"PVP","pvr inox":"PVRINOX","pvv infra":"PVVINFRA","pyramid technoplast":"PYRAMID","pyxis finvest":"PYXISFIN","q&t foods":"QTFOODS","qgo finance":"QGO","quadrant future tek":"QUADFUTURE","quadrant televentures":"QUADRANT","qualitek labs":"QLL","quality power electrical equipments":"QPOWER","quality ro industries":"QRIL","quanto agroworld":"QAL","quantum asset management co. pvt.":"QNIFTY","quantum digital vision (india)":"QUANTDIA","quess corp":"QUESS","quest capital markets":"QUESTCAP","quest flow controls":"QUESTFLOW","quick heal technologies":"QUICKHEAL","quint digital":"QUINT","quintegra solutions":"QUINTEGRA","r k swamy":"RKSWAMY","r m drip and sprinklers systems":"RMDRIP","r r kabel":"RRKABEL","r s software india":"RSSOFTWARE","r systems international":"RSYSTEMS","r&b denims":"RNBDENIMS","r.j. shah & co.":"RJSHAH","r.r.financial consultants":"RRFIN","r.r.securities":"RRSECUR","raaj medisafe india":"RAAJMEDI","raama finance":"RAAMA","race eco chain":"RACE","rachit prints":"RACHIT","racl geartech":"RACLGEAR","raconteur global resources":"RACONTEUR","radaan mediaworks (i)":"RADAAN","radhagobind commercial":"RCL","radhe developers (india)":"RADHEDE","radhika jeweltech":"RADHIKAJWE","radiant cash management services":"RADIANTCMS","radico khaitan":"RADICO","radix industries (india)":"RADIXIND","raghav productivity enhancers":"RPEL","raghunath international":"RAGHUNAT","raghunath tobacco co.":"RAGHUTOB","raghuvansh agrofarms":"RAFL","raghuvir synthetics":"RAGHUSYN","raideep industries":"RAIDEEPIND","rail vikas nigam":"RVNL","railtel corporation of india":"RAILTEL","rain industries":"RAIN","rainbow children's medicare":"RAINBOW","rainbow foundations":"RAINBOWF","raj oil mills":"ROML","raj packaging industries":"RAJPACK","raj rayon industries":"RAJRILTD","raj television network":"RAJTV","raja bahadur international":"RAJABAH","rajapalayam mills":"RAJPALAYAM","rajasthan cylinders & containers":"RCCL","rajasthan petro synthetics":"RAJSPTR","rajasthan securities":"RAJSEC","rajasthan tube mfg. co":"RAJTUBE","rajdarshan industries":"ARENTERP","rajesh exports":"RAJESHEXPO","rajesh power services":"RAJESH","rajeshwari cans":"RCAN","rajkamal synthetics":"RAJKSYN","rajkot investment trust":"RAJKOTINV","rajnandini fashion india":"RFIL","rajnish retail":"RRETAIL","rajnish wellness":"RAJNISH","rajoo engineers":"RAJOOENG","rajputana investment and finance":"RAJPUTANA","rajputana stainless":"RSL","rajratan global wire":"RAJRATAN","rajshree sugars & chemicals":"RAJSREESUG","rajvi logitrade":"RAJVI","raksan transformers":"RAKSAN","rallis india":"RALLIS","ram ratna wires":"RAMRAT","rama paper mills":"RAMAPPR_B","rama phosphates":"RAMAPHO","rama steel tubes":"RAMASTEEL","rama vision":"RAMAVISION","ramco industries":"RAMCOIND","ramco systems":"RAMCOSYS","ramgopal polytex":"RAMGOPOLY","raminfo":"RAMINFO","ramkrishna forgings":"RKFORGE","ramky infrastructure":"RAMKY","ramsons projects":"RAMSONS","rana sugars":"RANASUG","rander corporation":"RANDER","rane (madras)":"RML","rane holdings":"RANEHOLDIN","ranjeet mechatronics":"RANJEET","ranjit securities":"RANJITSE","rap corp":"RAP","rapicut carbides":"RAPICUT","rapid investments":"RAPIDIN","rapid multimodal logistics":"RAPID","ras resorts & apart hotels":"RASRESOR","rasandik engg. industries india":"RASANDIK","rashi peripherals":"RPTECH","rashtriya chemicals & fertilizers":"RCF","rasi electrodes":"RASIELEC","rategain travel technologies":"RATEGAIN","rathi bars":"RATHIBAR","rathi steel & power":"RATHIST","ratnabhumi developers":"RATNABHUMI","ratnamani metals & tubes":"RATNAMANI","ratnaveer precision engineering":"RATNAVEER","rattanindia enterprises":"RTNINDIA","rattanindia power":"RTNPOWER","ravelcare":"RAVEL","ravi kumar distilleries":"RKDL","ravileela granites":"RALEGRA","ravinder heights":"RVHL","ravindra energy":"RELTD","raw edge industrial solutions":"RAWEDGE","raymond":"RAYMOND","raymond lifestyle":"RAYMONDLSL","raymond realty":"RAYMONDREL","rays of belief":"MOMSBELIEF","rbl bank":"RBLBANK","rbz jewellers":"RBZJEWEL","rdb infrastructure and power":"RDBIPL","rdb rasayans":"RDBRL","rdb real estate constructions":"RRECL","real eco-energy":"REALECO","real growth corporation":"RGCORP","real touch finance":"RTFL","rec":"RECLTD","recode studios":"RECODE","redington":"REDINGTON","redtape":"REDTAPE","reetech international":"REETECH","refex industries":"REFEX","regaal resources":"REGAAL","regal entertainment & consultants":"REGAL","reganto enterprises":"REGANTO","regency ceramics":"REGENCERAM","regency fincorp":"REGENCY","regent enterprises":"REGENTRP","regis industries":"REGIS","rekvina laboratories":"VINRKLB","relaxo footwears":"RELAXO","reliable data services":"RELIABLE","reliable ventures india":"RELIABVEN","reliance chemotex industries":"RELCHEMQ","reliance communications":"RCOM","reliance home finance":"RHFL","reliance industrial infrastructure":"RIIL","reliance industries":"RELIANCE","reliance infrastructure":"RELINFRA","reliance power":"RPOWER","relic technologies":"RELICTEC","relicab cable manufacturing":"RELICAB","religare enterprises":"RELIGARE","remi edelstahl tubulars":"REMIEDEL","remsons industries":"REMSONSIND","renaissance global":"RGL","rentomojo":"RENTOMOJO","repco home finance":"REPCOHOME","repono":"REPONO","repro india":"REPRO","resgen":"RESGEN","resonance specialties":"RESONANCE","resourceful automobile":"RAL","response informatics":"RESPONSINF","responsive industries":"RESPONIND","restaurant brands asia":"RBA","restile ceramics":"RESTILE","retaggio industries":"RETAGGIO","retina paints":"RETINA","retro green revolution":"RGRL","revathi equipment india":"RVTH","rex sealing and packing industries":"REXSEAL","rexnord electronics & controls":"REXNORD","rgf capital markets":"RGF","rhetan tmt":"RHETAN","rhi magnesita india":"RHIM","riba textiles":"RIBATEX","rich universe network":"RICHUNV","richfield financial services":"RFSL","rico auto industries":"RICOAUTO","riddhi corporate services":"RIDDHICORP","riddhi display equipments":"RDEL","riddhi siddhi gluco biols":"RIDDHI","riddhi steel and tube":"RSTL","ridhi synthetics":"RIDHISYN","rikhav securities":"RIKHAV","rir power electronics":"RIR","risa international":"RISAINTL","rishabh digha steel and allied prod":"RISHDIGA","rishabh instruments":"RISHABH","rishi laser":"RISHILASE","rishi techtex":"RISHITECH","rishiroop":"RISHIROOP","rita finance and leasing":"RFLL","ritco logistics":"RITCO","rites":"RITES","ritesh international":"RITESHIN","rithwik facility management services":"RITHWIKFMS","riyaasat lifestyle":"RIYAASAT","rkd agri & retail":"RKDAGRRTL","rlf":"RLF","rmc switchgears":"RMC","rnit ai solutions":"RNITAI","ro jewels":"ROJL","robokidz eduventures":"ROBOKIDZ","robust hotels":"RHL","rodium realty":"RODIUM","rolcon engineering co.":"ROLCOEN","rolex rings":"ROLEXRINGS","rollatainters":"ROLLT","roni households":"RONI","roopa industries":"ROOPAIND","roopa screen":"ROOPA","roopshri resorts":"ROOPSHRI","rose merc.":"ROSEMER","roselabs finance":"ROSELABS","rossari biotech":"ROSSARI","rossell india":"ROSSELLIND","rossell techsys":"ROSSTECH","roto pumps":"ROTO","rotographics (india)":"RGIL","route mobile":"ROUTE","royal cushion vinyl products":"ROYALCU","royal india corporation":"ROYALIND","royal orchid hotels":"ROHLTD","royal sense":"ROYAL","royale manor hotels & industries lt":"RAYALEMA","rpg life sciences":"RPGLIFE","rpp infra projects":"RPPINFRA","rpsg ventures":"RPSGVENT","rr metalmakers india":"RRMETAL","rril":"RRIL","rsc international":"RSCINT","rsd finance":"RSDFIN","rswm":"RSWM","rts power corporation":"RTSPOWR","rubfila international":"RUBFILA","rubicon research":"RUBICON","ruby mills":"RUBYMILLS","ruchi infrastructure":"RUCHINFRA","ruchira papers":"RUCHIRA","rudra ecovation":"RUDRAECO","rudra gas enterprise":"RUDRAGAS","rudra global infra products":"RUDRA","rukmani devi garg agro impex":"RDGAIL","rungta irrigation":"RUNGTAIR","runwal enterprises":"RUNWALENTR","rupa & company":"RUPA","ruparel food products":"RFL","rushil decor":"RUSHIL","s & s power switchgears":"S_SPOWER","s & t corporation":"STCORP","s chand and company":"SCHAND","s h kelkar and company":"SHK","s v global mill":"SVGLOBAL","s. m. gold":"SMGOLD","s.a.l. steel":"SALSTEEL","s.i.capital and financial services":"SICAPIT","s.j.s. enterprises":"SJS","s.k. offset":"SKOFFSET","s.p. apparels":"SPAL","s.p.capital financing":"SPCAPIT","s.v. trading & agencies":"ZSVTRADI","s.v.j.enterprises":"SVJ","saatvik green energy":"SAATVIKGL","sab industries":"SAB","saboo sodium chloro":"SABOOSOD","sabrimala industries india":"SIIL","sacheta metals":"SACHEMT","sadbhav engineering":"SADBHAV","sadbhav infrastructure project":"SADBHIN","sadhana nitrochem":"SADHNANIQ","safa systems & technologies":"SSTL","safari industries (india)":"SAFARI","safecure services":"SAFECURE","safety controls & devices":"SCDL","saffron industries":"SAFFRON","sagar cements":"SAGCEM","sagar systech":"SAGARSYST","sagarsoft (india)":"SAGARSOFT","sagility":"SAGILITY","sahara housingfina corporation":"SAHARAHOUS","sahara maritime":"SMARITIME","sahyadri industries":"SAHYADRI","sai capital":"SAICAPI","sai life sciences":"SAILIFE","sai parenteral's":"SAIPARENT","sai silks (kalamandir)":"KALAMANDIR","sai urja indo ventures":"SAIURJA","saianand commercial":"SAICOM","sailani tours n travels":"SAILANI","sainik finance and industries":"SAINIK","saint-gobain sekurit india":"SEKURITIND","saksoft":"SAKSOFT","sakthi finance":"SAKTHIFIN","sakthi sugars":"SAKHTISUG","sakuma exports":"SAKUMA","sal automotive":"SALAUTO","salasar techno engineering":"SALASAR","salem erode investments":"SALEM","salguti industries":"SALGUTI","salona cotspin":"SALONA","salora international":"SALORAINTL","salzer electronics":"SALZERELEC","sam industries":"SAMINDUS","sambandam spinning mills":"SAMBANDAM","sambhaav media":"SAMBHAAV","sambhv steel tubes":"SAMBHV","samhi hotels":"SAMHI","samkrg pistons and rings":"SAMKRG","sammaan capital":"SAMMAANCAP","samor reality":"SAMOR","sampann utpadan india":"SAMPANN","sampark india logistics":"SILL","sampat aluminium":"SAMPAT","sampre nutritions":"SAMPRE","samrat forgings":"SAMRATFORG","samrat pharmachem":"SAMRATPH","samsrita labs":"SAMSRITA","samtel (india)":"SAMTELIN","samtex fashions":"SAMTEX","samvardhana motherson international":"MOTHERSON","samyak international":"SAMYAKINT","sanathan textiles":"SANATHAN","sanathnagar enterprises":"SEL","sanblue corporation":"SANBLUE","sanchay finvest":"SANCF","sanco trans":"SANCTRN","sancode technologies":"SANCODE","sandesh":"SANDESH","sandhar technologies":"SANDHAR","sandu pharmaceuticals":"SANDUPHQ","sandur manganese & iron ores":"SANDUMA","sangal papers":"SANPA","sangam (india)":"SANGAMIND","sangam finserv":"SANGAMFIN","sanghvi brands":"SBRANDS","sanghvi movers":"SANGHVIMOV","sanjivani paranteral":"SANJIVIN","sanmit infra":"SANINFRA","sanofi consumer healthcare india":"SANOFICONR","sanofi india":"SANOFI","sanrhea technical textiles":"SANTETX","sansera engineering":"SANSERA","sanstar":"SANSTAR","sanwaria consumer":"SANWARIA","sapphire foods india":"SAPPHIRE","saptak chem and business":"SCBL","saptarishi agro industries":"SPTRSHI","sar auto products":"SAPL","saraswati commercial (india)":"ZSARACOM","saraswati saree depot":"SSDL","sarda energy & minerals":"SARDAEN","saregama india":"SAREGAMA","sarla performance fibers":"SARLAPOLY","sarthak global":"SARTHAKGL","sarthak industries":"SARTHAKIND","sarthak metals":"SMLT","sarvamangal mercantile co.":"ZSARVAMA","sarveshwar foods":"SARVESHWAR","sarvottam finvest":"SARVOTTAM","sashwat technocrats":"SASHWAT","sasken technologies":"SASKEN","satchmo holdings":"SATCH","satia industries":"SATIA","satin creditcare network":"SATIN","sattrix information security":"SATTRIX","satyam silk mills":"ZSATYASL","saumya consultants":"SAUMYA","saurashtra cement":"SAURASHCEM","saven technologies":"7TEC","savera industries":"SAVERA","savita oil technologies":"SOTL","sawaca enterprises":"SAWACA","sayaji hotels":"SAYAJIHOTL","sayaji hotels (indore)":"SHILINDORE","sayaji hotels (pune)":"SHPLPUNE","sayaji industries":"SAYAJIIND","sbc exports":"SBC","sbec sugar":"SBECSUG","sbec systems (ind)":"SBECSYS","sbfc finance":"SBFC","sbi cards and payment services":"SBICARD","sbi funds management":"SBIFUNDS","sbi life insurance company":"SBILIFE","sbl infratech":"SBLI","sc agrotech":"SCAGRO","scan projects":"SCANPRO","scan steels":"SCANSTL","scarnose international":"SCARNOSE","schaeffler india":"SCHAEFFLER","schneider electric infrastructure":"SCHNEIDER","schneider electric president systems":"SELECTRIC","scintilla commercial & credit":"SCC","scoda tubes":"SCODATUBES","scoobee day garments (india)":"SCOOBEEDAY","sdc techmedia":"SDC","sea tv network":"SEATV","sealmatic india":"SEALMATIC","seamec":"SEAMECLTD","seasons textiles":"SEASONST","secmark consultancy":"SECMARK","securekloud technologies":"SECURKLOUD","sedemac mechatronics":"SEDEMAC","seemax resources":"SEEMAX","sejal glass":"SEJALLTD","seksaria finance":"FINANCE","semac construction":"SEMAC","senco gold":"SENCO","senores pharmaceuticals":"SENORES","sepc":"SEPC","sera investments & finance india":"SERA","seshaasai technologies":"STYL","seshasayee paper & boards":"SESHAPAPER","setco automotive":"SETCO","setubandhan infrastructure":"SETUINFRA","seya industries":"SEYAIND","sg finserve":"SGFIN","sg mart":"SGMART","sgl resources":"SGLRES","sgn telecoms":"SGNTE","shadowfax technologies":"SHADOWFAX","shah alloys":"SHAHALLOYS","shah construction co.":"SHAHCON","shah foods":"SHAHFOOD","shah investor's home":"SHAHINVEST","shah metacorp":"SHAH","shahi shipping":"SHAHISHIP","shahlon silk industries":"SHAHLON","shaily engineering plastics":"SHAILY","shakti polytarp":"SHAKTIPOLY","shakti press":"SHAKTIPR","shakti pumps (india)":"SHAKTIPUMP","shalby":"SHALBY","shalibhadra finance":"SAHLIBHFI","shalimar paints":"SHALPAINTS","shalimar productions":"SHALPRO","shalimar wires industries":"SHALIWIR","sham foam":"SHAMFOAM","shangar decor":"SHANGAR","shankar lal rampal dye-chem":"SRD","shankara building products":"SHANKARA","shankara buildpro":"BUILDPRO","shankesh jewellers":"SHANKESH","shanmuga hospital":"SHANMUGA","shantanu sheorey aquakult":"SHAQUAK","shanthi gears":"SHANTIGEAR","shanti educational initiatives":"SEIL","shanti gold international":"SHANTIGOLD","shanti guru industries":"SHANTIGURU","shanti spintex":"SHANTIDENM","shantidoot infra services":"SISL","sharat industries":"SHINDL","sharda cropchem":"SHARDACROP","sharda ispat":"SHRDAIS","sharda motor industries":"SHARDAMOTR","shardul securities":"SHARDUL","share india securities":"SHAREINDIA","share samadhan":"SSL","sharika enterprises":"SHARIKA","sharma east india hospitals and res":"SHARMEH","sharp investments":"SHARPINV","sharpline broadcast":"SHARPLINE","sharvaya metals":"SHARVAYA","shashank traders":"SHASHANK","shashijit infraprojects":"SHASHIJIT","shashwat furnishing solutions":"SFSL","shayona engineering":"SHAYONAENG","sheela foam":"SFL","sheetal cool products":"SCPL","shekhawati industries":"SHEKHAWATI","shelter infra projects":"SIPL","shelter pharma":"SHELTER","shemaroo entertainment":"SHEMAROO","sheraton properties & finance":"ZSHERAPR","shervani industrial syndicate":"SHERVANI","sheshadri industries":"SHESHAINDS","shetron":"SHETR","shikhar leasing and trading":"SHIKHARLETR","shilchar technologies":"SHILCTECH","shilp gravures":"SHILGRAVQ","shilpa medicare":"SHILPAMED","shine fashions (india)":"SHINEFASH","shining tools":"SHTL","shipping corporation of india":"SCI","shipping corporation of india land and assets":"SCILAL","shiprocket":"SHIPROCKET","shipwaves online":"SHIPWAVES","shish industries":"SHISHIND","shiv texchem":"SHIVTEXCHEM","shiva cement":"SHIVACEM","shiva global agro industries":"SHIVAAGRO","shiva granito export":"SHIVAEXPO","shiva mills":"SHIVAMILLS","shiva suitings":"SHVSUIT","shiva texyarn":"SHIVATEX","shivagrico implements":"SHIVAGR","shivalik bimetal controls":"SBCL","shivalik rasayan":"SHIVALIK","shivam autotech":"SHIVAMAUTO","shivam chemicals":"SHIVAM","shivamshree businesses":"SBL","shivansh finserv":"SHIVA","shivchem agro":"SHIVCHEM","shivkamal impex":"SHIVKAMAL","shlokka dyes":"SHLOKKA","shoora designs":"SHOORA","shoppers stop":"SHOPERSTOP","shraddha prime projects":"SHRADDHA","shradha ai technologies":"SHRAAITECH","shree ajit pulp and paper":"SAPPL","shree balaji (mala) textiles":"MALA","shree bhavya fabrics":"SBFL","shree cements":"SHREECEM","shree digvijay cement co.":"SHREDIGCEM","shree ganesh biotech (india)":"SHREEGANES","shree ganesh elastoplast":"SHGANEL","shree ganesh remedies":"SGRL","shree hanuman sugar & industries":"HANSUGAR","shree hari chemicals export":"SHHARICH","shree karthik papers":"SHKARTP","shree krishna infrastructure":"SKIFL","shree krishna paper mills & industr":"SKPMIL","shree manufacturing co.":"SHRMFGC","shree marutinandan tubes":"SHREE","shree metalloys":"SHREMETAL","shree pacetronix":"SHREEPAC","shree precoated steels":"SPSL","shree pushkar chemicals & fertilisers":"SHREEPUSHK","shree rajasthan syntex":"SHRAJSYNQ","shree ram twistex":"SRTL","shree rama multi-tech":"SHREERAMA","shree rama newsprint":"RAMANEWS","shree refrigerations":"SHREEREF","shree renuka sugars":"RENUKA","shree salasar investment":"SALSAIN","shree securities":"SHREESEC","shree steel wire ropes":"SSWRL","shree tirupati balajee agro trading company":"BALAJEE","shree vatsaa finance & leasing":"SHVFL","shreeji shipping global":"SHREEJISPG","shreeji translogistics":"STL","shreenath investments co.":"SHRENTI","shreenath paper products":"SHREENATH","shreeshay engineers":"SHREESHAY","shreyans industries":"SHREYANIND","shreyas intermediates":"SHREYASI","shri bajrang alliance":"SHBAJRG","shri balaji valve components":"SBVCL","shri dinesh mills":"SHRIDINE","shri gang industries & allied products":"SHRIGANG","shri jagdamba polymers":"SHRJAGP","shri kalyan holdings":"SHKALYN","shri keshav cements and infra":"SKCIL","shri krishna devcon":"SHRIKRISH","shri niwas leasing and finance":"SHRINIWAS","shri rajivlochan oil extraction":"SHRAJOI","shri vasuprada plantations":"VASUPRADA","shri venkatesh refineries":"SVRL","shricon industries":"SHRICON","shringar house of mangalsutra":"SHRINGARMS","shriram asset management co.":"SRAMSET","shriram finance":"SHRIRAMFIN","shriram properties":"SHRIRAMPPS","shristi infrastructure development corporation":"SHRISTI","shrydus industries":"SHRYDUS","shubham polyspin":"SHUBHAM","shukra bullions":"SKRABUL","shukra jewellers":"SHUKJEW","shukra pharmaceuticals":"SHUKRAPHAR","shyam century ferrous":"SHYAMCENT","shyam metalics and energy":"SHYAMMETL","shyam telecom":"SHYAMTEL","shyama computronics and services":"SHYAMACOMP","shyamkamal investments":"SHYMINV","sibar auto parts":"SIBARAUT","sicagen india":"SICAGEN","sical logistics":"SICALLOG","siddha ventures":"SIDDHA","siddheswari garments":"SIDDHEGA","sidh automobiles":"SIDH","siemens":"SIEMENS","siemens energy india":"ENRIN","sigachi industries":"SIGACHI","sigma advanced systems":"SIGMAADV","sigma solve":"SIGMA","signature green corporation":"SIGNGCL","signatureglobal (india)":"SIGNATURE","signet industries":"SIGIND","signpost india":"SIGNPOST","sihora industries":"SIHORA","sika interplant systems":"SIKA","sil investments":"SILINV","silicon rental solutions":"SRSOLTD","silver oak (india)":"SILVOAK","silver oak commercial":"SILVERO","silver pearl hospitality & luxury spaces":"SILVERPRL","silver touch technologies":"SILVERTUC","silverstorm parks and resorts":"SSPRL","simandhar impex":"SIMANDHAR","simbhaoli sugars":"SIMBHALS","simmonds-marshall":"SIMMOND","simplex castings":"SIMPLEXCAS","simplex infrastructures":"SIMPLEXINF","simplex papers":"SIMPLXPAP","simplex realty":"SIMPLXREA","simran farms":"SIMRAN","sinclairs hotels":"SINCLAIR","sindhu trade links":"SINDHUTRAD","singer india":"SINGERIND","sinnar bidi udyog":"SINNAR","sirca paints india":"SIRCA","sirohia & sons":"SIROHIA","sis":"SIS","sita enterprises":"SITAENT","siti networks":"SITINET","siyaram recycling industries":"SIYARAM","siyaram silk mills":"SIYSIL","sizemasters technology":"SIZEMASTER","sjvn":"SJVN","sk international export":"SKIEL","sk minerals & additives":"SKM","skf india":"SKFINDIA","skf india (industrial)":"SKFINDUS","skipper":"SKIPPER","skm egg products exports (india) lt":"SKMEGGPROD","skp securities":"SKPSEC","sky gold and diamonds":"SKYGOLD","sky industries":"SKYIND","skybiotech healthcare":"SKYBIOTECH","skyline millars":"SKYLMILAR","skyways air services":"SKYWAYS","sm auto stamping":"SMAUTO","smart finsec":"SMARTFIN","smartlink holdings":"SMARTLINK","smartworks coworking spaces":"SMARTWORKS","smc credits":"SMCREDT","smc global securities":"SMCGLOBAL","smiths & founders (india)":"SMFIL","sml mahindra":"SMLMAH","smr jewels":"SMR","smruthi organics":"SMRUTHIORG","sms pharmaceuticals":"SMSPHARMA","smt engineering":"SMTEL","snl bearings":"SNL","snowman logistics":"SNOWMAN","sobha":"SOBHA","sobhagya mercantile":"SOBME","sodhani academy of fintech enablers":"SAFE","sodhani capital":"SODHACAP","sofcom systems":"SOFCOM","softrak venture investments":"SOFTRAKV","softtech engineers":"SOFTTECH","solar industries india":"SOLARINDS","solara active pharma sciences":"SOLARA","solarium green energy":"SOLARIUM","solarworld energy solutions":"SOLARWORLD","solex energy":"SOLEX","solid stone company":"SOLIDSTON","solitaire machine tools":"SOLIMAC","solvex edibles":"SOLVEX","som distilleries & breweries":"SDBL","soma textile & industries":"SOMATEX","somany ceramics":"SOMANYCERA","somi conveyor beltings":"SOMICONVEY","sona blw precision forgings":"SONACOMS","sonal adhesives":"SONALAD","sonal mercantile":"SONAL","sonalis consumer products":"SONALIS","sonaselection india":"SONA","sonata software":"SONATSOFTW","sophia traexpo":"STRAEXPO","sotefin bharat":"SOTEFIN","source industries (india)":"SOURCEIND","source natural foods & herbal suppl":"SOURCENTRL","south india paper mills":"STHINPA","south indian bank":"SOUTHBANK","south west pinnacle exploration":"SOUTHWEST","southern infoconsultants":"SOUTHERNIN","southern latex":"SOUTLAT","southern magnesium and chemicals lt":"SOUTHMG","southern petrochemical industries corporation":"SPIC","sovereign diamonds":"SOVERDIA","spa capital services":"SPACAPS","space incubatrics technologies":"SPACEINCUBA","span divergent":"SDL","spandana sphoorty financial":"SPANDANA","sparc electrex":"SPAR","sparkle gold rock":"SPARKLEGR","speciality medicines":"SPML","speciality restaurants":"SPECIALITY","spectra industries":"SPECTRA","spectrum electrical industries":"SPECTRUM","spectrum foods":"SPECFOOD","speedage commercials":"ZSPEEDCO","spencer's retail":"SPENCERS","spenta international":"SPENTA","spice islands industries":"SPICEISLIN","spice lounge food works":"SPICELOUNG","spicejet":"SPICEJET","spinaroo commercial":"SPINAROO","spl industries":"SPLIL","spml infra":"SPMLINFRA","sportking india":"SPORTKING","spr auto technologies":"SHRIPISTON","sprayking":"SPRAYKING","spright agro":"SPRIGHT","springform technology":"SFTL","spv global trading":"SPVGLOBAL","square four projects india":"SFPIL","sree chem resins":"SRECR","sree rayalaseema hi-strength hypo":"SRHHYPOLTD","sreeleathers":"SREEL","srestha finvest":"SRESTHA","srf":"SRF","srg fingrow finance":"SRGFFL","srg housing finance":"SRGHFL","sri amarnath finance":"AMARNATH","sri chakra cement":"SRICC","sri havisha hospitality and infrastructure":"HAVISHA","sri kpr industries":"SRIKPRIND","sri lakshmi saraswathi textiles (ar":"SLSTLQ","sri lotus developers and realty":"LOTUSDEV","sri nachammai cotton mills":"SRINACHA","sri ramakrishna mills (coimbatore)":"SRMCL","srigee dlm":"SRIGEE","srit india":"SRIT","srm contractors":"SRM","srm energy":"SRMENERGY","sru steels":"SRUSTEELS","ss retail":"SSRETAIL","ssmd agrotech india":"SSMD","sspdl":"SSPDL","sspn finance":"SSPNFIN","stallion india fluorochemicals":"STALLION","stanbik agro":"STANBIK","standard batteries":"STDBAT","standard capital markets":"STANCAP","standard engineering technology":"SETL","standard industries":"SIL","standard shoe sole and mould (india)":"STDSHOE","standard surfactants":"STDSFAC","stanley lifestyles":"STANLEY","stanpacks (india)":"STANPACK","stanrose mafatlal investments & fin":"STANROS","star cement":"STARCEMENT","star delta transformers":"STARDELTA","star health and allied insurance company":"STARHEALTH","star housing finance":"STARHFL","star imaging and path lab":"STARIMAGIN","star paper mills":"STARPAPER","starlineps enterprises":"STARLENT","starlog enterprises":"STARLOG","starsource multitrade":"STARSOURCE","starteck finance":"STARTECK","state bank of india":"SBIN","state trading corporation of india":"STCINDIA","steamhouse india":"STEAMHOUSE","steel authority of india":"SAIL","steel exchange india":"STEELXIND","steel strips & wheels":"SSWL","steel strips infrastructures":"STLSTRINF","steelcast":"STEELCAS","steelco gujarat":"STEELCO","steelman telecom":"STML","stel holdings":"STEL","stellant securities (india)":"STELLANT","stellar capital services":"STELLAR","step two corporation":"STEP2COR","sterling and wilson renewable energy":"SWSOLAR","sterling green woods":"STRGRENWO","sterling powergensys":"STERPOW","sterling tools":"STERTOOLS","sterlite technologies":"STLTECH","stl global":"SGL","stl networks":"STLNETWORK","storage technologies and automation":"STAL","stove kraft":"STOVEKRAFT","stovec industries":"STOVACQ","stratmont industries":"STRATMONT","strides pharma science":"STAR","string metaverse":"META","studds accessories":"STUDDS","stylam industries":"STYLAMIND","styrenix performance materials":"STYRENIX","subam papers":"SUBAM","subex":"SUBEXLTD","subhash silk mills":"SUBSM","subros":"SUBROS","sudal industries":"SUDAI","sudarshan chemical indus.":"SUDARSCHEM","sudarshan colorants india":"SUDARCOLOR","sudarshan pharma industries":"SUDARSHAN","sudeep pharma":"SUDEEPPHRM","suditi industries":"SUDTIND_B","sueryaa knitwear":"SUERYAAKNI","sugal & damani share brokers":"SUGALDAM","sugs lloyd":"SUGSLLOYD","sujala trading & holdings":"SUJALA","sukhjit starch & chemicals":"SUKHJITS","sula vineyards":"SULA","sulabh engineers & services":"SULABEN","sumedha fiscal services":"SUMEDHA","sumeet industries":"SUMEETINDS","sumeru industries":"SUMERUIND","sumitomo chemical india":"SUMICHEM","summit securities":"SUMMITSEC","sun pharma advanced research company":"SPARC","sun pharmaceutical industries":"SUNPHARMA","sun retail":"SUNRETAIL","sun tv network":"SUNTV","suncare traders":"SCTL","suncity synthetics":"SUNCITYSY","sundaram brake linings":"SUNDRMBRAK","sundaram finance":"SUNDARMFIN","sundaram multi pap":"SUNDARAM","sundaram-clayton":"SUNCLAY","sundram fasteners":"SUNDRMFAST","sundrop brands":"SUNDROP","sunflag iron & steel co.":"SUNFLAG","sungold capital":"SUNGOLD","sungold media and entertainment":"SMEL","sunil agro foods":"SUNILAGR","sunil healthcare":"SUNLOC","sunil industries":"SUNILTX","sunita tools":"SUNITATOOL","sunraj diamond exports":"SUNRAJDI","sunrakshakk industries india":"SUNRAKSHAK","sunrise efficient marketing":"SEML","sunrise industrial traders":"SUNRINV","sunshield chemicals":"SUNSHIEL","sunshine pictures":"SUNSHINE","sunsky logistics":"SUNSKY","sunteck realty":"SUNTECK","super bakers (india)":"SUPERBAK","super crop safe":"SUCROSA","super fine knitters":"SKL","super iron foundry":"SUPERIRON","super sales india":"SUPER","super spinning mills":"SUPERSPIN","super tannery":"SUPTANERY","superhouse":"SUPERHOUSE","superior finlease":"SUPERIOR","superior industrial enterprises":"SIEL","supershakti metaliks":"SUPERSHAKT","supertech ev":"SEVL","supertex industries":"SUPERTEX","supha pharmachem":"SUPHA","supra pacific financial services":"SUPRAPFSL","supra trends":"SUPRATRE","suprajit engineering":"SUPRAJIT","supreme holdings & hospitality (india)":"SUPREME","supreme industries":"SUPREMEIND","supreme infrastructure india":"SUPREMEINF","supreme petrochem":"SPLPETRO","supriya lifescience":"SUPRIYA","suraj":"SURAJLTD","suraj estate developers":"SURAJEST","suraj industries":"SURJIND","suraj products":"SURAJ","suraksha diagnostic":"SURAKSHA","surana solar":"SURANASOL","surana telecom and power":"SURANAT_P","surat trade and mercantile":"SURATRAML","suratwwala business group":"SBGLP","surbhi industries":"SURBHIN","surya india":"SURYAINDIA","surya roshni":"SURYAROSNI","suryaamba spinning mills":"SURYAAMBA","suryalakshmi cotton mills":"SURYALAXMI","suryalata spinning mills":"SURYALA","suryo foods & industries":"SURFI","suryoday small finance bank":"SURYODAY","susan electricals india":"SUSAN","sutlej textiles & industries":"SUTLEJTEX","suven life sciences":"SUVEN","suvidha infraestate corporation":"SICL","suvidhaa infoserve":"SUVIDHAA","suyog gurbaxani funicular ropeways":"SGFRL","suyog telematics":"SUYOG","suzlon energy":"SUZLON","sva india":"SVAINDIA","svam software":"SVAMSOF","svaraj trading & agencies":"ZSVARAJT","svarnim trade udyog":"SNIM","svc industries":"SVCIND","svp global textiles":"SVPGLOB","svs ventures":"SVS","sw investments":"SW1","swadeshi industries leasing co.":"SWADEIN","swadeshi polytex":"SWADPOL","swadha nature":"SWADHATURE","swagtam trading & services":"SWAGTAM","swan corp":"SWANCORP","swan defence and heavy industries":"SWANDEF","swaraj engines":"SWARAJENG","swaraj suiting":"SWARAJ","swarna securities":"SWRNASE","swarnsarita jewels india":"SWARNSAR","swashthik plascon":"SPL","swasth foodtech india":"SWASTH","swasti vinayaka art and heritage corporation":"SVARTCORP","swasti vinayaka synthetics":"SWASTIVI","swastika castal":"SWASTIKAAL","swastika infra":"SWASTIKAIN","swastika investmart":"SWASTIKA","swati projects":"SWATIPRO","swelect energy systems":"SWELECTES","swiggy":"SWIGGY","swiss military consumer goods":"SWISSMLTRY","switching technologies gunther":"SWITCHTE","swojas foods":"SWOJAS","sword-edge commercials":"SWORDEDGE","sylph industries":"SYLPH","symbiotec pharmalab":"SYMBIOTEC","symbiox investment & trading co.":"SYMBIOX","symphony":"SYMPHONY","syncom formulations (india)":"SYNCOMF","synergy green industries":"SGIL","syngene international":"SYNGENE","syrma sgs technology":"SYRMA","syschem (india)":"SYSCHEM","systematic industries":"SYSTEMATIC","systematix corporate services":"SYSTMTXC","systematix securities":"SYTIXSE","t & i global":"TIGLOB","t t":"TTL","t. spiritual world":"TSPIRITUAL","t.v.today network":"TVTODAY","taal tech":"TAALTECH","tahmar enterprises":"TAHMARENT","tai industries":"TAIIND","tainwala chemicals & plastics":"TAINWALCHM","taj gvk hotels & resorts":"TAJGVK","take":"TAKE","takyon networks":"TAKYON","talbros automotive components":"TALBROAUTO","talbros engineering":"TALBROSENG","tamboli industries":"TAMBOLIIN","tamil nadu newsprint and papers":"TNPL","tamilnad mercantile bank":"TMB","tamilnadu petroproducts":"TNPETRO","tamilnadu steel tubes":"TNSTLTU","tamilnadu telecommunications":"TNTELE","tandhan industries":"TANDHANIN","taneja aerospace & aviation":"TANAA","tanfac industries":"TANFACIND","tanla platforms":"TANLA","tanvi foods (india)":"TANVI","taparia tools":"TAPARIA","tarai foods":"TARAI","tarapur transformers":"TARAPUR","tarc":"TARC","tarini international":"TARINI","tarmat":"TARMAT","tarsons products":"TARSONS","tashi india":"TASHIND","tasty bite eatables":"TASTYBITE","tasty dairy specialities":"TDSL","tata capital":"TATACAP","tata chemicals":"TATACHEM","tata communications":"TATACOMM","tata consultancy services":"TCS","tata consumer products":"TATACONSUM","tata elxsi":"TATAELXSI","tata investment corporation":"TATAINVEST","tata motors passenger vehicles":"TMPV","tata power co.":"TATAPOWER","tata steel":"TATASTEEL","tata technologies":"TATATECH","tata teleservices (maharashtra)":"TTML","tatia global vennture":"TATIAGLOB","tatva chintan pharma chem":"TATVA","tavexia lifecare":"TAVEXIA","taylormade renewables":"TRL","tbo tek":"TBOTEK","tcc concept":"TCC","tcfc finance":"TCFCFINQ","tci express":"TCIEXP","tci finance":"TCIFINANCE","tci industries":"TCIIND","tcm":"TCMLMTD","tcpl packaging":"TCPLPACK","td power systems":"TDPOWERSYS","team india guaranty":"TEAMGTY","team24 consumer products":"TEAM24","teamlease services":"TEAMLEASE","teamo productions hq":"TPHQ","tech mahindra":"TECHM","techknowgreen solutions":"TECHKGREEN","technichem organics":"TECHNICHEM","techno electric & engineering company":"TECHNOE","technocraft industries (india)":"TIIL","technocraft ventures":"TECHNOCRAF","technocrats plasma systems":"TECHNOCRAT","technojet consultants":"TECHCON","technopack polymers":"TECHNOPACK","technvision ventures":"TECHNVISN","tecil chemicals & hydro power limit":"TECILCHEM","teesta agro industries":"TEEAI","tega industries":"TEGA","tejas networks":"TEJASNET","tejassvi aaharam":"TEJASSVI","tejnaksh healthcare":"TEJNAKSH","telecanor global":"TELECANOR","telge projects":"TELGE","telogica":"TELOGICA","tempsens instruments (india)":"TEMPSENS","tenneco clean air india":"TENNIND","tera software":"TERASOFT","terai tea co.":"TERAI","terraform magnum":"TERRAFORM","terraform realstate":"TERRAREAL","texel industries":"TEXELIN","texmaco infrastructure & holdings":"TEXINFRA","texmaco rail & engineering":"TEXRAIL","texmo pipes and products":"TEXMOPIPES","tgb banquets and hotels":"TGBHOTELS","tgif agribusiness":"TGIF","tgv sraac":"TGVSL","thacker & co.":"THACKER","thakker's developers":"THAKDEV","thakkers group":"THAKKERS","thakral services (india)":"THAKRAL","thangamayil jewellery":"THANGAMAYL","the andhra sugars":"ANDHRSUGAR","the anup engineering":"ANUP","the bombay burmah trading corporation":"BBTC","the byke hospitality":"BYKE","the hi-tech gears":"HITECHGEAR","the indian hotels company":"INDHOTEL","the indian wood products co.":"IWP","the investment trust of india":"THEINVEST","the new india assurance company":"NIACL","the phoenix mills":"PHOENIXLTD","the phosphate company":"PHOSPHATE","the ramco cements":"RAMCOCEM","the ravalgaon sugar farm":"RAVALSUGAR","the southern gas":"ZSOUTGAS","the yamuna syndicate":"YSL","themis medicare":"THEMISMED","thermax":"THERMAX","thinkink picturez":"THINKINK","thirani projects":"TPROJECT","thirumalai chemicals":"TIRUMALCHM","thomas cook (india)":"THOMASCOOK","thomas scott (india)":"THOMASCOTT","three m paper boards":"THREEMPAPE","thrive future habitats":"THRIVE","thyrocare technologies":"THYROCARE","tierra agrotech":"TIERRA","tiger logistics (india)":"TIGERLOGS","tijaria polypipes":"TIJARIA","til":"TIL","tilak ventures":"TILAK","tilaknagar industries":"TI","time technoplast":"TIMETECHNO","times green energy (india)":"TIMESGREEN","timex group india":"TIMEX","timken india":"TIMKEN","tinna rubber and infrastructure":"TINNARUBR","tipco engineering india":"TIPCO","tips films":"TIPSFILMS","tips music":"TIPSMUSIC","tirth plastic":"TIRTPLS","tirupati fin-lease":"TFLL","tirupati foam":"TIRUFOAM","tirupati innovar":"TIRUPATIIN","tirupati sarjan":"TIRSARJ","tirupati starch & chemicals":"TIRUSTA","titaanium ten enterprise":"TITAANIUM","titagarh rail systems":"TITAGARH","titan bio-tech":"TITANBIO","titan company":"TITAN","titan intech":"TITANIN","titan securities":"TITANSEC","tivoli construction":"TVOLCON","tokyo finance":"TOKYOFIN","tokyo plast international":"TOKYOPLAST","tolins tyres":"TOLINS","tomorrow technologies global innovations":"TTGIL","torrent pharmaceuticals":"TORNTPHARM","torrent power":"TORNTPOWER","toss the coin":"TTC","tourism finance corpn. of india":"TFCILTD","toyam sports":"TOYAMSL","tpi india":"TPINDIA","tpl plastech":"TPLPLASTEH","tracxn technologies":"TRACXN","trade wings":"TRADWIN","tradewell holdings":"TRADEWELL","trans india house impex":"TIHIL","trans-freight containers":"TRANSFRE","transchem":"TRANSCHEM","transcorp international":"TRANSCOR","transformers and rectifiers (india)":"TARIL","transgene biotek":"TRABI","transglobe foods":"TRANSFD","transindia real estate":"TREL","transoceanic properties":"TRANOCE","transpact enterprises":"TRANSPACT","transpek industry":"TRANSPEK","transport corporation of india":"TCI","transrail lighting":"TRANSRAILL","transvoy logistics india":"TRANSVOY","transwarranty finance":"TFL","transworld shipping lines":"TRANSWORLD","tranway21 technologies":"TRANWAY21","travel food services":"TRAVELFOOD","travels & rentals":"TRAVELS","tree house education & accessories":"TREEHOUSE","trejhara solutions":"TREJHARA","trent ltd [lakme ltd]":"TRENT","trescon":"TRESCON","trf":"TRF","tribhovandas bhimji zaveri":"TBZ","tricom fruit products":"TRICOMFRU","trident":"TRIDENT","trident lifeline":"TLL","trident texofab":"TTFL","trigyn technologies":"TRIGYN","triliance polymers":"TRILIANCE","trinity league india":"TRINITYLEA","trio mercantile & trading":"TRIOMERC","triochem products":"TRIPR","trishakti industries":"TRISHAKT","triton valves":"TRITONV","triumph international finance india":"TRIUMPIN","triveni engineering & industries":"TRIVENI","triveni enterprises":"TRIVENIENT","triveni glass":"TRIVENIGQ","triveni turbine":"TRITURBINE","trualt bioenergy":"TRUALT","trucap finance":"TRU","true colors":"TRUECOLORS","true green bio energy":"TRUEGREEN","trustedge capital":"TRUSTEDGE","trustwave securities":"TRUSTWAVE","tti enterprise":"TTIENT","ttk healthcare":"TTKHLTCARE","ttk prestige":"TTKPRESTIG","ttl enterprises":"TTLEL","tube investments of india":"TIINDIA","tulasee bio-ethanol":"TULASEEBIOE","tulsyan nec":"TULSYAN","tuni textile mills":"TUNITEX","turtlemint fintech solutions":"TURTLEMINT","tusaldah":"TUSALDAH","tuticorin alkali chemicals and fertilizers":"TUTIALKA","tv vision":"TVVISION","tvs electronics":"TVSELECT","tvs holdings":"TVSHLTD","tvs motor company":"TVSMOTOR","tvs srichakra":"TVSSRICHAK","tvs supply chain solutions":"TVSSCS","twamev construction and infrastructure":"TICL","twentyfirst century management serv":"21STCENMGM","twin roses trades & agencies":"TWIROST","tyche industries":"TYCHE","typhoon financial services":"TFSL","typhoon holdings":"TYPHOON","tyroon tea co.":"TYROON","u. h. zaveri":"UHZAVERI","u. y. fincorp":"UYFINCORP","u.p. hotels":"UPHOT","ucal":"UCAL","uco bank":"UCOBANK","uday jewellery industries":"UDAYJEW","udayshivakumar infra":"USK","uflex":"UFLEX","ufm industries":"UFMINDL","ufo moviez india":"UFO","ugar sugar works":"UGARSUGAR","ugro capital":"UGROCAP","uhm vacation":"UHMVL","ujaas energy":"UEL","ujjivan small finance bank":"UJJIVANSFB","ultracab (india)":"ULTRACAB","ultramarine & pigments":"ULTRAMAR","ultratech cement":"ULTRACEMCO","uma exports":"UMAEXPORTS","umiya buildcon":"UMIYA_MRO","umiya mobile":"UML","umiya tubes":"UMIYA","uni-abex alloy products":"UNIABEXAL","unichem laboratories":"UNICHEMLAB","unick fix-a- form and printers":"UNICK","unicommerce esolutions":"UNIECOM","unified data tech solutions":"UNIFIED","unifinz capital india":"UCIL","unijolly investments co.":"UNIJOLL","unimech aerospace and manufacturing":"UNIMECH","union bank of india":"UNIONBANK","uniparts india":"UNIPARTS","uniphos enterprises":"UNIENTER","unipro technologies":"UPROTECH","unique organics":"UNIQUEO","uniroyal industries":"UNIROYAL","uniroyal marine exports":"UNRYLMA","unisem agritech":"UNISEM","unishire urban infra":"UNISHIRE","unison metals":"UNISON","unitec fibres":"UNITEC","unitech":"UNITECH","unitech international":"UNITINT","united breweries":"UBL","united cotfab":"COTFAB","united credit":"UNITDCR","united drilling tools":"UNIDT","united foodbrands":"UFBL","united interactive":"UNITEDINT","united leasing & industries":"UNTTEMI","united polyfab gujarat":"UNITEDPOLY","united spirits":"UNITDSPR","united van der horst":"UVDRHOR","universal arts":"UNIVARTS","universal autofoundry":"UNIAUTO","universal cables":"UNIVCABLES","universal office automation":"UNIOFFICE","universal starch-chem allied":"UNIVSTAR","universus photo imagings":"UNIVPHOTO","uniworth securities":"UNIWSEC","unjha formulations":"UNJHAFOR","uno minda":"UNOMINDA","updater services":"UDS","upl":"UPL","upsurge investment and finance":"UPSURGE","ur sugar industries":"URSUGAR","uravi defence and technology":"URAVIDEF","urban company":"URBANCO","urja global":"URJA","usg tech solutions":"USGTECH","usha martin":"USHAMART","usha martin education & solutions":"UMESLTD","ushakiran finance":"USHAKIRA","uti asset management company":"UTIAMC","utique enterprises":"UTIQUE","utkarsh small finance bank":"UTKARSHBNK","utl industries":"UTLINDS","uttam sugar mills":"UTTAMSUGAR","uvs hospitality and services":"UVS","v b industries":"VBIND","v r films & studios":"VRFILMS","v-guard industries":"VGUARD","v-mart retail":"VMART","v.b.desai financial services":"VBDESAI","v.i.p. industries":"VIPIND","v.s.t.tillers tractors":"VSTTILLERS","v2 retail":"V2RETAIL","va tech wabag":"WABAG","vaarad ventures":"VAARAD","vadilal enterprises":"VADILENT","vadilal industries":"VADILALIND","vahh chemicals":"VAHH","vaibhav global":"VAIBHAVGBL","vaishno cement co.":"VAICC","vakrangee":"VAKRANGEE","valencia india":"VALINDIA","valencia nutrition":"VALENCIA","valiant communications":"VALIANT","valiant laboratories":"VALIANTLAB","valiant organics":"VALIANTORG","vallabh steels":"VALLABHSQ","valley magnesite company":"VALLEY","valor estate":"DBREALTY","valplast technologies":"VALPLAST","valson industries":"VALSONQ","vama industries":"VAMA","vama wovenfab":"VAMAWOVEN","vamshi rubber":"VAMSHIRU","vandan foods":"VANDAN","vani commercials":"VANICOM","vanta bioscience":"VANTABIO","vantage knowledge academy":"VKAL","vapi enterprise":"VAPIENTER","vardhan capital & finance":"VARDHANCFL","vardhman holdings":"VHL","vardhman polytex":"VARDMNPOLY","vardhman special steels":"VSSL","vardhman textiles limted":"VTL","variman global enterprises":"VARIMAN","varmora granito":"VARMORA","varroc engineering":"VARROC","varun beverages":"VBL","varun mercantile":"VARUNME","varvee global":"VGL","varyaa creations":"VARYAA","vas infrastructure":"VASINFRA","vascon engineers":"VASCONEQ","vashishtha luxury fashion":"VASHISHTHA","vashu bhagnani industries":"POOJAENT","vasundhara rasayans":"VRL","vaswani industries":"VASWANI","vaxfab enterprises":"VEL","vcu data management":"VCU","vedant asset":"VEDANTASSET","vedant fashions":"MANYAVAR","vedanta":"VEDL","vedanta aluminium metal":"VAML","vedanta iron and steel":"VISL","vedanta oil and gas":"VOGL","vedanta power":"VEDPOWER","vedavaag systems":"VEDAVAAG","veedol corporation":"VEEDOL","veefin solutions":"VEEFIN","veegaland developers":"VEEGALAND","veejay lakshmi engineering works lt":"VJLAXMIE","veer energy & infrastructure":"VEERENRGY","veer global infraconstruction":"VGIL","veerhealth care":"VEERHEALTH","veerkrupa jewellers":"VEERKRUPA","vega jewellers":"VEGA","vegorama punjabi angithi":"VPAL","velan hotels":"VELHO","veljan denison":"VELJAN","vellora impact":"VELLORA","velox shipping and logistics":"VELOX","venky's (india)":"VENKEYS","venlon enterprises":"VENLONENT","venmax drugs and pharmaceuticals":"VENMAX","ventive hospitality":"VENTIVE","ventura guaranty":"SHYAM","ventura textiles":"VENTURA","venus pipes & tubes":"VENUSPIPES","venus remedies":"VENUSREM","veranda learning solutions":"VERANDA","veritas (india)":"VERITAS","vertex securities":"VERTEX","vesuvius india":"VESUVIUS","veto switchgears and cables":"VETO","vibhor steel tubes":"VSTL","vibrant global capital":"VGCL","viceroy hotels":"VHLTD","victoria mills":"VICTMILL","vidhi specialty food ingredients":"VIDHIING","vidya wires":"VIDYAWIRES","vijay solvex":"VIJSOLX","vijaya diagnostic centre":"VIJAYA","viji finance":"VIJIFIN","vikalp securities":"VIKALPS","vikas ecotech":"VIKASECO","vikas lifecare":"VIKASLIFE","vikas proppant & granite":"VIKASPROP","vikas wsp":"VIKASWSP","vikram aroma":"VIKRAMAR","vikram kamats hospitality":"KAMATS","vikram solar":"VIKRAMSOLR","vikram thermo (india)":"VIKRAMTH","vikran engineering":"VIKRAN","viksit engineering":"VIKSHEN","vimta labs":"VIMTALABS","vinati organics":"VINATIORGA","vinayak polycon international":"VINAYAKPOL","vinayak vanijya":"VINVANI","vindhya telelinks":"VINDHYATEL","vineet laboratories":"VINEETLAB","vinny overseas":"VINNY","vintage coffee and beverages":"VINCOFE","vintage securities":"VINTAGES","vinyl chemicals (india)":"VINYLINDIA","vinyoflex":"VINYOFL","vip clothing":"VIPCLOTHNG","vippy spinpro":"VIPPYSP","vipul":"VIPULLTD","vipul organics":"VIPULORG","viram suvarn":"VSL","virat crane industries":"VIRATCRA","virat industries":"VIRAT","virat leasing":"VLL","virgo global":"VIRGOGLOB","virinchi":"VIRINCHI","virtual global education":"VIRTUALG","virtuoso optoelectronics":"VOEPL","virya resources":"VIRYA","visa chrome":"VISACHROME","visagar financial services":"VISAGAR","visagar polytex":"VIVIDHA","visaka industries":"VISAKAIND","vishal bearings":"VISHALBL","vishal fabrics":"VISHAL","vishal mega mart":"VMM","vishnu chemicals":"VISHNU","vishnu prakash r punglia":"VPRPL","vishvprabha ventures":"VISVEN","vishwaraj sugar industries":"VISHWARAJ","vision cinemas":"VISIONCINE","vision corporation":"VISIONCO","vista pharmaceuticals":"VISTAPH","vistar amar":"VISTARAMAR","vivaa tradecom":"VIVAA","vivanta industries":"VIVANTA","vivanza biosciences":"VIVANZA","vivekanand cotspin":"VIVEKANAND","vivid global industries":"VIVIDIND","vivid mercantile":"VIVIDM","vivimed labs":"VIVIMEDLAB","vivo bio tech":"VIVOBIOT","viyash scientific":"VIYASH","vjtf eduservices":"VJTFEDU","vk global industries":"VKGLOBAL","vl e-governance & it solutions":"VLEGOV","vls finance":"VLSFINANCE","vms industries":"VMS","vms tmt":"VMSTMT","vodafone idea":"IDEA","voith paper fabrics india":"VOITHPAPR","voltaire leasing & finance":"VOLLF","voltamp transformers":"VOLTAMP","voltas":"VOLTAS","vraj iron and steel":"VRAJ","vrl logistics":"VRLLOG","vruddhi engineering works":"VRUDDHI","vrundavan plantation":"VPL","vsd confin":"VSDCONF","vsf projects":"VSFPROJ","vst industries":"VSTIND","vtm":"VTMLTD","vvip infratech":"VVIPIL","vxl instruments":"VXLINSTR","w.h. brady & co.":"WHBRADY","w.s. industries (india)":"WSI","waa solar":"WAA","waaree energies":"WAAREEENER","waaree renewable technologies":"WAAREERTL","waaree technologies":"WAAREE","wagend infra venture":"WAGEND","wakefit innovations":"WAKEFIT","walchand peoplefirst":"WALCHPF","walchandnagar industries":"WALCHANNAG","wallfort financial services":"WALLFORT","wanbury":"WANBURY","wardwizard foods and beverages":"WARDWIZFBL","wardwizard healthcare":"WARDHEALTH","wardwizard innovations and mobility":"WARDINMOBI","warren tea":"WARRENTEA","waterbase":"WATERBASE","waterways leisure tourism":"CORDELIA","we win":"WEWIN","wealth first portfolio managers":"WEALTH","web element solutions":"WEBSL","websol energy system":"WEBELSOLAR","weizmann":"WEIZMANIND","welcast steels":"ZWELCAST","welcure drugs & pharmaceuticals":"WELCURE","welspun corp":"WELCORP","welspun enterprises":"WELENT","welspun investments and commercials":"WELINV","welspun living":"WELSPUNLIV","welspun specialty solutions":"WELSPLSOL","welterman international":"WELTI","wendt (india)":"WENDT","wep solutions":"WEPSOLN","west coast paper mills":"WSTCSTPAPR","west leisure resorts":"WESTLEIRES","western carriers (india)":"WCIL","western ministil":"WMINIMT","western overseas study abroad":"WOSAL","westlife foodworld":"WESTLIFE","wework india management":"WEWORK","wheels india":"WHEELS","wherrelz it solutions":"WITS","whirlpool of india":"WHIRLPOOL","white hall commercial co.":"WHITHAL","white organic agro":"WHITEORG","william magor & company":"WILLAMAGOR","williamson financial services":"WILLIMFI","windlas biotech":"WINDLAS","windsor machines":"WINDMACHIN","winro commercial (india)":"WINROC","winsome breweries":"WINSOMBR","winsome textile industries":"WINSOMTX","wipro":"WIPRO","wires & fabriks (sa)":"WIREFABR","wockhardt":"WOCKPHARMA","women networks":"WOMENNET","wonder electricals":"WEL","wonderla holidays":"WONDERLA","woodsvilla":"WOODSVILA","workmates core2cloud solution":"WORKMATES","worldwide aluminium":"WWALUM","worth investment & trading co":"WORTH","worth peripherals":"WORTHPERI","wpil":"WPIL","wsfx global pay":"WSFX","xchanging solutions":"XCHANGING","xelpmoc design and tech":"XELPMOC","xpro india":"XPROINDIA","xtglobal infotech":"XTGLOBAL","xtranet technologies":"XTRANET","yaan enterprises":"YAANENT","yaashvi jewellers":"YAASHVI","yajur fibres":"YAJUR","yamini investments company":"YAMNINV","yarn syndicate":"YARNSYN","yash chemex":"YASHCHEM","yash highvoltage":"YASHHV","yash innoventures":"YASHINNO","yash management & satellite":"YASHMGM","yashhtej industries (india)":"YASHHTEJ","yasho industries":"YASHO","yashraj containeurs":"YASHRAJC","yatharth hospital & trauma care services":"YATHARTH","yatra online":"YATRA","yes bank":"YESBANK","yogi":"YOGI","yogi sung-won (india)":"YOGISUNG","york exports":"YORKEXP","yug decor":"YUG","yuken india":"YUKEN","yunik managing advisors":"YUNIKM","yuranus infrastructure":"YURANUS","yuvraaj hygiene products":"YUVRAAJHPL","z.f. steering gear (india)":"ZFSTEERING","zaggle prepaid ocean services":"ZAGGLE","zeal aqua":"ZEAL","zee entertainment enterprises":"ZEEL","zee learn":"ZEELEARN","zee media corporation":"ZEEMEDIA","zelio e mobility":"ZELIO","zen technologies":"ZENTEC","zenith exports":"ZENITHEXPO","zenith fibres":"ZENIFIB","zenith health care":"ZENITHHE","zenith steel pipes and industries":"ZENITHSTL","zenlabs ethica":"ZENLABS","zenotech laboratories":"ZENOTECH","zensar technologies":"ZENSARTECH","zf commercial vehicle control systems india":"ZFCVINDIA","zim laboratories":"ZIMLAB","zinema media and entertainment":"ZINEMA","zodiac clothing co.":"ZODIACLOTH","zodiac energy":"ZODIAC","zodiac ventures":"ZODIACVEN","zodiac-jrd-mkj":"ZODJRDMKJ","zr2 bioenergy":"ZR2","zuari agro chemicals":"ZUARI","zuari industries":"ZUARIIND","zydus lifesciences":"ZYDUSLIFE","zydus wellness":"ZYDUSWELL"};

  const EXCHANGE_BY_COUNTRY = {
    IN: 'BSE', US: 'NASDAQ', GB: 'LSE', DE: 'XETR', JP: 'TSE', KR: 'KRX', CN: 'HKEX', TW: 'TPEX',
    FR: 'EURONEXT', NL: 'EURONEXT', AU: 'ASX', BR: 'BVMF', CH: 'SIX', SA: 'TADAWUL', RU: 'MOEX'
  };
  function guessSymbol(name) {
    // COMPANIES (not E.COMPANIES) - this function lives inside the Engine IIFE itself, where COMPANIES is
    // already a local const (declared above). "E" is the name the UI layer uses *outside* Engine to refer
    // to it (const E = Engine); referencing E here was a real bug - from inside Engine's own scope there is
    // no E at all, so every call to guessSymbol() threw "ReferenceError: E is not defined" before this fix.
    const n = name.toLowerCase();
    let known = COMPANIES.find(c => c.name.toLowerCase() === n || c.aliases.some(a => a.toLowerCase() === n));
    // Fallback: a partial/substring match (either direction) before giving up on finding this company at
    // all. Bug this caught in practice: a user tracking "Maruti Suzuki" typed just "Maruti" - no exact name
    // match, no alias for the short form (fixed separately above) - and with ONLY the exact-match check
    // above, that silently fell through to the 'NASDAQ' default below and produced NASDAQ:MARUTI, a symbol
    // that doesn't exist, for an Indian company. Defaulting an unmatched name to NASDAQ is a reasonable
    // guess for a genuinely unknown/freehand company (most of this app's freehand tickers will be US names),
    // but it's a wrong-country guess whenever the name is actually a known company typed slightly differently
    // - this partial match catches that case first, so "Maruti" still resolves to the real IN/BSE listing.
    //
    // WORD-BOUNDARY match, not raw substring - a real bug caught while adding "Persistent Systems" (ticker
    // PERSISTENT) earlier this session: a bare raw .includes() check meant typing just "SIS" (itself a real,
    // separately-listed BSE company, Security and Intelligence Services Ltd) matched "Persistent" purely
    // because the letters "sis" happen to appear inside "perSIStent" - nothing to do with either company's
    // actual name. containsWordRun (below) only matches when one side's whole words appear as a contiguous
    // run inside the other's words, so "Maruti" still matches the words ["maruti","suzuki"], but "sis" never
    // matches the single word ["persistent"] since "sis" isn't one of that word's own words.
    if (!known && n.length >= 3) { // guard: below 3 chars, a word-boundary match is more likely noise than
                                    // signal - better to fall through to the NASDAQ default for those than
                                    // risk matching the wrong company entirely.
      const nWords = n.split(/\s+/).filter(Boolean);
      known = COMPANIES.find(c => {
        const cWords = c.name.toLowerCase().split(/\s+/).filter(Boolean);
        if (containsWordRun(cWords, nWords) || containsWordRun(nWords, cWords)) return true;
        return c.aliases.some(a => {
          const aWords = a.toLowerCase().split(/\s+/).filter(Boolean);
          return containsWordRun(aWords, nWords) || containsWordRun(nWords, aWords);
        });
      });
    }
    // A per-company exchange override (COMPANY_ROWS' 6th field, e.g. "NYSE" for Boeing/Ford/GM/ExxonMobil/
    // Chevron/JPMorgan/Goldman Sachs/Pfizer, or "NASDAQ" for ASML's US ADR listing) always wins over the
    // blanket per-country default - that default is right for most US/NL names but wrong for these specific
    // ones, confirmed individually against TradingView's own symbol pages.
    const exch = (known && known.exchange) || (known && EXCHANGE_BY_COUNTRY[known.code]) || 'NASDAQ';
    // A VERIFIED real ticker on the matched company (COMPANY_ROWS' 5th field) always wins over guessing -
    // this is what actually fixed "Reliance Industries" opening a nonexistent BSE:RELIANCEINDU instead of
    // the real BSE:RELIANCE, and "Jio"/"Adani" opening fabricated symbols instead of their real listings.
    if (known && known.ticker) return exch + ':' + known.ticker;
    // Second-tier lookup: BSE_SCRIP_LOOKUP (below), built from BSE's own official master equity list
    // (bseindia.com's published Security Id for every Active-listed equity - ~4,800 companies, user-supplied
    // this round), not guessed or scraped. This is what makes the difference between "we verified ~70
    // companies by hand" and actually covering the exchange: anyone typing a real BSE-listed company name
    // we haven't hand-curated into COMPANIES (with its richer short-name aliases) still gets the real
    // ticker instead of falling through to a fabricated one.
    //
    // Reached whenever there's no verified ticker yet AND the company isn't confidently placed on some OTHER
    // exchange: "known" is either nothing at all (a genuinely freehand name - the common case, since every
    // hand-curated IN entry above already has a ticker and returned already) or a matched company that IS
    // tagged IN but has no ticker yet. Deliberately NOT gated on exch === 'BSE' the way an earlier version of
    // this code was - that gate only ever fires when "known" is already a matched IN company, which either
    // already returned above via known.ticker or can't reach here with exch === 'BSE' at all, making the
    // whole broad lookup dead code for the one case it exists for: a freehand name with NO COMPANIES match,
    // where known is null and exch has already defaulted to NASDAQ before reaching this line.
    if (!known || known.code === 'IN') {
      const bseTicker = BSE_SCRIP_LOOKUP[n] || (n.length >= 3 ? bseScripPartialMatch(n) : null);
      if (bseTicker) return 'BSE:' + bseTicker;
    }
    // Only when neither lookup has this company (truly unlisted, or a non-Indian name) does this fall back
    // to the plain guess: strip anything that isn't a letter/number, uppercase it. Right often enough for
    // short, single-word Western names (AAPL, TSLA-style), and for everything else the widget's own search
    // is the real correction path - a starting point, never a claim of accuracy the way a verified ticker is.
    const ticker = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    return exch + ':' + ticker;
  }
  // Partial match against the full BSE scrip lookup - same spirit as the COMPANIES partial-match fallback
  // above (catching "Maruti" for "Maruti Suzuki"), but DELIBERATELY STRICTER: word-boundary containment,
  // not raw substring containment. The broad table has ~44 very short (<=3 char) company names (ITC, SRF,
  // SIS, REC, ...) and several of those are common English letter sequences ("sis", "ans", "ist", "rec",
  // "pds") that would turn up inside all kinds of unrelated freehand text under a plain .includes() check -
  // "Crisis Management Corp" contains "sis", "Analysis Partners" contains "ans", and so on. A raw substring
  // match at this table's scale (4,800 entries vs. ~120 in COMPANIES) makes that kind of accidental hit
  // likely rather than a theoretical edge case, so this checks whole-word membership instead: split both
  // the typed text and each candidate name into words, and only match when one side's words fully contain
  // the other's as a whole run of words (so "Maruti" still matches the words ["maruti","suzuki"], but
  // "crisis" never matches the single word ["sis"] since "sis" isn't one of crisis's own words).
  function bseScripPartialMatch(n) {
    const nWords = n.split(/\s+/).filter(Boolean);
    for (const key in BSE_SCRIP_LOOKUP) {
      const keyWords = key.split(/\s+/).filter(Boolean);
      if (containsWordRun(keyWords, nWords) || containsWordRun(nWords, keyWords)) return BSE_SCRIP_LOOKUP[key];
    }
    return null;
  }
  // True if `needle`'s words appear as a contiguous run inside `haystack`'s words, in order.
  function containsWordRun(haystack, needle) {
    if (!needle.length || needle.length > haystack.length) return false;
    for (let i = 0; i <= haystack.length - needle.length; i++) {
      if (needle.every((w, j) => haystack[i + j] === w)) return true;
    }
    return false;
  }

  /* ---------- sector index symbols (for the "View sector" chart, alongside the single-stock chart) ----------
     Tata Motors is correctly tagged Automotive (COMPANY_ROWS above) - not a misclassification. This map gives
     that same sector a benchmark index to chart next to the single stock, so e.g. an Automotive story shows
     both Tata Motors AND the sector it moves with. Indian sectors map to the matching S&P BSE sectoral index
     (real, exchange-published indices - BSE:AUTO, BSE:BANK, etc. - each verified to exist as a TradingView
     widget symbol). NSE sectoral indices (NIFTYAUTO etc.) deliberately are NOT used here: confirmed via
     TradingView's own Data FAQ that NSE is excluded from the free widget entirely - not delayed, not
     restricted-by-plan, just never shown, same "This symbol is only available on TradingView" wall as NSE
     equities. BSE sectoral indices are the free-widget-safe equivalent (same EOD-only limit as BSE stocks -
     see EXCHANGE_BY_COUNTRY above). Sectors with no confirmed BSE sectoral index, and non-Indian sectors in
     general, fall back to a widely-tracked global sector ETF as the closest available benchmark.
     Deliberately short list: only sectors that actually have a sensible single benchmark are here -
     everything else (Geopolitics, Economy, Climate, ...) has no stock-market index and isn't included, so
     "View sector" simply doesn't appear for those stories rather than guessing a bad symbol. */
  const SECTOR_INDEX = {
    Automotive: { in: ['BSE:AUTO', 'BSE Auto'], global: ['AMEX:CARZ', 'Global Auto'] },
    Banking: { in: ['BSE:BANK', 'BSE Bankex'], global: ['AMEX:KBE', 'Global Banks'] },
    'Metals & Mining': { in: ['BSE:METAL', 'BSE Metal'], global: ['AMEX:XME', 'Global Metals & Mining'] },
    Healthcare: { in: ['BSE:HC', 'BSE Healthcare'], global: ['NASDAQ:IBB', 'Global Biotech'] },
    // No BSE pharma-specific index is confirmed to exist separately from Healthcare (TradingView's BSE:HC
    // page covers both hospitals and drugmakers together), so Pharmaceuticals uses that same real, confirmed
    // index as its Indian benchmark rather than being left without one - it's broader than ideal, but it's a
    // genuine sectoral index Sun Pharma/Cipla/Dr Reddy's actually belong to, not a fabricated symbol.
    Pharmaceuticals: { in: ['BSE:HC', 'BSE Healthcare'], global: ['NASDAQ:IBB', 'Global Biotech'] },
    Technology: { in: ['BSE:TECK', 'BSE Teck'], global: ['NASDAQ:QQQ', 'Nasdaq 100'] },
    Energy: { in: ['BSE:OILGAS', 'BSE Oil & Gas'], global: ['AMEX:XLE', 'Global Energy'] },
    Consumer: { in: ['BSE:FMCG', 'BSE FMCG'], global: ['AMEX:XLP', 'Global Consumer Staples'] },
    // S&P BSE Realty Index - confirmed live on TradingView (tradingview.com/symbols/BSE-REALTY, "S&P BSE
    // REALTY INDEX", components led by DLF). Added for the new Infrastructure/realty names (DLF, Godrej
    // Properties) now that Infrastructure covers both industrial and real-estate companies - closer to those
    // specific names than the generic global infrastructure ETF fallback it had before.
    Infrastructure: { in: ['BSE:REALTY', 'BSE Realty'], global: ['AMEX:PAVE', 'Global Infrastructure'] },
    Semiconductors: { global: ['NASDAQ:SOXX', 'Semiconductors'] },
    Aerospace: { global: ['AMEX:ITA', 'Aerospace & Defense'] },
    Defence: { global: ['AMEX:ITA', 'Aerospace & Defense'] },
    // S&P BSE Power Index - confirmed live on TradingView (ideas page titled "BSE POWER INDEX", symbol logo
    // sandp-bse-power-index). No single global "Power" ETF is as universally recognized as XLE/CARZ/KBE for
    // other sectors, so Power stays India-only here rather than pairing it with a shaky global guess.
    Power: { in: ['BSE:POWER', 'BSE Power'] }
  };
  function guessSectorIndex(companyName, sector) {
    const row = SECTOR_INDEX[sector];
    if (!row) return null;
    const known = COMPANIES.find(c => c.name.toLowerCase() === companyName.toLowerCase()
      || c.aliases.some(a => a.toLowerCase() === companyName.toLowerCase()));
    // Each side carries its own [symbol, label] pair - a US company under "Automotive" shows "Global Auto"
    // next to the Nasdaq-listed global ETF, never the Indian "Nifty Auto" label next to a non-Indian symbol.
    // Some sectors (e.g. Power) are India-only and have no "global" pair at all - a non-Indian company (or an
    // Indian one somehow without a BSE index) in that sector has no benchmark to show, so this returns null
    // rather than destructuring an undefined pair, which previously would have thrown and crashed the "View
    // Chart" modal open entirely instead of just hiding the sector toggle for that one story.
    const pair = (known && known.code === 'IN' && row.in) ? row.in : row.global;
    if (!pair) return null;
    const [symbol, label] = pair;
    return { symbol, label };
  }

  /* ---------- sectors (most specific first, ties go to the earlier one) ---------- */
  const SECTORS = [
    { name: 'Semiconductors', kw: ['semiconductor*', 'chip', 'chipmaker*', 'chipmaking', 'chip-making', 'wafer*', 'foundry', 'foundries', 'lithography', 'EUV', 'fab', 'fabs', 'TSMC', 'ASML', 'Nvidia', 'GPU', 'DRAM', 'NAND', 'integrated circuit*', 'nanometre*', 'nanometer*', 'HBM'],
      sub: { 'Equipment': ['equipment', 'lithography', 'EUV', 'ASML', 'Applied Materials', 'Lam Research', 'Tokyo Electron', 'machinery'], 'Foundry': ['foundry', 'foundries', 'TSMC', 'SMIC', 'wafer*', 'fab', 'fabs'], 'Memory': ['memory', 'DRAM', 'NAND', 'HBM', 'SK Hynix', 'Micron'], 'Chip design': ['GPU', 'Nvidia', 'AMD', 'Qualcomm', 'Broadcom', 'chip design', 'fabless'] } },
    { name: 'Automotive', kw: ['automotive', 'auto industry', 'auto sales', 'automaker*', 'carmaker*', 'car sales', 'car maker*', 'vehicle*', 'passenger vehicle*', 'two-wheeler*', 'OEM', 'OEMs', 'electric vehicle*', 'cs:EV', 'cs:EVs', 'hybrid*', 'ADAS', 'autonomous driving', 'self-driving', 'auto component*', 'auto parts', 'commercial vehicle*', 'truck*', 'SUV*', 'dealership*'],
      sub: { 'EV': ['electric vehicle*', 'cs:EV', 'cs:EVs', 'charging station*', 'charging', 'plug-in', 'BYD', 'Tesla'], 'Batteries': ['battery', 'batteries', 'lithium-ion', 'cathode', 'anode', 'gigafactory', 'CATL'], 'ADAS': ['ADAS', 'autonomous driving', 'self-driving', 'driver assistance', 'lidar'], 'Components': ['auto component*', 'auto parts', 'supplier*', 'tier-1', 'wiring harness', 'transmission'], 'Commercial vehicles': ['commercial vehicle*', 'truck*', 'bus', 'buses', 'fleet'], 'ICE': ['petrol', 'diesel', 'combustion', 'internal combustion'] } },
    { name: 'Pharmaceuticals', kw: ['pharma*', 'drug*', 'FDA', 'USFDA', 'clinical trial*', 'vaccine*', 'biotech*', 'generic*', 'active pharmaceutical*', 'drug approval*', 'medicine*', 'CDSCO', 'biosimilar*', 'drugmaker*'], sub: {} },
    { name: 'Healthcare', kw: ['hospital*', 'healthcare', 'health care', 'patient*', 'medical device*', 'disease*', 'diagnostics', 'cs:WHO', 'public health', 'clinic*', 'doctors'], sub: {} },
    { name: 'Defence', kw: ['defence', 'defense', 'weapon*', 'armed forces', 'army', 'navy', 'air force', 'missile*', 'fighter jet*', 'drone*', 'ammunition', 'submarine*', 'warship*', 'military', 'troops', 'arms deal*', 'Pentagon'], sub: {} },
    { name: 'Aerospace', kw: ['aerospace', 'aircraft', 'aviation', 'airline*', 'airplane*', 'Boeing', 'Airbus', 'satellite*', 'space launch*', 'rocket*', 'ISRO', 'NASA', 'SpaceX', 'jet engine*', 'airport*'], sub: {} },
    { name: 'Metals & Mining', kw: ['copper', 'aluminium', 'aluminum', 'steel', 'iron ore', 'zinc', 'nickel', 'lithium', 'cobalt', 'gold', 'silver', 'mining', 'miner*', 'smelter*', 'rare earth*', 'metal*', 'bauxite', 'coking coal', 'platinum', 'palladium', 'critical mineral*'],
      sub: { 'Steel': ['steel', 'iron ore', 'coking coal'], 'Base metals': ['copper', 'aluminium', 'aluminum', 'zinc', 'nickel', 'smelter*'], 'Precious metals': ['gold', 'silver', 'platinum', 'palladium'], 'Critical minerals': ['lithium', 'cobalt', 'rare earth*', 'critical mineral*'] } },
    { name: 'Energy', kw: ['oil', 'crude', 'Brent', 'WTI', 'OPEC', 'natural gas', 'LNG', 'refiner*', 'refinery', 'refineries', 'pipeline*', 'power plant*', 'electricity', 'power demand', 'coal', 'renewable*', 'solar', 'wind power', 'wind farm*', 'nuclear power', 'hydrogen', 'energy', 'fuel', 'petroleum', 'power grid', 'utilities'],
      sub: { 'Oil & gas': ['oil', 'crude', 'Brent', 'WTI', 'OPEC', 'natural gas', 'LNG', 'refiner*', 'refinery', 'pipeline*', 'petroleum'], 'Power': ['electricity', 'power plant*', 'power demand', 'power grid', 'utilities', 'nuclear power'], 'Renewables': ['renewable*', 'solar', 'wind power', 'wind farm*', 'hydrogen'], 'Coal': ['coal'] } },
    { name: 'Chemicals', kw: ['chemical*', 'petrochemical*', 'polymer*', 'specialty chemical*', 'chlor-alkali', 'solvent*', 'plastic*', 'resin*', 'ammonia', 'methanol'], sub: {} },
    { name: 'Telecom', kw: ['telecom*', '5G', '6G', 'spectrum', 'broadband', 'mobile subscriber*', 'Jio', 'Airtel', 'Vodafone', 'telco*', 'fibre', 'fiber optic*', 'satellite internet'], sub: {} },
    { name: 'Technology', kw: ['artificial intelligence', 'cs:AI', 'machine learning', 'LLM', 'chatbot*', 'generative', 'OpenAI', 'cloud', 'data centre*', 'data center*', 'cybersecurity', 'cyberattack*', 'cyber attack*', 'ransomware', 'hack*', 'software', 'SaaS', 'algorithm*', 'smartphone*', 'quantum', 'robotics', 'big tech', 'startup*', 'tech company', 'tech companies', 'operating system*', 'app store'],
      sub: { 'AI': ['artificial intelligence', 'cs:AI', 'machine learning', 'LLM', 'chatbot*', 'generative', 'OpenAI', 'GPU*'], 'Cloud': ['cloud', 'data centre*', 'data center*', 'AWS', 'Azure', 'hyperscaler*'], 'Cybersecurity': ['cybersecurity', 'cyberattack*', 'cyber attack*', 'ransomware', 'hack*', 'breach*', 'malware', 'data leak*'], 'Software': ['software', 'SaaS', 'app store', 'operating system*'], 'Hardware': ['smartphone*', 'laptop*', 'devices', 'hardware', 'wearable*', 'electronics'] } },
    { name: 'Banking', kw: ['bank', 'banks', 'banking', 'central bank*', 'Federal Reserve', 'FOMC', 'ECB', 'interest rate*', 'rate cut*', 'rate hike*', 'basis points', 'monetary policy', 'lender*', 'lending', 'loan*', 'NPA', 'NPAs', 'NBFC*', 'credit growth', 'deposit*', 'repo rate', 'Basel', 'mortgage*', 'fintech', 'UPI', 'RBI', 'PBOC'],
      sub: { 'Monetary policy': ['central bank*', 'Federal Reserve', 'FOMC', 'ECB', 'interest rate*', 'rate cut*', 'rate hike*', 'basis points', 'monetary policy', 'repo rate', 'RBI', 'PBOC'], 'Lending': ['lender*', 'lending', 'loan*', 'NPA', 'NPAs', 'credit growth', 'mortgage*', 'NBFC*'], 'Fintech': ['fintech', 'UPI', 'digital payment*'] } },
    { name: 'Finance', kw: ['stock market*', 'equity market*', 'equities', 'bond*', 'yield*', 'currency', 'forex', 'IPO', 'merger*', 'acquisition*', 'private equity', 'venture capital', 'hedge fund*', 'investor*', 'crypto*', 'bitcoin', 'mutual fund*', 'dividend*', 'valuation*', 'credit rating*', 'downgrade*', 'upgrade*', 'funding round*', 'shares'], sub: {} },
    { name: 'Logistics', kw: ['logistics', 'shipping', 'freight', 'cargo', 'container*', 'port', 'ports', 'supply chain*', 'Red Sea', 'Suez', 'Panama Canal', 'railway*', 'trucking', 'warehous*', 'vessel*', 'tanker*', 'shipping line*'], sub: {} },
    { name: 'Agriculture', kw: ['agricultur*', 'crop*', 'farm*', 'wheat', 'rice', 'corn', 'soybean*', 'sugar', 'monsoon', 'fertilizer*', 'fertiliser*', 'pesticide*', 'harvest*', 'food prices', 'irrigation', 'edible oil', 'palm oil', 'cotton'], sub: {} },
    { name: 'Climate', kw: ['climate', 'emission*', 'carbon', 'net zero', 'net-zero', 'global warming', 'heatwave*', 'flood*', 'drought*', 'hurricane*', 'cyclone*', 'wildfire*', 'sea level', 'ESG', 'greenhouse', 'cs:COP30'], sub: {} },
    { name: 'Infrastructure', kw: ['infrastructure', 'highway*', 'bridge*', 'metro', 'airport', 'construction', 'cement', 'real estate', 'housing', 'smart city', 'tunnel*', 'dam', 'dams', 'urban development'], sub: {} },
    { name: 'Manufacturing', kw: ['manufactur*', 'factory', 'factories', 'plant closure*', 'industrial output', 'PLI scheme', 'assembly line*', 'capacity expansion', 'machinery', 'industrial production', 'PMI'], sub: {} },
    { name: 'Consumer', kw: ['consumer*', 'retail', 'retailer*', 'FMCG', 'e-commerce', 'ecommerce', 'brand*', 'restaurant*', 'apparel', 'footwear', 'luxury', 'household', 'consumer spending', 'consumption', 'festive demand'], sub: {} },
    { name: 'Economy', kw: ['GDP', 'inflation', 'CPI', 'recession', 'unemployment', 'jobs report', 'growth forecast*', 'fiscal', 'deficit*', 'trade deficit', 'economic', 'economy', 'economies', 'stimulus', 'tariff*', 'trade war', 'imports', 'exports', 'consumer confidence', 'retail sales', 'budget', 'wage*', 'trade agreement*', 'trade deal*'], sub: {} },
    { name: 'Geopolitics', kw: ['war', 'ceasefire', 'invasion', 'sanction*', 'diplomatic', 'diplomacy', 'summit', 'treaty', 'border', 'conflict*', 'tensions', 'NATO', 'Security Council', 'embassy', 'coup', 'election*', 'protest*', 'territorial', 'sovereignty', 'alliance*', 'geopolitic*', 'airstrike*', 'hostage*', 'nuclear talks'], sub: {} }
  ];
  const SECTOR_NAMES = SECTORS.map(s => s.name).concat('Other');

  /* ---------- importance ---------- */
  const IMP_TIERS = [
    { w: 6, terms: ['war', 'invasion', 'invade*', 'nuclear', 'missile*', 'airstrike*', 'coup', 'martial law', 'terror*', 'collapse*', 'default*', 'blockade', 'embargo', 'pandemic', 'bankruptcy', 'insolvency', 'blackout', 'cyberattack*', 'ransomware', 'explosion*', 'assassinat*', 'hostage*', 'casualt*', 'famine', 'meltdown', 'bank run', 'evacuat*'] },
    { w: 3, terms: ['sanction*', 'tariff*', 'export control*', 'export ban*', 'restriction*', 'shortage*', 'disruption*', 'plunge*', 'plummet*', 'soar*', 'surge*', 'spike*', 'record high', 'record low', 'all-time high', 'crash*', 'halt*', 'suspend*', 'probe', 'investigation', 'lawsuit*', 'antitrust', 'downgrade*', 'layoff*', 'job cuts', 'strike*', 'crackdown', 'merger*', 'acquisition*', 'takeover', 'bailout', 'rate cut*', 'rate hike*', 'interest rate*', 'recall*', 'output cut*', 'production cut*', 'price hike*', 'trade deal*', 'trade agreement*', 'trade war', 'ceasefire', 'treaty', 'ban', 'banned', 'ruling', 'fraud', 'scandal', 'breach*', 'outage*', 'crisis', 'crises', 'emergency', 'outbreak', 'reroute*', 'rerouting', 'warn*', 'monetary policy', 'repo rate', 'policy rate', 'rate decision*', 'cut* output', 'cut* production', 'unrest', 'evict*', 'seiz*'] },
    { w: 1, terms: ['announce*', 'launch*', 'approve*', 'plans', 'expects', 'forecast*', 'expansion', 'expand*', 'invest*', 'partnership', 'contract*', 'orders', 'sales', 'results', 'earnings', 'growth', 'profit*', 'revenue', 'guidance', 'quarter*', 'deal*', 'appoint*', 'outlook', 'signs', 'signed', 'unveil*', 'rise', 'rises', 'fall*', 'drop*', 'jump*', 'slump*', 'inflation', 'GDP'], cap: 4 }
  ];
  const LOW_TERMS = ['opinion', 'explainer', 'newsletter', 'weekly roundup', 'webinar', 'advertisement', 'sponsored', 'podcast', 'interview', 'recap', 'roundup'];
  const IMP_ORDER = ['Critical', 'High', 'Medium', 'Low'];
  const impRank = i => 3 - IMP_ORDER.indexOf(i); // Critical=3 … Low=0

  /* ---------- classification ---------- */
  function classifyCountry(text, head, companies, headline) {
    const scores = new Map();
    COUNTRIES.forEach(c => {
      let s = 0;
      c.aliases.forEach(a => {
        const inHead = count(head, a);
        const inBody = count(text, a);
        if (inHead) s += 3;
        s += Math.min(inBody, 4);
      });
      if (s) scores.set(c.name, s);
    });
    companies.forEach(co => {
      const n = COUNTRY_BY_CODE[co.code];
      if (n) scores.set(n, (scores.get(n) || 0) + 1);
    });
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const strong = ranked.filter(r => r[1] >= 2);
    const hl = headline || head.split('\n')[0];
    const globalCue = GLOBAL_CUES.some(g => count(head, g) > 0 || count(text, g) > 1);
    const globalInHeadline = GLOBAL_CUES.some(g => count(hl, g) > 0);
    const inHl = ranked.filter(r => COUNTRY_BY_NAME[r[0]].aliases.some(a => count(hl, a) > 0)).map(r => r[0]);
    let primary;
    if (!ranked.length) primary = 'Global';
    else if (globalInHeadline) primary = 'Global';
    else if (inHl.length === 1) primary = inHl[0];
    else if (inHl.length >= 4 || (strong.length >= 4 && ranked[0][1] < ranked[1][1] * 2) || (globalCue && ranked[0][1] < 5)) primary = 'Global';
    else primary = ranked[0][0];
    const involved = ranked.filter(r => r[0] !== primary && r[1] >= 2).slice(0, 5).map(r => r[0]);
    if (primary === 'Global' && ranked.length) {
      return { primary, involved: ranked.filter(r => r[1] >= 2).slice(0, 5).map(r => r[0]) };
    }
    return { primary, involved };
  }

  function classifySector(text, head, companies) {
    const scores = SECTORS.map(sec => {
      let s = 0;
      sec.kw.forEach(k => {
        if (count(head, k)) s += 3;
        s += Math.min(count(text, k), 3);
      });
      companies.forEach(co => { if (co.sector === sec.name) s += 3; });
      return s;
    });
    let bi = -1, best = 0;
    scores.forEach((s, i) => { if (s > best) { best = s; bi = i; } });
    if (bi < 0 || best < 3) return { sector: 'Other', subsector: '', also: [] };
    const sec = SECTORS[bi];
    let sub = '', subBest = 0;
    Object.entries(sec.sub).forEach(([name, kws]) => {
      let s = 0;
      kws.forEach(k => { if (count(head, k)) s += 3; s += Math.min(count(text, k), 3); });
      if (s > subBest) { subBest = s; sub = name; }
    });
    const also = scores.map((s, i) => [SECTORS[i].name, s]).filter(x => x[0] !== sec.name && x[1] >= Math.max(3, best * 0.6))
      .sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
    return { sector: sec.name, subsector: subBest >= 1 ? sub : '', also };
  }

  function classifyImportance(text, head, spread) {
    const body = text.slice(0, 4000);
    let score = 0, critPts = 0;
    const signals = [];
    IMP_TIERS.forEach(t => {
      let tierPts = 0;
      t.terms.forEach(term => {
        const inHead = count(head, term) > 0;
        const inBody = inHead || count(body, term) > 0;
        if (!inBody) return;
        tierPts += t.w * (inHead ? 2 : 1);
        if (t.w >= 3 && signals.length < 6) signals.push(term.replace(/\*/g, '').replace(/^cs:/, ''));
      });
      if (t.w === 6) critPts = tierPts;
      score += t.cap ? Math.min(tierPts, t.cap) : tierPts;
    });
    LOW_TERMS.forEach(term => { if (count(head, term) > 0) score -= 3; });
    if (spread >= 3) score += 2;
    // Critical needs a critical-tier term in the headline (or two in the body), or an extreme total
    const level = (critPts >= 12 || score >= 28) ? 'Critical' : score >= 5 ? 'High' : score >= 2 ? 'Medium' : 'Low';
    return { importance: level, score, signals };
  }

  function findCompanies(text) {
    const found = [];
    COMPANIES.forEach(co => {
      if (co.aliases.some(a => new RegExp('(?<![A-Za-z0-9_])' + escRe(a) + '(?![A-Za-z0-9_])').test(text))) found.push(co);
    });
    return found.slice(0, 8);
  }

  /* ---------- headline, summary, dates ---------- */
  function cleanLine(s) {
    return s.replace(/https?:\/\/\S+/g, '')
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200d]/gu, '')
      .replace(/^[\s\-\u2013\u2014\u2022\u00b7*#>|]+/, '')
      .replace(/^(breaking|just in|alert|update|exclusive|flash|news)\s*[:\-\u2013\u2014|]\s*/i, '')
      .replace(/[*_`~]+/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function clip(s, n) {
    if (s.length <= n) return s;
    const cut = s.slice(0, n - 1);
    return cut.slice(0, Math.max(cut.lastIndexOf(' '), n * 0.6)).replace(/[,;:\-\u2013\u2014]+$/, '') + '\u2026';
  }
  function pickHeadline(text, fallback) {
    const lines = text.split(/\n+/).map(cleanLine).filter(Boolean);
    for (const l of lines.slice(0, 25)) {
      if (l.length < 18 || !/[A-Za-z]{3}/.test(l)) continue;
      if (/^(page\s*\d+|\d+\s*(of|\/)\s*\d+|table of contents|contents|confidential|disclaimer|research|report)$/i.test(l)) continue;
      const first = l.split(/(?<=[.!?])\s+(?=[A-Z0-9"\u201c'(])/)[0];
      if (l.length > 100 && first.length >= 25 && first.length < l.length) return clip(first.replace(/[.\s]+$/, ''), 160);
      if (l.length > 170) return clip(l, 160);
      return l.replace(/[.\s]+$/, '');
    }
    return clip(cleanLine(text) || fallback || 'Untitled item', 160);
  }
  function sentences(text) {
    const out = [];
    text.split(/\n+/).forEach(line => {
      line = line.trim();
      if (!line) return;
      line.split(/(?<=[.!?])\s+(?=[A-Z0-9"\u201c'(])/).forEach(s => {
        s = cleanLine(s);
        if (s.length >= 30) out.push(s.length > 380 ? clip(s, 380) : s);
      });
    });
    return out;
  }
  function reflow(text) {
    // join hard-wrapped PDF lines; keep short lines (headings) separate
    return text.replace(/([^\n]{50,}[^.!?:;\n\s])[ \t]*\n(?!\n)/g, '$1 ');
  }
  function summarise(text, headline) {
    const hk = headline.slice(0, 40).toLowerCase();
    const sents = sentences(text).filter(s => !s.toLowerCase().startsWith(hk));
    if (!sents.length) {
      const one = cleanLine(text);
      return { summary: one.toLowerCase().startsWith(hk) && one.length <= headline.length + 25 ? '' : clip(one, 320), facts: [] };
    }
    const toks = tokens(text);
    const freq = new Map();
    toks.forEach(t => freq.set(t, (freq.get(t) || 0) + 1));
    const scored = sents.map((s, i) => {
      const st = tokens(s);
      let sc = st.reduce((a, t) => a + (freq.get(t) || 0), 0) / Math.sqrt(st.length || 1);
      if (i < 3) sc *= 1.25 - i * 0.08;
      if (/\d/.test(s)) sc *= 1.1;
      if (s.length < 60) sc *= 0.8;
      return { s, i, sc };
    });
    const total = text.length;
    const take = total < 500 ? 2 : 3;
    const chosen = scored.slice().sort((a, b) => b.sc - a.sc).slice(0, take).sort((a, b) => a.i - b.i);
    let summary = '';
    chosen.forEach(c => { if ((summary + ' ' + c.s).length <= 560) summary = (summary + ' ' + c.s).trim(); });
    if (!summary) summary = chosen[0].s;
    const inSummary = new Set(chosen.map(c => c.i));
    const facts = scored.filter(c => !inSummary.has(c.i) && /(\d+(\.\d+)?\s?(%|percent|per cent|bn|billion|million|crore|lakh|tonnes|basis points|bps))|[$\u20ac\u00a3\u20b9]\s?\d/i.test(c.s))
      .slice(0, 3).map(c => clip(c.s, 220));
    return { summary, facts };
  }

  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  function findDate(text) {
    const t = text.slice(0, 800);
    let m;
    const iso = d => (d.getFullYear() > 2000 && d.getFullYear() < 2100 && !isNaN(d)) ? d.toISOString().slice(0, 10) : null;
    if ((m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return iso(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
    if ((m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i)))
      return iso(new Date(Date.UTC(+m[3], MONTHS.indexOf(m[2].toLowerCase()), +m[1])));
    if ((m = t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i)))
      return iso(new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2])));
    return null;
  }

  /* ---------- analyse one document ---------- */
  function analyze(raw, opts) {
    opts = opts || {};
    const isPDF = !!opts.pdf;
    const text = (isPDF ? reflow(raw) : raw).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
    const headline = cleanLine(opts.headline || '') ? clip(cleanLine(opts.headline), 400) : pickHeadline(raw.replace(/\r/g, ''), opts.fallbackTitle);
    const head = (headline + '\n' + text.slice(0, 300));
    const companies = findCompanies(text);
    const c = classifyCountry(text, head, companies, headline);
    const s = classifySector(text, head, companies);
    const spread = (c.primary === 'Global' ? 1 : 0) + c.involved.length + (c.primary === 'Global' ? 0 : 1);
    const imp = classifyImportance(text, head, spread);
    const sm = summarise(text, headline);
    const toks = tokens(text);
    const headToks = tokens(head);
    const cn = COUNTRY_BY_NAME[c.primary] || COUNTRY_BY_NAME['Global'];
    return {
      headline,
      summary: sm.summary,
      facts: sm.facts,
      country: c.primary, countryCode: cn.code, involved: c.involved,
      sector: s.sector, subsector: s.subsector, also: s.also,
      importance: imp.importance, importanceScore: imp.score, signals: imp.signals,
      companies: companies.map(x => x.name),
      date: opts.date || findDate(text),
      text: text.slice(0, 6000),
      len: text.length,
      hash: hash(toks.slice(0, 400).join(' ')),
      head: [...new Set(headToks)].slice(0, 45),
      key: topTerms(toks, 40)
    };
  }

  /* ---------- duplicate and related-story detection ---------- */
  const setOf = arr => new Set(arr);
  const inter = (a, b) => { let n = 0; a.forEach(x => { if (b.has(x)) n++; }); return n; };
  function compare(a, b) {
    // a, b: { hash, len, country, involved, sector, head:Set, key:Set }
    if (a.hash === b.hash) return { type: 'duplicate', sim: 1 };
    const shHead = inter(a.head, b.head);
    const jh = shHead / ((a.head.size + b.head.size - shHead) || 1);
    const ovHead = shHead / (Math.min(a.head.size, b.head.size) || 1);
    const shKey = inter(a.key, b.key);
    const ovKey = shKey / (Math.min(a.key.size, b.key.size) || 1);
    const lenRatio = Math.min(a.len, b.len) / (Math.max(a.len, b.len) || 1);
    if (jh >= 0.55 || (ovHead >= 0.8 && shHead >= 6 && lenRatio >= 0.6) || (ovKey >= 0.85 && shKey >= 10 && lenRatio >= 0.7))
      return { type: 'duplicate', sim: Math.max(jh, ovHead) };
    const sameCountry = a.country === b.country || a.involved.includes(b.country) || b.involved.includes(a.country);
    if (ovKey >= 0.4 && shKey >= 5 && (sameCountry || a.sector === b.sector)) return { type: 'related', sim: ovKey };
    return null;
  }

  /* ---------- splitting and CSV ---------- */
  function splitMessages(text, byParagraph) {
    const norm = text.replace(/\r/g, '');
    let parts = norm.split(/\n[ \t]*(?:-{3,}|={3,}|\*{3,}|_{3,})[ \t]*\n/);
    if (byParagraph && parts.length === 1) parts = norm.split(/\n\s*\n+/);
    return parts.map(p => p.trim()).filter(p => p.length >= 12);
  }

  function parseCSV(text) {
    const first = text.split(/\r?\n/, 1)[0] || '';
    const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(c => c.trim())) rows.push(row);
        row = [];
      } else cur += ch;
    }
    row.push(cur);
    if (row.some(c => c.trim())) rows.push(row);
    return rows;
  }

  function csvToDocs(text, name) {
    const rows = parseCSV(text.replace(/^\uFEFF/, ''));
    if (!rows.length) return [];
    const hdr = rows[0].map(h => h.trim().toLowerCase());
    const find = re => hdr.findIndex(h => re.test(h));
    const iHead = find(/^(headline|title|heading|subject)$/);
    const iBody = find(/^(text|body|content|summary|description|message|article|details|story)$/);
    const iDate = find(/date|published|time/);
    const iSrc = find(/^(source|publisher|channel|outlet)$/);
    const hasHeader = iHead >= 0 || iBody >= 0;
    const data = hasHeader ? rows.slice(1) : rows;
    return data.slice(0, 500).map((r, n) => {
      const cells = r.map(c => c.trim());
      let headline = iHead >= 0 ? cells[iHead] : '';
      let body = iBody >= 0 ? cells[iBody] : '';
      if (!headline && !body) {
        const long = cells.slice().sort((a, b) => b.length - a.length)[0] || '';
        body = long; headline = cells.find(c => c.length >= 12) || '';
      }
      const t = (headline && body && body !== headline) ? headline + '\n' + body : (body || headline);
      let date = null;
      if (iDate >= 0) { const d = new Date(cells[iDate]); if (!isNaN(d) && d.getFullYear() > 2000) date = d.toISOString().slice(0, 10); }
      return { text: t, headline: headline && headline.length >= 12 ? headline : '', date, source: (iSrc >= 0 && cells[iSrc]) ? cells[iSrc] : name + ' (row ' + (n + 1) + ')' };
    }).filter(d => d.text && d.text.length >= 12);
  }

  function toCSV(items) {
    const cols = ['date', 'added_at', 'country', 'involved_countries', 'sector', 'subsector', 'importance', 'headline', 'summary', 'companies', 'sources', 'source_count', 'related_stories'];
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [cols.join(',')];
    items.forEach(it => {
      lines.push([
        it.date || new Date(it.addedAt).toISOString().slice(0, 10), new Date(it.addedAt).toISOString(), it.country, (it.involved || []).join('; '),
        it.sector, it.subsector, it.importance, it.headline, it.summary, (it.companies || []).join('; '),
        (it.sources || []).map(s => s.name).join('; '), (it.sources || []).length, (it.related || []).length
      ].map(q).join(','));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  return {
    analyze, compare, setOf, splitMessages, parseCSV, csvToDocs, toCSV, tokens, flag,
    classifyCountry, classifySector, classifyImportance, findCompanies, findDate,
    COUNTRY_NAMES, COUNTRY_BY_NAME, SECTOR_NAMES, IMP_ORDER, impRank, clip,
    COMPANIES, guessSymbol, guessSectorIndex
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Engine;

/* ================= Part 2: interface ================= */
if (typeof document !== 'undefined') (function () {
  const E = Engine;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- usage tracking (GA4) ----------
     One tiny wrapper around gtag() so every call site here reads as "log this interaction" rather than
     repeating the same try/catch. window.gtag is defined by the inline snippet in index.html's <head>
     (a real GA4 script if a Measurement ID is configured there, otherwise a harmless no-op stub) - either
     way this can never throw or block the UI, which matters more than never missing an event. params is
     a plain object of extra fields (e.g. { tab: 'saved' }); GA4's own event/param name limits apply. */
  function track(action, params) {
    try { if (typeof window.gtag === 'function') window.gtag('event', action, params || {}); }
    catch (e) { /* analytics must never break the app */ }
  }

  /* ---------- Multilingual UI (per the user's request: UI chrome only, not the live news content itself -
     headlines/summaries keep coming from the source in whatever language they were posted in; translating
     those live would need a translation API call per story per language, which is a separate, bigger feature).
     A small dictionary + a t(key) lookup, applied to static markup via data-i18n/-placeholder/-aria attributes
     and to JS-generated strings by calling t() instead of writing English directly. Add a language by adding
     one more key to I18N and one more <option> in index.html's #langSelect - everything else picks it up. */
  const LANG_KEY = 'qs-lang-v1';


  const I18N = {
    en: {
      linkPages: 'Link Pages', settings: 'Settings', signals: 'Signals', saved: 'Saved', export: 'Export',
      landingTitle: 'QwickSignal', landingTag: 'Sort news, messages and reports by country, sector and importance.',
      landingOr: 'or', continueAsGuest: 'Continue as guest',
      landingGuestNote: "You can look around and follow the default channels without an account. Sign in any time later from Settings to keep your own saved articles and channels.",
      account: 'Account', accountSub: "Optional. Sign in to keep your own saved articles, dismissed items and followed channels tied to your account instead of a code - and separate from anyone else's.",
      signInEmail: 'Email', signInPassword: 'Password', signIn: 'Sign in', createAccount: 'Create account',
      signOut: 'Sign out', signedInAs: 'Signed in as',
      telegram: 'Telegram', tgPlaceholder: 't/channelname or t.me link', addBtn: '+ Add',
      following: 'Following', follow: 'Follow', remove: 'Remove', removeShared: 'Remove for everyone', setDefault: 'Set default', removeDefault: 'Remove default', defaultBadge: 'Default',
      noChannelsYet: 'No channels yet. Add one above to start following it.',
      couldntLoadChannels: 'Couldn’t load the channel list right now.', checkConnection: 'Check your connection.',
      syncHeading: 'Sync across your devices', syncSub: 'This code links your saved articles and followed channels on another phone or browser. Anyone with the code can use it, so keep it to yourself and your own devices.',
      copyBtn: 'Copy', syncInputPlaceholder: 'Enter a code from another device', useCodeBtn: 'Use this code',
      searchPlaceholder: 'Search',
      allPriorities: 'All priorities', critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
      clearFilters: 'Clear filters',
      savedLede: "Stories you've saved stay here even after they'd normally drop off Signals after 24 hours.",
      exportLede: "Save a report or the raw table. Files go to your phone's Downloads.",
      downloadPdf: 'Download QwickSignal PDF', downloadCsv: 'Download CSV',
      onThisPhone: 'On this phone', clearAllData: 'Clear all data',
      refresh: 'Refresh',
      loginToLinkChannels: 'Log in to link Telegram channels.',
      notifHeading: 'Notifications', notifSub: "Get a notification on this device when a new story arrives - even when the app isn't open.",
      notifEnable: 'Turn on notifications', notifDisable: 'Turn off notifications', notifOn: 'Notifications are on for this device.',
      notifUnsupported: "This browser doesn't support push notifications.",
      notifBlocked: 'Notifications are blocked for this site. Allow them in your browser/site settings, then try again.',
      notifFailed: "Couldn't turn on notifications. Check your connection and try again.",
      getAppHeading: 'Get the app', getAppAndroidTab: 'Android', getAppIosTab: 'iPhone',
      getAppSub: 'Download the installable app (one file, zipped). Unzip it, then tap the .apk to install - you may need to allow "install unknown apps" for your browser once.', getAppBtn: 'Download QwickSignal.zip',
      getAppIosStep1: 'Open qwicksignal.netlify.app in Safari (it has to be Safari, not Chrome).', getAppIosStep2: 'Tap the Share icon, then "Add to Home Screen".', getAppIosStep3: 'Tap "Add" - QwickSignal now opens like a regular app, no browser bar.',
      getAppIosNote: 'Notifications work the same way after this - iOS supports real push notifications for home-screen apps on iOS 16.4 and later.',
      feedbackHeading: 'Feedback & support', feedbackSub: 'Found a bug, or have a suggestion? Send it here - it goes straight to the app owner.',
      agGoToAccount: 'Go to Account', agMaybeLater: 'Maybe later',
      agAddChannelsTitle: 'Log in to add channels', agAddChannelsBody: 'Creating a free account keeps your followed channels and saved stories with you, and lets you add new ones.',
      agSyncTitle: 'Log in to sync your devices', agSyncBody: 'Syncing across devices now needs a free account - it keeps everything a little safer and tied to you, not a shareable code.',
      feedbackLoginTitle: 'Log in to send feedback', feedbackLoginBody: 'Creating a free account lets the app owner follow up with you if needed.',
      ticketKindBug: 'Bug', ticketKindSupport: 'Support', ticketKindFeedback: 'Feedback',
      ticketPlaceholder: 'Describe the issue or idea…', ticketSend: 'Send', ticketSent: 'Thanks - sent to the app owner.',
      ticketFailed: "Couldn't send that. Check your connection and try again.", ticketEmpty: 'Write a few words first.',
      ticketAdminHeading: 'Tickets (owner only)', ticketAdminEmpty: 'No tickets yet.', ticketAdminLoadFailed: "Couldn't load tickets.",
      ticketStatusOpen: 'Open', ticketStatusDone: 'Done', ticketMarkDone: 'Mark done', ticketMarkOpen: 'Reopen',
      modeNews: 'News', modeInvestment: 'Investment',
      investHeading: 'Investment watchlist', investSub: "Track companies you've invested in, or are watching, to see their news grouped separately in the Investment tab.",
      investPlaceholder: 'Company name', loginToTrackCompanies: 'Log in to track companies.',
      agTrackCompanyTitle: 'Log in to track companies', agTrackCompanyBody: 'Creating a free account keeps your investment watchlist with you across devices.',
      investEmptyTitle: 'Track companies to see investment-related news.', investEmptyBtn: 'Add companies to track',
      investNoNews: 'No recent news for this company.', investRemove: 'Remove',
      viewChart: 'View Chart', chartLoading: 'Loading chart…',
      chartSearchHint: 'Wrong listing? Click the ticker name at the top-left of the chart to search for the right one.',
      chartStock: 'Stock', chartSectorFallback: 'Sector',
      chartEodHint: 'Indian exchange data shown here is end-of-day, not live intraday - a data-licensing limit on TradingView’s side, not a bug in this app.'
    },
    hi: {
      linkPages: 'लिंक पेज', settings: 'सेटिंग्स', signals: 'सिग्नल्स', saved: 'सेव किए गए', export: 'एक्सपोर्ट',
      landingTitle: 'QwickSignal', landingTag: 'खबरों, संदेशों और रिपोर्ट को देश, क्षेत्र और महत्व के अनुसार छाँटें।',
      landingOr: 'या', continueAsGuest: 'गेस्ट के रूप में जारी रखें',
      landingGuestNote: 'आप बिना खाते के भी देख सकते हैं और डिफ़ॉल्ट चैनल फॉलो कर सकते हैं। बाद में कभी भी सेटिंग्स से साइन इन करके अपने सेव किए गए लेख और चैनल रख सकते हैं।',
      account: 'खाता', accountSub: 'वैकल्पिक। अपने सेव किए गए लेख, हटाए गए आइटम और फॉलो किए गए चैनल किसी कोड की बजाय अपने खाते से जोड़ने के लिए साइन इन करें - और बाकी सभी से अलग रखें।',
      signInEmail: 'ईमेल', signInPassword: 'पासवर्ड', signIn: 'साइन इन करें', createAccount: 'खाता बनाएं',
      signOut: 'साइन आउट', signedInAs: 'इस रूप में साइन इन है',
      telegram: 'टेलीग्राम', tgPlaceholder: 't/channelname या t.me लिंक', addBtn: '+ जोड़ें',
      following: 'फॉलो कर रहे हैं', follow: 'फॉलो करें', remove: 'हटाएं', removeShared: 'सभी के लिए हटाएं', setDefault: 'डिफ़ॉल्ट बनाएं', removeDefault: 'डिफ़ॉल्ट हटाएं', defaultBadge: 'डिफ़ॉल्ट',
      noChannelsYet: 'अभी कोई चैनल नहीं है। फॉलो करने के लिए ऊपर एक जोड़ें।',
      couldntLoadChannels: 'अभी चैनल सूची लोड नहीं हो सकी।', checkConnection: 'अपना कनेक्शन जांचें।',
      syncHeading: 'अपने डिवाइस में सिंक करें', syncSub: 'यह कोड आपके सेव किए गए लेख और फॉलो किए गए चैनल किसी दूसरे फोन या ब्राउज़र से जोड़ता है। कोड जिसके पास भी है वह इसे इस्तेमाल कर सकता है, इसलिए इसे अपने और अपने डिवाइस तक सीमित रखें।',
      copyBtn: 'कॉपी करें', syncInputPlaceholder: 'दूसरे डिवाइस का कोड डालें', useCodeBtn: 'यह कोड इस्तेमाल करें',
      searchPlaceholder: 'खोजें',
      allPriorities: 'सभी प्राथमिकताएं', critical: 'गंभीर', high: 'उच्च', medium: 'मध्यम', low: 'निम्न',
      clearFilters: 'फ़िल्टर हटाएं',
      savedLede: 'आपके सेव किए गए लेख यहां बने रहते हैं, भले ही वे 24 घंटे बाद सिग्नल्स से हट जाते हों।',
      exportLede: 'रिपोर्ट या रॉ टेबल सेव करें। फ़ाइलें आपके फोन के डाउनलोड्स में जाएंगी।',
      downloadPdf: 'QwickSignal PDF डाउनलोड करें', downloadCsv: 'CSV डाउनलोड करें',
      onThisPhone: 'इस फोन पर', clearAllData: 'सारा डेटा हटाएं',
      refresh: 'रिफ्रेश करें',
      loginToLinkChannels: 'टेलीग्राम चैनल लिंक करने के लिए साइन इन करें।',
      notifHeading: 'सूचनाएं', notifSub: 'जब कोई नई खबर आए तो इस डिवाइस पर सूचना पाएं - ऐप खुला न होने पर भी।',
      notifEnable: 'सूचनाएं चालू करें', notifDisable: 'सूचनाएं बंद करें', notifOn: 'इस डिवाइस के लिए सूचनाएं चालू हैं।',
      notifUnsupported: 'यह ब्राउज़र पुश सूचनाओं का समर्थन नहीं करता।',
      notifBlocked: 'इस साइट के लिए सूचनाएं ब्लॉक हैं। अपनी ब्राउज़र/साइट सेटिंग्स में उन्हें अनुमति दें, फिर दोबारा कोशिश करें।',
      notifFailed: 'सूचनाएं चालू नहीं हो सकीं। अपना कनेक्शन जांचें और फिर कोशिश करें।',
      getAppHeading: 'ऐप पाएं', getAppAndroidTab: 'Android', getAppIosTab: 'iPhone',
      getAppSub: 'इंस्टॉल करने योग्य ऐप डाउनलोड करें (एक फ़ाइल, ज़िप की हुई)। इसे अनज़िप करें, फिर इंस्टॉल करने के लिए .apk पर टैप करें - आपको अपने ब्राउज़र के लिए एक बार "अज्ञात ऐप्स इंस्टॉल करें" की अनुमति देनी पड़ सकती है।', getAppBtn: 'QwickSignal.zip डाउनलोड करें',
      getAppIosStep1: 'Safari में qwicksignal.netlify.app खोलें (Chrome में नहीं, Safari में ही)।', getAppIosStep2: 'शेयर आइकन टैप करें, फिर "Add to Home Screen" चुनें।', getAppIosStep3: '"Add" टैप करें - अब QwickSignal एक सामान्य ऐप की तरह खुलेगा, बिना ब्राउज़र बार के।',
      getAppIosNote: 'इसके बाद नोटिफिकेशन वैसे ही काम करते हैं - iOS 16.4 और उसके बाद होम-स्क्रीन ऐप्स के लिए असली पुश नोटिफिकेशन देता है।',
      feedbackHeading: 'फ़ीडबैक और सहायता', feedbackSub: 'कोई बग मिला, या कोई सुझाव है? यहाँ भेजें - यह सीधे ऐप के मालिक तक जाता है।',
      agGoToAccount: 'खाते पर जाएं', agMaybeLater: 'बाद में',
      agAddChannelsTitle: 'चैनल जोड़ने के लिए साइन इन करें', agAddChannelsBody: 'मुफ़्त खाता बनाने से आपके फॉलो किए चैनल और सेव की गई स्टोरी आपके साथ रहती हैं, और आप नए चैनल जोड़ पाते हैं।',
      agSyncTitle: 'डिवाइस सिंक करने के लिए साइन इन करें', agSyncBody: 'डिवाइस के बीच सिंक करने के लिए अब मुफ़्त खाता चाहिए - यह सब कुछ थोड़ा ज़्यादा सुरक्षित और आपसे जुड़ा रखता है, शेयर किए जा सकने वाले कोड के बजाय।',
      feedbackLoginTitle: 'फ़ीडबैक भेजने के लिए साइन इन करें', feedbackLoginBody: 'मुफ़्त खाता बनाने से ऐप के मालिक ज़रूरत पड़ने पर आपसे संपर्क कर सकते हैं।',
      ticketKindBug: 'बग', ticketKindSupport: 'सहायता', ticketKindFeedback: 'फ़ीडबैक',
      ticketPlaceholder: 'समस्या या विचार बताएं…', ticketSend: 'भेजें', ticketSent: 'धन्यवाद - ऐप के मालिक को भेज दिया गया।',
      ticketFailed: 'भेजा नहीं जा सका। अपना कनेक्शन जांचें और फिर कोशिश करें।', ticketEmpty: 'पहले कुछ शब्द लिखें।',
      ticketAdminHeading: 'टिकट (केवल मालिक)', ticketAdminEmpty: 'अभी तक कोई टिकट नहीं।', ticketAdminLoadFailed: 'टिकट लोड नहीं हो सके।',
      ticketStatusOpen: 'खुला', ticketStatusDone: 'पूर्ण', ticketMarkDone: 'पूर्ण के रूप में चिह्नित करें', ticketMarkOpen: 'फिर से खोलें'
    },
    mr: {
      linkPages: 'लिंक पेजेस', settings: 'सेटिंग्ज', signals: 'सिग्नल्स', saved: 'सेव्ह केलेले', export: 'एक्सपोर्ट',
      landingTitle: 'QwickSignal', landingTag: 'बातम्या, मेसेज आणि रिपोर्ट्स देश, क्षेत्र आणि महत्त्वानुसार क्रमवारी लावा.',
      landingOr: 'किंवा', continueAsGuest: 'गेस्ट म्हणून सुरू ठेवा',
      landingGuestNote: 'तुम्ही खात्याशिवायही पाहू शकता आणि डीफॉल्ट चॅनेल्स फॉलो करू शकता. नंतर कधीही सेटिंग्जमधून साइन इन करून तुमचे सेव्ह केलेले लेख आणि चॅनेल्स ठेवू शकता.',
      account: 'खाते', accountSub: 'ऐच्छिक. तुमचे सेव्ह केलेले लेख, हटवलेल्या गोष्टी आणि फॉलो केलेले चॅनेल्स कोडऐवजी तुमच्या खात्याशी जोडण्यासाठी साइन इन करा - आणि इतरांपासून वेगळे ठेवा.',
      signInEmail: 'ईमेल', signInPassword: 'पासवर्ड', signIn: 'साइन इन करा', createAccount: 'खाते तयार करा',
      signOut: 'साइन आउट', signedInAs: 'साइन इन केले आहे',
      telegram: 'टेलिग्राम', tgPlaceholder: 't/channelname किंवा t.me लिंक', addBtn: '+ जोडा',
      following: 'फॉलो करत आहात', follow: 'फॉलो करा', remove: 'काढा', removeShared: 'सर्वांसाठी काढा', setDefault: 'डीफॉल्ट करा', removeDefault: 'डीफॉल्ट काढा', defaultBadge: 'डीफॉल्ट',
      noChannelsYet: 'अजून कोणतेही चॅनेल नाही. फॉलो करण्यासाठी वर एक जोडा.',
      couldntLoadChannels: 'सध्या चॅनेल यादी लोड होऊ शकली नाही.', checkConnection: 'तुमचे कनेक्शन तपासा.',
      syncHeading: 'तुमच्या डिव्हाइसेसवर सिंक करा', syncSub: 'हा कोड तुमचे सेव्ह केलेले लेख आणि फॉलो केलेले चॅनेल दुसऱ्या फोन किंवा ब्राउझरशी जोडतो. हा कोड ज्याच्याकडेही असेल तो वापरू शकतो, त्यामुळे तो फक्त स्वतःपुरता आणि स्वतःच्या डिव्हाइसेसपुरता ठेवा.',
      copyBtn: 'कॉपी करा', syncInputPlaceholder: 'दुसऱ्या डिव्हाइसचा कोड टाका', useCodeBtn: 'हा कोड वापरा',
      searchPlaceholder: 'शोधा',
      allPriorities: 'सर्व प्राधान्ये', critical: 'गंभीर', high: 'उच्च', medium: 'मध्यम', low: 'कमी',
      clearFilters: 'फिल्टर्स साफ करा',
      savedLede: 'तुम्ही सेव्ह केलेल्या बातम्या 24 तासांनंतर सिग्नल्समधून निघून गेल्या तरी इथे राहतात.',
      exportLede: 'अहवाल किंवा रॉ टेबल सेव्ह करा. फाइल्स तुमच्या फोनच्या डाउनलोड्समध्ये जातील.',
      downloadPdf: 'QwickSignal PDF डाउनलोड करा', downloadCsv: 'CSV डाउनलोड करा',
      onThisPhone: 'या फोनवर', clearAllData: 'सर्व डेटा काढा',
      refresh: 'रिफ्रेश करा',
      loginToLinkChannels: 'टेलिग्राम चॅनेल लिंक करण्यासाठी साइन इन करा.',
      notifHeading: 'सूचना', notifSub: 'नवीन बातमी आल्यावर या डिव्हाइसवर सूचना मिळवा - अ‍ॅप उघडे नसतानाही.',
      notifEnable: 'सूचना चालू करा', notifDisable: 'सूचना बंद करा', notifOn: 'या डिव्हाइससाठी सूचना चालू आहेत.',
      notifUnsupported: 'हा ब्राउझर पुश सूचनांना सपोर्ट करत नाही.',
      notifBlocked: 'या साइटसाठी सूचना ब्लॉक केलेल्या आहेत. तुमच्या ब्राउझर/साइट सेटिंग्जमध्ये त्यांना परवानगी द्या, नंतर पुन्हा प्रयत्न करा.',
      notifFailed: 'सूचना चालू करता आल्या नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',
      getAppHeading: 'अ‍ॅप मिळवा', getAppAndroidTab: 'Android', getAppIosTab: 'iPhone',
      getAppSub: 'इंस्टॉल करण्यायोग्य अ‍ॅप डाउनलोड करा (एक फाईल, झिप केलेली). अनझिप करा, मग इंस्टॉल करण्यासाठी .apk वर टॅप करा - तुम्हाला तुमच्या ब्राउझरसाठी एकदा "अज्ञात अ‍ॅप्स इंस्टॉल करा" ला परवानगी द्यावी लागू शकते.', getAppBtn: 'QwickSignal.zip डाउनलोड करा',
      getAppIosStep1: 'Safari मध्ये qwicksignal.netlify.app उघडा (Chrome नाही, Safari हवे).', getAppIosStep2: 'शेअर आयकॉन टॅप करा, मग "Add to Home Screen" निवडा.', getAppIosStep3: '"Add" टॅप करा - आता QwickSignal सामान्य अ‍ॅपसारखे उघडेल, ब्राउझर बारशिवाय.',
      getAppIosNote: 'यानंतर नोटिफिकेशन्स तशीच काम करतात - iOS 16.4 आणि त्यानंतरच्या आवृत्त्यांमध्ये होम-स्क्रीन अ‍ॅप्ससाठी खऱ्या पुश नोटिफिकेशन्स मिळतात.',
      feedbackHeading: 'फीडबॅक आणि सहाय्य', feedbackSub: 'बग सापडला, किंवा सुचवायचे आहे? इथे पाठवा - ते थेट अ‍ॅपच्या मालकाकडे जाते.',
      agGoToAccount: 'खात्याकडे जा', agMaybeLater: 'नंतर',
      agAddChannelsTitle: 'चॅनेल जोडण्यासाठी साइन इन करा', agAddChannelsBody: 'मोफत खाते तयार केल्याने तुमचे फॉलो केलेले चॅनेल आणि सेव्ह केलेल्या स्टोरीज तुमच्याजवळ राहतात, आणि तुम्हाला नवीन जोडता येतात.',
      agSyncTitle: 'डिव्हाइस सिंक करण्यासाठी साइन इन करा', agSyncBody: 'डिव्हाइसमध्ये सिंक करण्यासाठी आता मोफत खाते आवश्यक आहे - यामुळे सर्व काही थोडे अधिक सुरक्षित आणि तुमच्याशी जोडलेले राहते, शेअर करता येणाऱ्या कोडऐवजी.',
      feedbackLoginTitle: 'फीडबॅक पाठवण्यासाठी साइन इन करा', feedbackLoginBody: 'मोफत खाते तयार केल्याने अ‍ॅपचे मालक गरज पडल्यास तुमच्याशी संपर्क साधू शकतात.',
      ticketKindBug: 'बग', ticketKindSupport: 'सहाय्य', ticketKindFeedback: 'फीडबॅक',
      ticketPlaceholder: 'समस्या किंवा कल्पना सांगा…', ticketSend: 'पाठवा', ticketSent: 'धन्यवाद - अ‍ॅपच्या मालकाला पाठवले.',
      ticketFailed: 'पाठवता आले नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.', ticketEmpty: 'आधी काही शब्द लिहा.',
      ticketAdminHeading: 'तिकिटे (फक्त मालक)', ticketAdminEmpty: 'अजून तिकिटे नाहीत.', ticketAdminLoadFailed: 'तिकिटे लोड करता आली नाहीत.',
      ticketStatusOpen: 'उघडे', ticketStatusDone: 'पूर्ण', ticketMarkDone: 'पूर्ण म्हणून चिन्हांकित करा', ticketMarkOpen: 'पुन्हा उघडा'
    },
    gu: {
      linkPages: 'લિંક પેજીસ', settings: 'સેટિંગ્સ', signals: 'સિગ્નલ્સ', saved: 'સેવ કરેલ', export: 'એક્સપોર્ટ',
      landingTitle: 'QwickSignal', landingTag: 'સમાચાર, સંદેશા અને અહેવાલોને દેશ, ક્ષેત્ર અને મહત્વ પ્રમાણે ગોઠવો.',
      landingOr: 'અથવા', continueAsGuest: 'ગેસ્ટ તરીકે ચાલુ રાખો',
      landingGuestNote: 'તમે ખાતા વગર પણ જોઈ શકો છો અને ડિફોલ્ટ ચેનલ્સ ફોલો કરી શકો છો. પછી ગમે ત્યારે સેટિંગ્સમાંથી સાઇન ઇન કરીને તમારા સેવ કરેલા લેખો અને ચેનલ્સ રાખી શકો છો.',
      account: 'ખાતું', accountSub: 'વૈકલ્પિક. તમારા સેવ કરેલા લેખો, કાઢી નાખેલી વસ્તુઓ અને ફોલો કરેલા ચેનલ્સ કોડને બદલે તમારા ખાતા સાથે જોડવા માટે સાઇન ઇન કરો - અને બીજા બધાથી અલગ રાખો.',
      signInEmail: 'ઇમેઇલ', signInPassword: 'પાસવર્ડ', signIn: 'સાઇન ઇન કરો', createAccount: 'ખાતું બનાવો',
      signOut: 'સાઇન આઉટ', signedInAs: 'આ રીતે સાઇન ઇન છે',
      telegram: 'ટેલિગ્રામ', tgPlaceholder: 't/channelname અથવા t.me લિંક', addBtn: '+ ઉમેરો',
      following: 'ફોલો કરો છો', follow: 'ફોલો કરો', remove: 'કાઢી નાખો', removeShared: 'બધા માટે કાઢી નાખો', setDefault: 'ડિફોલ્ટ બનાવો', removeDefault: 'ડિફોલ્ટ કાઢો', defaultBadge: 'ડિફોલ્ટ',
      noChannelsYet: 'હજુ કોઈ ચેનલ નથી. ફોલો કરવા માટે ઉપર એક ઉમેરો.',
      couldntLoadChannels: 'હાલમાં ચેનલ યાદી લોડ થઈ શકી નથી.', checkConnection: 'તમારું જોડાણ તપાસો.',
      syncHeading: 'તમારા ડિવાઇસ પર સિંક કરો', syncSub: 'આ કોડ તમારા સેવ કરેલા લેખો અને ફોલો કરેલા ચેનલ્સને બીજા ફોન કે બ્રાઉઝર સાથે જોડે છે. આ કોડ જેની પાસે પણ હોય તે તેનો ઉપયોગ કરી શકે છે, તેથી તેને ફક્ત તમારા પોતાના ડિવાઇસ પૂરતો રાખો.',
      copyBtn: 'કૉપિ કરો', syncInputPlaceholder: 'બીજા ડિવાઇસનો કોડ દાખલ કરો', useCodeBtn: 'આ કોડ વાપરો',
      searchPlaceholder: 'શોધો',
      allPriorities: 'બધી પ્રાથમિકતાઓ', critical: 'ગંભીર', high: 'ઊંચી', medium: 'મધ્યમ', low: 'નીચી',
      clearFilters: 'ફિલ્ટર્સ સાફ કરો',
      savedLede: 'તમે સેવ કરેલી સ્ટોરીઝ 24 કલાક પછી સિગ્નલ્સમાંથી નીકળી જાય તો પણ અહીં રહે છે.',
      exportLede: 'રિપોર્ટ અથવા રો ટેબલ સેવ કરો. ફાઇલો તમારા ફોનના ડાઉનલોડ્સમાં જશે.',
      downloadPdf: 'QwickSignal PDF ડાઉનલોડ કરો', downloadCsv: 'CSV ડાઉનલોડ કરો',
      onThisPhone: 'આ ફોન પર', clearAllData: 'બધો ડેટા કાઢી નાખો',
      refresh: 'રિફ્રેશ કરો',
      loginToLinkChannels: 'ટેલિગ્રામ ચેનલ લિંક કરવા સાઇન ઇન કરો.',
      notifHeading: 'નોટિફિકેશન', notifSub: 'નવી સ્ટોરી આવે ત્યારે આ ડિવાઇસ પર નોટિફિકેશન મેળવો - ઍપ ખુલ્લી ન હોય ત્યારે પણ.',
      notifEnable: 'નોટિફિકેશન ચાલુ કરો', notifDisable: 'નોટિફિકેશન બંધ કરો', notifOn: 'આ ડિવાઇસ માટે નોટિફિકેશન ચાલુ છે.',
      notifUnsupported: 'આ બ્રાઉઝર પુશ નોટિફિકેશનને સપોર્ટ કરતું નથી.',
      notifBlocked: 'આ સાઇટ માટે નોટિફિકેશન બ્લોક કરેલા છે. તમારા બ્રાઉઝર/સાઇટ સેટિંગ્સમાં તેમને મંજૂરી આપો, પછી ફરી પ્રયાસ કરો.',
      notifFailed: 'નોટિફિકેશન ચાલુ કરી શકાયા નહીં. તમારું જોડાણ તપાસો અને ફરી પ્રયાસ કરો.',
      getAppHeading: 'ઍપ મેળવો', getAppAndroidTab: 'Android', getAppIosTab: 'iPhone',
      getAppSub: 'ઇન્સ્ટોલ કરી શકાય તેવી ઍપ ડાઉનલોડ કરો (એક ફાઇલ, ઝિપ કરેલી). તેને અનઝિપ કરો, પછી ઇન્સ્ટોલ કરવા માટે .apk પર ટૅપ કરો - તમારે તમારા બ્રાઉઝર માટે એકવાર "અજાણી ઍપ્સ ઇન્સ્ટોલ કરો"ની મંજૂરી આપવી પડી શકે.', getAppBtn: 'QwickSignal.zip ડાઉનલોડ કરો',
      getAppIosStep1: 'Safari માં qwicksignal.netlify.app ખોલો (Chrome નહીં, Safari જ જોઈએ).', getAppIosStep2: 'શેર આઇકન ટૅપ કરો, પછી "Add to Home Screen" પસંદ કરો.', getAppIosStep3: '"Add" ટૅપ કરો - હવે QwickSignal સામાન્ય ઍપની જેમ ખુલશે, બ્રાઉઝર બાર વગર.',
      getAppIosNote: 'આ પછી નોટિફિકેશન એ જ રીતે કામ કરે છે - iOS 16.4 અને પછીની આવૃત્તિઓમાં હોમ-સ્ક્રીન ઍપ્સ માટે ખરા પુશ નોટિફિકેશન મળે છે.',
      feedbackHeading: 'પ્રતિસાદ અને સહાય', feedbackSub: 'બગ મળ્યો, કે સૂચન છે? અહીં મોકલો - તે સીધું ઍપના માલિક સુધી જાય છે.',
      agGoToAccount: 'ખાતા પર જાઓ', agMaybeLater: 'પછી',
      agAddChannelsTitle: 'ચેનલ ઉમેરવા સાઇન ઇન કરો', agAddChannelsBody: 'મફત ખાતું બનાવવાથી તમારી ફોલો કરેલી ચેનલો અને સેવ કરેલી સ્ટોરીઝ તમારી સાથે રહે છે, અને તમે નવી ઉમેરી શકો છો.',
      agSyncTitle: 'ડિવાઇસ સિંક કરવા સાઇન ઇન કરો', agSyncBody: 'ડિવાઇસ વચ્ચે સિંક કરવા હવે મફત ખાતું જરૂરી છે - આ બધું થોડું વધુ સુરક્ષિત અને તમારી સાથે જોડાયેલું રાખે છે, શેર કરી શકાય તેવા કોડને બદલે.',
      feedbackLoginTitle: 'ફીડબેક મોકલવા સાઇન ઇન કરો', feedbackLoginBody: 'મફત ખાતું બનાવવાથી ઍપના માલિક જરૂર પડ્યે તમારો સંપર્ક કરી શકે છે.',
      ticketKindBug: 'બગ', ticketKindSupport: 'સહાય', ticketKindFeedback: 'પ્રતિસાદ',
      ticketPlaceholder: 'સમસ્યા કે વિચાર જણાવો…', ticketSend: 'મોકલો', ticketSent: 'આભાર - ઍપના માલિકને મોકલાયું.',
      ticketFailed: 'મોકલી શકાયું નહીં. તમારું જોડાણ તપાસો અને ફરી પ્રયાસ કરો.', ticketEmpty: 'પહેલા થોડા શબ્દો લખો.',
      ticketAdminHeading: 'ટિકિટ (ફક્ત માલિક)', ticketAdminEmpty: 'હજુ કોઈ ટિકિટ નથી.', ticketAdminLoadFailed: 'ટિકિટ લોડ કરી શકાયા નહીં.',
      ticketStatusOpen: 'ખુલ્લું', ticketStatusDone: 'પૂર્ણ', ticketMarkDone: 'પૂર્ણ તરીકે ચિહ્નિત કરો', ticketMarkOpen: 'ફરી ખોલો'
    }
  };
  let currentLang = 'en';
  function loadLang() {
    try { return localStorage.getItem(LANG_KEY) || 'en'; } catch (e) { return 'en'; }
  }
  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  }
  function applyI18n() {
    document.documentElement.lang = currentLang;
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    $$('[data-i18n-title]').forEach(el => { el.setAttribute('title', t(el.dataset.i18nTitle)); });
    const sel = $('#langSelect');
    if (sel) sel.value = currentLang;
    // Re-render the bits built dynamically in JS (their strings come from t() at render time, so a plain
    // re-render is enough - no separate translation pass needed for them).
    renderAccount(); renderChannels(); renderExport();
  }
  function setLang(lang) {
    currentLang = I18N[lang] ? lang : 'en';
    try { localStorage.setItem(LANG_KEY, currentLang); } catch (e) { /* private browsing etc. */ }
    applyI18n();
    renderAll(); renderCountryViewer();   // re-render the news itself too, not just the app chrome
  }

  /* ---------- Multilingual news content (headline/summary/why/facts) ----------
     A follow-up to the UI-only translation above: the person asked for the news itself to translate too, not
     just the app's own buttons and labels. This translates on top of whatever the source posted in - it does
     not touch S.live/S.items (the original English stays there for search/filter/export), only what's shown
     on screen via trOf()/trList() below.
     Uses Google's public "gtx" translate endpoint (translate.googleapis.com) - the same unauthenticated
     endpoint many browser extensions use. It needs no API key, which is why this can just work today, but
     it is not an official, supported API: Google can rate-limit or change it without notice. If that becomes
     a problem, the fix is to switch ensureTranslated() below to the paid Cloud Translation API (needs a
     GOOGLE_TRANSLATE_API_KEY and a small budget tracker, the same pattern as image_intel.py's Budget) instead
     of this endpoint - everything that calls trOf()/trList() stays the same either way. */
  const TR_CACHE = new Map();     // "lang␟text" -> translated text (or the original, once we've tried)
  const TR_PENDING = new Set();   // keys currently in flight, so a busy render doesn't fire duplicate requests
  const TR_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

  function trKey(text) { return currentLang + '␟' + text; }
  // Synchronous lookup for use inside template strings: cached translation if we have one, else the original
  // English text (so the UI never blocks on a network round trip - it just upgrades in place once ready).
  function trOf(text) {
    if (currentLang === 'en' || !text) return text;
    const cached = TR_CACHE.get(trKey(text));
    return cached === undefined ? text : cached;
  }
  function trList(arr) { return (arr || []).map(trOf); }

  async function translateOne(text, lang) {
    const url = `${TR_ENDPOINT}?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return (data[0] || []).map(seg => seg[0]).join('');
  }

  // Swaps the translated text into cards already on screen, in place - no innerHTML rebuild, so nothing
  // flashes, replays its fade-in, loses scroll position, or drops an in-progress swipe/tap. This is what
  // actually fixes the "choppy, bouncy" feeling: a full renderList()/renderAll() used to run after every
  // single card's translation landed (up to TR_CONCURRENCY at once), tearing down and rebuilding the whole
  // list each time. Only touches nodes whose text actually changed, so untranslated/unaffected cards are
  // left completely alone.
  function patchTranslations() {
    if (currentLang === 'en') return;
    $$('#list .entry[data-id], #savedList .entry[data-id]').forEach(card => {
      const it = all().find(x => x.id === card.dataset.id);
      if (!it) return;
      const hl = card.querySelector(':scope > .hl');
      if (hl && it.headline) { const v = trOf(it.headline); if (hl.textContent !== v) hl.textContent = v; }
      const sum = card.querySelector(':scope > .sum');
      if (sum && it.summary) { const v = trOf(it.summary); if (sum.textContent !== v) sum.textContent = v; }
      // Only present when the card is open - still just a text swap, not a rebuild.
      const why = card.querySelector('.details .why');
      if (why && it.why) {
        const v = trOf(it.why);
        // Keep the "Why it matters" <b> label, only replace the text after it.
        const label = why.querySelector('b');
        why.textContent = ''; if (label) why.appendChild(label);
        why.appendChild(document.createTextNode(' ' + v));
      }
      const factEls = card.querySelectorAll('.details .facts li');
      if (factEls.length && (it.facts || []).length) {
        const translated = trList(it.facts);
        factEls.forEach((li, i) => { if (translated[i] !== undefined && li.textContent !== translated[i]) li.textContent = translated[i]; });
      }
    });
  }

  let trRenderQueued = false;
  function trRefreshSoon() {
    if (trRenderQueued) return;
    trRenderQueued = true;
    tick().then(() => { trRenderQueued = false; patchTranslations(); renderCountryViewer(); });
  }

  // Kicks off translation for whatever text is about to be shown on screen, with modest concurrency (the
  // free endpoint above is unauthenticated, so this deliberately doesn't hammer it). Cards already show their
  // English text immediately; each one silently swaps in its translation as soon as it lands, via the
  // debounced re-render above - never a blocking spinner over the news itself.
  const TR_CONCURRENCY = 4;
  let trActive = 0;
  const trQueue = [];
  function trPump() {
    while (trActive < TR_CONCURRENCY && trQueue.length) {
      const text = trQueue.shift();
      const key = trKey(text);
      if (TR_CACHE.has(key) || TR_PENDING.has(key)) continue;
      TR_PENDING.add(key);
      trActive++;
      translateOne(text, currentLang)
        .then(out => TR_CACHE.set(key, out || text))
        .catch(() => TR_CACHE.set(key, text))   // give up quietly for this string - it just stays in English
        .finally(() => { TR_PENDING.delete(key); trActive--; trRefreshSoon(); trPump(); });
    }
  }
  function ensureTranslated(texts) {
    if (currentLang === 'en') return;
    for (const text of texts) {
      if (!text) continue;
      const key = trKey(text);
      if (!TR_CACHE.has(key) && !TR_PENDING.has(key) && !trQueue.includes(text)) trQueue.push(text);
    }
    trPump();
  }
  // Collects every translatable string out of a list of feed items, for one ensureTranslated() call per render.
  function collectTranslatable(items) {
    const out = [];
    for (const it of items) {
      if (it.headline) out.push(it.headline);
      if (it.summary) out.push(it.summary);
      if (it.why) out.push(it.why);
      if (it.facts) out.push(...it.facts);
    }
    return out;
  }

  const URLS = {
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
  };

  const S = {
    items: [],
    live: [],
    liveMeta: null,
    liveSig: '',
    videoMeta: null,
    brief: null,
    lastLive: 0,
    tab: 'inbox',
    open: new Set(),
    exportRange: 'today',
    f: { range: '7d', country: '', sector: '', imp: '', q: '', view: 'priority' },
    syncCode: null,          // this device's sync code (also usable on other devices to share state)
    saved: new Set(),        // article ids saved by the user (Phase B, kept here so Sync can use it early)
    dismissed: new Set(),    // article ids dismissed by the user (Phase B)
    myChannels: new Set(),   // Telegram channels this user has chosen to follow (empty = follow everything)
    hiddenChannels: new Set(), // channels this user has explicitly removed/hidden from their own Telegram list
    reviewed: new Set(),     // article ids the user has opened in the Country Status viewer (Phase C)
    myCompanies: new Set(),  // companies this user is tracking (invested in / watching) - News/Investment toggle
    mode: 'news',            // 'news' (country-grouped, unchanged) or 'investment' (sector->company groups, tracked companies only)
    cv: null                 // { country, idx, stories } while the Country Status viewer is open; not persisted
  };

  /* ---------- storage (IndexedDB) ---------- */
  const DB = {
    db: null,
    init() {
      return new Promise(res => {
        try {
          const r = indexedDB.open('gni-phase1', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' });
          r.onsuccess = () => { DB.db = r.result; res(true); };
          r.onerror = () => res(false);
        } catch (e) { res(false); }
      });
    },
    tx(mode, fn) {
      return new Promise((ok, no) => {
        if (!DB.db) return ok(null);
        const t = DB.db.transaction('items', mode);
        const req = fn(t.objectStore('items'));
        t.oncomplete = () => ok(req ? req.result : null);
        t.onerror = () => no(t.error);
      });
    },
    all() { return DB.tx('readonly', s => s.getAll()).then(r => r || []); },
    put(it) { return DB.tx('readwrite', s => s.put(strip(it))); },
    del(id) { return DB.tx('readwrite', s => s.delete(id)); },
    clear() { return DB.tx('readwrite', s => s.clear()); }
  };
  const strip = it => JSON.parse(JSON.stringify(it));

  /* ---------- Sync (Phase 3): saved / dismissed / followed channels, shared across a person's devices ----------
     There are no accounts. A device makes a random "sync code" the first time it is used, and stores it in
     localStorage. Entering the same code on another device makes both read and write the same small record in
     Firestore. Anyone who has the code can see and change that record - there is no password - so the code is
     shown once, clearly marked as something to keep private, the same way a person would treat a shared link.
     A sync problem must never stop the news feed from working: every method below fails quietly and falls back
     to the device's own local copy. */
  const SYNC_KEY = 'qs-sync-code-v1';
  const SYNC_CACHE_KEY = 'qs-sync-cache-v1';
  const FIREBASE = {
    // Public web config: safe to ship in client code. Firestore access is controlled by server-side Security
    // Rules (see firestore.rules in the repo), not by keeping this object secret.
    apiKey: 'AIzaSyBTix4TmUn9oVQrX0ByPra4FissOfAHefY',
    projectId: 'qwicksignal',
    // Phase E: the OAuth "Web client ID" for Google sign-in. This is NOT auto-generated by this code - in the
    // Firebase console, go to Authentication -> Sign-in method -> enable Google, and it will show you this ID
    // (also visible in Google Cloud Console -> APIs & Services -> Credentials). You also need to enable the
    // Email/Password provider on that same Sign-in method screen for email/password accounts to work at all -
    // both providers are OFF by default on a new Firebase project, and Auth.signUp/signIn will fail with
    // "OPERATION_NOT_ALLOWED" until Email/Password is turned on. Leaving googleClientId blank simply hides the
    // "Continue with Google" button - email/password accounts work regardless.
    googleClientId: '434668496404-ivlniatcoq0b26bvcuk9ue1q40thtkfu.apps.googleusercontent.com'
  };
  // Web Push VAPID public key (safe to ship in client code - it only identifies this app to the push
  // service, it can't be used to send anything). Its matching private key lives only in the pipeline's
  // GitHub Actions secrets (see pipeline.py's send_push_notifications()) and is never in this repo.
  const VAPID_PUBLIC_KEY = 'BLoqORqoNU8nV8DYIq70_t11_XaiwkhELAT_QBtFyoz9c8sWnYd0Ibg8Pp1sr_87C0s0iHq9FKQxZsk5wo4mh8w';
  const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;

  // The one account that owns this deployment - the only sign-in that can remove a shared channel or curate the
  // "default channels" list guests (and logged-in users with no channels of their own) see. This is enforced for
  // real in firestore.rules (request.auth.token.email == this same address); the check here only decides what the
  // UI offers, exactly like googleClientId above - a client-side check is never real security by itself. If you
  // sign in with a different email than this, change the value below AND the matching line in firestore.rules,
  // then re-publish the rules.
  const OWNER_EMAIL = 'rrrajput2101@gmail.com';
  const isOwner = () => !!(Auth.uid && Auth.email && Auth.email.toLowerCase() === OWNER_EMAIL.toLowerCase());

  function newSyncCode() {
    const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I, so a code is easy to read and re-type
    let s = '';
    for (let i = 0; i < 8; i++) s += AB[Math.floor(Math.random() * AB.length)];
    return 'QS-' + s.slice(0, 4) + '-' + s.slice(4);
  }
  // Case-sensitive on purpose: callers normalize (trim + uppercase) before calling this, so a caller that
  // forgets to normalize gets a clear "invalid" rather than a silently auto-corrected code.
  function validSyncCode(s) { return /^QS-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/.test(s || ''); }

  // Firestore REST <-> plain JS value conversion (the REST API wraps every value with its type).
  function toFsValue(v) {
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'number') return { integerValue: String(Math.trunc(v)) };
    if (typeof v === 'boolean') return { booleanValue: v };
    return { nullValue: null };
  }
  function fromFsValue(v) {
    if (!v) return null;
    if (v.arrayValue) return (v.arrayValue.values || []).map(fromFsValue);
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return parseInt(v.integerValue, 10);
    if ('booleanValue' in v) return v.booleanValue;
    return null;
  }
  function fsFieldsToObject(fields) {
    const out = {};
    for (const k in (fields || {})) out[k] = fromFsValue(fields[k]);
    return out;
  }

  /* ---------- Phase E: accounts (optional) ----------
     Login is optional - guest mode (the sync code above) keeps working exactly as before. Signing in
     gives you a permanent identity instead of a code to remember/share, and unlocks a real per-user
     security boundary in Firestore (qs_users/{uid}, only readable/writable by that uid - see
     firestore.rules) instead of "anyone with the code." Implemented as plain REST calls to Google's
     Identity Toolkit (the same API the Firebase Auth SDK itself calls), so the app still ships with no
     build step and no SDK, matching the rest of app.js. */
  const AUTH_KEY = 'qs-auth-v1';
  const IDTOOLKIT = 'https://identitytoolkit.googleapis.com/v1';
  const SECURETOKEN = 'https://securetoken.googleapis.com/v1/token';

  function authErrorMessage(d) {
    const code = ((d || {}).error || {}).message || '';
    const MAP = {
      EMAIL_EXISTS: 'An account with that email already exists – try signing in instead.',
      EMAIL_NOT_FOUND: 'No account found with that email.',
      INVALID_PASSWORD: 'Incorrect email or password.',
      INVALID_LOGIN_CREDENTIALS: 'Incorrect email or password.',
      WEAK_PASSWORD: 'Use a password of at least 6 characters.',
      INVALID_EMAIL: 'That doesn’t look like a valid email address.',
      TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts – wait a bit and try again.',
      USER_DISABLED: 'This account has been disabled.',
      OPERATION_NOT_ALLOWED: 'Email/password sign-in isn’t turned on for this app yet (Firebase console → Authentication → Sign-in method).',
      // Different from OPERATION_NOT_ALLOWED above: this means Firebase Authentication itself has never been
      // switched on for this project (nobody has clicked "Get started" on the Authentication tab yet), so
      // there is no sign-in configuration at all yet, not just a disabled provider.
      CONFIGURATION_NOT_FOUND: 'Sign-in isn’t set up yet for this app (Firebase console → Authentication → click “Get started”, then enable Email/Password under Sign-in method).'
    };
    return MAP[code] || (code ? code.replace(/_/g, ' ').toLowerCase() : 'Something went wrong. Try again.');
  }

  const Auth = {
    uid: null, email: null, idToken: null, refreshToken: null, expiresAt: 0, ready: false,

    load() {
      try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; }
    },
    persist() {
      try {
        if (!this.uid) { localStorage.removeItem(AUTH_KEY); return; }
        localStorage.setItem(AUTH_KEY, JSON.stringify({
          uid: this.uid, email: this.email, idToken: this.idToken, refreshToken: this.refreshToken, expiresAt: this.expiresAt
        }));
      } catch (e) { /* private browsing etc: session just won't survive a reload */ }
    },
    applySession(uid, email, idToken, refreshToken, expiresInSec) {
      this.uid = uid; this.email = email || this.email; this.idToken = idToken; this.refreshToken = refreshToken;
      this.expiresAt = Date.now() + (Number(expiresInSec || 3600) - 60) * 1000;   // refresh a minute early
      this.persist();
    },

    async restore() {
      const rec = this.load();
      if (!rec || !rec.uid) { this.ready = true; return false; }
      this.uid = rec.uid; this.email = rec.email; this.idToken = rec.idToken;
      this.refreshToken = rec.refreshToken; this.expiresAt = rec.expiresAt || 0;
      const result = await this.refreshIfNeeded();
      this.ready = true;
      // Only a DEFINITIVE rejection from Firebase itself (the refresh token was actually revoked or is
      // invalid - e.g. the password was changed elsewhere, or the account was deleted) should sign the
      // person out here. Anything else - offline for a moment, a slow connection, a transient network or
      // CORS hiccup on load, which is common on mobile - must NOT wipe a real, valid session just because
      // this one attempt to refresh it happened to fail. In that ambiguous case we keep the existing
      // session as-is (still logged in, using the token already stored) and simply try again the next time
      // something needs it; the worst case is one stale token retried shortly after, not a surprise logout.
      if (result === 'invalid') this.signOut();
      return result === 'ok' || result === 'unchanged';
    },

    // Returns 'unchanged' (token still fresh, nothing to do), 'ok' (refreshed successfully), 'invalid'
    // (Firebase explicitly rejected the refresh token - genuinely dead), or 'network' (couldn't reach
    // Firebase to find out either way - NOT the same as invalid, see restore() above).
    async refreshIfNeeded() {
      if (!this.refreshToken) return 'invalid';
      if (Date.now() < this.expiresAt) return 'unchanged';
      try {
        const r = await fetch(`${SECURETOKEN}?key=${FIREBASE.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(this.refreshToken)
        });
        if (!r.ok) {
          // A 400 with a body naming the token as invalid/expired/revoked is Firebase actually saying
          // "this session is over." Any other failure (5xx, a body we can't parse, etc.) is treated as
          // network trouble, not a verdict on the session.
          let code = '';
          try { code = ((await r.json()).error || {}).message || ''; } catch (e) { /* not JSON */ }
          const dead = /TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_DISABLED|USER_NOT_FOUND/.test(code);
          return dead ? 'invalid' : 'network';
        }
        const d = await r.json();
        this.applySession(d.user_id, this.email, d.id_token, d.refresh_token, d.expires_in);
        return 'ok';
      } catch (e) { return 'network'; }   // fetch itself failed: offline, blocked, timed out - not a rejection
    },

    // Always call this right before an authenticated Firestore request - it refreshes a stale token first.
    // refreshIfNeeded() now returns a string ('unchanged'/'ok'/'invalid'/'network'), not a boolean - only
    // 'unchanged' or 'ok' mean there's a good token to hand back.
    async bearerToken() {
      if (!this.uid) return null;
      if (Date.now() >= this.expiresAt) {
        const result = await this.refreshIfNeeded();
        if (result !== 'ok' && result !== 'unchanged') return null;
      }
      return this.idToken;
    },

    async _call(endpoint, body) {
      try {
        const r = await fetch(`${IDTOOLKIT}/accounts:${endpoint}?key=${FIREBASE.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, error: authErrorMessage(d) };
        this.applySession(d.localId, d.email, d.idToken, d.refreshToken, d.expiresIn);
        return { ok: true };
      } catch (e) { return { ok: false, error: 'Network error – check your connection.' }; }
    },
    signUp(email, password) { return this._call('signUp', { email, password, returnSecureToken: true }); },
    signIn(email, password) { return this._call('signInWithPassword', { email, password, returnSecureToken: true }); },
    signInWithGoogleIdToken(idToken) {
      return this._call('signInWithIdp', {
        postBody: 'id_token=' + encodeURIComponent(idToken) + '&providerId=google.com',
        requestUri: location.origin, returnSecureToken: true
      });
    },
    signOut() {
      this.uid = null; this.email = null; this.idToken = null; this.refreshToken = null; this.expiresAt = 0;
      this.persist();
    }
  };

  const Sync = {
    code: null,
    ready: false,

    localCode() { try { return localStorage.getItem(SYNC_KEY); } catch (e) { return null; } },
    saveLocalCode(code) { try { localStorage.setItem(SYNC_KEY, code); } catch (e) { /* private browsing etc: sync still works this session */ } },
    cacheRead() { try { return JSON.parse(localStorage.getItem(SYNC_CACHE_KEY) || 'null'); } catch (e) { return null; } },
    cacheWrite(obj) { try { localStorage.setItem(SYNC_CACHE_KEY, JSON.stringify(obj)); } catch (e) { /* ignore */ } },

    async init() {
      let code = this.localCode();
      if (!code) { code = newSyncCode(); this.saveLocalCode(code); }
      this.code = code;
      S.syncCode = code;
      const cached = this.cacheRead();       // show something instantly; the network read (if any) refines it after
      if (cached) this.applyRecord(cached);
      await this.pull();
    },

    async switchTo(code) {
      code = (code || '').trim().toUpperCase();
      if (!validSyncCode(code)) { toast('That code doesn\u2019t look right. It should look like QS-AB12-CD34.'); return false; }
      this.saveLocalCode(code);
      this.code = code;
      S.syncCode = code;
      this.cacheWrite(null);
      S.saved = new Set(); S.dismissed = new Set(); S.myChannels = new Set(); S.hiddenChannels = new Set(); S.reviewed = new Set(); S.myCompanies = new Set();
      const ok = await this.pull();
      toast(ok ? 'Synced. This device now shares saved articles and channels with that code.' : 'Saved the code, but couldn\u2019t reach the sync service just now. It will sync when back online.');
      renderAll(); renderChannels();
      return true;
    },

    // Phase E: when signed in, every sync read/write goes to this account's own qs_users/{uid} doc,
    // authenticated with a Bearer ID token, instead of the guest qs_sync/{code} doc keyed by API key.
    // Nothing else about pull()/push() changes - same shape, same cache-then-network pattern.
    docUrl() {
      return Auth.uid ? `${FS_BASE}/qs_users/${Auth.uid}` : `${FS_BASE}/qs_sync/${encodeURIComponent(this.code)}?key=${FIREBASE.apiKey}`;
    },
    async authHeaders() {
      if (!Auth.uid) return {};
      const t = await Auth.bearerToken();
      return t ? { Authorization: 'Bearer ' + t } : {};
    },

    applyRecord(rec) {
      S.saved = new Set(rec.saved || []);
      S.dismissed = new Set(rec.dismissed || []);
      S.myChannels = new Set(rec.channels || []);
      S.hiddenChannels = new Set(rec.hiddenChannels || []);
      S.reviewed = new Set(rec.reviewed || []);
      S.myCompanies = new Set(rec.companies || []);
    },

    // lastPullFoundDoc distinguishes "no cloud record yet" (404 - S.* is left exactly as it was, whatever
    // that was) from "found one and loaded it" - completeAuth() below needs that distinction to know
    // whether a brand-new account actually had its own data, or is still just showing leftover guest state.
    lastPullFoundDoc: false,
    async pull() {
      try {
        const r = await fetch(this.docUrl(), { cache: 'no-store', headers: await this.authHeaders() });
        if (r.status === 404) { this.ready = true; this.lastPullFoundDoc = false; return true; }   // a fresh, empty device/account
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const doc = await r.json();
        const rec = fsFieldsToObject(doc.fields);
        this.applyRecord(rec);
        if (!Auth.uid) this.cacheWrite(rec);    // the local cache is a guest-mode-only convenience
        this.ready = true;
        this.lastPullFoundDoc = true;
        return true;
      } catch (e) {
        this.ready = false;           // network trouble or first run offline: keep working from the local cache
        return false;
      }
    },

    async push() {
      if (!this.code && !Auth.uid) return false;
      const rec = { saved: [...S.saved], dismissed: [...S.dismissed], channels: [...S.myChannels], hiddenChannels: [...S.hiddenChannels], reviewed: [...S.reviewed], companies: [...S.myCompanies] };
      if (!Auth.uid) this.cacheWrite(rec);
      try {
        const fields = { saved: toFsValue(rec.saved), dismissed: toFsValue(rec.dismissed), channels: toFsValue(rec.channels), hiddenChannels: toFsValue(rec.hiddenChannels), reviewed: toFsValue(rec.reviewed), companies: toFsValue(rec.companies) };
        const headers = Object.assign({ 'Content-Type': 'application/json' }, await this.authHeaders());
        const r = await fetch(this.docUrl(), { method: 'PATCH', headers, body: JSON.stringify({ fields }) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        this.ready = true;
        return true;
      } catch (e) {
        return false;                 // saved locally (guest mode); will retry on the next change or next launch
      }
    },

    pushSoon: (() => { let t = null; return () => { clearTimeout(t); t = setTimeout(() => Sync.push(), 600); }; })()
  };

  /* ---------- Phase E: account UI ---------- */
  // Runs right after a successful sign-up/sign-in/Google call. Auth.uid is already set at this point, so
  // Sync.pull() below reads this account's own qs_users/{uid} doc instead of the guest one.
  async function completeAuth() {
    const hadGuestData = !!(S.saved.size || S.dismissed.size || S.myChannels.size || S.hiddenChannels.size || S.reviewed.size || S.myCompanies.size);
    await Sync.pull();
    // pull() found no existing doc for this account (a brand-new account, or a returning one that never
    // synced from this browser before) - S.* still holds whatever was there before the pull, i.e. the
    // guest data, unchanged. If the account already had its own cloud data, pull() has just loaded it and
    // overwritten S.* with it - nothing to offer merging in, that data already IS what's now on screen.
    if (hadGuestData && !Sync.lastPullFoundDoc) {
      const bring = confirm('Bring your existing saved articles, dismissed items and followed channels into this account?');
      if (!bring) { S.saved = new Set(); S.dismissed = new Set(); S.myChannels = new Set(); S.hiddenChannels = new Set(); S.reviewed = new Set(); S.myCompanies = new Set(); }
      else await Sync.push();
      toast('Signed in as ' + Auth.email + (bring ? '. Your existing data is now saved to this account.' : '.'));
    } else {
      toast('Signed in as ' + Auth.email + '.');
    }
    renderAccount(); renderAll(); renderChannels(); renderSyncCode(); renderTicketBox(); renderTicketAdmin(); renderInvestmentBox();
  }

  function signOut() {
    Auth.signOut();
    S.saved = new Set(); S.dismissed = new Set(); S.myChannels = new Set(); S.hiddenChannels = new Set(); S.reviewed = new Set(); S.myCompanies = new Set();
    renderAccount(); renderAll(); renderChannels(); renderSyncCode(); renderTicketBox(); renderTicketAdmin(); renderInvestmentBox();
    toast('Signed out. Back to guest mode on this device.');
    Sync.pull().then(() => { renderAll(); renderChannels(); });    // fall back to this browser's guest sync code
    Landing.clearGuestSeen();   // a stale guest flag from earlier this tab session shouldn't skip the screen below
    Landing.show();   // "once the user picks something" also unwinds on sign-out: ask again next time
  }

  /* ---------- Landing / sign-in screen ----------
     A new front door: "Login as user with id/password or google account or will login as guest. Once the
     user gets into the site via user login or as a guest - land them on signal page." Shown until a choice
     is made (sign in, create account, Google, or Continue as guest).
     Signing in/up is remembered properly - Auth's own stored session (AUTH_KEY, checked via Auth.load())
     is what lets a real account skip this screen next time, exactly like before.
     Continuing as guest is now remembered only for the current tab/session (sessionStorage, GUEST_KEY) -
     "if the tab/session is closed the user should be redirected to the login page again." Closing the tab,
     or opening the app in a new tab, asks again; reloading the SAME tab does not (sessionStorage survives
     a reload, just not a close). Signing out (below) clears both and brings this screen back either way. */
  const GUEST_KEY = 'qs-landing-guest-v1';   // sessionStorage: guest choice, this tab only
  const Landing = {
    guestSeen() { try { return sessionStorage.getItem(GUEST_KEY) === '1'; } catch (e) { return false; } },
    markGuestSeen() { try { sessionStorage.setItem(GUEST_KEY, '1'); } catch (e) { /* private browsing etc. */ } },
    clearGuestSeen() { try { sessionStorage.removeItem(GUEST_KEY); } catch (e) { /* private browsing etc. */ } },
    // A signed-in account skips the landing screen via its own persisted session, same as always; a guest
    // only skips it for as long as this tab/session stays open.
    seen() { const rec = Auth.load(); return !!(rec && rec.uid) || this.guestSeen(); },
    show() {
      const el = $('#landing');
      if (el) el.hidden = false;
      document.body.classList.add('pre-app');
      renderGoogleButton('landingGoogleBtn', async () => { await completeAuth(); Landing.dismiss(false); });
      // Brief bars-loading indicator (see .landing-loader in index.html) before the sign-in form appears -
      // a short, fixed reveal rather than tied to any particular async step, so it never gets stuck showing
      // if something is slow and never flashes so fast it's pointless if everything is instant. Kept well
      // under half a second so it reads as a polish beat, not a delay someone has to wait through.
      if (el) setTimeout(() => el.classList.remove('landing-loading'), 350);
    },
    // asGuest=true records the session-only guest flag; a real sign-in/sign-up dismissal needs nothing
    // extra here since Auth already persisted its own session by the time this runs.
    dismiss(asGuest) {
      if (asGuest) this.markGuestSeen();
      const el = $('#landing');
      if (el) el.hidden = true;
      document.body.classList.remove('pre-app');
    },
    // Called once at boot: if this device/tab already has a reason to skip (a real signed-in session, or a
    // guest choice made earlier in this same tab/session), skip straight past the landing screen (same
    // "land them on Signals" outcome either way, since setTab('brief') already runs unconditionally
    // elsewhere in start()). Otherwise show it and wire its controls - done here rather than
    // unconditionally so a returning, already-decided visitor never pays for the Google button init or
    // seeing the screen flash up first.
    init() {
      if (this.seen()) return;
      this.show();
      const form = $('#landingAuthForm');
      if (form) form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const mode = (ev.submitter && ev.submitter.dataset.mode) || 'signin';
        const email = $('#landingEmail').value.trim(), pass = $('#landingPass').value;
        if (!email || pass.length < 6) { toast('Enter an email and a password of at least 6 characters.'); return; }
        const r = mode === 'signup' ? await Auth.signUp(email, pass) : await Auth.signIn(email, pass);
        if (!r.ok) { toast(r.error); return; }
        track(mode === 'signup' ? 'sign_up' : 'sign_in', { method: 'email' });
        await completeAuth();
        this.dismiss(false);
      });
      const guestBtn = $('#landingGuestBtn');
      if (guestBtn) guestBtn.addEventListener('click', () => { track('continue_as_guest'); this.dismiss(true); });
    }
  };

  let googleReady = false;
  // Takes a container id so both the Settings account box (#googleBtn) and the landing page
  // (#landingGoogleBtn) can share the same Google Identity Services init/render logic instead of
  // duplicating it - each call re-initializes with its own callback, which is harmless (GIS supports it)
  // and keeps completeAuth()'s post-sign-in flow identical no matter which button was used.
  async function renderGoogleButton(containerId = 'googleBtn', onSignedIn = completeAuth) {
    const box = $('#' + containerId);
    if (!box) return;
    if (!FIREBASE.googleClientId) { box.hidden = true; return; }   // not configured for this deployment
    box.hidden = false;
    try {
      if (!googleReady) { await loadScript('https://accounts.google.com/gsi/client'); googleReady = true; }
      window.google.accounts.id.initialize({
        client_id: FIREBASE.googleClientId,
        callback: async (resp) => {
          const r = await Auth.signInWithGoogleIdToken(resp.credential);
          if (!r.ok) { toast(r.error); return; }
          track('sign_in', { method: 'google' });
          await onSignedIn();
        }
      });
      box.innerHTML = '';
      window.google.accounts.id.renderButton(box, { type: 'standard', theme: 'outline', size: 'large', width: 260 });
    } catch (e) {
      box.hidden = true;   // Google's script didn't load (offline, or accounts.google.com blocked) - email/password still works
    }
  }

  function renderAccount() {
    const box = $('#accountBox');
    if (!box) return;
    if (Auth.uid) {
      box.innerHTML = `<p class="acct-signed">${t('signedInAs')} <b>${esc(Auth.email || '')}</b></p>
        <button id="signOutBtn" class="btn small">${t('signOut')}</button>`;
      $('#signOutBtn').addEventListener('click', signOut);
      $('#syncBlock').hidden = true;     // the account is now this device's identity; the manual code is redundant
    } else {
      box.innerHTML = `
        <form id="authForm" class="acct-form">
          <label class="vh" for="authEmail">${t('signInEmail')}</label>
          <input id="authEmail" type="email" autocomplete="email" placeholder="Enter your Gmail" required>
          <label class="vh" for="authPass">${t('signInPassword')}</label>
          <input id="authPass" type="password" autocomplete="current-password" placeholder="${esc(t('signInPassword'))}" minlength="6" required>
          <div class="acct-buttons">
            <button type="submit" data-mode="signin" class="btn primary small">${t('signIn')}</button>
            <button type="submit" data-mode="signup" class="btn small">${t('createAccount')}</button>
          </div>
        </form>
        <div id="googleBtn" class="acct-google" hidden></div>`;
      $('#authForm').addEventListener('submit', async ev => {
        ev.preventDefault();
        const mode = (ev.submitter && ev.submitter.dataset.mode) || 'signin';
        const email = $('#authEmail').value.trim(), pass = $('#authPass').value;
        if (!email || pass.length < 6) { toast('Enter an email and a password of at least 6 characters.'); return; }
        const r = mode === 'signup' ? await Auth.signUp(email, pass) : await Auth.signIn(email, pass);
        if (!r.ok) { toast(r.error); return; }
        await completeAuth();
      });
      renderGoogleButton();
      $('#syncBlock').hidden = false;
    }
  }

  // Rough, good-enough device guess from the UA string - only used to decide which tab opens by default
  // (Android vs iPhone); both tabs are always present so anyone can check the other platform's steps too
  // (e.g. to tell a friend on a different phone how to install it).
  function guessPlatform() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    // iPadOS 13+ reports as "Macintosh" with touch support - the one real ambiguous case worth catching.
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
    return 'android';   // most visitors are on Android (see the TWA work earlier this project) - reasonable default
  }

  // "Get the app" card: Android gets the direct APK download (item #9 - a single zipped asset on the
  // GitHub release, not the whole PWABuilder export folder). iOS can't sideload a .apk at all (Apple
  // blocks it outright, no workaround), so it gets "Add to Home Screen" steps instead - the PWA already
  // supports real push notifications on iOS 16.4+, so this is a genuinely equivalent install path, not a
  // downgrade. Both tabs always exist (see guessPlatform() above); only which one opens by default changes.
  const APK_URL = 'https://github.com/romitrajput/qwicksignal/releases/download/QwickSignal/QwickSignal.zip';
  let gaTab = null;   // persists the chosen tab across re-renders within a session (e.g. after a language change)
  function renderGetApp() {
    const box = $('#getAppBox');
    if (!box) return;
    if (!gaTab) gaTab = guessPlatform();
    const androidSvg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 9.48l1.84-3.18a.5.5 0 0 0-.86-.5l-1.87 3.23a8.9 8.9 0 0 0-7.42 0L7.42 5.8a.5.5 0 1 0-.86.5L8.4 9.48A8.4 8.4 0 0 0 4 16.5h16a8.4 8.4 0 0 0-4.4-7.02zM9 14.25a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>';
    const appleSvg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.3 12.2c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.3.7 1 1.5 2.1 2.6 2a10 10 0 0 0 1.2-.1c.5-.2 1-.2 1.6 0 .6.2 1 .1 1.6-.1 1.1-.4 1.9-1.6 2.6-2.6a7.3 7.3 0 0 1-1.7-2.9c.1 0-1.5-.8-1.5-2zM14.1 5.9c.6-.7 1-1.7.9-2.6-.9.1-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5.9.1 1.9-.4 2.5-1.2z"/></svg>';
    box.innerHTML = `
      <div class="tcard gacard">
        <div class="gatabs" role="tablist" aria-label="${esc(t('getAppHeading'))}">
          <button role="tab" data-v="android" aria-pressed="${gaTab === 'android'}">${androidSvg}${esc(t('getAppAndroidTab'))}</button>
          <button role="tab" data-v="ios" aria-pressed="${gaTab === 'ios'}">${appleSvg}${esc(t('getAppIosTab'))}</button>
        </div>
        ${gaTab === 'android' ? `
          <p class="lp-sub" style="margin:0">${esc(t('getAppSub'))}</p>
          <a id="apkDownloadLink" class="btn primary small" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none;align-self:flex-start" href="${esc(APK_URL)}">${esc(t('getAppBtn'))}</a>
        ` : `
          <ol class="gasteps">
            <li><span class="ganum">1</span><span>${esc(t('getAppIosStep1'))}</span></li>
            <li><span class="ganum">2</span><span>${esc(t('getAppIosStep2'))}</span></li>
            <li><span class="ganum">3</span><span>${esc(t('getAppIosStep3'))}</span></li>
          </ol>
          <p class="ganote">${esc(t('getAppIosNote'))}</p>
        `}
      </div>
    `;
    $$('.gatabs button', box).forEach(b => b.addEventListener('click', () => { gaTab = b.dataset.v; renderGetApp(); }));
  }

  function renderNotifBox() {
    const box = $('#notifBox');
    if (!box) return;
    if (!Push.supported()) {
      box.innerHTML = `<p class="lp-syncnote">${t('notifUnsupported')}</p>`;
      return;
    }
    const blocked = Notification.permission === 'denied';
    const on = Push.isOn() && Notification.permission === 'granted';
    if (blocked) {
      box.innerHTML = `<p class="lp-syncnote">${t('notifBlocked')}</p>`;
      return;
    }
    box.innerHTML = on
      ? `<p class="lp-syncnote">${t('notifOn')}</p><button id="notifBtn" class="btn small">${t('notifDisable')}</button>`
      : `<button id="notifBtn" class="btn primary small">${t('notifEnable')}</button>`;
    $('#notifBtn').addEventListener('click', async () => {
      $('#notifBtn').disabled = true;
      if (on) { await Push.unsubscribe(); } else {
        const r = await Push.subscribe();
        if (!r.ok) { toast(r.error); }
      }
      renderNotifBox();
    });
  }

  // Feedback/bug/support submission card. Requires an account (per the owner's request: tickets are now
  // tied to a real identity, same reasoning as gating Telegram +Add and cross-device sync) - a signed-out
  // visitor sees a login prompt instead of the form, via openAuthGate(), not a disabled textarea they can
  // type into and then get rejected on submit.
  const TICKET_MAX = 2000;
  function renderTicketBox() {
    const box = $('#ticketBox');
    if (!box) return;
    if (!Auth.uid) {
      box.innerHTML = `<div class="tcard" style="text-align:center;padding:22px 16px">
        <p class="lp-sub" style="margin:0 0 12px">${esc(t('feedbackLoginBody'))}</p>
        <button class="btn primary small" data-act="agGoto">${esc(t('agGoToAccount'))}</button>
      </div>`;
      return;
    }
    box.innerHTML = `
      <div class="tcard">
        <div class="tseg" id="ticketKindSeg" role="group" aria-label="${esc(t('feedbackHeading'))}">
          <button data-v="bug" aria-pressed="true">${esc(t('ticketKindBug'))}</button>
          <button data-v="support" aria-pressed="false">${esc(t('ticketKindSupport'))}</button>
          <button data-v="feedback" aria-pressed="false">${esc(t('ticketKindFeedback'))}</button>
        </div>
        <textarea id="ticketMsg" class="tmsg" rows="4" maxlength="${TICKET_MAX}" placeholder="${esc(t('ticketPlaceholder'))}"></textarea>
        <div class="tfoot">
          <span class="tcount" id="ticketCount">0 / ${TICKET_MAX}</span>
          <button id="ticketSendBtn" class="btn primary small">${esc(t('ticketSend'))}</button>
        </div>
      </div>
    `;
    let kind = 'bug';
    $$('#ticketKindSeg button', box).forEach(b => b.addEventListener('click', () => {
      kind = b.dataset.v;
      $$('#ticketKindSeg button', box).forEach(x => x.setAttribute('aria-pressed', x === b));
    }));
    const ta = $('#ticketMsg', box), count = $('#ticketCount', box);
    ta.addEventListener('input', () => { count.textContent = ta.value.length + ' / ' + TICKET_MAX; });
    $('#ticketSendBtn', box).addEventListener('click', async () => {
      const btn = $('#ticketSendBtn', box);
      btn.disabled = true;
      const r = await Tickets.submit(kind, ta.value);
      btn.disabled = false;
      if (r.ok) { ta.value = ''; count.textContent = '0 / ' + TICKET_MAX; toast(t('ticketSent')); }
      else { toast(r.error); }
    });
  }

  // Owner-only ticket list. Block itself stays hidden (removed from layout, not just display:none in spirit
  // - the "hidden" attribute) for anyone whose isOwner() is false, so a non-owner never even sees an empty
  // "Tickets" heading or triggers the owner-gated Firestore query.
  async function renderTicketAdmin() {
    const block = $('#ticketAdminBlock');
    const box = $('#ticketAdminBox');
    if (!block || !box) return;
    if (!isOwner()) { block.hidden = true; return; }
    block.hidden = false;
    box.innerHTML = '<p class="lp-syncnote">…</p>';
    const rows = await Tickets.listAll();
    if (rows === null) { box.innerHTML = `<p class="lp-syncnote">${t('ticketAdminLoadFailed')}</p>`; return; }
    if (!rows.length) { box.innerHTML = `<p class="lp-syncnote">${t('ticketAdminEmpty')}</p>`; return; }
    box.innerHTML = rows.map(tk => {
      const done = tk.status === 'done';
      const kindLabel = tk.kind === 'bug' ? t('ticketKindBug') : tk.kind === 'support' ? t('ticketKindSupport') : t('ticketKindFeedback');
      const when = tk.created_at ? fmtDateTime(new Date(tk.created_at).getTime()) : '';
      return `<div class="lp-row" style="align-items:flex-start;flex-direction:column;gap:4px;padding:10px 0;border-top:1px solid var(--line)">
        <div style="display:flex;gap:8px;align-items:center;width:100%">
          <span class="chip" style="flex:none">${kindLabel}</span>
          <span style="flex:1;font-size:12.5px;color:var(--ink2)">${when}${tk.user_email ? ' · ' + tk.user_email : ''}</span>
          <span style="flex:none;font-size:12px;font-weight:700;color:${done ? 'var(--ink2)' : 'var(--accent)'}">${done ? t('ticketStatusDone') : t('ticketStatusOpen')}</span>
        </div>
        <div style="font-size:14px;white-space:pre-wrap">${escapeHtml(tk.message || '')}</div>
        <button class="btn small" data-ticket-toggle="${tk.id}" data-ticket-status="${done ? 'open' : 'done'}">${done ? t('ticketMarkOpen') : t('ticketMarkDone')}</button>
      </div>`;
    }).join('');
    $$('[data-ticket-toggle]', box).forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      await Tickets.setStatus(b.dataset.ticketToggle, b.dataset.ticketStatus);
      renderTicketAdmin();
    }));
  }

  /* ---------- Telegram channel linking (Link Pages) ----------
     Typing t/channelname adds it straight to the shared qs_channels collection as "approved" - the very next
     pipeline run (see fetch_approved_channels() in pipeline.py) picks it up and starts fetching it into the
     shared feed.json for everyone, no manual review step. This trades away the earlier "one person can't
     silently add a source for everyone" protection in exchange for channels going live immediately - see the
     note in the Link Pages screen. */
  const CHANNEL_RX = /^[a-z0-9_]{5,32}$/i;
  // Accepts our own t/channelname shorthand, a bare @channelname, or a pasted Telegram link in any of its
  // common forms (t.me, telegram.me, with or without "www.", http or https, with or without a trailing
  // slash or a ?start=/?ref= query string) - "so the person doesn't have to get the exact t/channelname
  // format right themselves, just paste the link Telegram gives them."
  function normalizeChannel(raw) {
    let s = (raw || '').trim();
    if (s.startsWith('t/')) s = s.slice(2);
    s = s.replace(/^@/, '');
    s = s.replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, '');
    s = s.split('?')[0].split('#')[0];   // drop any ?start=xyz / ?ref=xyz / #fragment a pasted link carries
    s = s.replace(/\/+$/, '');            // drop a trailing slash left over from the link
    return s.trim();
  }
  // Set whenever a Firestore call fails, so the UI can show *why* instead of just "check your connection" -
  // check the browser console (F12) for the full detail this only summarises.
  let lastChannelError = null;
  async function describeFailure(r, e) {
    if (r) {
      let body = '';
      try { body = await r.text(); } catch (_) { /* ignore */ }
      let msg = '';
      try { msg = (JSON.parse(body).error || {}).message || ''; } catch (_) { /* not JSON */ }
      console.error('[QwickSignal] Firestore request failed: HTTP ' + r.status + (msg ? ' - ' + msg : ''), body);
      if (r.status === 403 || r.status === 400) return 'Permission denied (HTTP ' + r.status + '). Check that firestore.rules has been published, and that the Firestore database exists.';
      if (r.status === 404) return 'Not found (HTTP 404). Check the Firebase project ID is correct and the database exists.';
      return 'HTTP ' + r.status + (msg ? ': ' + msg : '');
    }
    console.error('[QwickSignal] Firestore request failed (network/CORS):', e);
    return 'Network error \u2013 the request never reached Firestore (offline, blocked, or CORS).';
  }
  const Channels = {
    async propose(raw) {
      // Linking a NEW channel now requires an account - guests can still follow/unfollow whatever is already
      // in the shared pool (see follow()/unfollow() below and the default-channel model), but adding a fresh
      // one is gated on sign-in, per the owner's request. Enforced here (not just in the UI) so this can't be
      // bypassed by calling propose() some other way; there is no further Firestore-side check for this,
      // since qs_channels stays an open-create collection for any signed-in identity (see firestore.rules).
      if (!Auth.uid) { openAuthGate('agAddChannelsTitle', 'agAddChannelsBody'); return false; }
      const name = normalizeChannel(raw);
      if (!CHANNEL_RX.test(name)) { toast('Use the form t/channelname \u2013 letters, numbers and underscores only.'); return false; }
      try {
        const url = `${FS_BASE}/qs_channels/${encodeURIComponent(name.toLowerCase())}?key=${FIREBASE.apiKey}`;
        const existing = await fetch(url, { cache: 'no-store' });
        if (existing.ok) {
          // Already linked by someone (or by this device, previously): just follow it, no need to write again.
          // If this account had previously hidden/removed this exact channel, typing it into +Add again is
          // how the user asked to bring it back (confirmed: "could still bring it back later via +Add") - so
          // clear it from hiddenChannels here too, or it would keep disappearing from renderChannels().
          S.myChannels.add(name.toLowerCase()); S.hiddenChannels.delete(name.toLowerCase()); Sync.pushSoon(); renderChannels();
          toast('t/' + name + ' is already linked \u2014 added it to your feed.');
          return true;
        }
        // Recorded for humans reading the Firebase console, not for access control (qs_channels stays a
        // shared, unauthenticated collection - see firestore.rules). Prefers the signed-in account's email
        // so a real identity shows up here once Phase E accounts are in use, falling back to the guest code.
        const fields = { channel: toFsValue(name), status: toFsValue('approved'), added_by: toFsValue((Auth.uid && Auth.email) || Sync.code || ''), added_at: toFsValue(new Date().toISOString()) };
        const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
        if (!r.ok) { const why = await describeFailure(r, null); toast('Couldn\u2019t link that channel: ' + why); return false; }
        approvedChannelsCache = null;        // force the next channel-list render to pick up the new one
        S.myChannels.add(name.toLowerCase());
        S.hiddenChannels.delete(name.toLowerCase());
        Sync.pushSoon();
        toast('t/' + name + ' linked. The next pipeline run (within ~5 min) will start fetching it for everyone.');
        renderChannels();
        return true;
      } catch (e) {
        const why = await describeFailure(null, e);
        toast('Couldn\u2019t link that channel: ' + why);
        return false;
      }
    },

    async listApproved() {
      try {
        // The Firestore REST runQuery endpoint is POST {parent}:runQuery where {parent} is the "...documents"
        // path itself (not the path with "/documents" stripped off) - FS_BASE already ends in "/documents", so
        // appending ":runQuery" directly is correct. An earlier .replace() here used to strip that segment out,
        // producing a malformed URL that Firestore could never resolve - every "Couldn't load the channel list"
        // error traced back to this.
        const r = await fetch(`${FS_BASE}:runQuery?key=${FIREBASE.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'qs_channels' }], where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: toFsValue('approved') } } } })
        });
        if (!r.ok) { lastChannelError = await describeFailure(r, null); return null; }
        lastChannelError = null;
        const rows = await r.json();
        return rows.filter(x => x.document).map(x => fsFieldsToObject(x.document.fields).channel).filter(Boolean);
      } catch (e) {
        lastChannelError = await describeFailure(null, e);
        return null;      // unknown: the UI treats this as "couldn't load the list", not as "no channels"
      }
    },

    // Unlinks a channel for everyone: the pipeline stops fetching it on its next run. Restricted to the
    // owner account (see OWNER_EMAIL) - both here (so the person gets an immediate, friendly message
    // instead of a bare permission error) and in firestore.rules (the real enforcement; this check alone
    // is not security since any client-side code can be edited or bypassed).
    async remove(name) {
      if (!isOwner()) { toast('Only the owner account can remove a shared channel.'); return false; }
      try {
        const url = `${FS_BASE}/qs_channels/${encodeURIComponent(name.toLowerCase())}?key=${FIREBASE.apiKey}`;
        const r = await fetch(url, { method: 'DELETE', headers: await Sync.authHeaders() });
        if (!r.ok && r.status !== 404) { const why = await describeFailure(r, null); toast('Couldn’t remove t/' + name + ': ' + why); return false; }
        approvedChannelsCache = null;   // force the next channel-list render to drop it
        S.myChannels.delete(name.toLowerCase());
        Sync.pushSoon();
        toast('t/' + name + ' removed — the pipeline will stop fetching it on its next run.');
        renderChannels();
        return true;
      } catch (e) {
        const why = await describeFailure(null, e);
        toast('Couldn’t remove t/' + name + ': ' + why);
        return false;
      }
    },

    follow(name) { S.myChannels.add(name.toLowerCase()); Sync.pushSoon(); track('follow_channel', { channel: name }); },
    unfollow(name) { S.myChannels.delete(name.toLowerCase()); Sync.pushSoon(); track('unfollow_channel', { channel: name }); }
  };

  /* ---------- Investment watchlist (News/Investment toggle) ----------
     Unlike Telegram channels, a tracked company is purely personal data - there's no shared pool to add to
     or owner-curation step, it only ever lives in this account's own qs_users/{uid} (or qs_sync/{code} for a
     guest) doc, under the "companies" field Sync.push()/pull() already carry. So this module is much smaller
     than Channels: no Firestore collection of its own, just add/remove on S.myCompanies plus the login gate,
     matching the owner's instruction that this - like Telegram +Add and cross-device Sync - needs an account. */
  const COMPANY_NAME_RX = /^[\p{L}\p{N}&'.,\- ]{2,60}$/u;   // \p{L}/\p{N} so non-English company names (accents, etc) aren't rejected
  const Companies = {
    add(raw) {
      if (!Auth.uid) { openAuthGate('agTrackCompanyTitle', 'agTrackCompanyBody'); return false; }
      const name = (raw || '').trim();
      if (!COMPANY_NAME_RX.test(name)) { toast('Enter a company name (letters, numbers, spaces, & ’ . , -).'); return false; }
      if (S.myCompanies.size >= 300) { toast('You can track up to 300 companies.'); return false; }
      // Keep the exact, known display name when the typed text matches one of the app's recognized
      // companies (case-insensitively) - this is what lets a tracked company actually match
      // item.companies (the pipeline tags stories with these same canonical names), rather than only
      // ever matching a freehand name the user happened to type with different capitalization.
      const known = E.COMPANIES.find(c => c.name.toLowerCase() === name.toLowerCase()
        || c.aliases.some(a => a.toLowerCase() === name.toLowerCase()));
      const canonical = known ? known.name : name;
      if (S.myCompanies.has(canonical)) { toast(canonical + ' is already on your watchlist.'); return false; }
      S.myCompanies.add(canonical);
      Sync.pushSoon();
      track('track_company', { company: canonical, known: !!known });
      toast(canonical + ' added to your investment watchlist.');
      renderInvestmentBox();
      renderAll();
      return true;
    },
    remove(name) {
      S.myCompanies.delete(name);
      Sync.pushSoon();
      track('untrack_company', { company: name });
      renderInvestmentBox();
      renderAll();
    }
  };

  /* ---------- Push notifications (real OS-level, work even when the app isn't open) ----------
     Separate from the in-app "Waveform Arrival" toast (notifyNewStory() near loadLive(), which only shows
     while this tab is open): this is a standard Web Push subscription, so the pipeline (pipeline.py's
     send_push_notifications(), run after every publish) can wake the service worker and show a real system
     notification for a brand-new story, same as any other app's push notifications. No login needed - the
     subscription is keyed by a random id this device keeps in localStorage, same spirit as the guest sync
     code, since most visitors use the app signed out (see qs_push_subs in firestore.rules). */
  const PUSH_ID_KEY = 'qs-push-id-v1';
  function urlBase64ToUint8Array(base64) {
    const pad = '='.repeat((4 - base64.length % 4) % 4);
    const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function pushId() {
    try {
      let id = localStorage.getItem(PUSH_ID_KEY);
      if (!id) { id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10); localStorage.setItem(PUSH_ID_KEY, id); }
      return id;
    } catch (e) { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  }
  const Push = {
    supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
    // Reflects this device's own subscription bookkeeping, not the live OS permission (which can change
    // behind our back in the browser's own settings) - renderNotifBox() checks Notification.permission too.
    isOn() { try { return localStorage.getItem('qs-push-on-v1') === '1'; } catch (e) { return false; } },
    setOn(v) { try { localStorage.setItem('qs-push-on-v1', v ? '1' : '0'); } catch (e) { /* ignore */ } },

    async subscribe() {
      if (!this.supported()) return { ok: false, error: t('notifUnsupported') };
      try {
        const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (perm !== 'granted') return { ok: false, error: t('notifBlocked') };
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
        const j = sub.toJSON();
        const id = pushId();
        const fields = {
          endpoint: toFsValue(j.endpoint),
          p256dh: toFsValue((j.keys || {}).p256dh || ''),
          auth: toFsValue((j.keys || {}).auth || ''),
          created_at: toFsValue(new Date().toISOString())
        };
        const r = await fetch(`${FS_BASE}/qs_push_subs/${id}?key=${FIREBASE.apiKey}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        this.setOn(true);
        track('push_subscribe', {});
        return { ok: true };
      } catch (e) {
        return { ok: false, error: t('notifFailed') };
      }
    },

    async unsubscribe() {
      try {
        if (this.supported()) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        }
        const id = pushId();
        await fetch(`${FS_BASE}/qs_push_subs/${id}?key=${FIREBASE.apiKey}`, { method: 'DELETE' }).catch(() => { });
      } catch (e) { /* best-effort - still mark it off locally below */ }
      this.setOn(false);
      track('push_unsubscribe', {});
    },

    // Re-verifies and, if needed, re-writes this device's subscription on Firestore. Called once on every
    // app load when the local "on" flag is set, because that flag alone is NOT proof the server actually
    // has a working subscription for this device - it can only ever record what the last successful
    // subscribe() call did, and several things can silently invalidate the real subscription afterward
    // without this app being told: the pipeline prunes a subscription Firestore itself returns 404/410 for
    // after a failed push, the browser can rotate or drop a push registration on its own (a Chrome update,
    // storage pressure, "Clear browsing data"), and firestore.rules might not have been published yet the
    // first time this device turned notifications on, which silently failed the write but had already
    // flipped the local flag in an earlier version of this code. Re-subscribing when permission is already
    // granted is a safe no-op from the browser's side (no new prompt, same endpoint most of the time) - the
    // point here is making sure Firestore's copy actually matches it, every single app open.
    async resync() {
      if (!this.isOn() || !this.supported() || Notification.permission !== 'granted') return;
      const r = await this.subscribe();
      if (!r.ok) {
        // A genuine, repeatable failure here (not just "offline right now") means Firestore does NOT have
        // a working subscription for this device, whatever the local flag says - so the flag is corrected
        // to match reality instead of going on silently claiming "on" every time Settings is opened.
        console.warn('[QwickSignal] push resync failed:', r.error);
        this.setOn(false);
      }
      if ($('#notifBox')) renderNotifBox();   // Settings may already be open and showing the stale state
    }
  };

  /* ---------- Tickets (bug reports / support / feedback) ----------
     User's own words: "It is becoming difficult for me to track each and every bugs / additional features
     which needs to be added - Kindly add a ticket system where user can raise the ticket [...] Which I can
     only see as the owner of the app and take actions on it." Same shape as qs_push_subs/qs_channels: no
     login required to submit (most visitors are signed out), a random id the device doesn't need to
     remember (nobody re-opens their own ticket), write-only for a normal visitor, and get/list restricted
     to the owner account by firestore.rules - not just hidden in the UI, since a client-side check alone is
     never real security (same note as isOwner() elsewhere in this file). */
  const Tickets = {
    // Requires sign-in (per the owner's request - tickets are now tied to a real account, same reasoning
    // as gating Telegram +Add and cross-device sync). Checked here too, not just in the UI (renderTicketBox()
    // hides the form for guests) and in firestore.rules (the real enforcement) - a client-side check alone
    // is never real security by itself, same note as isOwner() elsewhere in this file.
    async submit(kind, message) {
      if (!Auth.uid) return { ok: false, error: t('feedbackLoginTitle') };
      const text = (message || '').trim();
      if (!text) return { ok: false, error: t('ticketEmpty') };
      const id = 'tk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      const fields = {
        kind: toFsValue(kind || 'feedback'),
        message: toFsValue(text.slice(0, 4000)),
        status: toFsValue('open'),
        created_at: toFsValue(new Date().toISOString()),
        // Now always the signed-in account's own address (firestore.rules checks it matches the caller's
        // auth token) - never empty, since submit() requires Auth.uid above.
        user_email: toFsValue(Auth.email || ''),
      };
      try {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders());
        const r = await fetch(`${FS_BASE}/qs_tickets/${id}?key=${FIREBASE.apiKey}`, {
          method: 'PATCH', headers, body: JSON.stringify({ fields })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        track('ticket_submit', { kind: kind || 'feedback' });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: t('ticketFailed') };
      }
    },

    // Owner-only. Mirrors Channels.listApproved()'s runQuery pattern; firestore.rules is the real
    // enforcement (get/list on qs_tickets requires isOwner()), this check just avoids a wasted, doomed
    // request and a confusing raw permission error for anyone who isn't the owner.
    async listAll() {
      if (!isOwner()) return null;
      try {
        const r = await fetch(`${FS_BASE}:runQuery?key=${FIREBASE.apiKey}`, {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders()),
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'qs_tickets' }] } })
        });
        if (!r.ok) return null;
        const rows = await r.json();
        return rows.filter(x => x.document).map(x => {
          const o = fsFieldsToObject(x.document.fields);
          o.id = x.document.name.split('/').pop();
          return o;
        }).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      } catch (e) {
        return null;
      }
    },

    // Owner-only toggle between "open" and "done", so the owner has somewhere to put a ticket once it's
    // handled without deleting the record outright.
    async setStatus(id, status) {
      if (!isOwner()) return false;
      try {
        const r = await fetch(`${FS_BASE}/qs_tickets/${id}?updateMask.fieldPaths=status&key=${FIREBASE.apiKey}`, {
          method: 'PATCH',
          headers: Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders()),
          body: JSON.stringify({ fields: { status: toFsValue(status) } })
        });
        return r.ok;
      } catch (e) {
        return false;
      }
    }
  };

  /* ---------- Default channels (owner-curated) ----------
     Section 1 of Link Pages, from the user's own words: "By default channel which are linked to this app to
     avoid showing blank when user visit this page. Kind of like guest mode. So owner will have the access to
     link/remove the default pages." One shared doc, qs_config/defaults, holding the list of channel names a
     guest (or a signed-in user who hasn't followed anything of their own yet) sees. Once that person follows
     even one channel (S.myChannels.size > 0), this list stops mattering for them - see filtered() and
     countryGroups(). Public read, owner-only write (see firestore.rules). */
  let defaultChannelsCache = null;   // null = not loaded yet (treat as "no filter" so the feed never looks empty)
  const DefaultChannels = {
    async load() {
      try {
        const r = await fetch(`${FS_BASE}/qs_config/defaults?key=${FIREBASE.apiKey}`, { cache: 'no-store' });
        if (r.status === 404) { defaultChannelsCache = []; return; }
        if (!r.ok) return;   // leave defaultChannelsCache as null - try again on next call
        const doc = await r.json();
        const rec = fsFieldsToObject(doc.fields);
        defaultChannelsCache = (rec.channels || []).map(c => String(c).toLowerCase());
      } catch (e) { /* offline etc: leave as null, retry later */ }
    },
    async save(list) {
      if (!isOwner()) { toast('Only the owner account can curate the default channels.'); return false; }
      try {
        const fields = { channels: toFsValue(list) };
        const r = await fetch(`${FS_BASE}/qs_config/defaults?key=${FIREBASE.apiKey}`, {
          method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders()), body: JSON.stringify({ fields })
        });
        if (!r.ok) { const why = await describeFailure(r, null); toast('Couldn’t update default channels: ' + why); return false; }
        defaultChannelsCache = list.map(c => c.toLowerCase());
        renderChannels(); renderAll();
        return true;
      } catch (e) {
        const why = await describeFailure(null, e);
        toast('Couldn’t update default channels: ' + why);
        return false;
      }
    },
    async toggle(name) {
      const n = name.toLowerCase();
      const list = (defaultChannelsCache || []).slice();
      const i = list.indexOf(n);
      if (i === -1) list.push(n); else list.splice(i, 1);
      await this.save(list);
    }
  };

  /* ---------- helpers ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
  }
  // Same as toast(), but the message can carry inline markup (e.g. an Undo button) instead of plain text.
  function toastAction(html, ms) {
    const t = $('#toast');
    t.innerHTML = html; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms || 3600);
  }
  const tick = () => new Promise(r => setTimeout(r, 0));
  const newId = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const dayISO = ts => new Date(ts).toISOString().slice(0, 10);
  function ago(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' h ago';
    return Math.round(h / 24) + ' d ago';
  }
  // Escapes text that gets dropped into innerHTML as plain content (e.g. a ticket's free-typed message),
  // so a visitor typing "<img onerror=...>" into the feedback box can't inject markup into the owner's
  // admin view.
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Absolute date+time next to the "X ago" relative label, e.g. "29 Sep 2026, 10:39 PM" - uses the
  // viewer's own locale/timezone (Intl.DateTimeFormat with no timeZone override) rather than hardcoding
  // IST, so it reads correctly for users outside India too.
  function fmtDateTime(ts) {
    try {
      const d = new Date(ts);
      const datePart = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${datePart}, ${timePart}`;
    } catch (e) { return ''; }
  }
  const all = () => S.items.concat(S.live);
  const flagOf = name => E.flag((E.COUNTRY_BY_NAME[name] || {}).code);
  const loaded = {};
  function loadScript(src) {
    return loaded[src] || (loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    }));
  }
  function inRange(it, range) {
    if (range === 'all') return true;
    if (range === 'today') return new Date(it.addedAt).toDateString() === new Date().toDateString();
    return Date.now() - it.addedAt <= 7 * 864e5;
  }
  const byPriority = (a, b) => E.impRank(b.importance) - E.impRank(a.importance) || b.addedAt - a.addedAt;
  const prep = it => {
    if (!it._p) Object.defineProperty(it, '_p', {
      value: { hash: it.hash, len: it.len, country: it.country, involved: it.involved || [], sector: it.sector, head: new Set(it.head), key: new Set(it.key) },
      writable: true, enumerable: false, configurable: true
    });
    return it._p;
  };

  /* ---------- ingestion ---------- */
  const newStats = () => ({ added: 0, dup: 0, related: 0 });
  const addStats = (a, b) => { a.added += b.added; a.dup += b.dup; a.related += b.related; };

  async function addDoc(doc, st, fresh) {
    const rec = E.analyze(doc.text, { headline: doc.headline, date: doc.date, pdf: doc.pdf, fallbackTitle: doc.fallbackTitle });
    const p = { hash: rec.hash, len: rec.len, country: rec.country, involved: rec.involved, sector: rec.sector, head: new Set(rec.head), key: new Set(rec.key) };
    let dup = null; const rels = [];
    for (const it of S.items) {
      const c = E.compare(p, prep(it));
      if (!c) continue;
      if (c.type === 'duplicate') { if (!dup || c.sim > dup.sim) dup = { it, sim: c.sim }; }
      else rels.push({ it, sim: c.sim });
    }
    if (dup) {
      dup.it.sources.push({ name: doc.source, at: Date.now() });
      await DB.put(dup.it);
      st.dup++;
      return;
    }
    const now = Date.now();
    const item = Object.assign(rec, { id: newId(), addedAt: now, source: doc.source, sources: [{ name: doc.source, at: now }], related: [], manual: false });
    rels.sort((a, b) => b.sim - a.sim).slice(0, 3).forEach(r => {
      item.related.push(r.it.id);
      r.it.related = [...new Set([...(r.it.related || []), item.id])];
      DB.put(r.it);
    });
    if (rels.length) st.related++;
    S.items.push(item);
    await DB.put(item);
    st.added++;
    if (fresh) fresh.push(item);
  }

  const summariseStats = st => {
    const bits = [st.added + ' new'];
    if (st.dup) bits.push(st.dup + ' duplicate' + (st.dup > 1 ? 's' : '') + ' merged');
    if (st.related) bits.push(st.related + ' linked to related stories');
    return bits.join(', ');
  };

  // Manual ingest (paste/upload) was removed from Link Pages - Telegram channels and Sync are now the
  // only ways content enters the app. ingestText() is still used by the web-share-target flow in
  // start(), below. (The old "Load sample data" empty-state helper was removed now that the app always
  // has real content from the live feed.)
  async function ingestText(text, source) {
    const st = newStats(); const fresh = [];
    let parts = E.splitMessages(text, false);
    if (!parts.length && text.trim().length >= 12) parts = [text.trim()];
    for (const p of parts) await addDoc({ text: p, source }, st, fresh);
    renderAll();
    return st;
  }

  /* ---------- rendering ---------- */
  function itemChannel(it) {
    const src = (it.sources || [])[0];
    const m = src && /^Telegram:\s*(.+)$/i.exec(src.name || '');
    return m ? m[1].trim().toLowerCase() : null;
  }

  /* ---------- 24h lifecycle (Phase B) ----------
     An item's status is computed on the fly from S.saved / S.dismissed / its age, never stored as a separate
     expiring field, so it can never drift out of sync with those sets.
       active     shows in Signals, normal lifecycle
       saved      always shows in Saved, regardless of age
       dismissed  hidden everywhere (soft-delete; Undo puts it back for a few seconds after dismissing)
       expired    not saved, not dismissed, and no longer considered current - falls off the Signals feed
       A live item's presence in the latest feed.json IS the freshness signal - the pipeline only keeps
       genuinely current stories in there, so a live item is active for as long as it's still in S.live.
       (It used to also require it.addedAt, the article's original publish time, to be under 24h old -
       but a story picked up by the pipeline after it was already published elsewhere would then vanish
       from Signals immediately, hiding most of every fetch. The 24h lifecycle now only applies to items
       added manually (not live), which have no feed to fall out of and would otherwise linger forever. */
  const LIFECYCLE_MS = 24 * 3600e3;
  function itemStatus(it) {
    if (S.dismissed.has(it.id)) return 'dismissed';
    if (S.saved.has(it.id)) return 'saved';
    if (it.live) return 'active';
    return (Date.now() - it.addedAt) < LIFECYCLE_MS ? 'active' : 'expired';
  }

  // Whether a live item is currently in scope for this visitor's channel selection - the same rule Signals,
  // Export/PDF/CSV and Country Status all need: followed channels win if any are followed, otherwise fall
  // back to the owner-curated default list, otherwise (nothing loaded yet) show everything rather than a
  // blank feed. Pulled out of filtered() so every list-of-items-shown-to-this-visitor call goes through one
  // place - the PDF/CSV export used to skip this entirely and pull straight from all(), which is why it
  // could show 80+ items while Signals (channel-filtered) showed only a handful for the same visitor.
  function channelVisible(it) {
    if (!it.live) return true;
    const ch = itemChannel(it);
    if (!ch) return true;
    if (S.myChannels.size) return S.myChannels.has(ch);
    if (defaultChannelsCache && defaultChannelsCache.length) return defaultChannelsCache.includes(ch);
    return true;
  }

  // The set of items this visitor actually sees anywhere in the app: not dismissed/expired, and in scope for
  // their channel selection. This is the base every view (Signals, Export/PDF/CSV, Country Status) filters
  // down from, so none of them can drift out of sync with what the person is actually following.
  function visibleItems() {
    return all().filter(it => {
      const st = itemStatus(it);
      if (st === 'dismissed' || st === 'expired') return false;
      return channelVisible(it);
    });
  }

  function filtered(skip) {
    const f = S.f, q = f.q.trim().toLowerCase();
    return visibleItems().filter(it => {
      const st = itemStatus(it);
      if (st !== 'saved' && !inRange(it, f.range)) return false;   // a saved item stays visible even outside the date range
      if (skip !== 'country' && f.country && it.country !== f.country && !(it.involved || []).includes(f.country)) return false;
      if (skip !== 'sector' && f.sector && it.sector !== f.sector) return false;
      if (skip !== 'imp' && f.imp && it.importance !== f.imp) return false;
      if (q && !(it.headline + ' ' + it.summary + ' ' + it.country + ' ' + it.sector + ' ' + it.subsector + ' ' + (it.companies || []).join(' ') + ' ' + it.text).toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function savedItems() {
    return all().filter(it => S.saved.has(it.id)).sort(byPriority);
  }

  /* ---------- Phase C: Country Status ----------
     A WhatsApp-Status-style row of country circles above the Signals list. Each circle's ring is
     split into one segment per currently-active story for that country (latest first), colored by
     whether the user has opened it in the story viewer yet (S.reviewed). This is deliberately
     independent of the Signals search/filter controls - like a status bar, it always reflects
     everything currently active, not the narrowed-down list underneath it. */
  function countryGroups() {
    const byCountry = new Map();
    for (const it of all()) {
      if (itemStatus(it) !== 'active') continue;         // saved/dismissed/expired don't appear here
      if (!channelVisible(it)) continue;
      const c = it.country || 'Global';
      if (!byCountry.has(c)) byCountry.set(c, []);
      byCountry.get(c).push(it);
    }
    const groups = [...byCountry.entries()].map(([country, stories]) => {
      stories.sort((a, b) => b.addedAt - a.addedAt);       // latest story first, per spec
      return { country, stories, unread: stories.some(s => !S.reviewed.has(s.id)), latest: stories[0].addedAt };
    });
    // Countries with new stories float to the front; within each group, most recent activity first.
    groups.sort((a, b) => (b.unread - a.unread) || (b.latest - a.latest));
    return groups;
  }

  /* ---------- Investment tab: sector -> tracked-company groups ----------
     Deliberately NOT filtered by channelVisible()/followed channels - the Investment tab is scoped by
     which COMPANIES the user tracks, not which Telegram channels they follow, so a story about a tracked
     company should show here even if it came from a channel the user hasn't followed in the News tab.
     Still excludes dismissed/expired exactly like the News tab (a dismissed story should stay dismissed
     everywhere), and still respects the current search/priority filters via filtered-style logic in
     renderList(), same as the News tab's By-country/By-sector grouping. */
  function investmentGroups() {
    const want = S.myCompanies;
    const bySector = new Map();   // sector -> Map(company -> stories[])
    if (!want.size) return [];
    for (const it of all()) {
      const st = itemStatus(it);
      if (st === 'dismissed' || st === 'expired') continue;
      const matched = (it.companies || []).filter(c => want.has(c));
      if (!matched.length) continue;
      for (const co of matched) {
        const known = E.COMPANIES.find(c => c.name === co);
        const sector = (known && known.sector) || it.sector || 'Other';
        if (!bySector.has(sector)) bySector.set(sector, new Map());
        const comp = bySector.get(sector);
        if (!comp.has(co)) comp.set(co, []);
        comp.get(co).push(it);
      }
    }
    // Every tracked company gets a row even with zero stories (confirmed: show a quiet "no recent news"
    // note rather than hiding it), so a company with no matches yet still needs a home sector to sit
    // under - fall back to the known list's sector, or 'Other' for a freehand name with no match.
    for (const name of want) {
      const known = E.COMPANIES.find(c => c.name === name);
      const sector = (known && known.sector) || 'Other';
      if (!bySector.has(sector)) bySector.set(sector, new Map());
      if (!bySector.get(sector).has(name)) bySector.get(sector).set(name, []);
    }
    const sectors = [...bySector.entries()].map(([sector, companyMap]) => {
      const companies = [...companyMap.entries()].map(([company, stories]) => {
        stories.sort(byPriority);
        return { company, stories, latest: stories.length ? Math.max(...stories.map(s => s.addedAt)) : 0 };
      });
      companies.sort((a, b) => (b.stories.length - a.stories.length) || (b.latest - a.latest) || a.company.localeCompare(b.company));
      const total = companies.reduce((n, c) => n + c.stories.length, 0);
      const latest = Math.max(0, ...companies.map(c => c.latest));
      return { sector, companies, total, latest };
    });
    sectors.sort((a, b) => (b.total - a.total) || (b.latest - a.latest) || a.sector.localeCompare(b.sector));
    return sectors;
  }

  const RING_MAXSEG = 12, RING_GAP_DEG = 6;
  function ringGradient(stories) {
    const total = stories.length;
    const segCount = Math.min(total, RING_MAXSEG);
    // Below the cap, each segment maps 1:1 to a story (already sorted latest-first). Above it (an
    // unusually newsy country), segments are apportioned by the unread/reviewed split instead of
    // one-per-story, so the ring stays readable rather than turning into illegible slivers.
    const direct = total <= RING_MAXSEG;
    const unreadCount = stories.filter(s => !S.reviewed.has(s.id)).length;
    const unreadSegs = direct ? null : Math.min(segCount, Math.round(segCount * unreadCount / total));
    const per = 360 / segCount;
    const stops = [];
    let angle = 0;
    for (let i = 0; i < segCount; i++) {
      const isUnread = direct ? !S.reviewed.has(stories[i].id) : i < unreadSegs;
      const color = isUnread ? 'var(--accent)' : 'var(--ink2)';
      const start = angle, end = angle + per - RING_GAP_DEG;
      stops.push(`${color} ${start}deg ${end}deg`, `transparent ${end}deg ${angle + per}deg`);
      angle += per;
    }
    return `conic-gradient(${stops.join(', ')})`;
  }

  function renderCountryBar() {
    const box = $('#countryStatus');
    if (!box) return;
    const groups = countryGroups();
    box.hidden = !groups.length;
    if (!groups.length) { box.innerHTML = ''; return; }
    box.innerHTML = groups.map(g => {
      const n = g.stories.length;
      const label = esc(g.country) + ' – ' + n + (n === 1 ? ' story' : ' stories') + (g.unread ? ', new' : '');
      return `<button class="cstop" data-act="opencountry" data-c="${esc(g.country)}" aria-label="${label}">
        <span class="qs-ring" style="background:${ringGradient(g.stories)}"><span class="qs-ring-inner">${flagOf(g.country)}</span></span>
        <span class="cstop-name">${esc(g.country)}</span>
      </button>`;
    }).join('');
  }

  // S.cv keeps the whole ordered list of country groups (frozen at the moment the viewer opened, so the
  // row doesn't reshuffle under the user's thumb mid-session as reviewed state changes reorder it), plus
  // which country and which story within it is current - so ">" can walk off the end of one country
  // straight into the next, the way swiping past the last status/story usually works.
  function cvStories() { return S.cv.groups[S.cv.groupIdx].stories; }
  function cvCountry() { return S.cv.groups[S.cv.groupIdx].country; }

  function openCountry(country) {
    const groups = countryGroups();
    const gi = groups.findIndex(x => x.country === country);
    if (gi === -1 || !groups[gi].stories.length) return;
    S.cv = { groups, groupIdx: gi, idx: 0 };
    $('#countryViewer').hidden = false;
    document.body.classList.add('cv-lock');
    renderCountryViewer();
    markCurrentReviewed();
  }

  function closeCountryViewer() {
    if (!S.cv) return;
    S.cv = null;
    $('#countryViewer').hidden = true;
    document.body.classList.remove('cv-lock');
    renderCountryBar();     // ring segments may have flipped from unread to reviewed while open
  }

  function markCurrentReviewed() {
    if (!S.cv) return;
    const it = cvStories()[S.cv.idx];
    if (!it || S.reviewed.has(it.id)) return;
    S.reviewed.add(it.id);
    Sync.pushSoon();
    renderCountryViewer();   // update the dash for the now-reviewed story without a full re-render
  }

  function cvGo(delta) {
    if (!S.cv) return;
    const stories = cvStories();
    const ni = S.cv.idx + delta;
    if (ni >= 0 && ni < stories.length) {
      S.cv.idx = ni;
      renderCountryViewer();
      markCurrentReviewed();
      return;
    }
    // Past an edge: move on to the next (or previous) country's stories, starting from its near end,
    // instead of just stopping - this is the ">" transition between countries.
    const gi = S.cv.groupIdx + (delta > 0 ? 1 : -1);
    if (gi < 0 || gi >= S.cv.groups.length) { closeCountryViewer(); return; }   // no more countries either way: done
    S.cv.groupIdx = gi;
    S.cv.idx = delta > 0 ? 0 : S.cv.groups[gi].stories.length - 1;
    renderCountryViewer();
    markCurrentReviewed();
  }

  function renderCountryViewer() {
    if (!S.cv) return;
    const country = cvCountry(), idx = S.cv.idx, stories = cvStories();
    const it = stories[idx];
    ensureTranslated(collectTranslatable([it]));   // just the current story - no need to translate every story in every country up front
    const dashes = stories.map((s, i) => {
      const cls = i < idx || (i === idx && S.reviewed.has(s.id)) ? 'seen' : (i === idx ? 'current' : '');
      return `<span class="cv-dash ${cls}"></span>`;
    }).join('');
    // Headlines only, per explicit feedback: no sector subtext, no Sources line, and no why-it-matters/
    // facts body copy - just the flag, country, headline, date/time and (if found) an image. A date+time
    // stamp was added back per later feedback asking for it against every headline, feed included.
    $('#cvDashes').innerHTML = dashes;
    const body = $('#cvBody');
    // onerror hides a broken/expired image link instead of leaving a broken-image icon - a missing photo
    // should never look like an app bug, the story still reads fine as headline-only.
    const img = it.image ? `<div class="cv-img"><img src="${esc(it.image.url)}" alt="" loading="lazy" onerror="this.closest('.cv-img').hidden=true"></div>` : '';
    body.innerHTML = `
      ${img}
      <div class="cv-flag">${flagOf(country)}</div>
      <div class="cv-country">${esc(country)}</div>
      <h2 class="cv-headline">${esc(trOf(it.headline))}</h2>
      <div class="cv-time">${esc(fmtDateTime(it.addedAt))}</div>
      <div class="cv-pos">${idx + 1} / ${stories.length}</div>
    `;
    // A quick crossfade so moving between stories - and especially between countries - reads as a smooth
    // transition rather than a hard cut.
    body.classList.remove('cv-fade'); void body.offsetWidth; body.classList.add('cv-fade');
  }

  function cvTap(ev) {
    if (cvJustSwiped) return;                        // the preceding pointerup already paged the story
    if (ev.target.closest('a,button')) return;      // links/buttons inside the body handle their own click
    const rect = $('#cvBody').getBoundingClientRect();
    const frac = (ev.clientX - rect.left) / rect.width;
    cvGo(frac < 0.35 ? -1 : 1);                      // left third = previous, right two-thirds = next (IG/WA convention)
  }

  // A lightweight horizontal swipe on the viewer body, independent of the Signals-card swipe machinery
  // above (that one saves/dismisses; this one just pages through stories). A real swipe sets cvJustSwiped
  // so the click that always follows a pointerup doesn't also fire cvTap and page twice.
  let cvSwipeStartX = null, cvSwipeStartY = null, cvJustSwiped = false;
  function cvSwipeStart(ev) { cvSwipeStartX = ev.clientX; cvSwipeStartY = ev.clientY; }
  function cvSwipeEnd(ev) {
    if (cvSwipeStartX === null) return;
    const dx = ev.clientX - cvSwipeStartX, dy = ev.clientY - cvSwipeStartY;
    cvSwipeStartX = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      cvJustSwiped = true;
      setTimeout(() => { cvJustSwiped = false; }, 350);
      cvGo(dx < 0 ? 1 : -1);
    }
  }

  function saveItem(id) {
    if (S.saved.has(id)) return;
    S.saved.add(id); S.dismissed.delete(id);
    Sync.pushSoon();
    renderAll();
    toast('Saved. Find it any time under Saved.');
    track('save_story', { id });
  }
  function unsaveItem(id) {
    S.saved.delete(id);
    Sync.pushSoon();
    renderAll();
    track('unsave_story', { id });
  }
  function dismissItem(id) {
    S.saved.delete(id);
    S.dismissed.add(id);
    Sync.pushSoon();
    renderAll();
    toastAction('Dismissed. <button class="link inline" data-act="undo-dismiss" data-id="' + esc(id) + '">Undo</button>', 5000);
    track('dismiss_story', { id });
  }
  function undoDismiss(id) {
    S.dismissed.delete(id);
    Sync.pushSoon();
    renderAll();
    clearTimeout(toastTimer);
    $('#toast').classList.remove('show');
    track('undo_dismiss', { id });
  }

  /* ---------- Video (Phase 2.5) ----------
     The pipeline attaches the best verified video to important stories (it.video). Three things can be shown:
       Watch news             a video that can be played inside QwickSignal
       Watch on YouTube       a video that cannot be embedded: opens the original page
       No verified video found   nothing good enough was found
     A story with no "video" data at all (older stories, or video discovery switched off) shows nothing. */
  const YT_ID = /^[A-Za-z0-9_-]{11}$/;
  const PENDING_MAX_MS = 3 * 3600e3;     // "Finding related video..." is shown for new stories for at most 3 hours

  function videoInfo(it) {
    const v = it.video;
    if (v && v.available) {
      if (v.platform === 'youtube' && YT_ID.test(v.video_id || '')) {   // the link is rebuilt from the id, never trusted as given
        return { kind: v.is_embeddable ? 'watch' : 'external', id: v.video_id, url: 'https://www.youtube.com/watch?v=' + v.video_id, v };
      }
      if (v.platform && v.platform !== 'youtube' && /^https:\/\//i.test(v.video_url || '')) return { kind: 'external', url: v.video_url, v };
      return null;                                                       // malformed: show nothing rather than something wrong
    }
    if (v && v.status === 'none') return { kind: 'none' };
    const m = S.videoMeta;
    if (!v && it.live && m && m.enabled && m.status === 'ok' && (m.importance || []).includes(it.importance) && Date.now() - it.addedAt < PENDING_MAX_MS) {
      return { kind: 'pending' };
    }
    return null;
  }
  function videoHTML(it) {
    const info = videoInfo(it);
    if (!info) return '';
    if (info.kind === 'pending') return '<p class="vnote pending" role="status">Finding related video\u2026</p>';
    if (info.kind === 'none') return '<p class="vnote">No verified video found</p>';
    const v = info.v, site = v.platform === 'youtube' ? 'YouTube' : (v.platform || '');
    const meta = [v.publisher, site, v.duration].filter(Boolean).map(esc).join(' \u2022 ');
    const tri = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    const label = esc('Watch video: ' + (v.title || it.headline));
    const btn = info.kind === 'watch'
      ? `<button class="btn-watch" data-act="watch" data-id="${esc(it.id)}" aria-label="${label}">${tri}Watch news</button>`
      : `<a class="btn-watch" href="${esc(info.url)}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${tri}Watch on ${v.platform === 'youtube' ? 'YouTube' : 'original source'}</a>`;
    return `<div class="vid">${btn}${meta ? `<span class="vmeta">${meta}</span>` : ''}</div>`;
  }

  let vmOpener = null;
  function openVideo(it, opener) {
    const info = videoInfo(it), box = $('#videoModal'), frame = $('#vmFrame');
    if (!info || info.kind !== 'watch' || !box || !frame) return;
    track('watch_video', { id: it.id });
    frame.innerHTML = '';
    const f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + info.id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    f.title = info.v.title || 'News video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.appendChild(f);
    $('#vmTitle').textContent = info.v.title || it.headline;
    $('#vmMeta').textContent = [info.v.publisher, 'YouTube', info.v.duration].filter(Boolean).join(' \u2022 ');
    $('#vmOpen').href = info.url;
    vmOpener = opener || document.activeElement;
    box.hidden = false;
    document.body.classList.add('noscroll');
    const x = box.querySelector('.vclose'); if (x) x.focus();
  }
  // Shared "log in to do that" popup (replaces the old plain-text toast for the same moments: Telegram
  // +Add, Sync Code, and ticket submission while signed out). "Go to Account" closes the popup and jumps
  // to Settings > Account so the person can actually act on it, rather than just being told no.
  let agOpener = null;
  function openAuthGate(titleKey, bodyKey) {
    const box = $('#authGate');
    if (!box) { toast(t(bodyKey)); return; }   // safety net if an older index.html is still cached
    $('#agTitle').textContent = t(titleKey);
    $('#agBody').textContent = t(bodyKey);
    agOpener = document.activeElement;
    box.hidden = false;
    document.body.classList.add('noscroll');
    track('auth_gate_shown', { reason: titleKey });
    const g = $('#agGoto'); if (g) g.focus();
  }
  function closeAuthGate() {
    const box = $('#authGate');
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.classList.remove('noscroll');
    if (agOpener && document.contains(agOpener)) agOpener.focus();
    agOpener = null;
  }

  function closeVideo() {
    const box = $('#videoModal');
    if (!box || box.hidden) return;
    $('#vmFrame').innerHTML = '';             // removing the player stops the video and releases it
    box.hidden = true;
    document.body.classList.remove('noscroll');
    if (vmOpener && document.contains(vmOpener)) vmOpener.focus();
    vmOpener = null;
  }

  /* ---------- View Chart (Investment tab) ----------
     TradingView's free Advanced Chart widget, embedded directly - no API key, no backend. The opening
     symbol is only a best-effort guess (see guessSymbol() above); the widget's own built-in symbol search
     (click the ticker name top-left of the chart) is the real correction path for anything guessed wrong,
     which is why #cmNote points the user at it. A fresh script tag is created on every open (rather than
     a single reused one) because the widget's config is baked in at script-load time - there's no
     documented "change symbol" call for this particular embed, so a different company means a fresh widget. */
  let cmOpener = null;
  let cmState = null; // { stockSymbol, sectorSymbol, sectorLabel } for the currently-open modal, so the
                       // Stock/Sector toggle can re-render without needing the company name/sector again.
  function loadChartSymbol(symbol) {
    // Builds one fresh widget for whichever symbol is currently selected (stock or sector index). A fresh
    // script tag on every switch - same reason as before: the widget's config is baked in at script-load
    // time, there's no documented "change symbol" call, so switching means tearing down and rebuilding.
    const chart = $('#cmChart');
    chart.innerHTML = `<div class="tradingview-widget-container" style="height:100%;width:100%">
      <div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
    </div>`;
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.text = JSON.stringify({
      // QwickSignal has one permanent cream/red palette, no dark mode (by explicit prior request) - so the
      // chart always matches it with the light theme, no detection needed.
      symbol, interval: 'D', timezone: 'exchange', theme: 'light',
      style: '1', locale: 'en', autosize: true,
      studies: ['MASimple@tv-basicstudies'],
      studies_overrides: { 'moving average.length': 200 }
    });
    // The loader script must be a SIBLING of .tradingview-widget-container__widget (both children of
    // .tradingview-widget-container), not nested inside __widget itself - that's how TradingView's own
    // loader finds where to inject the chart. Appending it one level too deep (a bug in an earlier version
    // of this function) left the chart area blank with no visible error.
    chart.querySelector('.tradingview-widget-container').appendChild(script);
    // BSE data in TradingView's free widget is end-of-day only (a licensing limit on TradingView's side, not
    // a bug here - see EXCHANGE_BY_COUNTRY's comment) - surfaced plainly rather than left for the user to
    // wonder why an Indian stock's chart doesn't move intraday like a US one does.
    const note = $('#cmNote');
    if (note) note.textContent = symbol.startsWith('BSE:') ? t('chartEodHint') : t('chartSearchHint');
  }
  function setChartSeg(which) {
    // which: 'stock' or 'sector'. No-op (and the toggle is hidden) when there's no sector symbol to show -
    // see guessSectorIndex(): sectors with no sensible benchmark (Geopolitics, Economy, ...) return null
    // rather than a guessed-wrong index symbol.
    if (!cmState) return;
    const seg = $('#cmSeg');
    if (which === 'sector' && !cmState.sectorSymbol) which = 'stock';
    const btns = seg ? seg.querySelectorAll('button[data-act="cmSeg"]') : [];
    btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === which)));
    loadChartSymbol(which === 'sector' ? cmState.sectorSymbol : cmState.stockSymbol);
  }
  function openChartModal(companyName, opener, sector) {
    const box = $('#chartModal'), chart = $('#cmChart');
    if (!box || !chart) {
      // Silent otherwise - no exception, so the generic error net above wouldn't catch this case. Shows up
      // if the #chartModal/#cmChart markup is somehow missing from the loaded page (stale/partial HTML).
      toast('View Chart: missing modal markup (' + (!box ? '#chartModal' : '#cmChart') + ' not found).');
      return;
    }
    track('view_chart', { company: companyName });
    $('#cmTitle').textContent = companyName;
    const stockSymbol = E.guessSymbol(companyName);
    const idx = E.guessSectorIndex(companyName, sector); // null when this sector has no sensible benchmark
    cmState = { stockSymbol, sectorSymbol: idx ? idx.symbol : null, sectorLabel: idx ? idx.label : null };
    const seg = $('#cmSeg');
    if (seg) {
      seg.hidden = !idx; // one symbol only -> no point showing a toggle with nothing to switch to
      const sectorBtn = seg.querySelector('[data-v="sector"]');
      const sectorLabelEl = $('#cmSectorLabel');
      if (idx && sectorLabelEl) sectorLabelEl.textContent = idx.label;
      if (sectorBtn) sectorBtn.setAttribute('aria-pressed', 'false');
      const stockBtn = seg.querySelector('[data-v="stock"]');
      if (stockBtn) stockBtn.setAttribute('aria-pressed', 'true');
    }
    loadChartSymbol(stockSymbol);
    cmOpener = opener || document.activeElement;
    box.hidden = false;
    document.body.classList.add('noscroll');
    const x = box.querySelector('.vclose'); if (x) x.focus();
  }
  function closeChartModal() {
    const box = $('#chartModal');
    if (!box || box.hidden) return;
    $('#cmChart').innerHTML = '';     // drop the widget/iframe entirely rather than leave it running hidden
    box.hidden = true;
    document.body.classList.remove('noscroll');
    if (cmOpener && document.contains(cmOpener)) cmOpener.focus();
    cmOpener = null;
    cmState = null;
  }

  function entryHTML(it) {
    const open = S.open.has(it.id);
    const n = (it.sources || []).length;
    const rel = (it.related || []).length;
    // Closed-card thumbnail only (CSS also hides it via .entry.open .entry-thumb as a second safety net) -
    // a real headline photo from image_intel.py when one was found, otherwise nothing is rendered at all
    // rather than a placeholder box, so stories without a match just keep today's clean text-only look.
    const thumb = (!open && it.image && it.image.url)
      ? `<div class="entry-thumb"><img src="${esc(it.image.url)}" alt="" loading="lazy" onerror="this.closest('.entry-thumb').remove()"></div>` : '';
    return `<article class="entry imp-${it.importance.toLowerCase()}${open ? ' open' : ''}" data-id="${it.id}">
      <div class="entry-top">
        <div class="entry-text">
          <div class="where"><span>${flagOf(it.country)} ${esc(it.country)}</span><span class="sect">${esc(it.sector)}${it.subsector ? ' / ' + esc(it.subsector) : ''}</span></div>
          <h3 class="hl">${esc(trOf(it.headline))}</h3>
          ${it.summary ? `<p class="sum">${esc(trOf(it.summary))}</p>` : ''}
        </div>
        ${thumb}
      </div>
      ${videoHTML(it)}
      <div class="foot">${n > 1 ? `<span>${n} sources</span>` : ''}${rel ? `<span>${rel} related</span>` : ''}<span title="${esc(fmtDateTime(it.addedAt))}">${ago(it.addedAt)}</span><span class="ts">${esc(fmtDateTime(it.addedAt))}</span></div>
      ${open ? detailsHTML(it) : ''}
    </article>`;
  }

  // Swipe backgrounds only apply on the Signals list (swipe left = dismiss, right = save); the Saved tab has
  // its own card without swipe, since "swipe to dismiss" doesn't make sense once something is already saved.
  // Only one label is ever shown at a time: sw-left is the "Skip" label revealed by a LEFT swipe (it sits on
  // the right edge, where the card uncovers it as it slides away), sw-right is "Save" revealed by a RIGHT swipe
  // (sits on the left edge). Both markers exist in the DOM; onSwipeMove toggles which one is visible via the
  // .left/.right class on the wrapper, so the two never show at once.
  function entryWrapHTML(it) {
    return `<div class="entrywrap">
      <div class="swipebg" aria-hidden="true">
        <span class="sw-left">Skip <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg></span>
        <span class="sw-right"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3z" fill="currentColor"/></svg> Save</span>
      </div>
      ${entryHTML(it)}
    </div>`;
  }

  function savedCardHTML(it) {
    const open = S.open.has(it.id);
    const n = (it.sources || []).length;
    const thumb = (!open && it.image && it.image.url)
      ? `<div class="entry-thumb"><img src="${esc(it.image.url)}" alt="" loading="lazy" onerror="this.closest('.entry-thumb').remove()"></div>` : '';
    return `<article class="entry imp-${it.importance.toLowerCase()}${open ? ' open' : ''}" data-id="${it.id}">
      <div class="entry-top">
        <div class="entry-text">
          <div class="where"><span>${flagOf(it.country)} ${esc(it.country)}</span><span class="sect">${esc(it.sector)}${it.subsector ? ' / ' + esc(it.subsector) : ''}</span></div>
          <h3 class="hl">${esc(trOf(it.headline))}</h3>
          ${it.summary ? `<p class="sum">${esc(trOf(it.summary))}</p>` : ''}
        </div>
        ${thumb}
      </div>
      ${videoHTML(it)}
      <div class="foot">${n > 1 ? `<span>${n} sources</span>` : ''}<span title="${esc(fmtDateTime(it.addedAt))}">${ago(it.addedAt)}</span><span class="ts">${esc(fmtDateTime(it.addedAt))}</span></div>
      ${open ? detailsHTML(it, { inSaved: true }) : ''}
      ${open ? '' : `<button class="link unsave" data-act="unsave" data-id="${esc(it.id)}">Remove from Saved</button>`}
    </article>`;
  }

  /* ---------- swipe gestures (Phase B) ----------
     Pointer Events (not touch-only) so both a phone swipe and a mouse drag work the same way.
     Left = dismiss, right = save. A small accidental move snaps back with no effect; a vertical scroll is
     detected early and cancels the gesture cleanly so scrolling the list never gets hijacked.
     SWIPE.justSwiped suppresses the ordinary "tap card to open" click handler that otherwise fires right after
     the pointerup of any drag - including a small one that snapped back, and including a vertical scroll that
     started inside a card - so a swipe or a scroll can never be misread as a tap-to-open. */
  const SWIPE = { active: null, startX: 0, startY: 0, dx: 0, locked: null, pointerId: null, justSwiped: false, renderPending: false };
  const SWIPE_THRESHOLD = 90;   // px of horizontal movement needed to commit to dismiss/save
  const SWIPE_LOCK = 12;        // px of movement before deciding this gesture is horizontal vs. vertical scroll

  function markJustSwiped() {
    SWIPE.justSwiped = true;
    setTimeout(() => { SWIPE.justSwiped = false; }, 350);
  }

  // A card can be replaced in the DOM (renderList/renderAll run on almost every action) while a gesture is
  // still technically "captured" on it. Releasing explicitly here means the next gesture always starts clean,
  // rather than ever depending on the browser noticing the old element was removed from the document.
  function releaseCapture(card) {
    if (card && SWIPE.pointerId != null) {
      try { card.releasePointerCapture(SWIPE.pointerId); } catch (e) { /* already released, or the element is gone - both fine */ }
    }
    SWIPE.pointerId = null;
  }

  function swipeReset(card) {
    if (card) {
      card.style.transition = 'transform .22s ease, opacity .22s ease';
      card.style.transform = '';
      card.style.opacity = '';
    }
    const wrap = card && card.closest('.entrywrap');
    if (wrap) { const p = wrap.querySelector('.swipebg'); if (p) p.style.opacity = '0'; }
    releaseCapture(card);
    SWIPE.active = null; SWIPE.dx = 0; SWIPE.locked = null;
    flushPendingRender();
  }

  // A background refresh may have tried to re-render #list while a gesture was in progress (see renderList());
  // once the gesture is fully over, catch up on that render so the list doesn't go stale.
  function flushPendingRender() {
    if (SWIPE.renderPending && !SWIPE.active) { SWIPE.renderPending = false; renderList(); }
  }

  function onSwipeStart(ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const card = ev.target.closest('.entry');
    if (!card || ev.target.closest('select,button,a,label,.details,.btn-watch,.btn-ai')) return;
    // A fresh gesture on a new element: make sure no stale capture from a previous, since-removed card lingers.
    if (SWIPE.active && SWIPE.active !== card) releaseCapture(SWIPE.active);
    SWIPE.active = card; SWIPE.startX = ev.clientX; SWIPE.startY = ev.clientY; SWIPE.dx = 0; SWIPE.locked = null;
    SWIPE.pointerId = ev.pointerId;
    card.style.transition = 'none';
    try { card.setPointerCapture(ev.pointerId); } catch (e) { /* not critical - move/end still fire via bubbling */ }
  }

  function onSwipeMove(ev) {
    if (!SWIPE.active) return;
    const dx = ev.clientX - SWIPE.startX, dy = ev.clientY - SWIPE.startY;
    if (SWIPE.locked === null && (Math.abs(dx) > SWIPE_LOCK || Math.abs(dy) > SWIPE_LOCK)) {
      SWIPE.locked = Math.abs(dx) > Math.abs(dy);
      if (!SWIPE.locked) {
        // Vertical scroll: let the browser handle it, and mark this as "just swiped" so the trailing click
        // (which always follows a pointerdown+pointerup, even one that was really a scroll) doesn't open the card.
        markJustSwiped();
        swipeReset(SWIPE.active);
        return;
      }
    }
    if (!SWIPE.locked) return;
    ev.preventDefault();
    SWIPE.dx = dx;
    const card = SWIPE.active;
    card.style.transform = `translateX(${dx}px)`;
    const wrap = card.closest('.entrywrap');
    const panel = wrap && wrap.querySelector('.swipebg');
    if (panel) {
      const frac = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
      panel.style.opacity = String(frac);
      panel.classList.toggle('left', dx < 0);
      panel.classList.toggle('right', dx > 0);
    }
  }

  function onSwipeEnd(ev) {
    if (!SWIPE.active) return;
    const card = SWIPE.active, dx = SWIPE.dx, dy = ev.clientY - SWIPE.startY, id = card.dataset.id;
    const moved = Math.abs(dx) > SWIPE_LOCK || Math.abs(dy) > SWIPE_LOCK;
    if (!SWIPE.locked || Math.abs(dx) < SWIPE_THRESHOLD) {
      if (moved) markJustSwiped();     // below threshold but still a real drag: snapping back should not open the card either
      swipeReset(card);
      return;
    }
    markJustSwiped();
    card.style.transition = 'transform .22s ease, opacity .22s ease';
    card.style.transform = `translateX(${dx < 0 ? '-120%' : '120%'})`;
    card.style.opacity = '0';
    releaseCapture(card);
    SWIPE.active = null;
    setTimeout(() => { if (dx < 0) dismissItem(id); else saveItem(id); }, 200);
  }

  $('#list').addEventListener('pointerdown', onSwipeStart);
  $('#list').addEventListener('pointermove', onSwipeMove);
  $('#list').addEventListener('pointerup', onSwipeEnd);
  $('#list').addEventListener('pointercancel', () => swipeReset(SWIPE.active));
  // Once a horizontal drag is under way, stop the browser's own native "drag this element" gesture from
  // starting - if it does, it swallows the pointer (a pointercancel with no matching pointerup) and the swipe
  // silently aborts, leaving the card behaving as if nothing happened.
  $('#list').addEventListener('dragstart', ev => { if (SWIPE.active) ev.preventDefault(); });

  /* ---------- Phase C: Country Status viewer navigation ---------- */
  $('#cvBody').addEventListener('click', cvTap);
  $('#cvBody').addEventListener('pointerdown', cvSwipeStart);
  $('#cvBody').addEventListener('pointerup', cvSwipeEnd);
  document.addEventListener('keydown', ev => {
    if (!S.cv) return;
    if (ev.key === 'Escape') closeCountryViewer();
    else if (ev.key === 'ArrowLeft') cvGo(-1);
    else if (ev.key === 'ArrowRight') cvGo(1);
  });

  /* ---------- Analyze with AI ----------
     Phase D: this used to hand the external AI (ChatGPT/Claude) a fixed 5-question checklist for
     every event, from a central-bank rate decision to a corporate merger to a border skirmish - the
     same mechanical structure regardless of what actually happened. Per the Phase D brief, the AI
     should decide the most useful structure for THIS kind of event, not fill in the same five
     blanks every time. So instead of asking five fixed questions, this builds a short, event-aware
     nudge (using the sector this story was already classified into) that names a few angles typical
     of that kind of event as illustration, then explicitly leaves the actual structure to the
     model's own judgement. A story that doesn't match any of the illustrated angles below still gets
     a sensible generic nudge, not the old rigid checklist. */
  const EVENT_ANGLES = {
    'Banking': 'what changed, the monetary-policy or lending significance, market and currency implications, who it affects, and what to watch next',
    'Finance': 'what changed, market/valuation implications, who gains or loses, and what to watch next',
    'Geopolitics': 'what happened, the actors involved, the strategic significance, immediate consequences, and likely next developments',
    'Defence': 'what happened, the military/strategic significance, the actors involved, and likely next developments',
    'Technology': 'what changed, the competitive or security implications, who it affects, and what to watch next',
    'Energy': 'what changed, the supply/demand or price implications, who it affects, and what to watch next',
    'Economy': 'what changed, the macroeconomic significance, who it affects, and what to watch next',
    'Climate': 'what happened, the environmental and economic significance, who it affects, and what to watch next'
  };
  function eventAngle(it) {
    // Company-driven stories read as corporate news even when classified under a broader sector.
    if ((it.companies || []).length) return 'the company action, its financial/business implications, competitors and supply chain, and likely market impact';
    return EVENT_ANGLES[it.sector] || 'what happened, why it matters, who it affects, and what to watch next';
  }
  function aiPrompt(it) {
    const where = [it.country, ...(it.involved || [])].filter(Boolean).join(', ');
    return `Analyze this news/event:

${it.headline}
${where ? `(Country/region: ${where}${it.sector ? '; sector: ' + it.sector : ''})` : (it.sector ? `(Sector: ${it.sector})` : '')}

Give a concise, event-specific analysis - decide for yourself which structure best fits what actually happened here, rather than forcing a generic template onto it. For this kind of story, that will likely mean covering things like ${eventAngle(it)} - but use your own judgement on what's actually relevant, and skip anything that isn't.`;
  }

  function aiLinks(it) {
    return `<div class="ai-actions">
      <b>Analyze with AI</b>
      <div class="ai-buttons">
        <button class="btn-ai" data-act="ai" data-ai="chatgpt" data-id="${it.id}">ChatGPT</button>
        <button class="btn-ai" data-act="ai" data-ai="claude" data-id="${it.id}">Claude</button>
      </div>
    </div>`;
  }

  function openAI(it, provider) {
    const prompt = encodeURIComponent(aiPrompt(it));
    const urls = {
      chatgpt: 'https://chatgpt.com/?q=' + prompt,
      claude: 'https://claude.ai/new?q=' + prompt
    };
    const url = urls[provider];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }


  function detailsHTML(it, opts) {
    const inSaved = !!(opts && opts.inSaved);
    const rel = (it.related || []).map(id => all().find(x => x.id === id)).filter(Boolean);
    const opt = (list, cur) => list.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
    const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
    // On Signals, Save/Dismiss are swipe-only now (swipe right/left on the card) - no buttons here, so there's
    // nothing to duplicate. The Saved tab keeps its "Remove from Saved" button since un-saving has no swipe
    // gesture of its own there.
    const quickacts = inSaved
      ? `<div class="quickacts"><button class="btn small" data-act="unsave" data-id="${esc(it.id)}">Remove from Saved</button></div>`
      : '';
    return `<div class="details">
      ${quickacts}
      ${aiLinks(it)}
      ${it.why ? `<p class="why"><b>Why it matters</b> ${esc(trOf(it.why))}</p>` : ''}
      ${(it.facts || []).length ? `<ul class="facts">${trList(it.facts).map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      <dl class="kv">
        ${row('Also involved', (it.involved || []).map(c => flagOf(c) + ' ' + esc(c)).join(', '))}
        ${row('Companies', (it.companies || []).map(esc).join(', '))}
        
        
        ${row('Source date', esc(it.date || dayISO(it.addedAt)))}
        ${row('Sources', (it.sources || []).map(s => s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)).join(', '))}
      </dl>
      ${rel.length ? `<div class="rel"><b>Related stories</b>${rel.map(r => `<button class="link" data-act="goto" data-id="${r.id}">${flagOf(r.country)} ${esc(r.headline)}</button>`).join('')}</div>` : ''}
      ${it.live ? '' : `<div class="edit">
        <label>Country<select data-edit="country">${opt(E.COUNTRY_NAMES, it.country)}</select></label>
        <label>Sector<select data-edit="sector">${opt(E.SECTOR_NAMES, it.sector)}</select></label>
        <label>Importance<select data-edit="importance">${opt(E.IMP_ORDER, it.importance)}</select></label>
      </div>
      <button class="btn small danger" data-act="del" data-id="${it.id}">Delete item</button>`}
    </div>`;
  }

  const IMP_TITLES = { Critical: 'Critical developments', High: 'High priority', Medium: 'Medium priority', Low: 'Low priority' };
  const IMP_VAR = { Critical: 'var(--crit)', High: 'var(--high)', Medium: 'var(--med)', Low: 'var(--low)' };

  function groupHead(html, n, color) {
    return `<h2 class="grp">${color ? `<span class="sw" style="background:${color}"></span>` : ''}${html}<span class="n">${n}</span></h2>`;
  }

  // Investment mode's search/priority filter: same fields as filtered()'s own search, applied per-story
  // within each company group, so the existing search box and priority chips keep working without
  // duplicating their UI. Country/sector dropdown filters don't apply here - sector is already the
  // Investment tab's own grouping - so only q and imp are relevant.
  function investmentStoryMatches(it) {
    const f = S.f, q = f.q.trim().toLowerCase();
    if (f.imp && it.importance !== f.imp) return false;
    if (q && !(it.headline + ' ' + it.summary + ' ' + it.country + ' ' + it.sector + ' ' + it.subsector + ' ' + (it.companies || []).join(' ') + ' ' + it.text).toLowerCase().includes(q)) return false;
    return true;
  }

  function renderInvestmentList() {
    // Same guard as renderList(): don't yank #list's DOM out from under an in-progress swipe gesture.
    if (SWIPE.active) { SWIPE.renderPending = true; return; }
    const box = $('#list');
    const groups = investmentGroups();
    const empty = $('#investEmpty');
    if (!S.myCompanies.size) {
      if (empty) empty.hidden = false;
      box.innerHTML = '';
      return;
    }
    if (empty) empty.hidden = true;
    let html = '';
    for (const g of groups) {
      const companyBlocks = g.companies.map(c => {
        const stories = c.stories.filter(investmentStoryMatches);
        const body = stories.length
          ? stories.map(entryWrapHTML).join('')
          : `<p class="empty-note">${esc(t('investNoNews'))}</p>`;
        return `<h3 class="grp-company">
          <div class="gc-top"><span class="gc-name">${esc(c.company)}</span><span class="n">${stories.length}</span></div>
          <div class="gc-actions">
            <button class="btn-chart" data-act="viewChart" data-v="${esc(c.company)}" data-sector="${esc(g.sector)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/></svg>${esc(t('viewChart'))}</button>
            <button class="gc-remove" data-act="untrack" data-v="${esc(c.company)}" aria-label="${esc(t('investRemove'))} ${esc(c.company)}" title="${esc(t('investRemove'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </div>
        </h3>${body}`;
      }).join('');
      const sectorTotal = g.companies.reduce((n, c) => n + c.stories.filter(investmentStoryMatches).length, 0);
      html += groupHead(esc(g.sector), sectorTotal) + companyBlocks;
    }
    box.innerHTML = html || `<div class="empty"><p>${esc(t('investNoNews'))}</p></div>`;
  }

  function renderList() {
    if (S.mode === 'investment') { renderInvestmentList(); return; }
    // A background refresh (the initial live-feed load, or the 60s auto-poll) can land while the user has a
    // finger down on a card. Rebuilding #list's innerHTML underneath an in-progress gesture would yank the DOM
    // node out from under the pointer capture, so a re-render is deferred until the gesture ends.
    if (SWIPE.active) { SWIPE.renderPending = true; return; }
    const items = filtered().sort(byPriority);
    ensureTranslated(collectTranslatable(items));
    const box = $('#list');
    if (!all().length) {
      box.innerHTML = `<div class="empty"><p>Nothing here right now.</p><p>Stories move here as they come in from your followed channels. Check back shortly, or pull down to refresh.</p><button class="btn" data-act="refresh">Refresh</button></div>`;
      return;
    }
    if (!items.length) {
      // A real active filter (country/sector/importance/search) gets "Clear filters"; the 7-day default range
      // hiding items that simply expired or were dismissed is not a "filter" the person set, so it gets a plainer
      // message instead of a button that clears nothing meaningful.
      const hasRealFilter = !!(S.f.country || S.f.sector || S.f.imp || S.f.q);
      box.innerHTML = hasRealFilter
        ? `<div class="empty"><p>No items match these filters.</p><button class="btn" data-act="reset">Clear filters</button></div>`
        : `<div class="empty"><p>Nothing here right now.</p><p>Stories move here as they come in, and drop off the list automatically after 24 hours unless you save them.</p></div>`;
      return;
    }
    let html = '';
    if (S.f.view === 'priority') {
      E.IMP_ORDER.forEach(lv => {
        const g = items.filter(i => i.importance === lv);
        if (g.length) html += groupHead(IMP_TITLES[lv], g.length, IMP_VAR[lv]) + g.map(entryWrapHTML).join('');
      });
    } else {
      const key = S.f.view === 'country' ? 'country' : 'sector';
      const map = new Map();
      items.forEach(i => { if (!map.has(i[key])) map.set(i[key], []); map.get(i[key]).push(i); });
      [...map.entries()].sort((a, b) => E.impRank(b[1][0].importance) - E.impRank(a[1][0].importance) || b[1].length - a[1].length)
        .forEach(([k, g]) => { html += groupHead((key === 'country' ? flagOf(k) + ' ' : '') + esc(k), g.length) + g.map(entryWrapHTML).join(''); });
    }
    box.innerHTML = html;
  }

  function renderSaved() {
    const box = $('#savedList');
    if (!box) return;
    const items = savedItems();
    ensureTranslated(collectTranslatable(items));
    if (!items.length) {
      box.innerHTML = `<div class="empty"><p>Nothing saved yet.</p><p>Swipe a story right, or tap Save, to keep it here past the normal 24-hour window.</p></div>`;
      return;
    }
    box.innerHTML = items.map(savedCardHTML).join('');
  }

  /* ---------- country, sector and priority drop-downs ---------- */
  function ensureFilterSelects() {
    const box = $('#filterBox');
    if (box && !$('#countryFilter')) {   // safety net if an older index.html is still cached
      box.innerHTML = '<select id="countryFilter" class="filter-dropdown" aria-label="Filter by country"></select>' +
        '<select id="sectorFilter" class="filter-dropdown" aria-label="Filter by sector"></select>';
    }
    if (box && !$('#viewFilter')) {
      box.insertAdjacentHTML('beforeend', '<select id="viewFilter" class="filter-dropdown" aria-label="Filter by priority">' +
        '<option value="">All priorities</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>');
    }
  }
  function fillSelect(sel, allLabel, counts, current) {
    const entries = [...counts.entries()];
    if (current && !counts.has(current)) entries.push([current, 0]);   // keep the chosen value visible
    entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const html = `<option value="">${allLabel}</option>` + entries.map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${n})</option>`).join('');
    if (sel.dataset.sig !== html) { sel.innerHTML = html; sel.dataset.sig = html; }
    sel.value = current || '';
    sel.classList.toggle('on', !!current);
  }
  function syncFilterDropdowns() {
    ensureFilterSelects();
    const cSel = $('#countryFilter'), sSel = $('#sectorFilter');
    if (!cSel || !sSel) return;
    const cm = new Map(), sm = new Map();
    filtered('country').forEach(i => new Set([i.country].concat(i.involved || [])).forEach(c => cm.set(c, (cm.get(c) || 0) + 1)));
    filtered('sector').forEach(i => sm.set(i.sector, (sm.get(i.sector) || 0) + 1));
    fillSelect(cSel, 'All Countries', cm, S.f.country);
    fillSelect(sSel, 'All Sectors', sm, S.f.sector);
  }

  function renderControls() {
    syncFilterDropdowns();

    // importance bar + chips (counts ignore the importance filter itself)
    const base = filtered('imp');
    const counts = {}; E.IMP_ORDER.forEach(l => counts[l] = 0);
    base.forEach(i => counts[i.importance]++);
    const total = base.length || 1;
    $('#impbar').innerHTML = E.IMP_ORDER.map(l => counts[l] ? `<i style="flex:${counts[l]};background:${IMP_VAR[l]}"></i>` : '').join('');
    $('#impchips').innerHTML = `<button class="chip${!S.f.imp ? ' on' : ''}" data-act="fi" data-v="">All <b>${base.length}</b></button>` +
      E.IMP_ORDER.map(l => `<button class="chip${S.f.imp === l ? ' on' : ''}" data-act="fi" data-v="${l}"><span class="dot" style="background:${IMP_VAR[l]}"></span>${l} <b>${counts[l]}</b></button>`).join('');
    // country strip
    const cBase = filtered('country'); const cm = new Map();
    cBase.forEach(i => { [i.country].concat(i.involved || []).forEach(c => cm.set(c, (cm.get(c) || 0) + 1)); });
    $('#countries').innerHTML = [...cm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
      .map(([c, n]) => `<button class="chip${S.f.country === c ? ' on' : ''}" data-act="fc" data-v="${esc(c)}">${flagOf(c)} ${esc(c)} <b>${n}</b></button>`).join('');
    // sector strip
    const sBase = filtered('sector'); const sm = new Map();
    sBase.forEach(i => sm.set(i.sector, (sm.get(i.sector) || 0) + 1));
    $('#sectors').innerHTML = [...sm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
      .map(([s, n]) => `<button class="chip${S.f.sector === s ? ' on' : ''}" data-act="fs" data-v="${esc(s)}">${esc(s)} <b>${n}</b></button>`).join('');
    // segmented controls
    $$('#rangeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.f.range));
    $$('#viewSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.f.view));
    const viewSel = $('#viewFilter');
    if (viewSel && viewSel.value !== S.f.imp) viewSel.value = S.f.imp;
    const shown = filtered();
    const merged = shown.reduce((a, i) => a + Math.max(0, (i.sources || []).length - 1), 0);
    $('#briefMeta').textContent = shown.length + (shown.length === 1 ? ' item' : ' items') + (merged ? ', ' + merged + ' duplicate' + (merged > 1 ? 's' : '') + ' merged' : '');
    $('#hasFilter').hidden = !(S.f.country || S.f.sector || S.f.imp || S.f.q);
  }


  // Sync-by-code is now guest-only UI that just points at login (see the #syncBlock markup in index.html) -
  // there is no code to show any more, so this just keeps the block's visibility in sync with sign-in state.
  // renderAccount() also sets this on every sign-in/sign-out, this call covers the initial page load.
  function renderSyncCode() {
    const box = $('#syncBlock');
    if (box) box.hidden = !!Auth.uid;
  }

  // Linking a NEW channel needs an account (see the note on Channels.propose(), which is the actual block -
  // this only keeps the "log in to link" note in sync with sign-in state). The input/button stay enabled
  // while signed out, on purpose: tapping Add while signed out is what triggers propose()'s toast telling the
  // person to log in, rather than a disabled control they can't interact with at all.
  function renderTelegramGate() {
    const note = $('#tgGateNote');
    if (note) note.hidden = !!Auth.uid;
  }

  let approvedChannelsCache = null;   // re-fetched whenever a channel is linked, so the new one appears right away
  async function renderChannels() {
    const box = $('#tgList'), note = $('#tgSyncNote');
    if (!box) return;
    renderTelegramGate();
    if (note) note.textContent = Sync.ready ? '' : 'Working from this device only until the sync service is reachable.';
    if (defaultChannelsCache === null) await DefaultChannels.load();
    const defaults = defaultChannelsCache || [];

    // Signed out: read-only view of the owner-curated default channels only - no Follow/Add/Remove, since
    // managing channel preferences requires an account (see the login-gate on Channels.propose() above, and
    // the user's own architecture: "In case if user have not logged in, he/she will see only the information
    // of the channels linked by default and is managed by owner"). Signing back out returns here automatically,
    // since this whole branch is keyed off Auth.uid rather than any locally-cached list.
    if (!Auth.uid) {
      if (!defaults.length) {
        box.innerHTML = '<p class="lp-empty">' + esc(t('noChannelsYet')) + '</p>';
        return;
      }
      box.innerHTML = defaults.map(lower => `<div class="lp-row">
      <span class="name">t/${esc(lower)} <span class="lp-defaultbadge">${esc(t('defaultBadge'))}</span></span>
    </div>`).join('');
      return;
    }

    // Signed in: the full shared pool, with this account's own follow/unfollow plus (owner only) the
    // curation controls.
    if (approvedChannelsCache === null) approvedChannelsCache = await Channels.listApproved();
    // A channel this account has hidden (see the always-visible "Remove" button below) is left out of this
    // account's own list entirely - it stays in the shared pool untouched for every other user, and this
    // person can bring it back later by typing it into +Add again (see Channels.propose()'s un-hide step).
    const linked = (approvedChannelsCache || []).filter(name => !S.hiddenChannels.has(name.toLowerCase()));
    if (approvedChannelsCache === null) {
      box.innerHTML = '<p class="lp-empty">' + esc(t('couldntLoadChannels')) +
        (lastChannelError ? ' <br><span class="lp-errdetail">' + esc(lastChannelError) + '</span>' : ' ' + esc(t('checkConnection'))) + '</p>';
      return;
    }
    if (!linked.length) {
      box.innerHTML = '<p class="lp-empty">' + esc(t('noChannelsYet')) + '</p>';
      return;
    }
    const owner = isOwner();
    box.innerHTML = linked.map(name => {
      const lower = name.toLowerCase();
      const following = S.myChannels.has(lower);
      const isDefault = defaults.includes(lower);
      // Follow/Following is a plain toggle again - it only ever adds or drops this channel from this
      // account's OWN feed, and never removes the row itself. The always-visible "Remove" button below is
      // the separate, personal delink/hide action: visible on every row regardless of follow state, so a
      // user can get a channel out of their own list ("in case if the user don't want it") without first
      // having to follow it. This is distinct from the owner-only button further right, which deletes the
      // channel from the shared pool for every user.
      const mineBtn = following
        ? `<button class="follow on" data-act="tgfollow" data-v="${esc(name)}">${esc(t('following'))}</button>`
        : `<button class="follow" data-act="tgfollow" data-v="${esc(name)}">${esc(t('follow'))}</button>`;
      const hideBtn = `<button class="follow lp-hide" data-act="tghide" data-v="${esc(name)}" aria-label="${esc(t('remove'))} t/${esc(name)}">${esc(t('remove'))}</button>`;
      return `<div class="lp-row">
      <span class="name">t/${esc(name)}${isDefault ? ' <span class="lp-defaultbadge">' + esc(t('defaultBadge')) + '</span>' : ''}</span>
      <div class="lp-rowbtns">
        ${mineBtn}
        ${hideBtn}
        ${owner ? `<button class="follow lp-default" data-act="tgdefault" data-v="${esc(name)}">${isDefault ? esc(t('removeDefault')) : esc(t('setDefault'))}</button>` : ''}
        ${owner ? `<button class="follow lp-remove" data-act="tgremove" data-v="${esc(name)}" aria-label="${esc(t('removeShared'))} t/${esc(name)}">${esc(t('removeShared'))}</button>` : ''}
      </div>
    </div>`;
    }).join('');
  }

  // Investment watchlist (Settings). Much simpler than renderChannels(): purely personal data, no shared
  // pool/owner-approval step, just this account's own S.myCompanies - see the Companies module above.
  function renderInvestmentBox() {
    const box = $('#invList'), gate = $('#invGateNote');
    if (!box) return;
    // Signed out: a quiet login prompt, same spirit as the Telegram gate note - the input/button stay in
    // the DOM and clickable either way, since Companies.add() itself is what opens the login-gate modal.
    if (gate) gate.hidden = !!Auth.uid;
    if (!S.myCompanies.size) {
      box.innerHTML = `<p class="lp-empty">${esc(t('investEmptyTitle'))}</p>`;
    } else {
      box.innerHTML = [...S.myCompanies].sort((a, b) => a.localeCompare(b)).map(name => `<div class="lp-row">
        <span class="name">${esc(name)}</span>
        <div class="lp-rowbtns">
          <button class="follow lp-remove" data-act="untrack" data-v="${esc(name)}" aria-label="${esc(t('investRemove'))} ${esc(name)}">${esc(t('investRemove'))}</button>
        </div>
      </div>`).join('');
    }
    // Datalist suggestions from the app's own recognized-companies list, so typed names match what the
    // pipeline actually tags stories with (see Companies.add()'s canonical-name lookup).
    const dl = $('#invSuggest');
    if (dl && !dl.childElementCount) dl.innerHTML = E.COMPANIES.map(c => `<option value="${esc(c.name)}">`).join('');
  }

  async function renderExport() {
    $$('#exportSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.exportRange));
    const c = visibleItems().filter(i => inRange(i, S.exportRange)).length;
    $('#exportCount').textContent = c + (c === 1 ? ' item' : ' items') + ' in this period';
  }
  function renderAll() {
    if (S.mode === 'investment') { renderList(); if (S.tab === 'saved') renderSaved(); return; }
    renderControls(); renderList(); renderExport(); renderCountryBar();
    if (S.tab === 'saved') renderSaved();
    // keep the just-added cards in sync when they are toggled
  }

  /* ---------- News / Investment mode toggle ---------- */
  function setMode(mode) {
    if (mode === S.mode) return;
    S.mode = mode;
    track('mode_view', { mode });
    $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === mode));
    // The News-only chrome (country status ring, country/sector dropdown filters) has no meaning in
    // Investment mode, which is already grouped by sector/company - hide it rather than render it against
    // the wrong data. #rangeSeg/#sectors/#countries/#viewSeg are left alone entirely: they're already
    // permanently hidden in the markup (their buttons are commented out - unused/future UI), independent of
    // mode. The search box and priority chips/dropdown stay visible in both modes: Investment mode's own
    // rendering (investmentStoryMatches()) honors the same S.f.q/S.f.imp, so they keep actually doing something.
    const investmentOnlyHide = ['#countryStatus', '#countryFilter', '#sectorFilter', '#hasFilter'];
    if (mode === 'investment') {
      investmentOnlyHide.forEach(sel => { const el = $(sel); if (el) el.hidden = true; });
      renderInvestmentList();
    } else {
      // renderControls() fills countryFilter/sectorFilter but never un-hides them (it only reacts to filter
      // state, not mode), so that's cleared here first; #countryStatus/#hasFilter are restored by
      // renderCountryBar()/renderControls() themselves right after.
      ['#countryFilter', '#sectorFilter'].forEach(sel => { const el = $(sel); if (el) el.hidden = false; });
      renderControls(); renderList(); renderCountryBar();
    }
  }

  /* ---------- tabs ---------- */
  function setTab(name) {
    if (name !== S.tab) track('tab_view', { tab: name });
    S.tab = name;
    $$('.view').forEach(v => v.hidden = v.id !== 'view-' + name);
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name));
    window.scrollTo(0, 0);
    if (name === 'brief') { if (S.mode === 'investment') renderInvestmentList(); else { renderControls(); renderList(); } }
    if (name === 'export') renderExport();
    if (name === 'saved') renderSaved();
    // Settings used to be the app's default first screen ("Link Pages"), so its Account/Telegram/Appearance
    // blocks were always rendered on load regardless of which tab was showing. Now that it's reached only via
    // the Settings tab, re-render its dynamic bits on every visit so they're never stale (e.g. after signing
    // in from the landing page while this tab wasn't open yet).
    if (name === 'settings') { renderAccount(); renderChannels(); renderSyncCode(); renderGetApp(); renderNotifBox(); renderTicketBox(); renderTicketAdmin(); renderInvestmentBox(); }
  }

  /* ---------- export ---------- */
  function download(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  const RANGE_LABEL = { today: 'Today', '7d': 'Last 7 days', all: 'All items' };

  function exportCSV() {
    const items = visibleItems().filter(i => inRange(i, S.exportRange)).sort(byPriority);
    if (!items.length) { toast('Nothing to export for that period.'); return; }
    download('qwicksignal-' + dayISO(Date.now()) + '.csv', E.toCSV(items), 'text/csv;charset=utf-8');
    toast('CSV saved to Downloads.');
    track('export', { format: 'csv', range: S.exportRange, count: items.length });
  }

  async function exportPDF() {
    const items = visibleItems().filter(i => inRange(i, S.exportRange)).sort(byPriority);
    if (!items.length) { toast('Nothing to export for that period.'); return; }
    toast('Building the PDF\u2026');
    track('export', { format: 'pdf', range: S.exportRange, count: items.length });
    try { await loadScript(URLS.jspdf); }
    catch (e) { toast('The PDF tool could not load. Connect to the internet once and try again.'); return; }
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight(), M = 42, CW = PW - 2 * M;
    let y = 0;
    const safe = t => String(t || '').replace(/[\u2018\u2019\u201B]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...').replace(/[\u2022\u00b7]/g, '-').replace(/\u00a0/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
    const COL = { Critical: [200, 50, 31], High: [207, 127, 18], Medium: [79, 124, 163], Low: [135, 149, 162] };
    const INK = [14, 34, 56], GREY = [88, 104, 120];
    const need = h => { if (y + h > PH - 46) { doc.addPage(); y = M; } };
    function put(t, o) {
      o = Object.assign({ size: 10, bold: false, color: INK, after: 4, indent: 0 }, o);
      doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size); doc.setTextColor(...o.color);
      const lh = o.size * 1.34;
      doc.splitTextToSize(safe(t), CW - o.indent).forEach(l => { need(lh); doc.text(l, M + o.indent, y + o.size); y += lh; });
      y += o.after;
    }
    function heading(t) {
      need(40); y += 6;
      put(t, { size: 13, bold: true, after: 3 });
      doc.setDrawColor(...INK); doc.setLineWidth(0.8); doc.line(M, y, PW - M, y); y += 10;
    }

    // masthead
    doc.setFillColor(...INK); doc.rect(0, 0, PW, 92, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(23); doc.text('QwickSignal Report', M, 44);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    doc.text(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '   |   ' + RANGE_LABEL[S.exportRange], M, 64);
    y = 116;

    // Every priority level (Critical/High/Medium/Low) is included in the export - items is never filtered
    // by importance (see visibleItems()/inRange() above). This used to be split into two sections titled
    // "Priority developments" (Critical+High) and "Other developments" (Medium+Low), which read to at least
    // one user as "only High and some generic Other stuff get exported," even though every level was always
    // present. Now split into four explicitly-labelled sections, one per importance, in rank order, so the
    // PDF itself makes it unambiguous that nothing is being left out.
    const ORDER = ['Critical', 'High', 'Medium', 'Low'];
    const SECTION_TITLE = { Critical: 'Critical developments', High: 'High developments', Medium: 'Medium developments', Low: 'Low developments' };
    ORDER.forEach(level => {
      const group = items.filter(i => i.importance === level);
      if (!group.length) return;
      heading(SECTION_TITLE[level] + ' (' + group.length + ')');
      group.forEach(it => {
        need(70);
        doc.setFillColor(...COL[it.importance]); doc.rect(M, y + 2, 7, 9, 'F');
        put(it.headline, { size: 11.5, bold: true, indent: 14, after: 1 });
        put(it.country + '  |  ' + it.sector + (it.subsector ? ' / ' + it.subsector : '') + '  |  ' + it.importance + ((it.sources || []).length > 1 ? '  |  ' + it.sources.length + ' sources' : ''), { size: 8.5, color: GREY, indent: 14, after: 2 });
        if (it.summary) put(it.summary, { size: 9.5, indent: 14, after: 9 }); else y += 7;
      });
    });

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 130, 140);
      doc.text('QwickSignal, generated on device   |   page ' + p + ' of ' + pages, PW / 2, PH - 22, { align: 'center' });
    }
    doc.save('QwickSignal-Report-' + dayISO(Date.now()) + '.pdf');
    toast('PDF saved to Downloads.');
  }

  /* ---------- temporary diagnostic net ----------
     An uncaught error anywhere in the app (not just inside the click handler below, which has its own
     try/catch) used to fail completely silently on a phone with no devtools - a tap just did nothing, with
     no way to tell what broke. These two surface the real browser error as a toast instead, which is how
     we found and fixed real bugs (like the TradingView chart one) without guessing blind. Safe to leave in
     permanently - they only fire on a genuine uncaught error/rejection, never during normal use. */
  window.addEventListener('error', ev => {
    console.error('[window.onerror]', ev.error || ev.message);
    toast('App error: ' + (ev.error && ev.error.message ? ev.error.message : ev.message));
  });
  window.addEventListener('unhandledrejection', ev => {
    console.error('[unhandledrejection]', ev.reason);
    const r = ev.reason;
    toast('App error: ' + (r && r.message ? r.message : String(r)));
  });

  /* ---------- events ---------- */
  document.addEventListener('click', async ev => {
    if (SWIPE.justSwiped) { ev.preventDefault(); ev.stopPropagation(); return; }
    const el = ev.target.closest('[data-act],[data-tab],[data-v]');
    if (el && el.dataset.tab) { setTab(el.dataset.tab); return; }
    if (el && el.closest('#modeSeg')) { setMode(el.dataset.v); return; }
    if (el && el.closest('#rangeSeg')) { S.f.range = el.dataset.v; renderControls(); renderList(); return; }
    if (el && el.closest('#viewSeg')) { S.f.view = el.dataset.v; renderControls(); renderList(); return; }
    if (el && el.closest('#exportSeg')) { S.exportRange = el.dataset.v; renderExport(); return; }
    const act = el && el.dataset.act;
    if (act) {
     try {
      const v = el.dataset.v;
      if (act === 'untrack') { Companies.remove(v); }
      else if (act === 'gotoWatchlist') { setTab('settings'); const inp = $('#invInput'); if (inp) inp.focus(); }
      else if (act === 'viewChart') { openChartModal(v, el, el.dataset.sector); }
      else if (act === 'cmclose') { closeChartModal(); }
      else if (act === 'cmSeg') { setChartSeg(v); }
      else if (act === 'ai') {
        const it = all().find(x => x.id === el.dataset.id);
        if (it) openAI(it, el.dataset.ai);
      }
      else if (act === 'watch') {
        const it = all().find(x => x.id === el.dataset.id);
        if (it) openVideo(it, el);
      }
      else if (act === 'vclose') { closeVideo(); }
      else if (act === 'agclose') { closeAuthGate(); }
      else if (act === 'agGoto') { closeAuthGate(); setTab('settings'); const eb = $('#authEmail'); if (eb) eb.focus(); }
      else if (act === 'fi') { S.f.imp = v; if (S.mode === 'investment') renderInvestmentList(); else { renderControls(); renderList(); } }
      else if (act === 'fc') { S.f.country = S.f.country === v ? '' : v; renderControls(); renderList(); }
      else if (act === 'fs') { S.f.sector = S.f.sector === v ? '' : v; renderControls(); renderList(); }
      else if (act === 'reset') { S.f = Object.assign(S.f, { country: '', sector: '', imp: '', q: '', range: 'all' }); $('#q').value = ''; if (S.mode === 'investment') renderInvestmentList(); else { renderControls(); renderList(); } }
      else if (act === 'refresh') { await loadLive(true); }
      else if (act === 'tgfollow') {
        // Follow/unfollow used to fire-and-forget via Sync.pushSoon() (a 600ms-debounced background save) -
        // the button flipped instantly, but if that background save then failed (an expired session, a
        // network blip, or a permissions problem), nothing told the person: the change quietly never reached
        // their account, and reappeared reverted the next time the screen re-rendered from server data. That
        // looked exactly like "nothing happens" or "it flips back on its own". Awaiting Sync.push() here and
        // reporting a real failure - reverting the UI back in step with an explanation, rather than letting it
        // drift back on its own later - turns a silent, confusing revert into an honest one.
        const name = el.dataset.v;
        const wasFollowing = S.myChannels.has(name.toLowerCase());
        if (wasFollowing) Channels.unfollow(name); else Channels.follow(name);
        renderChannels(); renderAll();
        const ok = await Sync.push();
        if (!ok) {
          if (wasFollowing) Channels.follow(name); else Channels.unfollow(name);
          renderChannels(); renderAll();
          toast('Couldn’t save that change to your account — check your connection (or sign in again if it keeps happening) and try again.');
        }
      }
      else if (act === 'tghide') {
        // The personal delink/hide action: always visible, regardless of follow state ("visible immediately,
        // even before following" - confirmed with the user). This only removes the channel from THIS
        // account's own list going forward; the shared pool, and every other user's list, is untouched. If
        // this channel was also followed, unfollow it too so it actually disappears from the feed as well as
        // the channel list, instead of a hidden-but-still-followed channel quietly continuing to show items.
        const name = el.dataset.v;
        const wasFollowing = S.myChannels.has(name.toLowerCase());
        S.hiddenChannels.add(name.toLowerCase());
        if (wasFollowing) Channels.unfollow(name);
        renderChannels(); renderAll();
        const ok = await Sync.push();
        if (!ok) {
          S.hiddenChannels.delete(name.toLowerCase());
          if (wasFollowing) Channels.follow(name);
          renderChannels(); renderAll();
          toast('Couldn’t save that change to your account — check your connection (or sign in again if it keeps happening) and try again.');
        } else {
          toast('t/' + name + ' removed from your list. Add it again any time with +Add.');
        }
      }
      else if (act === 'tgremove') {
        const name = el.dataset.v;
        if (confirm('Remove t/' + name + ' for everyone? The pipeline will stop fetching it on its next run.')) {
          await Channels.remove(name);
          renderAll();
        }
      }
      else if (act === 'tgdefault') {
        await DefaultChannels.toggle(el.dataset.v);
      }
      else if (act === 'opencountry') { track('open_country_viewer', { country: el.dataset.c }); openCountry(el.dataset.c); }
      else if (act === 'cvclose') { closeCountryViewer(); }
      else if (act === 'cvprev') { cvGo(-1); }
      else if (act === 'cvnext') { cvGo(1); }
      else if (act === 'save') { saveItem(el.dataset.id); }
      else if (act === 'unsave') { unsaveItem(el.dataset.id); }
      else if (act === 'dismiss') { dismissItem(el.dataset.id); }
      else if (act === 'undo-dismiss') { undoDismiss(el.dataset.id); }
      else if (act === 'goto') {
        gotoItem(el.dataset.id);
      }
      else if (act === 'del') {
        if (!confirm('Delete this item?')) return;
        const id = el.dataset.id;
        S.items = S.items.filter(i => i.id !== id);
        for (const i of S.items) if ((i.related || []).includes(id)) { i.related = i.related.filter(r => r !== id); await DB.put(i); }
        await DB.del(id); S.open.delete(id);
        renderAll();
      }
     } catch (e) {
       // Temporary diagnostic net (see the matching window.onerror/unhandledrejection hooks below): a
       // data-act handler that throws used to fail completely silently - the click just did nothing, with
       // no way for someone on a phone with no devtools to tell us why. Surfacing the real error as a toast
       // is what let us find and fix real bugs instead of guessing blind.
       console.error('[data-act:' + act + ']', e);
       toast('Action error (' + act + '): ' + (e && e.message ? e.message : String(e)));
     }
      return;
    }
    // tap on an entry toggles its details
    const card = ev.target.closest('.entry');
    if (card && !ev.target.closest('select,button,a,label,.details')) {
      const id = card.dataset.id;
      const opening = !S.open.has(id);
      if (opening) S.open.add(id); else S.open.delete(id);
      track(opening ? 'open_story' : 'close_story', { id });
      const it = all().find(i => i.id === id);
      if (it) card.outerHTML = card.closest('#savedList') ? savedCardHTML(it) : entryHTML(it);
    }
  });

  document.addEventListener('change', async ev => {
    const sel = ev.target.closest('select[data-edit]');
    if (!sel) return;
    const card = sel.closest('.entry');
    const it = S.items.find(i => i.id === card.dataset.id);
    if (!it) return;
    const f = sel.dataset.edit;
    it[f] = sel.value;
    if (f === 'country') { it.countryCode = (E.COUNTRY_BY_NAME[sel.value] || {}).code || 'GL'; it.involved = (it.involved || []).filter(c => c !== sel.value); }
    it.manual = true; it._p = undefined;
    await DB.put(it);
    renderControls(); renderList(); renderExport();
    toast('Updated.');
  });

  document.addEventListener('change', ev => {
    const t = ev.target;
    if (!t || !t.id) return;
    if (t.id === 'countryFilter') { S.f.country = t.value; renderControls(); renderList(); }
    else if (t.id === 'sectorFilter') { S.f.sector = t.value; renderControls(); renderList(); }
    else if (t.id === 'viewFilter') { S.f.imp = t.value; renderControls(); renderList(); }
  });
  document.addEventListener('keydown', ev => {
    const box = $('#videoModal');
    if (box && !box.hidden) {
      if (ev.key === 'Escape') { ev.preventDefault(); closeVideo(); return; }
      if (ev.key === 'Tab') {                      // keep keyboard focus inside the open player
        const f = [...box.querySelectorAll('button, a[href], iframe')].filter(e => !e.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
      return;
    }
    const chartBox = $('#chartModal');
    if (chartBox && !chartBox.hidden) {
      if (ev.key === 'Escape') { ev.preventDefault(); closeChartModal(); return; }
      if (ev.key === 'Tab') {
        const f = [...chartBox.querySelectorAll('button, a[href], iframe')].filter(e => !e.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
      return;
    }
    const gate = $('#authGate');
    if (gate && !gate.hidden) {
      if (ev.key === 'Escape') { ev.preventDefault(); closeAuthGate(); return; }
      if (ev.key === 'Tab') {
        const f = [...gate.querySelectorAll('button')].filter(e => !e.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    }
  });
  $('#q').addEventListener('input', e => { S.f.q = e.target.value; if (S.mode === 'investment') renderInvestmentList(); else { renderControls(); renderList(); } });
  $('#tgAdd').addEventListener('click', async () => {
    const inp = $('#tgInput'); const v = inp.value;
    if (!v.trim()) return;
    const ok = await Channels.propose(v);
    if (ok) inp.value = '';
  });
  $('#tgInput').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('#tgAdd').click(); } });
  $('#invAdd').addEventListener('click', () => {
    const inp = $('#invInput'); const v = inp.value;
    if (!v.trim()) return;
    const ok = Companies.add(v);
    if (ok) inp.value = '';
  });
  $('#invInput').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('#invAdd').click(); } });
  // Sync-by-code UI (#syncCopy/#syncUse/#syncInput) was removed from index.html - syncing now requires an
  // account (see renderSyncCode()); Sync.switchTo()/the code itself still exist internally since Sync.code
  // is also the guest local-cache key for saves/dismisses/channels on a single device, just with no more
  // UI to manually copy/paste it between devices.
  $('#pdfBtn').addEventListener('click', exportPDF);
  $('#csvBtn').addEventListener('click', exportCSV);


  /* ---------- live feed and AI briefing (Phase 2) ---------- */
  const REPO = 'romitrajput/QwickSignal', BRANCH = 'main';
  async function getJSON(name) {
    const urls = ['https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + name, name];
    for (const u of urls) {
      try {
        const r = await fetch(u + '?t=' + Date.now(), { cache: 'no-store' });
        if (r.ok) return await r.json();
      } catch (e) { /* try the next address */ }
    }
    return null;
  }
  function mapRules(x) {
    // free mode: the pipeline saved only an excerpt, so this phone sorts it with the keyword rules
    const t = Date.parse(x.published) || Date.now();
    const r = E.analyze(x.excerpt || x.headline, { headline: x.headline, date: (x.published || '').slice(0, 10) });
    return {
      id: 'L' + x.id, live: true, rules: true, headline: x.headline || r.headline, summary: r.summary || '', why: '',
      country: r.country, countryCode: r.countryCode, involved: r.involved, sector: r.sector, subsector: r.subsector,
      also: r.also, signals: r.signals, importance: r.importance, companies: r.companies, facts: r.facts,
      date: (x.published || '').slice(0, 10), text: x.excerpt || '', addedAt: t,
      sources: (x.sources || []).map(s => ({ name: s.name, url: s.url, at: Date.parse(s.at) || t })), related: [],
      video: x.video || null
    };
  }
  function mapLive(x) {
    if (x.ai === false) return mapRules(x);
    const t = Date.parse(x.published) || Date.now();
    const c = E.COUNTRY_BY_NAME[x.country] ? x.country : 'Global';
    return {
      id: 'L' + x.id, live: true, headline: x.headline || '', summary: x.summary || '', why: x.why_it_matters || '',
      country: c, countryCode: E.COUNTRY_BY_NAME[c].code, involved: x.involved || [],
      sector: E.SECTOR_NAMES.includes(x.sector) ? x.sector : 'Other', subsector: x.subsector || '', also: [], signals: [],
      importance: E.IMP_ORDER.includes(x.importance) ? x.importance : 'Medium',
      companies: x.companies || [], facts: x.facts || [], date: (x.published || '').slice(0, 10),
      text: (x.summary || '') + ' ' + (x.why_it_matters || ''), addedAt: t,
      sources: (x.sources || []).map(s => ({ name: s.name, url: s.url, at: Date.parse(s.at) || t })),
      related: (x.related || []).map(r => 'L' + r),
      video: x.video || null,
      // Headline images (image_intel.py): a real news photo Google's Custom Search index returned for this
      // headline, or null if none was found (or none was searched for yet - only Critical/High stories get
      // searched, see image_max_per_run/image_importance in sources.yml). Never re-hosted, just linked.
      image: (x.image && x.image.status === 'found' && x.image.url) ? { url: x.image.url, source: x.image.source || '' } : null
    };
  }
  const readCache = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const writeCache = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full */ } };

  let liveBusy = false;
  async function loadLive(manual) {
    if (liveBusy) return;                     // a load is already running, ignore extra taps
    liveBusy = true;
    $('#liveBar').classList.add('busy');      // makes the icon spin
    try {
      const prevIds = new Set(S.live.map(i => i.id)), prevSig = S.liveSig;
      let [feed, brief] = await Promise.all([getJSON('feed.json'), getJSON('briefing.json')]);
      let cached = false;
      if (feed && Array.isArray(feed.items)) writeCache('gni-feed', feed);
      else { feed = readCache('gni-feed'); cached = !!feed; }
      if (brief && brief.overview) writeCache('gni-brief', brief); else brief = readCache('gni-brief');
      const items = feed && Array.isArray(feed.items) ? feed.items : [];
      const sig = items.map(i => i.id + '|' + (i.updated || '') + '|' + (i.video ? (i.video.status || '') + (i.video.video_id || '') + (i.video.checked_at || '') : '')).join(',') +
        '|' + (feed && feed.video_meta ? feed.video_meta.status : '');
      S.lastLive = Date.now();
      if (!manual && S.liveMeta && sig === prevSig) return;   // silent check, nothing new: leave the screen alone
      S.live = items.map(mapLive);
      S.liveSig = sig;
      S.videoMeta = feed && feed.video_meta ? feed.video_meta : null;
      S.liveMeta = feed ? { at: Date.parse(feed.generated_at) || 0, cached } : null;
      S.brief = brief;
      renderAll(); renderBrief();
      // New-story detection runs on every load (manual pull or silent background poll), not just manual ones,
      // so a story that arrives while the person isn't actively refreshing still surfaces a notification.
      const freshItems = S.live.filter(i => !prevIds.has(i.id));
      const fresh = freshItems.length;
      if (!cached && fresh && prevIds.size) notifyNewStory(freshItems);
      if (manual) {
        // The toast's story count must match what Signals actually shows this visitor, not the pipeline's
        // raw total - S.live.length is every story across every source channel (e.g. 199), while most
        // visitors only follow a few of those channels (or see the owner-curated default list if they
        // follow none), so Signals itself only ever shows a filtered subset (e.g. 33). Showing the raw
        // total here was confusing ("199 stories refreshed" when only 33 appear) even though neither
        // number was wrong - they were just answering different questions. visibleCount applies the same
        // channelVisible()/itemStatus() filtering Signals, Export and Country Status already use, counted
        // against S.live only (not S.items) since this message is specifically about the live feed.
        const visibleCount = S.live.filter(it => itemStatus(it) !== 'dismissed' && itemStatus(it) !== 'expired' && channelVisible(it)).length;
        toast(!S.liveMeta ? 'The live feed is not set up yet.'
          : cached ? 'No connection. Showing the saved copy (' + visibleCount + ' stories).'
          : fresh && prevIds.size ? fresh + (fresh === 1 ? ' new story.' : ' new stories.')
          : 'Up to date. ' + visibleCount + ' stories in your feed.');
      }
    } finally {
      liveBusy = false;
      $('#liveBar').classList.remove('busy');
    }
  }

  // Jumps to a specific item's card in the Signals list - same behaviour the "goto" tap action and the AI
  // briefing's inline links use, factored out so the story-arrival notification can reuse it too.
  function gotoItem(id) {
    S.f = Object.assign(S.f, { country: '', sector: '', imp: '', q: '', range: 'all' }); $('#q').value = '';
    S.open.add(id);
    if (S.tab !== 'brief') setTab('brief');
    renderControls(); renderList();
    const t = document.querySelector('#view-brief .entry[data-id="' + id + '"]');
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let storyToastTimer = null;
  // Pops the "Waveform Arrival" notification for a newly-arrived live story. If several arrived in the same
  // poll, the single most important one is shown (matching how the manual-refresh toast instead gives a count).
  function notifyNewStory(freshItems) {
    if (!freshItems.length) return;
    const wrap = $('#storyToast');
    if (!wrap) return;
    const it = freshItems.slice().sort(byPriority)[0];
    const flag = flagOf(it.country);
    const kicker = flag + ' ' + esc(it.country) + ' · ' + esc(it.sector);
    wrap.classList.remove('show', 'hide');
    wrap.innerHTML = `<div class="stcard" data-id="${esc(it.id)}" role="button" tabindex="0">
        <div class="stsweep top"></div>
        <div class="stsweep bottom"></div>
        <div class="stwave"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="stbody">
          <div class="stkicker">${kicker}</div>
          <div class="sthead">${esc(it.headline)}</div>
        </div>
        <button class="stgo" type="button">Check Now</button>
      </div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
    const dismiss = () => {
      if (!wrap.classList.contains('show')) return;
      wrap.classList.remove('show'); wrap.classList.add('hide');
      setTimeout(() => { wrap.innerHTML = ''; wrap.classList.remove('hide'); }, 300);
    };
    const open = () => { dismiss(); gotoItem(it.id); };
    wrap.querySelector('.stgo').addEventListener('click', open);
    wrap.querySelector('.stcard').addEventListener('click', open);
    clearTimeout(storyToastTimer);
    storyToastTimer = setTimeout(dismiss, 6000);
  }
  function renderLiveBar() {
    // Small equalizer bars instead of a spinning-arrows icon - still while idle, pulsing while a refresh
    // is in flight (see .livebar.busy in index.html), matching the landing screen's loading indicator.
    $('#liveBar').innerHTML = '<button class="iconbtn" data-act="refresh" aria-label="Refresh" title="Refresh">' +
      '<span class="refresh-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></button>';
  }
  function renderBrief() {
    const b = S.brief, box = $('#aiBrief');
    if (!b) { box.innerHTML = ''; return; }
    const item = id => S.live.find(i => i.id === 'L' + id);
    const flags = cs => (cs || []).map(c => flagOf(c)).join(' ');
    const crit = (b.critical || []).map(c => ({ it: item(c.item_id), note: c.note })).filter(c => c.it);
    const themes = (b.themes || []).map(t => `<li><b>${esc(t.title)}</b> <span class="fl">${flags(t.countries)}</span>
        <p>${esc(t.what_changed)}</p>${t.watch_next ? `<p class="next">Watch next: ${esc(t.watch_next)}</p>` : ''}</li>`).join('');
    const chains = (b.impact_chains || []).map(c => `<li><b>${esc(c.title)}</b> <span class="conf">${esc(c.confidence)} confidence</span>
        <ol class="chain">${(c.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol></li>`).join('');
    const watch = (b.watchlist || []).map(w => `<li>${esc(w)}</li>`).join('');
    box.innerHTML = `<section class="ai">
      <div class="aihead"><h2>AI briefing</h2><span>${esc(b.date_label || '')}</span></div>
      <p class="ov">${esc(b.overview)}</p>
      ${crit.length ? `<h3>Top developments</h3><ul class="tops">${crit.map(c => `<li><button class="link" data-act="goto" data-id="${c.it.id}">${flagOf(c.it.country)} ${esc(c.it.headline)}</button><span>${esc(c.note)}</span></li>`).join('')}</ul>` : ''}
      ${(themes || chains || watch) ? `<details><summary>Themes and impact chains</summary>
        ${themes ? `<h3>Themes</h3><ul class="themes">${themes}</ul>` : ''}
        ${chains ? `<h3>Impact chains</h3><ul class="chains">${chains}</ul>` : ''}
        ${watch ? `<h3>Watchlist</h3><ul class="watch">${watch}</ul>` : ''}
      </details>` : ''}
    </section>`;
  }
  const AUTO_REFRESH_MS = 2 * 60e3;   // the pipeline publishes every 5 minutes; checking every 2 keeps the screen close behind it
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - S.lastLive >= AUTO_REFRESH_MS) loadLive(); });
  setInterval(() => { if (!document.hidden && Date.now() - S.lastLive >= AUTO_REFRESH_MS) loadLive(); }, 60e3);

  // Install-as-app: the header's Install button stays hidden until the browser tells us installing is actually
  // possible (beforeinstallprompt), then triggers the browser's real install flow. Chrome/Edge/most Android
  // browsers fire this; iOS Safari never does (no native install prompt there - "Add to Home Screen" via the
  // Share sheet is the only route, so the button stays hidden and isn't a bug on iOS).
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', ev => {
    ev.preventDefault();
    deferredInstallPrompt = ev;
    const btn = $('[data-install]');
    if (btn) btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = $('[data-install]');
    if (btn) btn.hidden = true;
  });
  document.addEventListener('click', async ev => {
    if (!ev.target.closest('[data-install]') || !deferredInstallPrompt) return;
    const btn = $('[data-install]');
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (btn) btn.hidden = true;
  });

  /* ---------- splash ---------- */
  // Shown on every cold start (see #splash in index.html, written inline in the HTML so the first paint
  // already has it - no white flash while app.js loads/parses). Purely a brand beat: it never blocks or
  // waits on anything else in start() below, it just sits on top for a fixed ~1.1s minimum, then fades.
  // A minimum rather than "hide once ready" so it never flashes for 50ms on a fast device/warm cache -
  // long enough to register as intentional, short enough not to feel like a delay.
  const SPLASH_MIN_MS = 1100;
  function dismissSplash() {
    const el = $('#splash');
    if (!el) return;
    el.classList.add('splash-out');
    setTimeout(() => el.remove(), 500);   // matches the CSS opacity transition, then drop it from the DOM
  }

  /* ---------- start ---------- */
  (async function start() {
    setTimeout(dismissSplash, SPLASH_MIN_MS);
    currentLang = loadLang();
    applyI18n();
    const langSel = $('#langSelect');
    if (langSel) langSel.addEventListener('change', ev => setLang(ev.target.value));
    $('#today').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const ok = await DB.init();
    if (ok) S.items = await DB.all(); else toast('Storage is blocked in this browser. Items will be lost when you close the page.');
    const qs = new URLSearchParams(location.search);
    const shared = ['title', 'text', 'url'].map(k => qs.get(k)).filter(Boolean).join('\n');
    if (shared) {
      history.replaceState(null, '', location.pathname);
      ingestText(shared, 'Shared to QwickSignal').then(st => {
        if (st.added + st.dup) { toast('Added shared text: ' + summariseStats(st)); setTab('brief'); }
        else toast('Shared text was too short to use.');
      });
    }
    setTab('brief'); renderAll(); renderLiveBar(); renderAccount();
    Landing.init();   // shows the landing screen over everything above if this device hasn't chosen yet
    // Opening the app from a push notification when no tab was already open lands here as a plain URL
    // hash (sw.js's self.clients.openWindow('./#' + id)) - jump to that story once the first live feed
    // load below has populated S.live, so the id is actually there to find.
    const hashGotoId = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : '';
    if (hashGotoId) history.replaceState(null, '', location.pathname);
    loadLive().then(() => { if (hashGotoId) gotoItem(hashGotoId); });
    // The default-channels list is public read, so it loads independently of sign-in - a guest should never
    // see a blank feed while waiting for anything auth-related.
    DefaultChannels.load().then(() => renderAll());
    // Phase E: restore any signed-in session first, so Sync.init() reads the right doc (account vs. guest
    // code) on the very first pull - neither ever blocks the news feed itself from loading.
    Auth.restore().then(() => Sync.init()).then(() => { renderAccount(); renderSyncCode(); renderChannels(); renderAll(); });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(() => Push.resync()).catch(() => { }));
      // A push notification's "Check Now" tap (see sw.js's notificationclick): an already-open tab gets
      // focused and sent this message directly instead of relying on the hash above.
      navigator.serviceWorker.addEventListener('message', ev => {
        if (ev.data && ev.data.type === 'qs-goto' && ev.data.id) gotoItem(ev.data.id);
      });
    }
  })();
})();
