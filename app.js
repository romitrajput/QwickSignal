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
    // Tickers (field 5) added for these so a watchlist entry typed as a ticker - "NVDA", "GOOGL" - is
    // recognised as the company (logo, and View Chart's symbol) instead of being guessed from the letters.
    'Apple|US|Technology||AAPL', 'Microsoft|US|Technology||MSFT', 'Alphabet|US|Technology|Google|GOOGL',
    'Amazon|US|Consumer||AMZN', 'Meta|US|Technology||META', 'Nvidia|US|Semiconductors||NVDA', 'Tesla|US|Automotive||TSLA', 'Intel|US|Semiconductors||INTC',
    'AMD|US|Semiconductors||AMD', 'Micron|US|Semiconductors||MU', 'Qualcomm|US|Semiconductors||QCOM', 'Broadcom|US|Semiconductors||AVGO',
    'Applied Materials|US|Semiconductors||AMAT', 'Lam Research|US|Semiconductors||LRCX', 'KLA|US|Semiconductors||KLAC',
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

  // A small hand-curated name -> real web domain table, for well-known companies where a generic name-to-
  // domain guess (below) would be wrong or just not exist - e.g. "JSW Steel" isn't jswsteel.com, it's
  // jsw.in; "ICICI Bank" isn't icicibank.com (that domain exists but isn't ICICI's own site), it's
  // icicibank.com actually... the point being: some of these needed a human to actually check, not guessed.
  // NOT every COMPANIES entry needs one - most Western single-word names (Apple, Tesla, Nvidia, ...) guess
  // correctly from the name alone (see the generic fallback below), so this only covers the cases that don't.
  // Same spirit as COMPANY_ROWS' verified-ticker field: a short, deliberately incomplete list of confirmed-
  // correct answers that wins over a guess, not an attempt at full coverage.
  const COMPANY_DOMAIN = {
    'jsw steel': 'jsw.in', 'tata motors': 'tatamotors.com', 'tata steel': 'tatasteel.com',
    'tata consultancy services': 'tcs.com', 'tcs': 'tcs.com', 'tata power': 'tatapower.com',
    'reliance industries': 'ril.com', 'bharti airtel': 'airtel.in', 'hdfc bank': 'hdfcbank.com',
    'icici bank': 'icicibank.com', 'state bank of india': 'sbi.co.in', 'axis bank': 'axisbank.com',
    'kotak mahindra bank': 'kotak.com', 'infosys': 'infosys.com', 'wipro': 'wipro.com',
    'hcltech': 'hcltech.com', 'hcl technologies': 'hcltech.com', 'larsen and toubro': 'larsentoubro.com',
    'maruti suzuki': 'marutisuzuki.com', 'mahindra and mahindra': 'mahindra.com', 'bajaj auto': 'bajajauto.com',
    'bajaj finance': 'bajajfinserv.in', 'hindustan unilever': 'hul.co.in', 'itc': 'itcportal.com',
    'asian paints': 'asianpaints.com', 'nestle': 'nestle.com', 'marico': 'marico.com',
    'sun pharma': 'sunpharma.com', 'sun pharmaceutical': 'sunpharma.com', "dr reddy's": 'drreddys.com',
    'cipla': 'cipla.com', 'adani enterprises': 'adani.com', 'adani ports': 'adaniports.com',
    'adani green energy': 'adanigreenenergy.com', 'ntpc': 'ntpc.co.in', 'power grid corporation': 'powergrid.in',
    'coal india': 'coalindia.in', 'ongc': 'ongcindia.com', 'sail': 'sail.co.in', 'nmdc': 'nmdc.co.in',
    'vodafone idea': 'myvi.in', 'zee entertainment': 'zee.com', 'ultratech cement': 'ultratechcement.com',
    'grasim industries': 'grasim.com', 'dlf': 'dlf.in', 'godrej properties': 'godrejproperties.com',
    'ambuja cements': 'ambujacement.com', 'acc': 'acclimited.com', 'alphabet': 'google.com', 'google': 'google.com',   // abc.xyz is Alphabet's holding-company site; GOOGL holders know the G
    'meta': 'meta.com', 'exxonmobil': 'exxonmobil.com', 'jpmorgan': 'jpmorganchase.com',
    'goldman sachs': 'goldmansachs.com', 'general motors': 'gm.com', 'tsmc': 'tsmc.com', 'sk hynix': 'skhynix.com',
    'tokyo electron': 'tel.com', 'softbank': 'group.softbank', 'byd': 'byd.com', 'huawei': 'huawei.com',
    'alibaba': 'alibaba.com', 'tencent': 'tencent.com', 'catl': 'catl.com', 'smic': 'smics.com',
    'xiaomi': 'mi.com', 'volkswagen': 'vw.com', 'mercedes-benz': 'mercedes-benz.com', 'saudi aramco': 'aramco.com',
    'shell': 'shell.com', 'rio tinto': 'riotinto.com', 'bhp': 'bhp.com', 'vale': 'vale.com',
    'novo nordisk': 'novonordisk.com', 'persistent systems': 'persistent.com'
  };
  // Best-effort logo lookup, same philosophy as guessSymbol() right above: never a hard claim, always a
  // starting guess the UI can safely fall back away from if it's wrong (see companyLogoHTML() in the UI
  // layer, which swaps back to a plain initial-letter circle on any image load failure - a wrong/missing
  // domain guess here is a silently-handled cosmetic miss, never a broken-image icon the user actually sees).
  // 1) COMPANY_DOMAIN's hand-checked answer always wins, keyed the same way as COMPANIES/aliases (lowercase
  //    exact match on name or a known alias). 2) Otherwise, strip the name down to letters and guess
  //    "name.com" - right often enough for simple single-word Western names (tesla.com, nvidia.com,
  //    apple.com), and for ".in"-flavored Indian names tends to need the curated table above instead, which
  //    is exactly why that table exists. Returns null (no logo attempted at all) only for a name that
  //    produces zero letters once stripped - genuinely nothing to guess from.
  // Second share classes and old tickers that point at a company already in COMPANIES.
  const EXTRA_TICKERS = { goog: 'Alphabet', fb: 'Meta' };
  function guessLogoDomain(name) {
    const n = name.toLowerCase().trim();
    // Tickers count as well as names: a watchlist entry typed "Nvda" used to miss every name and alias,
    // fall through to the letters-plus-".com" guess below, and show whichever unrelated company happens to
    // own nvda.com. Exact matches only, so a short ticker like "F" (Ford) can't hit by accident.
    const viaExtra = EXTRA_TICKERS[n] ? EXTRA_TICKERS[n].toLowerCase() : null;
    const known = COMPANIES.find(c => c.name.toLowerCase() === n || c.aliases.some(a => a.toLowerCase() === n)
      || (c.ticker && c.ticker.toLowerCase() === n) || (viaExtra && c.name.toLowerCase() === viaExtra));
    if (known) {
      const key = known.name.toLowerCase();
      if (COMPANY_DOMAIN[key]) return COMPANY_DOMAIN[key];
      for (const a of known.aliases) { if (COMPANY_DOMAIN[a.toLowerCase()]) return COMPANY_DOMAIN[a.toLowerCase()]; }
    }
    if (COMPANY_DOMAIN[n]) return COMPANY_DOMAIN[n];
    // Guess from the RECOGNISED company's name when there is one, not from what was typed: "Nvda" is known
    // to be Nvidia, so the guess is nvidia.com - building it from the typed letters gave nvda.com.
    const stripped = (known ? known.name.toLowerCase() : n).replace(/[^a-z0-9]/g, '');
    if (!stripped) return null;
    return stripped + '.com';
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
  const INDIA_MARKET_CUES = /₹|\bRs\.?\s?\d|\b\d[\d,.]*\s?(?:cr|crore|lakh)\b|\b(?:NSE|BSE|Nifty|Sensex|SEBI|F&O|GIFT City)\b/gi;
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
    // Indian market posts (results, concalls, broker notes) are full of rupee amounts, "Cr" and Indian exchange
    // words but rarely say "India" - and often mention US or other markets in passing ("US stocks: GIFT City
    // approval"), which used to pull a story about an Indian company into United States or Global. Those
    // markers are a strong sign the story is about India.
    const inCues = (text.match(INDIA_MARKET_CUES) || []).length;
    if (inCues) scores.set('India', (scores.get('India') || 0) + Math.min(10, 5 * inCues));
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
    COMPANIES, guessSymbol, guessSectorIndex, guessLogoDomain
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Engine;

/* ================= Part 2: interface ================= */
if (typeof document !== 'undefined') (function () {
  const E = Engine;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  // Links that come from the data files must be plain http(s); anything else (javascript:, data:) becomes '#'.
  const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '#';
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
      linkPages: 'Link Pages', settings: 'Settings', signals: 'Signals', saved: 'Saved', export: 'Export', community: 'Sentiment board',
      landingTitle: 'QwickSignal', landingTag: 'Sort news, messages and reports by country, sector and importance.',
      landingOr: 'or', continueAsGuest: 'Continue as guest',
      landingGuestNote: "You can look around and follow the default channels without an account. Sign in any time later from Settings to keep your own saved articles and channels.",
      account: 'Account', accountSub: "Optional. Sign in to keep your own saved articles, dismissed items and followed channels tied to your account instead of a code - and separate from anyone else's.",
      signInEmail: 'Email', signInPassword: 'Password', signIn: 'Sign in', createAccount: 'Create account', forgotPw: 'Forgot password?',
      signOut: 'Sign out', signedInAs: 'Signed in as',
      telegram: 'Telegram', tgPlaceholder: 't/channelname or t.me link', addBtn: '+ Add',
      following: 'Following', follow: 'Follow', remove: 'Remove', removeShared: 'Remove for everyone', setDefault: 'Set default', removeDefault: 'Remove default', defaultBadge: 'Default',
      noChannelsYet: 'No channels yet. Add one above to start following it.',
      couldntLoadChannels: 'Couldn’t load the channel list right now.', checkConnection: 'Check your connection.',
      syncHeading: 'Sync across your devices', syncSub: 'This code links your saved articles and followed channels on another phone or browser. Anyone with the code can use it, so keep it to yourself and your own devices.',
      searchPlaceholder: 'Search',
      allPriorities: 'All priorities', critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
      clearFilters: 'Clear filters',
      savedLede: "Stories you've saved stay here even after they'd normally drop off Signals after 24 hours.",
      exportLede: "Save a report or the raw table. Files go to your phone's Downloads.",
      downloadPdf: 'Download QwickSignal PDF', downloadCsv: 'Download CSV',
      onThisPhone: 'On this phone', clearAllData: 'Clear all data',
      refresh: 'Refresh',
      loginToLinkChannels: 'Log in to link Telegram channels.',
      appearanceHeading: 'Appearance', appearanceSub: 'Choose how QwickSignal looks on this device.',
      themeSystem: 'Default', themeLight: 'Light', themeDark: 'Dark',
      appetiteHeading: 'Daily appetite', appetiteSub: 'Say how much news you want in a day. QwickSignal works out which priorities to lead with, and adjusts as the volume changes.',
      appetiteAll: 'Everything', appetitePerDay: 'stories a day',
      appetiteResolved: 'To land near that, QwickSignal is holding the bar at',
      appetiteApprox: 'Priorities come in four steps, so this is the closest it can get.',
      appetiteFloorNote: "You asked for fewer, but going below this would mean holding back Critical stories.",
      appetiteOffNote: 'No filtering. Everything in your channels reaches the feed.',
      appetiteNoData: 'Once stories come in, this will show how many a day your channels produce.',
      appetiteLadderHead: 'What your channels are producing right now, per day',
      appetiteKeptNote: 'Nothing is ever deleted. Lower-priority stories stay in the app, one tap from the bottom of your feed.',
      appetitePushNote: 'This also decides which stories are allowed to notify you.',
      appetiteDoneTitle: "That's your news for today.",
      appetiteRestSub: 'lower-priority stories are still here.',
      appetiteRestBtn: 'Show the rest', appetiteShowingAll: 'Showing everything, including stories below your daily amount.',
      appetiteFoldBtn: 'Back to my daily amount',
      notifAppetiteManaged: 'Set by your daily appetite. Changing it here switches that off.',
      notifHeading: 'Notifications', notifSub: "Get a notification on this device when a new story arrives - even when the app isn't open.",
      notifEnable: 'Turn on notifications', notifDisable: 'Turn off notifications', notifOn: 'Notifications are on for this device.',
      notifUnsupported: "This browser doesn't support push notifications.",
      notifBlocked: 'Notifications are blocked for this site. Allow them in your browser/site settings, then try again.',
      notifFailed: "Couldn't turn on notifications. Check your connection and try again.",
      notifTierLabel: 'Notify me about', notifTierHint: 'Lower tiers include everything above them.',
      notifImpCritical: 'Critical only', notifImpHigh: 'High and above', notifImpMedium: 'Medium and above', notifImpLow: 'Everything',
      notifQuietLabel: 'Quiet hours (10pm - 7am)', notifQuietHint: 'Only Critical stories come through overnight.',
      notifDigestLabel: 'Summary', notifDigestOff: 'Off', notifDigestDaily: 'Daily', notifDigestWeekly: 'Weekly',
      notifDigestHint: 'One morning notification rounding up recent stories, instead of each one as it lands.',
      notifInvestLabel: 'Stories from my Investment watchlist', notifInvestHint: 'News about your tracked companies and posts from your linked Investment channels, combined into the same alerts as your news. They come through even below your priority setting.',
      investFromChannels: 'From your linked channels', investChannelsEmpty: 'Nothing from your linked channels in the last 24 hours. A newly linked channel starts showing up within about 30 minutes.',
      notifInvestNeedCompanies: 'Track companies or link channels in the Investment tab to turn this on.',
      notifPacingNote: 'Alerts are grouped: at most one every 20–40 minutes, bundling whatever arrived in between. Critical stories come straight away.',
      getAppHeading: 'Get the app', getAppAndroidTab: 'Android', getAppIosTab: 'iPhone',
      getAppSub: 'Download the installable app (one file, zipped). Unzip it, then tap the .apk to install - you may need to allow "install unknown apps" for your browser once.', getAppBtn: 'Download QwickSignal.zip',
      getAppIosStep1: 'Open qwicksignal.netlify.app in Safari (it has to be Safari, not Chrome).', getAppIosStep2: 'Tap the Share icon, then "Add to Home Screen".', getAppIosStep3: 'Tap "Add" - QwickSignal now opens like a regular app, no browser bar.',
      getAppIosNote: 'Notifications work the same way after this - iOS supports real push notifications for home-screen apps on iOS 16.4 and later.',
      feedbackHeading: 'Feedback & support', feedbackSub: 'Found a bug, or have a suggestion? Send it here - it goes straight to the app owner.',
      agGoToAccount: 'Go to Account', agMaybeLater: 'Maybe later',
      agAddChannelsTitle: 'Customize your news and investment feed by signing in', agAddChannelsBody: 'Sign in to link your own Telegram channels for News and Investment. It\'s free, and your channels, companies and saved stories stay with you on every device.',
      agSyncTitle: 'Log in to sync your devices', agSyncBody: 'Syncing across devices now needs a free account - it keeps everything a little safer and tied to you, not a shareable code.',
      feedbackLoginTitle: 'Log in to send feedback', feedbackLoginBody: 'Creating a free account lets the app owner follow up with you if needed.',
      ticketKindBug: 'Bug', ticketKindFeedback: 'Feedback',
      ticketPrefixBug: 'Bug: ', ticketPrefixFeedback: 'Feedback: ',
      ticketPlaceholder: 'Describe the issue or idea…', ticketSend: 'Submit', ticketSent: 'Thanks - sent to the app owner.',
      ticketFailed: "Couldn't send that. Check your connection and try again.", ticketEmpty: 'Write a few words first.',
      ticketSentWithNumber: 'Sent - your ticket number is {num}. Keep it for reference.',
      ticketAttachHeading: 'Attachment (optional)', ticketAttachAdd: 'Add a screenshot or file',
      ticketAttachRemove: 'Remove', ticketAttachTooBig: 'That file is too large (max 8 MB).',
      ticketAttachUploading: 'Uploading attachment…', ticketAttachFailed: "Couldn't upload the attachment - sent the ticket without it.",
      ticketAdminHeading: 'Tickets', ticketAdminEmpty: 'No tickets yet.', ticketAdminLoadFailed: "Couldn't load tickets.",
      ticketStatusOpen: 'Open', ticketStatusDone: 'Resolved', ticketMarkDone: 'Mark resolved', ticketMarkOpen: 'Reopen',
      ticketAdminAttachment: 'Attachment',
      modeNews: 'Signal', modeInvestment: 'Investment',
      telegramNewsSub: 'Link Telegram channels to follow for your Signal/News feed.',
      telegramInvestHeading: 'Telegram channels for Investment', telegramInvestSub: "Link Telegram channels you follow specifically for investment/market news - kept separate from your News channels above. Their posts appear in your Investment tab within about 30 minutes.",
      investHeading: 'Investment watchlist', investSub: "Track companies you've invested in, or are watching, to see their news grouped separately in the Investment tab.",
      investPlaceholder: 'Company name', loginToTrackCompanies: 'Log in to track companies.',
      agTrackCompanyTitle: 'Log in to track companies', agTrackCompanyBody: 'Creating a free account keeps your investment watchlist with you across devices.',
      investEmptyTitle: 'Track companies to see investment-related news.', investEmptyBtn: 'Add companies to track',
      impTitle: 'Import from your broker', impPick: 'Choose holdings file', impSub: 'Download your holdings from your broker (CSV or Excel), or your depository statement (PDF), and add them in one go.',
      impPrivate: 'Read on your phone only. The file is never uploaded.', impReading: 'Reading your file…', impNone: 'No stocks found in this file. Check it is a holdings report or a depository statement.',
      impXls: 'Old .xls files cannot be read. Open it in Excel and save as .xlsx or CSV, then choose it again.', impFail: 'This file could not be read. Try the CSV or .xlsx holdings report.',
      impPdfFail: 'This statement could not be read. Check the password, or use your broker holdings CSV instead.', impPassTitle: 'Enter the statement password',
      impPassBody: 'Depository statements are locked. The password is usually your PAN in capital letters (some also add your date of birth).', impUnlock: 'Unlock', impPassWrong: 'That password did not work. Try again.',
      impFound: '{n} stocks found', impReview: 'Tick the stocks to add to your watchlist.', impUnknown: 'Not in our company list yet. News and charts may be limited.', impHave: 'already on your list',
      impAdd: 'Add to watchlist', impAdded: '{n} stocks added to your watchlist.', impNothing: 'Nothing new to add.', impDone: 'OK',
      impHow: 'Where to find it: Zerodha Console > Portfolio > Holdings > download. Groww > Profile > Reports > Stocks holdings. Upstox, ICICI Direct and others: Reports > Holdings. For all brokers at once, use your CDSL or NSDL statement.',
      sbCrowdToday: 'Retail investor mood today', bvDisagree: 'Brokers and retail investors disagree.', bvLeanBuy: 'Brokers lean Buy,', bvLeanSell: 'Brokers lean Sell,', bvLeanSplit: 'Brokers are split,',
      bvCrowdBull: 'retail investors lean Bullish.', bvCrowdBear: 'retail investors lean Bearish.', bvCrowdMix: 'retail investors are split.',
      sbTracker: 'person tracks this stock', sbTrackers: 'people track this stock',
      lpHint: 'Press and hold a stock to remove it', removeStock: 'Remove stock',
      tileChart: 'Chart', tileNews: 'News', tileSent: 'Sentiment',
      bvTitle: 'Broker view', bvNone: 'No broker calls on this stock in the last 45 days. They appear here when a linked channel posts one.', bvLoading: 'Loading broker calls…',
      bvConsensus: 'Consensus', bvBullish: 'Bullish', bvNeutral: 'Mixed', bvBearish: 'Cautious', bvBuy: 'Buy', bvHold: 'Hold', bvSell: 'Sell',
      bvAvgTarget: 'Avg target', bvRaised: 'Target raised', bvCut: 'Target cut', bvUpgrade: 'Upgrade', bvDowngrade: 'Downgrade', bvInitiate: 'New coverage', bvMaintain: 'Reiterated',
      bvMomentum: 'Last 30 days', bvMoves: 'raised', bvMovesDown: 'cut', bvBrokers: 'brokers', bvCrowd: 'Retail investors', bvOpenBoard: 'Open sentiment board', bvNoVotes: 'No votes yet',
      bvFoot: 'Read from public broker-call posts on linked channels. Not investment advice.', bvSource: 'Source', bvOn: 'brokers on the board',
      investNoNews: 'No recent news for this company.', investRemove: 'Remove',
      investNoNewsHint: "This updates automatically as new stories come in - it's not a sign anything is wrong.",
      investAllSectors: 'All sectors',
      viewChart: 'View Chart', chartLoading: 'Loading chart…',
      chartStock: 'Stock', chartSectorFallback: 'Sector',
      obSkip: 'Skip', obNext: 'Next', obDone: 'Got it',
      obStep1Title: 'Country-wise news', obStep1Body: 'Each flag is a country with stories waiting - tap one to jump straight to its news.',
      obStep2Title: 'Search', obStep2Body: 'Search across every story in your feed - headlines, summaries, and company names.',
      obStep3Title: 'Country, sector & priority', obStep3Body: 'Narrow the feed to one country or sector, or show only Critical/High priority stories.',
      obStep4Title: 'A news card', obStep4Body: 'Tap a story to read more, swipe right to save it, or swipe left to dismiss it.',
      obStep5Title: 'Saved', obStep5Body: 'Swipe a story right, or tap Save, to keep it here. Saved stories stay with your account until you remove them, even after signing out.',
      obStep6Title: 'Investment', obStep6Body: 'News for the companies in your watchlist, with their logos. Link a company’s Telegram channels in Settings to pull in more.',
      obInvCardTitle: 'Your stocks in one place', obInvCardBody: 'Each stock you track has a card. Chart shows its price chart, News opens every story about the company, and Sentiment shows what brokers rate it and their target prices.',
      obInvEmptyTitle: 'Investment', obInvEmptyBody: 'Add the stocks you own or follow. Each gets a card with its chart, its news, and broker ratings and target prices.',
      obInvOtherTitle: 'Other companies in the news', obInvOtherBody: 'News about companies you don’t track is listed here, below your own stocks.',
      obBoardTitle: 'Sentiment board', obBoardBody: 'The mood on your stocks: broker ratings, how many people track each one, and today’s Bull or Bear votes. Vote once a day and add a comment with your reason.',
      obBoardEmptyTitle: 'Sentiment board', obBoardEmptyBody: 'Once you track stocks, see broker ratings and other investors’ votes on them here, and vote and comment yourself.',
      obExploreTitle: 'Explore channels', obExploreBody: 'Every Telegram channel on QwickSignal. Link the ones you want to your News or Investment feed, and tap i to see what share of users follow each.',
      obImportTitle: 'Your watchlist and channels', obImportBody: 'Add stocks by name, or import your holdings file from Zerodha, Groww or another broker to add them all at once. Investment channels are linked here too.',
      obSavedTitle: 'Saved stories', obSavedBody: 'Stories you save are kept here, with News and Investment shown separately.',
      obStep7Title: 'Settings', obStep7Body: 'Also here: Appearance, Language, Daily appetite (how many stories a day), Notifications, Export, Feedback, and Replay the tour any time.',
      obStep8Title: 'Sentiment board', obStep8Body: 'Every stock users track, with today’s bullish/bearish mood. Vote once a day per stock, add your reason, and search any stock.',
      pulseLabel: 'Sentiment of the Users:', pulseBull: 'Bullish', pulseBear: 'Bearish',
      communityPending: 'Votes will appear here shortly.',
      agPulseTitle: 'Log in to vote', agPulseBody: 'A free account keeps one vote per person honest - no limit on reading, just on voting.',
      notifNewsLabel: 'News notifications',
      notifNewsHint: 'Important stories from your News feed.',
      notifStockLabel: 'Stock notifications',
      notifStockHint: 'News about the companies you track and posts from your Investment channels. These come through even below your priority setting.',
      notifSlotsLabel: 'Notification times',
      notifSlotsHint: 'News notifications arrive at 9 am, 1 pm, 4 pm, 7 pm and 10 pm (your time). Each one rounds up what came in since the last, most important first.',
      notifPerDay: 'Up to {n} notifications a day. Critical stories lead the next one.',
      notifBothOff: 'Both are off, so no notifications will be sent. Turn one on to get them.',
      sbNoVotes: 'No votes in the last 24 hours yet. Be the first.',
      sbVote: 'vote today',
      sbVotes: 'votes today',
      sbYourList: 'Your list',
      sbYourView: 'Your view today:',
      sbChangeHint: 'You can change it any time today.',
      sbWhy: 'Why? (optional)',
      sbWhyPh: 'Share your reason - results, valuation, news, chart… (up to 2000 characters)',
      sbCancel: 'Cancel',
      sbPost: 'Post vote',
      sbReasons: 'Reasons',
      sbDelete: 'Delete',
      appetiteAllShort: 'All',
      savedNewsHead: 'News',
      savedInvestHead: 'Investment',
      darkMode: 'Dark mode',
      languageHeading: 'Language',
      moreOptions: 'More options for',
      justForMe: 'just for me',
      ticketStatusProgress: 'In progress',
      ticketMarkProgress: 'Working on it',
      ticketReplyLabel: 'Note to the sender (they will see this)',
      ticketReplyPh: 'e.g. Fixed in today\'s update - thanks for reporting!',
      ticketNeedReason: 'Add a short note for the sender before marking it resolved.',
      ticketSavedDone: 'Marked resolved. The sender will see your note.',
      ticketSavedProgress: 'Marked in progress. The sender will see your note.',
      ticketSavedOpen: 'Reopened.',
      ticketDelete: 'Delete ticket',
      ticketDeleted: 'Ticket deleted.',
      ticketUpdateToast: 'Update on your ticket',
      ticketView: 'View',
      ticketMine: 'Your tickets',
      ticketNew: 'New',
      ticketOwnerReply: 'Reply from QwickSignal',
      ticketUpdatesSub: '{n} update(s) on your tickets',
      sbGuestNote: 'Sign in to vote and share your reason. Anyone can read the board.',
      sbGuestBtn: 'Sign in to vote',
      sbHoldHint: 'Your reason. Press and hold for options.',
      sbDeleted: 'Reason deleted.',
      undo: 'Undo',
      sbNoReasons: 'No reasons posted yet.',
      sbShowAll: 'Show all',
      sbOffline: 'Can’t reach the board right now - showing what this device last saw.',
      sbNoMatch: 'No stock matches that search.',
      sbEmpty: 'No stocks yet. Add companies to your watchlist in Settings and they appear here for everyone to vote on.',
      sbMore: 'Show more',
      sbSearchPh: 'Search a stock',
      sbNote: 'The stocks on your watchlist. Today’s mood: votes from the last 24 hours, one per person per stock. Opinions of users, not investment advice.',
      sbPosted: 'Vote posted',
      sbFailed: 'Couldn’t post - check your connection and try again.',
      sbDeleteConfirm: 'Delete this reason? Your vote is removed with it.',
      agBoardTitle: 'Log in to vote',
      agBoardBody: 'A free account keeps it to one vote per person per stock each day. Reading the board needs no account.',
      obStepRTitle: 'Refresh the news', obStepRBody: 'The five bars beside QwickSignal are the refresh button. Tap them any time to fetch the latest stories. They pulse while loading.',
      obStep0Title: 'While you were away',
      obStep0Body: 'When you come back, this card sums up what changed since your last visit - tap a line to jump to it.',
      obReplay: 'Replay the tour'
    },
    hi: {
      linkPages: 'लिंक पेज', settings: 'सेटिंग्स', signals: 'सिग्नल्स', saved: 'सेव किए गए', export: 'एक्सपोर्ट', community: 'सेंटिमेंट बोर्ड',
      landingTitle: 'QwickSignal', landingTag: 'खबरों, संदेशों और रिपोर्ट को देश, क्षेत्र और महत्व के अनुसार छाँटें।',
      landingOr: 'या', continueAsGuest: 'गेस्ट के रूप में जारी रखें',
      landingGuestNote: 'आप बिना खाते के भी देख सकते हैं और डिफ़ॉल्ट चैनल फॉलो कर सकते हैं। बाद में कभी भी सेटिंग्स से साइन इन करके अपने सेव किए गए लेख और चैनल रख सकते हैं।',
      account: 'खाता', accountSub: 'वैकल्पिक। अपने सेव किए गए लेख, हटाए गए आइटम और फॉलो किए गए चैनल किसी कोड की बजाय अपने खाते से जोड़ने के लिए साइन इन करें - और बाकी सभी से अलग रखें।',
      signInEmail: 'ईमेल', signInPassword: 'पासवर्ड', signIn: 'साइन इन करें', createAccount: 'खाता बनाएं', forgotPw: 'पासवर्ड भूल गए?',
      signOut: 'साइन आउट', signedInAs: 'इस रूप में साइन इन है',
      telegram: 'टेलीग्राम', tgPlaceholder: 't/channelname या t.me लिंक', addBtn: '+ जोड़ें',
      following: 'फॉलो कर रहे हैं', follow: 'फॉलो करें', remove: 'हटाएं', removeShared: 'सभी के लिए हटाएं', setDefault: 'डिफ़ॉल्ट बनाएं', removeDefault: 'डिफ़ॉल्ट हटाएं', defaultBadge: 'डिफ़ॉल्ट',
      noChannelsYet: 'अभी कोई चैनल नहीं है। फॉलो करने के लिए ऊपर एक जोड़ें।',
      couldntLoadChannels: 'अभी चैनल सूची लोड नहीं हो सकी।', checkConnection: 'अपना कनेक्शन जांचें।',
      syncHeading: 'अपने डिवाइस में सिंक करें', syncSub: 'यह कोड आपके सेव किए गए लेख और फॉलो किए गए चैनल किसी दूसरे फोन या ब्राउज़र से जोड़ता है। कोड जिसके पास भी है वह इसे इस्तेमाल कर सकता है, इसलिए इसे अपने और अपने डिवाइस तक सीमित रखें।',
      searchPlaceholder: 'खोजें',
      allPriorities: 'सभी प्राथमिकताएं', critical: 'गंभीर', high: 'उच्च', medium: 'मध्यम', low: 'निम्न',
      clearFilters: 'फ़िल्टर हटाएं',
      savedLede: 'आपके सेव किए गए लेख यहां बने रहते हैं, भले ही वे 24 घंटे बाद सिग्नल्स से हट जाते हों।',
      exportLede: 'रिपोर्ट या रॉ टेबल सेव करें। फ़ाइलें आपके फोन के डाउनलोड्स में जाएंगी।',
      downloadPdf: 'QwickSignal PDF डाउनलोड करें', downloadCsv: 'CSV डाउनलोड करें',
      onThisPhone: 'इस फोन पर', clearAllData: 'सारा डेटा हटाएं',
      refresh: 'रिफ्रेश करें',
      loginToLinkChannels: 'टेलीग्राम चैनल लिंक करने के लिए साइन इन करें।',
      appearanceHeading: 'दिखावट', appearanceSub: 'इस डिवाइस पर क्विकसिग्नल कैसा दिखे, यह चुनें।',
      themeSystem: 'डिफ़ॉल्ट', themeLight: 'लाइट', themeDark: 'डार्क',
      appetiteHeading: 'रोज़ कितनी खबरें', appetiteSub: 'बताएं कि आपको दिन में कितनी खबरें चाहिए। QwickSignal तय करेगा कि कौन-सी प्राथमिकताएं सबसे पहले दिखें, और खबरों की संख्या बदलने पर खुद बदलता रहेगा।',
      appetiteAll: 'सब कुछ', appetitePerDay: 'खबरें रोज़',
      appetiteResolved: 'इसके आसपास रहने के लिए QwickSignal ने स्तर रखा है',
      appetiteApprox: 'प्राथमिकताएं चार स्तरों में हैं, इसलिए यह सबसे नज़दीकी आंकड़ा है।',
      appetiteFloorNote: 'आपने इससे कम मांगा था, पर इससे नीचे जाने का मतलब होगा अति-महत्वपूर्ण खबरें रोकना।',
      appetiteOffNote: 'कोई छंटाई नहीं। आपके चैनलों की हर खबर फ़ीड में आएगी।',
      appetiteNoData: 'खबरें आने के बाद यहां दिखेगा कि आपके चैनल रोज़ कितनी खबरें देते हैं।',
      appetiteLadderHead: 'आपके चैनल अभी रोज़ कितनी खबरें दे रहे हैं',
      appetiteKeptNote: 'कुछ भी मिटाया नहीं जाता। कम प्राथमिकता वाली खबरें ऐप में रहती हैं, फ़ीड के नीचे एक टैप दूर।',
      appetitePushNote: 'इससे यह भी तय होता है कि कौन-सी खबरें आपको सूचना भेज सकती हैं।',
      appetiteDoneTitle: 'आज की ज़रूरी खबरें हो गईं।',
      appetiteRestSub: 'कम प्राथमिकता वाली खबरें अब भी यहां हैं।',
      appetiteRestBtn: 'बाकी दिखाएं', appetiteShowingAll: 'सब कुछ दिख रहा है, आपकी रोज़ की संख्या से नीचे की खबरें भी।',
      appetiteFoldBtn: 'वापस मेरी रोज़ की संख्या पर',
      notifAppetiteManaged: 'यह आपकी रोज़ की संख्या से तय होता है। यहां बदलने पर वह बंद हो जाएगा।',
      notifHeading: 'सूचनाएं', notifSub: 'जब कोई नई खबर आए तो इस डिवाइस पर सूचना पाएं - ऐप खुला न होने पर भी।',
      notifEnable: 'सूचनाएं चालू करें', notifDisable: 'सूचनाएं बंद करें', notifOn: 'इस डिवाइस के लिए सूचनाएं चालू हैं।',
      notifUnsupported: 'यह ब्राउज़र पुश सूचनाओं का समर्थन नहीं करता।',
      notifBlocked: 'इस साइट के लिए सूचनाएं ब्लॉक हैं। अपनी ब्राउज़र/साइट सेटिंग्स में उन्हें अनुमति दें, फिर दोबारा कोशिश करें।',
      notifFailed: 'सूचनाएं चालू नहीं हो सकीं। अपना कनेक्शन जांचें और फिर कोशिश करें।',
      notifTierLabel: 'मुझे सूचित करें', notifTierHint: 'नीचे का स्तर अपने ऊपर के सभी स्तर भी शामिल करता है।',
      notifImpCritical: 'केवल अति-महत्वपूर्ण', notifImpHigh: 'उच्च और उससे ऊपर', notifImpMedium: 'मध्यम और उससे ऊपर', notifImpLow: 'सब कुछ',
      notifQuietLabel: 'शांत समय (रात 10 - सुबह 7)', notifQuietHint: 'रात में केवल अति-महत्वपूर्ण खबरें आएंगी।',
      notifDigestLabel: 'सारांश', notifDigestOff: 'बंद', notifDigestDaily: 'रोज़', notifDigestWeekly: 'साप्ताहिक',
      notifDigestHint: 'हर खबर अलग-अलग आने के बजाय सुबह एक सूचना में हाल की खबरों का सारांश।',
      notifInvestLabel: 'मेरी Investment वॉचलिस्ट की खबरें', notifInvestHint: 'आपकी ट्रैक की गई कंपनियों की खबरें और आपके जोड़े गए Investment चैनलों की पोस्ट, आपकी खबरों वाली सूचनाओं में ही जुड़कर। ये आपकी प्राथमिकता सेटिंग से नीचे होने पर भी आती हैं।',
      investFromChannels: 'आपके जोड़े गए चैनलों से', investChannelsEmpty: 'पिछले 24 घंटों में आपके जोड़े गए चैनलों से कुछ नहीं। नया जोड़ा गया चैनल लगभग 30 मिनट में दिखने लगता है।',
      notifInvestNeedCompanies: 'इसे चालू करने के लिए Investment टैब में कंपनियां ट्रैक करें या चैनल जोड़ें।',
      notifPacingNote: 'सूचनाएं समूह में आती हैं: हर 20–40 मिनट में ज़्यादा से ज़्यादा एक, बीच में आई खबरों के साथ। अति-महत्वपूर्ण खबरें तुरंत आती हैं।',
      getAppHeading: 'ऐप पाएं', getAppAndroidTab: 'Android', getAppIosTab: 'iPhone',
      getAppSub: 'इंस्टॉल करने योग्य ऐप डाउनलोड करें (एक फ़ाइल, ज़िप की हुई)। इसे अनज़िप करें, फिर इंस्टॉल करने के लिए .apk पर टैप करें - आपको अपने ब्राउज़र के लिए एक बार "अज्ञात ऐप्स इंस्टॉल करें" की अनुमति देनी पड़ सकती है।', getAppBtn: 'QwickSignal.zip डाउनलोड करें',
      getAppIosStep1: 'Safari में qwicksignal.netlify.app खोलें (Chrome में नहीं, Safari में ही)।', getAppIosStep2: 'शेयर आइकन टैप करें, फिर "Add to Home Screen" चुनें।', getAppIosStep3: '"Add" टैप करें - अब QwickSignal एक सामान्य ऐप की तरह खुलेगा, बिना ब्राउज़र बार के।',
      getAppIosNote: 'इसके बाद नोटिफिकेशन वैसे ही काम करते हैं - iOS 16.4 और उसके बाद होम-स्क्रीन ऐप्स के लिए असली पुश नोटिफिकेशन देता है।',
      feedbackHeading: 'फ़ीडबैक और सहायता', feedbackSub: 'कोई बग मिला, या कोई सुझाव है? यहाँ भेजें - यह सीधे ऐप के मालिक तक जाता है।',
      agGoToAccount: 'खाते पर जाएं', agMaybeLater: 'बाद में',
      agAddChannelsTitle: 'साइन इन करके अपनी न्यूज़ और इन्वेस्टमेंट फ़ीड को अपने हिसाब से बनाएं', agAddChannelsBody: 'न्यूज़ और इन्वेस्टमेंट के लिए अपने टेलीग्राम चैनल जोड़ने के लिए साइन इन करें। यह मुफ़्त है, और आपके चैनल, कंपनियां और सेव की गई खबरें हर डिवाइस पर आपके साथ रहती हैं।',
      agSyncTitle: 'डिवाइस सिंक करने के लिए साइन इन करें', agSyncBody: 'डिवाइस के बीच सिंक करने के लिए अब मुफ़्त खाता चाहिए - यह सब कुछ थोड़ा ज़्यादा सुरक्षित और आपसे जुड़ा रखता है, शेयर किए जा सकने वाले कोड के बजाय।',
      feedbackLoginTitle: 'फ़ीडबैक भेजने के लिए साइन इन करें', feedbackLoginBody: 'मुफ़्त खाता बनाने से ऐप के मालिक ज़रूरत पड़ने पर आपसे संपर्क कर सकते हैं।',
      ticketKindBug: 'बग', ticketKindSupport: 'सहायता', ticketKindFeedback: 'फ़ीडबैक',
      ticketPrefixBug: 'बग: ', ticketPrefixFeedback: 'फ़ीडबैक: ',
      ticketPlaceholder: 'समस्या या विचार बताएं…', ticketSend: 'सबमिट करें', ticketSent: 'धन्यवाद - ऐप के मालिक को भेज दिया गया।',
      ticketFailed: 'भेजा नहीं जा सका। अपना कनेक्शन जांचें और फिर कोशिश करें।', ticketEmpty: 'पहले कुछ शब्द लिखें।',
      ticketSentWithNumber: 'भेज दिया गया - आपका टिकट नंबर {num} है। संदर्भ के लिए इसे रखें।',
      ticketAttachHeading: 'अटैचमेंट (वैकल्पिक)', ticketAttachAdd: 'स्क्रीनशॉट या फ़ाइल जोड़ें',
      ticketAttachRemove: 'हटाएं', ticketAttachTooBig: 'यह फ़ाइल बहुत बड़ी है (अधिकतम 8 MB)।',
      ticketAttachUploading: 'अटैचमेंट अपलोड हो रहा है…', ticketAttachFailed: 'अटैचमेंट अपलोड नहीं हो सका - टिकट बिना उसके भेज दिया गया।',
      ticketAdminHeading: 'टिकट', ticketAdminEmpty: 'अभी तक कोई टिकट नहीं।', ticketAdminLoadFailed: 'टिकट लोड नहीं हो सके।',
      ticketAdminAttachment: 'अटैचमेंट',
      ticketStatusOpen: 'खुला', ticketStatusDone: 'हल हुआ', ticketMarkDone: 'हल हुआ मार्क करें', ticketMarkOpen: 'फिर से खोलें',
      obSkip: 'छोड़ें', obNext: 'आगे', obDone: 'समझ गया',
      obStep1Title: 'देश के अनुसार समाचार', obStep1Body: 'हर झंडा एक देश है जिसकी खबरें तैयार हैं - सीधे उसकी खबरों पर जाने के लिए टैप करें।',
      obStep2Title: 'खोजें', obStep2Body: 'अपने फ़ीड की हर खबर में खोजें - हेडलाइन, सारांश, और कंपनी के नाम।',
      obStep3Title: 'देश, क्षेत्र और महत्व', obStep3Body: 'फ़ीड को किसी एक देश या क्षेत्र तक सीमित करें, या केवल क्रिटिकल/हाई प्राथमिकता वाली खबरें दिखाएं।',
      obStep4Title: 'एक न्यूज़ कार्ड', obStep4Body: 'अधिक पढ़ने के लिए किसी खबर पर टैप करें, सेव करने के लिए दाईं ओर स्वाइप करें, या हटाने के लिए बाईं ओर स्वाइप करें।',
      obStep5Title: 'सेव किए गए', obStep5Body: 'किसी खबर को दाईं ओर स्वाइप करें या सेव पर टैप करें। सेव की गई खबरें आपके खाते में तब तक रहती हैं जब तक आप उन्हें न हटाएं, साइन आउट के बाद भी।',
      obStep6Title: 'इन्वेस्टमेंट', obStep6Body: 'आपकी वॉचलिस्ट की कंपनियों की खबरें, उनके लोगो के साथ। ज़्यादा खबरों के लिए सेटिंग्स में कंपनी के टेलीग्राम चैनल जोड़ें।',
      obStep7Title: 'सेटिंग्स', obStep7Body: 'रूप, चैनल, आपकी वॉचलिस्ट, डेली अपेटाइट (दिन में कितनी खबरें), नोटिफिकेशन (खबर और इन्वेस्टमेंट अलर्ट, हर 20-40 मिनट में एक साथ, शांत समय के साथ), एक्सपोर्ट और फ़ीडबैक।',
      obStep8Title: 'सेंटिमेंट बोर्ड', obStep8Body: 'उपयोगकर्ताओं द्वारा ट्रैक किया हर स्टॉक, आज के तेज़ी/मंदी मूड के साथ। हर स्टॉक पर दिन में एक वोट दें, कारण लिखें, और कोई भी स्टॉक खोजें।',
      pulseLabel: 'उपयोगकर्ताओं की राय:', pulseBull: 'तेज़ी', pulseBear: 'मंदी',
      communityPending: 'वोट जल्द ही यहां दिखेंगे।',
      agPulseTitle: 'वोट करने के लिए साइन इन करें', agPulseBody: 'मुफ़्त खाता यह सुनिश्चित करता है कि हर व्यक्ति सिर्फ़ एक बार वोट करे - पढ़ने की कोई सीमा नहीं, सिर्फ़ वोट करने की।',
      notifNewsLabel: 'न्यूज़ नोटिफिकेशन',
      notifNewsHint: 'आपकी न्यूज़ फ़ीड की महत्वपूर्ण खबरें।',
      notifStockLabel: 'स्टॉक नोटिफिकेशन',
      notifStockHint: 'आपकी ट्रैक की गई कंपनियों की खबरें और आपके Investment चैनलों की पोस्ट। ये आपकी प्राथमिकता सेटिंग से नीचे होने पर भी आती हैं।',
      notifSlotsLabel: 'सूचना का समय',
      notifSlotsHint: 'समाचार सूचनाएं सुबह 9, दोपहर 1, शाम 4, शाम 7 और रात 10 बजे (आपके समय के अनुसार) आती हैं। हर एक में पिछली सूचना के बाद की खबरें होती हैं, सबसे ज़रूरी पहले।',
      notifPerDay: 'दिन में अधिकतम {n} नोटिफिकेशन। क्रिटिकल खबरें अगले नोटिफिकेशन में सबसे ऊपर रहेंगी।',
      notifBothOff: 'दोनों बंद हैं, इसलिए कोई नोटिफिकेशन नहीं भेजा जाएगा। पाने के लिए एक चालू करें।',
      sbNoVotes: 'पिछले 24 घंटों में अभी कोई वोट नहीं। पहले आप वोट करें।',
      sbVote: 'वोट आज',
      sbVotes: 'वोट आज',
      sbYourList: 'आपकी सूची',
      sbYourView: 'आज आपकी राय:',
      sbChangeHint: 'आप इसे आज कभी भी बदल सकते हैं।',
      sbWhy: 'क्यों? (वैकल्पिक)',
      sbWhyPh: 'अपना कारण बताएं - नतीजे, वैल्यूएशन, खबर, चार्ट… (2000 अक्षरों तक)',
      sbCancel: 'रद्द करें',
      sbPost: 'वोट पोस्ट करें',
      sbReasons: 'कारण',
      sbDelete: 'हटाएं',
      appetiteAllShort: 'सब',
      savedNewsHead: 'न्यूज़',
      savedInvestHead: 'इन्वेस्टमेंट',
      darkMode: 'डार्क मोड',
      languageHeading: 'भाषा',
      moreOptions: 'और विकल्प',
      justForMe: 'सिर्फ़ मेरे लिए',
      ticketStatusProgress: 'काम जारी',
      ticketMarkProgress: 'इस पर काम हो रहा है',
      ticketReplyLabel: 'भेजने वाले के लिए नोट (वे इसे देखेंगे)',
      ticketReplyPh: 'जैसे: आज के अपडेट में ठीक कर दिया गया - बताने के लिए धन्यवाद!',
      ticketNeedReason: 'हल हुआ मार्क करने से पहले भेजने वाले के लिए छोटा नोट लिखें।',
      ticketSavedDone: 'हल हुआ मार्क किया गया। भेजने वाला आपका नोट देखेगा।',
      ticketSavedProgress: 'काम जारी मार्क किया गया। भेजने वाला आपका नोट देखेगा।',
      ticketSavedOpen: 'फिर से खोला गया।',
      ticketDelete: 'टिकट हटाएं',
      ticketDeleted: 'टिकट हटाया गया।',
      ticketUpdateToast: 'आपके टिकट पर अपडेट',
      ticketView: 'देखें',
      ticketMine: 'आपके टिकट',
      ticketNew: 'नया',
      ticketOwnerReply: 'QwickSignal का जवाब',
      ticketUpdatesSub: 'आपके टिकट पर {n} अपडेट',
      sbGuestNote: 'वोट करने और अपना कारण लिखने के लिए साइन इन करें। बोर्ड कोई भी पढ़ सकता है।',
      sbGuestBtn: 'वोट करने के लिए साइन इन करें',
      sbHoldHint: 'आपका कारण। विकल्पों के लिए दबाकर रखें।',
      sbDeleted: 'कारण हटाया गया।',
      undo: 'वापस लें',
      sbNoReasons: 'अभी तक कोई कारण पोस्ट नहीं हुआ।',
      sbShowAll: 'सभी दिखाएं',
      sbOffline: 'बोर्ड अभी उपलब्ध नहीं है - इस डिवाइस पर पिछली बार देखा गया दिखा रहे हैं।',
      sbNoMatch: 'इस खोज से कोई स्टॉक नहीं मिला।',
      sbEmpty: 'अभी कोई स्टॉक नहीं। सेटिंग्स में अपनी वॉचलिस्ट में कंपनियां जोड़ें, वे यहां सबके वोट के लिए दिखेंगी।',
      sbMore: 'और दिखाएं',
      sbSearchPh: 'स्टॉक खोजें',
      sbNote: 'आज का मूड: पिछले 24 घंटों के वोट, हर व्यक्ति का हर स्टॉक पर एक। यह उपयोगकर्ताओं की राय है, निवेश सलाह नहीं।',
      sbPosted: 'वोट पोस्ट हुआ',
      sbFailed: 'पोस्ट नहीं हो सका - कनेक्शन जांचें और फिर कोशिश करें।',
      sbDeleteConfirm: 'यह कारण हटाएं? इसके साथ आपका वोट भी हट जाएगा।',
      agBoardTitle: 'वोट करने के लिए साइन इन करें',
      agBoardBody: 'मुफ़्त खाता हर व्यक्ति को हर स्टॉक पर दिन में एक वोट तक सीमित रखता है। बोर्ड पढ़ने के लिए खाता ज़रूरी नहीं।',
      obStepRTitle: 'न्यूज़ रिफ्रेश करें', obStepRBody: 'QwickSignal के बगल की पाँच पट्टियाँ रिफ्रेश बटन हैं। ताज़ा खबरें लाने के लिए कभी भी इन्हें दबाएँ। लोड होते समय ये चलती दिखती हैं।',
      obStep0Title: 'आपकी गैरमौजूदगी में',
      obStep0Body: 'लौटने पर यह कार्ड बताता है कि पिछली बार के बाद क्या बदला - किसी लाइन पर टैप करके सीधे वहां जाएं।',
      obReplay: 'टूर फिर से देखें'
    },
    mr: {
      linkPages: 'लिंक पेजेस', settings: 'सेटिंग्ज', signals: 'सिग्नल्स', saved: 'सेव्ह केलेले', export: 'एक्सपोर्ट', community: 'सेंटिमेंट बोर्ड',
      landingTitle: 'QwickSignal', landingTag: 'बातम्या, मेसेज आणि रिपोर्ट्स देश, क्षेत्र आणि महत्त्वानुसार क्रमवारी लावा.',
      landingOr: 'किंवा', continueAsGuest: 'गेस्ट म्हणून सुरू ठेवा',
      landingGuestNote: 'तुम्ही खात्याशिवायही पाहू शकता आणि डीफॉल्ट चॅनेल्स फॉलो करू शकता. नंतर कधीही सेटिंग्जमधून साइन इन करून तुमचे सेव्ह केलेले लेख आणि चॅनेल्स ठेवू शकता.',
      account: 'खाते', accountSub: 'ऐच्छिक. तुमचे सेव्ह केलेले लेख, हटवलेल्या गोष्टी आणि फॉलो केलेले चॅनेल्स कोडऐवजी तुमच्या खात्याशी जोडण्यासाठी साइन इन करा - आणि इतरांपासून वेगळे ठेवा.',
      signInEmail: 'ईमेल', signInPassword: 'पासवर्ड', signIn: 'साइन इन करा', createAccount: 'खाते तयार करा', forgotPw: 'पासवर्ड विसरलात?',
      signOut: 'साइन आउट', signedInAs: 'साइन इन केले आहे',
      telegram: 'टेलिग्राम', tgPlaceholder: 't/channelname किंवा t.me लिंक', addBtn: '+ जोडा',
      following: 'फॉलो करत आहात', follow: 'फॉलो करा', remove: 'काढा', removeShared: 'सर्वांसाठी काढा', setDefault: 'डीफॉल्ट करा', removeDefault: 'डीफॉल्ट काढा', defaultBadge: 'डीफॉल्ट',
      noChannelsYet: 'अजून कोणतेही चॅनेल नाही. फॉलो करण्यासाठी वर एक जोडा.',
      couldntLoadChannels: 'सध्या चॅनेल यादी लोड होऊ शकली नाही.', checkConnection: 'तुमचे कनेक्शन तपासा.',
      syncHeading: 'तुमच्या डिव्हाइसेसवर सिंक करा', syncSub: 'हा कोड तुमचे सेव्ह केलेले लेख आणि फॉलो केलेले चॅनेल दुसऱ्या फोन किंवा ब्राउझरशी जोडतो. हा कोड ज्याच्याकडेही असेल तो वापरू शकतो, त्यामुळे तो फक्त स्वतःपुरता आणि स्वतःच्या डिव्हाइसेसपुरता ठेवा.',
      searchPlaceholder: 'शोधा',
      allPriorities: 'सर्व प्राधान्ये', critical: 'गंभीर', high: 'उच्च', medium: 'मध्यम', low: 'कमी',
      clearFilters: 'फिल्टर्स साफ करा',
      savedLede: 'तुम्ही सेव्ह केलेल्या बातम्या 24 तासांनंतर सिग्नल्समधून निघून गेल्या तरी इथे राहतात.',
      exportLede: 'अहवाल किंवा रॉ टेबल सेव्ह करा. फाइल्स तुमच्या फोनच्या डाउनलोड्समध्ये जातील.',
      downloadPdf: 'QwickSignal PDF डाउनलोड करा', downloadCsv: 'CSV डाउनलोड करा',
      onThisPhone: 'या फोनवर', clearAllData: 'सर्व डेटा काढा',
      refresh: 'रिफ्रेश करा',
      loginToLinkChannels: 'टेलिग्राम चॅनेल लिंक करण्यासाठी साइन इन करा.',
      appearanceHeading: 'दिसावा', appearanceSub: 'या डिव्हाइसवर क्विकसिग्नल कसे दिसावे ते निवडा.',
      themeSystem: 'डीफॉल्ट', themeLight: 'लाइट', themeDark: 'डार्क',
      appetiteHeading: 'रोज किती बातम्या', appetiteSub: 'तुम्हाला दिवसातून किती बातम्या हव्यात ते सांगा. QwickSignal कोणत्या प्राधान्याच्या बातम्या आधी दाखवायच्या हे ठरवेल आणि संख्या बदलल्यावर स्वतः जुळवून घेईल.',
      appetiteAll: 'सर्व काही', appetitePerDay: 'बातम्या रोज',
      appetiteResolved: 'त्याच्या जवळ राहण्यासाठी QwickSignal ने पातळी ठेवली आहे',
      appetiteApprox: 'प्राधान्ये चार पायऱ्यांत आहेत, त्यामुळे हा सर्वात जवळचा आकडा आहे.',
      appetiteFloorNote: 'तुम्ही यापेक्षा कमी मागितले होते, पण याच्या खाली जाणे म्हणजे अति-महत्त्वाच्या बातम्या रोखणे.',
      appetiteOffNote: 'कोणतेही गाळणे नाही. तुमच्या चॅनेलमधील प्रत्येक बातमी फीडमध्ये येईल.',
      appetiteNoData: 'बातम्या आल्यावर इथे दिसेल की तुमचे चॅनेल रोज किती बातम्या देतात.',
      appetiteLadderHead: 'तुमचे चॅनेल सध्या रोज किती बातम्या देत आहेत',
      appetiteKeptNote: 'काहीही हटवले जात नाही. कमी प्राधान्याच्या बातम्या अ‍ॅपमध्येच राहतात, फीडच्या तळाशी एका टॅपवर.',
      appetitePushNote: 'यावरून हेही ठरते की कोणत्या बातम्या तुम्हाला सूचना पाठवू शकतात.',
      appetiteDoneTitle: 'आजच्या महत्त्वाच्या बातम्या झाल्या.',
      appetiteRestSub: 'कमी प्राधान्याच्या बातम्या अजूनही इथे आहेत.',
      appetiteRestBtn: 'बाकीच्या दाखवा', appetiteShowingAll: 'सर्व काही दिसत आहे, तुमच्या रोजच्या संख्येखालील बातम्यांसह.',
      appetiteFoldBtn: 'परत माझ्या रोजच्या संख्येवर',
      notifAppetiteManaged: 'हे तुमच्या रोजच्या संख्येवरून ठरते. इथे बदलल्यास ते बंद होईल.',
      notifHeading: 'सूचना', notifSub: 'नवीन बातमी आल्यावर या डिव्हाइसवर सूचना मिळवा - अ‍ॅप उघडे नसतानाही.',
      notifEnable: 'सूचना चालू करा', notifDisable: 'सूचना बंद करा', notifOn: 'या डिव्हाइससाठी सूचना चालू आहेत.',
      notifUnsupported: 'हा ब्राउझर पुश सूचनांना सपोर्ट करत नाही.',
      notifBlocked: 'या साइटसाठी सूचना ब्लॉक केलेल्या आहेत. तुमच्या ब्राउझर/साइट सेटिंग्जमध्ये त्यांना परवानगी द्या, नंतर पुन्हा प्रयत्न करा.',
      notifFailed: 'सूचना चालू करता आल्या नाहीत. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',
      notifTierLabel: 'मला कळवा', notifTierHint: 'खालची पातळी वरच्या सर्व पातळ्या समाविष्ट करते.',
      notifImpCritical: 'फक्त अति-महत्त्वाचे', notifImpHigh: 'उच्च आणि त्यावरील', notifImpMedium: 'मध्यम आणि त्यावरील', notifImpLow: 'सर्व काही',
      notifQuietLabel: 'शांत वेळ (रात्री 10 - सकाळी 7)', notifQuietHint: 'रात्री फक्त अति-महत्त्वाच्या बातम्या येतील.',
      notifDigestLabel: 'सारांश', notifDigestOff: 'बंद', notifDigestDaily: 'रोज', notifDigestWeekly: 'साप्ताहिक',
      notifDigestHint: 'प्रत्येक बातमी वेगळी येण्याऐवजी सकाळी एका सूचनेत अलीकडच्या बातम्यांचा सारांश.',
      notifInvestLabel: 'माझ्या Investment वॉचलिस्टमधील बातम्या', notifInvestHint: 'तुम्ही ट्रॅक केलेल्या कंपन्यांच्या बातम्या आणि जोडलेल्या Investment चॅनेलच्या पोस्ट, तुमच्या बातम्यांच्या सूचनांमध्येच एकत्र. तुमच्या प्राधान्य सेटिंगपेक्षा खाली असल्या तरी येतात.',
      investFromChannels: 'तुम्ही जोडलेल्या चॅनेलवरून', investChannelsEmpty: 'गेल्या 24 तासांत तुम्ही जोडलेल्या चॅनेलवरून काहीही नाही. नवीन जोडलेले चॅनेल सुमारे 30 मिनिटांत दिसू लागते.',
      notifInvestNeedCompanies: 'हे चालू करण्यासाठी Investment टॅबमध्ये कंपन्या ट्रॅक करा किंवा चॅनेल जोडा.',
      notifPacingNote: 'सूचना गटाने येतात: दर 20–40 मिनिटांत जास्तीत जास्त एक, मधल्या काळातील बातम्यांसह. अति-महत्त्वाच्या बातम्या लगेच येतात.',
      getAppHeading: 'अ‍ॅप मिळवा', getAppAndroidTab: 'Android', getAppIosTab: 'iPhone',
      getAppSub: 'इंस्टॉल करण्यायोग्य अ‍ॅप डाउनलोड करा (एक फाईल, झिप केलेली). अनझिप करा, मग इंस्टॉल करण्यासाठी .apk वर टॅप करा - तुम्हाला तुमच्या ब्राउझरसाठी एकदा "अज्ञात अ‍ॅप्स इंस्टॉल करा" ला परवानगी द्यावी लागू शकते.', getAppBtn: 'QwickSignal.zip डाउनलोड करा',
      getAppIosStep1: 'Safari मध्ये qwicksignal.netlify.app उघडा (Chrome नाही, Safari हवे).', getAppIosStep2: 'शेअर आयकॉन टॅप करा, मग "Add to Home Screen" निवडा.', getAppIosStep3: '"Add" टॅप करा - आता QwickSignal सामान्य अ‍ॅपसारखे उघडेल, ब्राउझर बारशिवाय.',
      getAppIosNote: 'यानंतर नोटिफिकेशन्स तशीच काम करतात - iOS 16.4 आणि त्यानंतरच्या आवृत्त्यांमध्ये होम-स्क्रीन अ‍ॅप्ससाठी खऱ्या पुश नोटिफिकेशन्स मिळतात.',
      feedbackHeading: 'फीडबॅक आणि सहाय्य', feedbackSub: 'बग सापडला, किंवा सुचवायचे आहे? इथे पाठवा - ते थेट अ‍ॅपच्या मालकाकडे जाते.',
      agGoToAccount: 'खात्याकडे जा', agMaybeLater: 'नंतर',
      agAddChannelsTitle: 'साइन इन करून तुमची न्यूज आणि इन्व्हेस्टमेंट फीड तुमच्या पद्धतीने बनवा', agAddChannelsBody: 'न्यूज आणि इन्व्हेस्टमेंटसाठी तुमचे स्वतःचे टेलिग्राम चॅनेल जोडण्यासाठी साइन इन करा. हे मोफत आहे, आणि तुमचे चॅनेल, कंपन्या आणि सेव्ह केलेल्या बातम्या प्रत्येक डिव्हाइसवर तुमच्यासोबत राहतात.',
      agSyncTitle: 'डिव्हाइस सिंक करण्यासाठी साइन इन करा', agSyncBody: 'डिव्हाइसमध्ये सिंक करण्यासाठी आता मोफत खाते आवश्यक आहे - यामुळे सर्व काही थोडे अधिक सुरक्षित आणि तुमच्याशी जोडलेले राहते, शेअर करता येणाऱ्या कोडऐवजी.',
      feedbackLoginTitle: 'फीडबॅक पाठवण्यासाठी साइन इन करा', feedbackLoginBody: 'मोफत खाते तयार केल्याने अ‍ॅपचे मालक गरज पडल्यास तुमच्याशी संपर्क साधू शकतात.',
      ticketKindBug: 'बग', ticketKindSupport: 'सहाय्य', ticketKindFeedback: 'फीडबॅक',
      ticketPrefixBug: 'बग: ', ticketPrefixFeedback: 'फीडबॅक: ',
      ticketPlaceholder: 'समस्या किंवा कल्पना सांगा…', ticketSend: 'सबमिट करा', ticketSent: 'धन्यवाद - अ‍ॅपच्या मालकाला पाठवले.',
      ticketFailed: 'पाठवता आले नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.', ticketEmpty: 'आधी काही शब्द लिहा.',
      ticketSentWithNumber: 'पाठवले - तुमचा तिकीट क्रमांक {num} आहे. संदर्भासाठी तो जपून ठेवा.',
      ticketAttachHeading: 'जोडणी (ऐच्छिक)', ticketAttachAdd: 'स्क्रीनशॉट किंवा फाइल जोडा',
      ticketAttachRemove: 'काढा', ticketAttachTooBig: 'ही फाइल खूप मोठी आहे (कमाल 8 MB).',
      ticketAttachUploading: 'जोडणी अपलोड होत आहे…', ticketAttachFailed: 'जोडणी अपलोड होऊ शकली नाही - तिकीट त्याशिवाय पाठवले.',
      ticketAdminHeading: 'टिकट्स', ticketAdminEmpty: 'अजून तिकिटे नाहीत.', ticketAdminLoadFailed: 'तिकिटे लोड करता आली नाहीत.',
      ticketAdminAttachment: 'जोडणी',
      ticketStatusOpen: 'उघडे', ticketStatusDone: 'सोडवले', ticketMarkDone: 'सोडवले म्हणून चिन्हांकित करा', ticketMarkOpen: 'पुन्हा उघडा',
      obSkip: 'वगळा', obNext: 'पुढे', obDone: 'समजले',
      obStep1Title: 'देशानुसार बातम्या', obStep1Body: 'प्रत्येक ध्वज म्हणजे एक देश ज्याच्या बातम्या तयार आहेत - थेट त्या बातम्यांवर जाण्यासाठी टॅप करा.',
      obStep2Title: 'शोधा', obStep2Body: 'तुमच्या फीडमधील प्रत्येक बातमीत शोधा - मथळे, सारांश, आणि कंपनीची नावे.',
      obStep3Title: 'देश, क्षेत्र आणि महत्त्व', obStep3Body: 'फीड एका देशापुरते किंवा क्षेत्रापुरते मर्यादित करा, किंवा फक्त क्रिटिकल/हाय प्राधान्याच्या बातम्या दाखवा.',
      obStep4Title: 'एक न्यूज कार्ड', obStep4Body: 'अधिक वाचण्यासाठी बातमीवर टॅप करा, सेव्ह करण्यासाठी उजवीकडे स्वाइप करा, किंवा काढण्यासाठी डावीकडे स्वाइप करा.',
      obStep5Title: 'सेव्ह केलेले', obStep5Body: 'बातमी उजवीकडे स्वाइप करा किंवा सेव्हवर टॅप करा. सेव्ह केलेल्या बातम्या तुम्ही काढेपर्यंत तुमच्या खात्यात राहतात, साइन आउट केल्यानंतरही.',
      obStep6Title: 'इन्व्हेस्टमेंट', obStep6Body: 'तुमच्या वॉचलिस्टमधील कंपन्यांच्या बातम्या, त्यांच्या लोगोसह. अधिक बातम्यांसाठी सेटिंग्जमध्ये कंपनीचे टेलिग्राम चॅनेल जोडा.',
      obStep7Title: 'सेटिंग्ज', obStep7Body: 'रूप, चॅनेल्स, तुमची वॉचलिस्ट, डेली अपेटाइट (दिवसाला किती बातम्या), नोटिफिकेशन्स (बातम्या आणि इन्व्हेस्टमेंट अलर्ट, दर 20-40 मिनिटांनी एकत्र, शांत वेळेसह), एक्सपोर्ट आणि फीडबॅक.',
      obStep8Title: 'सेंटिमेंट बोर्ड', obStep8Body: 'वापरकर्त्यांनी ट्रॅक केलेला प्रत्येक स्टॉक, आजच्या तेजी/मंदी मूडसह. प्रत्येक स्टॉकवर दिवसाला एक मत द्या, कारण लिहा, आणि कोणताही स्टॉक शोधा.',
      pulseLabel: 'वापरकर्त्यांचे मत:', pulseBull: 'तेजी', pulseBear: 'मंदी',
      communityPending: 'मते लवकरच इथे दिसतील.',
      agPulseTitle: 'मतदानासाठी साइन इन करा', agPulseBody: 'मोफत खाते खात्री करते की प्रत्येक व्यक्ती फक्त एकदाच मत देईल - वाचण्यावर मर्यादा नाही, फक्त मतदानावर.',
      notifNewsLabel: 'न्यूज नोटिफिकेशन',
      notifNewsHint: 'तुमच्या न्यूज फीडमधील महत्त्वाच्या बातम्या.',
      notifStockLabel: 'स्टॉक नोटिफिकेशन',
      notifStockHint: 'तुम्ही ट्रॅक करत असलेल्या कंपन्यांच्या बातम्या आणि तुमच्या Investment चॅनेलवरील पोस्ट. या तुमच्या प्राधान्य सेटिंगपेक्षा कमी असल्या तरी येतात.',
      notifSlotsLabel: 'सूचनांच्या वेळा',
      notifSlotsHint: 'बातम्यांच्या सूचना सकाळी 9, दुपारी 1, दुपारी 4, संध्याकाळी 7 आणि रात्री 10 वाजता (तुमच्या वेळेनुसार) येतात. प्रत्येकामध्ये मागील सूचनेनंतरच्या बातम्या असतात, सर्वात महत्त्वाच्या आधी.',
      notifPerDay: 'दिवसाला जास्तीत जास्त {n} नोटिफिकेशन. क्रिटिकल बातम्या पुढच्या नोटिफिकेशनमध्ये सर्वात वर.',
      notifBothOff: 'दोन्ही बंद आहेत, त्यामुळे कोणतेही नोटिफिकेशन पाठवले जाणार नाही. मिळवण्यासाठी एक चालू करा.',
      sbNoVotes: 'गेल्या 24 तासांत अजून मत नाही. पहिले मत तुमचे द्या.',
      sbVote: 'मत आज',
      sbVotes: 'मते आज',
      sbYourList: 'तुमची यादी',
      sbYourView: 'आज तुमचे मत:',
      sbChangeHint: 'तुम्ही ते आज कधीही बदलू शकता.',
      sbWhy: 'का? (ऐच्छिक)',
      sbWhyPh: 'तुमचे कारण सांगा - निकाल, मूल्यांकन, बातमी, चार्ट… (2000 अक्षरांपर्यंत)',
      sbCancel: 'रद्द करा',
      sbPost: 'मत पोस्ट करा',
      sbReasons: 'कारणे',
      sbDelete: 'हटवा',
      appetiteAllShort: 'सर्व',
      savedNewsHead: 'न्यूज',
      savedInvestHead: 'इन्व्हेस्टमेंट',
      darkMode: 'डार्क मोड',
      languageHeading: 'भाषा',
      moreOptions: 'आणखी पर्याय',
      justForMe: 'फक्त माझ्यासाठी',
      ticketStatusProgress: 'काम सुरू',
      ticketMarkProgress: 'यावर काम सुरू आहे',
      ticketReplyLabel: 'पाठवणाऱ्यासाठी नोंद (त्यांना ही दिसेल)',
      ticketReplyPh: 'उदा. आजच्या अपडेटमध्ये दुरुस्त केले - कळवल्याबद्दल धन्यवाद!',
      ticketNeedReason: 'सोडवले म्हणून चिन्हांकित करण्यापूर्वी पाठवणाऱ्यासाठी छोटी नोंद लिहा.',
      ticketSavedDone: 'सोडवले म्हणून चिन्हांकित. पाठवणाऱ्याला तुमची नोंद दिसेल.',
      ticketSavedProgress: 'काम सुरू म्हणून चिन्हांकित. पाठवणाऱ्याला तुमची नोंद दिसेल.',
      ticketSavedOpen: 'पुन्हा उघडले.',
      ticketDelete: 'टिकट हटवा',
      ticketDeleted: 'टिकट हटवले.',
      ticketUpdateToast: 'तुमच्या टिकटवर अपडेट',
      ticketView: 'पहा',
      ticketMine: 'तुमची टिकट्स',
      ticketNew: 'नवीन',
      ticketOwnerReply: 'QwickSignal चे उत्तर',
      ticketUpdatesSub: 'तुमच्या टिकटवर {n} अपडेट',
      sbGuestNote: 'मत देण्यासाठी आणि तुमचे कारण लिहिण्यासाठी साइन इन करा. बोर्ड कोणीही वाचू शकतो.',
      sbGuestBtn: 'मत देण्यासाठी साइन इन करा',
      sbHoldHint: 'तुमचे कारण. पर्यायांसाठी दाबून धरा.',
      sbDeleted: 'कारण हटवले.',
      undo: 'परत घ्या',
      sbNoReasons: 'अजून कोणतेही कारण पोस्ट झालेले नाही.',
      sbShowAll: 'सर्व दाखवा',
      sbOffline: 'बोर्ड आत्ता उपलब्ध नाही - या डिव्हाइसवर शेवटचे पाहिलेले दाखवत आहोत.',
      sbNoMatch: 'या शोधाशी जुळणारा स्टॉक नाही.',
      sbEmpty: 'अजून स्टॉक नाहीत. सेटिंग्जमध्ये तुमच्या वॉचलिस्टमध्ये कंपन्या जोडा, त्या इथे सर्वांच्या मतासाठी दिसतील.',
      sbMore: 'आणखी दाखवा',
      sbSearchPh: 'स्टॉक शोधा',
      sbNote: 'आजचा मूड: गेल्या 24 तासांतील मते, प्रत्येक व्यक्तीचे प्रत्येक स्टॉकवर एक. ही वापरकर्त्यांची मते आहेत, गुंतवणूक सल्ला नाही.',
      sbPosted: 'मत पोस्ट झाले',
      sbFailed: 'पोस्ट होऊ शकले नाही - कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',
      sbDeleteConfirm: 'हे कारण हटवायचे? त्यासोबत तुमचे मतही हटेल.',
      agBoardTitle: 'मतदानासाठी साइन इन करा',
      agBoardBody: 'मोफत खाते प्रत्येक व्यक्तीला प्रत्येक स्टॉकवर दिवसाला एक मत इतके मर्यादित ठेवते. बोर्ड वाचण्यासाठी खाते लागत नाही.',
      obStepRTitle: 'बातम्या रिफ्रेश करा', obStepRBody: 'QwickSignal शेजारील पाच पट्ट्या म्हणजे रिफ्रेश बटण. ताज्या बातम्या आणण्यासाठी केव्हाही दाबा. लोड होताना त्या हलतात.',
      obStep0Title: 'तुम्ही नसताना',
      obStep0Body: 'परत आल्यावर हे कार्ड मागच्या भेटीनंतर काय बदलले ते सांगते - थेट तिथे जाण्यासाठी ओळीवर टॅप करा.',
      obReplay: 'टूर पुन्हा पहा'
    },
    gu: {
      linkPages: 'લિંક પેજીસ', settings: 'સેટિંગ્સ', signals: 'સિગ્નલ્સ', saved: 'સેવ કરેલ', export: 'એક્સપોર્ટ', community: 'સેન્ટિમેન્ટ બોર્ડ',
      landingTitle: 'QwickSignal', landingTag: 'સમાચાર, સંદેશા અને અહેવાલોને દેશ, ક્ષેત્ર અને મહત્વ પ્રમાણે ગોઠવો.',
      landingOr: 'અથવા', continueAsGuest: 'ગેસ્ટ તરીકે ચાલુ રાખો',
      landingGuestNote: 'તમે ખાતા વગર પણ જોઈ શકો છો અને ડિફોલ્ટ ચેનલ્સ ફોલો કરી શકો છો. પછી ગમે ત્યારે સેટિંગ્સમાંથી સાઇન ઇન કરીને તમારા સેવ કરેલા લેખો અને ચેનલ્સ રાખી શકો છો.',
      account: 'ખાતું', accountSub: 'વૈકલ્પિક. તમારા સેવ કરેલા લેખો, કાઢી નાખેલી વસ્તુઓ અને ફોલો કરેલા ચેનલ્સ કોડને બદલે તમારા ખાતા સાથે જોડવા માટે સાઇન ઇન કરો - અને બીજા બધાથી અલગ રાખો.',
      signInEmail: 'ઇમેઇલ', signInPassword: 'પાસવર્ડ', signIn: 'સાઇન ઇન કરો', createAccount: 'ખાતું બનાવો', forgotPw: 'પાસવર્ડ ભૂલી ગયા?',
      signOut: 'સાઇન આઉટ', signedInAs: 'આ રીતે સાઇન ઇન છે',
      telegram: 'ટેલિગ્રામ', tgPlaceholder: 't/channelname અથવા t.me લિંક', addBtn: '+ ઉમેરો',
      following: 'ફોલો કરો છો', follow: 'ફોલો કરો', remove: 'કાઢી નાખો', removeShared: 'બધા માટે કાઢી નાખો', setDefault: 'ડિફોલ્ટ બનાવો', removeDefault: 'ડિફોલ્ટ કાઢો', defaultBadge: 'ડિફોલ્ટ',
      noChannelsYet: 'હજુ કોઈ ચેનલ નથી. ફોલો કરવા માટે ઉપર એક ઉમેરો.',
      couldntLoadChannels: 'હાલમાં ચેનલ યાદી લોડ થઈ શકી નથી.', checkConnection: 'તમારું જોડાણ તપાસો.',
      syncHeading: 'તમારા ડિવાઇસ પર સિંક કરો', syncSub: 'આ કોડ તમારા સેવ કરેલા લેખો અને ફોલો કરેલા ચેનલ્સને બીજા ફોન કે બ્રાઉઝર સાથે જોડે છે. આ કોડ જેની પાસે પણ હોય તે તેનો ઉપયોગ કરી શકે છે, તેથી તેને ફક્ત તમારા પોતાના ડિવાઇસ પૂરતો રાખો.',
      searchPlaceholder: 'શોધો',
      allPriorities: 'બધી પ્રાથમિકતાઓ', critical: 'ગંભીર', high: 'ઊંચી', medium: 'મધ્યમ', low: 'નીચી',
      clearFilters: 'ફિલ્ટર્સ સાફ કરો',
      savedLede: 'તમે સેવ કરેલી સ્ટોરીઝ 24 કલાક પછી સિગ્નલ્સમાંથી નીકળી જાય તો પણ અહીં રહે છે.',
      exportLede: 'રિપોર્ટ અથવા રો ટેબલ સેવ કરો. ફાઇલો તમારા ફોનના ડાઉનલોડ્સમાં જશે.',
      downloadPdf: 'QwickSignal PDF ડાઉનલોડ કરો', downloadCsv: 'CSV ડાઉનલોડ કરો',
      onThisPhone: 'આ ફોન પર', clearAllData: 'બધો ડેટા કાઢી નાખો',
      refresh: 'રિફ્રેશ કરો',
      loginToLinkChannels: 'ટેલિગ્રામ ચેનલ લિંક કરવા સાઇન ઇન કરો.',
      appearanceHeading: 'દેખાવ', appearanceSub: 'આ ડિવાઇસ પર ક્વિકસિગ્નલ કેવું દેખાય તે પસંદ કરો.',
      themeSystem: 'ડિફૉલ્ટ', themeLight: 'લાઇટ', themeDark: 'ડાર્ક',
      appetiteHeading: 'રોજ કેટલા સમાચાર', appetiteSub: 'તમને દિવસમાં કેટલા સમાચાર જોઈએ તે જણાવો. QwickSignal નક્કી કરશે કે કઈ પ્રાથમિકતા પહેલાં બતાવવી, અને સંખ્યા બદલાતાં જાતે ગોઠવાશે.',
      appetiteAll: 'બધું', appetitePerDay: 'સ્ટોરી રોજ',
      appetiteResolved: 'તેની નજીક રહેવા માટે QwickSignal એ સ્તર રાખ્યું છે',
      appetiteApprox: 'પ્રાથમિકતા ચાર પગથિયાંમાં છે, તેથી આ સૌથી નજીકનો આંકડો છે.',
      appetiteFloorNote: 'તમે આનાથી ઓછું માગ્યું હતું, પણ આનાથી નીચે જવાનો અર્થ અતિ-મહત્વની સ્ટોરી રોકવી થાય.',
      appetiteOffNote: 'કોઈ ગાળણી નહીં. તમારી ચેનલની દરેક સ્ટોરી ફીડમાં આવશે.',
      appetiteNoData: 'સ્ટોરી આવ્યા પછી અહીં દેખાશે કે તમારી ચેનલો રોજ કેટલી સ્ટોરી આપે છે.',
      appetiteLadderHead: 'તમારી ચેનલો હાલમાં રોજ કેટલી સ્ટોરી આપે છે',
      appetiteKeptNote: 'કશું કાઢી નખાતું નથી. ઓછી પ્રાથમિકતાની સ્ટોરી ઍપમાં જ રહે છે, ફીડના તળિયે એક ટૅપ દૂર.',
      appetitePushNote: 'આનાથી એ પણ નક્કી થાય છે કે કઈ સ્ટોરી તમને નોટિફિકેશન મોકલી શકે.',
      appetiteDoneTitle: 'આજના મહત્વના સમાચાર પૂરા.',
      appetiteRestSub: 'ઓછી પ્રાથમિકતાની સ્ટોરી હજી અહીં છે.',
      appetiteRestBtn: 'બાકીની બતાવો', appetiteShowingAll: 'બધું દેખાઈ રહ્યું છે, તમારી રોજની સંખ્યાથી નીચેની સ્ટોરી સહિત.',
      appetiteFoldBtn: 'પાછા મારી રોજની સંખ્યા પર',
      notifAppetiteManaged: 'આ તમારી રોજની સંખ્યાથી નક્કી થાય છે. અહીં બદલવાથી તે બંધ થશે.',
      notifHeading: 'નોટિફિકેશન', notifSub: 'નવી સ્ટોરી આવે ત્યારે આ ડિવાઇસ પર નોટિફિકેશન મેળવો - ઍપ ખુલ્લી ન હોય ત્યારે પણ.',
      notifEnable: 'નોટિફિકેશન ચાલુ કરો', notifDisable: 'નોટિફિકેશન બંધ કરો', notifOn: 'આ ડિવાઇસ માટે નોટિફિકેશન ચાલુ છે.',
      notifUnsupported: 'આ બ્રાઉઝર પુશ નોટિફિકેશનને સપોર્ટ કરતું નથી.',
      notifBlocked: 'આ સાઇટ માટે નોટિફિકેશન બ્લોક કરેલા છે. તમારા બ્રાઉઝર/સાઇટ સેટિંગ્સમાં તેમને મંજૂરી આપો, પછી ફરી પ્રયાસ કરો.',
      notifFailed: 'નોટિફિકેશન ચાલુ કરી શકાયા નહીં. તમારું જોડાણ તપાસો અને ફરી પ્રયાસ કરો.',
      notifTierLabel: 'મને જણાવો', notifTierHint: 'નીચેનું સ્તર તેની ઉપરનાં બધાં સ્તર પણ સમાવે છે.',
      notifImpCritical: 'ફક્ત અતિ-મહત્વનું', notifImpHigh: 'ઉચ્ચ અને તેથી ઉપર', notifImpMedium: 'મધ્યમ અને તેથી ઉપર', notifImpLow: 'બધું',
      notifQuietLabel: 'શાંત સમય (રાત્રે 10 - સવારે 7)', notifQuietHint: 'રાત્રે ફક્ત અતિ-મહત્વની સ્ટોરી આવશે.',
      notifDigestLabel: 'સારાંશ', notifDigestOff: 'બંધ', notifDigestDaily: 'રોજ', notifDigestWeekly: 'સાપ્તાહિક',
      notifDigestHint: 'દરેક સ્ટોરી અલગ આવવાને બદલે સવારે એક નોટિફિકેશનમાં તાજેતરની સ્ટોરીનો સારાંશ.',
      notifInvestLabel: 'મારી Investment વૉચલિસ્ટના સમાચાર', notifInvestHint: 'તમે ટ્રૅક કરેલી કંપનીઓના સમાચાર અને જોડેલી Investment ચેનલોની પોસ્ટ, તમારા સમાચારના નોટિફિકેશનમાં જ ભેગા. તમારી પ્રાથમિકતા સેટિંગથી નીચે હોય તો પણ આવે છે.',
      investFromChannels: 'તમે જોડેલી ચેનલોમાંથી', investChannelsEmpty: 'છેલ્લા 24 કલાકમાં તમે જોડેલી ચેનલોમાંથી કંઈ નથી. નવી જોડેલી ચેનલ લગભગ 30 મિનિટમાં દેખાવા લાગે છે.',
      notifInvestNeedCompanies: 'આ ચાલુ કરવા Investment ટૅબમાં કંપનીઓ ટ્રૅક કરો અથવા ચેનલ જોડો.',
      notifPacingNote: 'નોટિફિકેશન જૂથમાં આવે છે: દર 20–40 મિનિટે વધુમાં વધુ એક, વચ્ચે આવેલા સમાચાર સાથે. અતિ-મહત્વની સ્ટોરી તરત આવે છે.',
      getAppHeading: 'ઍપ મેળવો', getAppAndroidTab: 'Android', getAppIosTab: 'iPhone',
      getAppSub: 'ઇન્સ્ટોલ કરી શકાય તેવી ઍપ ડાઉનલોડ કરો (એક ફાઇલ, ઝિપ કરેલી). તેને અનઝિપ કરો, પછી ઇન્સ્ટોલ કરવા માટે .apk પર ટૅપ કરો - તમારે તમારા બ્રાઉઝર માટે એકવાર "અજાણી ઍપ્સ ઇન્સ્ટોલ કરો"ની મંજૂરી આપવી પડી શકે.', getAppBtn: 'QwickSignal.zip ડાઉનલોડ કરો',
      getAppIosStep1: 'Safari માં qwicksignal.netlify.app ખોલો (Chrome નહીં, Safari જ જોઈએ).', getAppIosStep2: 'શેર આઇકન ટૅપ કરો, પછી "Add to Home Screen" પસંદ કરો.', getAppIosStep3: '"Add" ટૅપ કરો - હવે QwickSignal સામાન્ય ઍપની જેમ ખુલશે, બ્રાઉઝર બાર વગર.',
      getAppIosNote: 'આ પછી નોટિફિકેશન એ જ રીતે કામ કરે છે - iOS 16.4 અને પછીની આવૃત્તિઓમાં હોમ-સ્ક્રીન ઍપ્સ માટે ખરા પુશ નોટિફિકેશન મળે છે.',
      feedbackHeading: 'પ્રતિસાદ અને સહાય', feedbackSub: 'બગ મળ્યો, કે સૂચન છે? અહીં મોકલો - તે સીધું ઍપના માલિક સુધી જાય છે.',
      agGoToAccount: 'ખાતા પર જાઓ', agMaybeLater: 'પછી',
      agAddChannelsTitle: 'સાઇન ઇન કરીને તમારી ન્યૂઝ અને ઇન્વેસ્ટમેન્ટ ફીડ તમારી રીતે બનાવો', agAddChannelsBody: 'ન્યૂઝ અને ઇન્વેસ્ટમેન્ટ માટે તમારી પોતાની ટેલિગ્રામ ચેનલો જોડવા સાઇન ઇન કરો. તે મફત છે, અને તમારી ચેનલો, કંપનીઓ અને સેવ કરેલા સમાચાર દરેક ડિવાઇસ પર તમારી સાથે રહે છે.',
      agSyncTitle: 'ડિવાઇસ સિંક કરવા સાઇન ઇન કરો', agSyncBody: 'ડિવાઇસ વચ્ચે સિંક કરવા હવે મફત ખાતું જરૂરી છે - આ બધું થોડું વધુ સુરક્ષિત અને તમારી સાથે જોડાયેલું રાખે છે, શેર કરી શકાય તેવા કોડને બદલે.',
      feedbackLoginTitle: 'ફીડબેક મોકલવા સાઇન ઇન કરો', feedbackLoginBody: 'મફત ખાતું બનાવવાથી ઍપના માલિક જરૂર પડ્યે તમારો સંપર્ક કરી શકે છે.',
      ticketKindBug: 'બગ', ticketKindSupport: 'સહાય', ticketKindFeedback: 'પ્રતિસાદ',
      ticketPrefixBug: 'બગ: ', ticketPrefixFeedback: 'પ્રતિસાદ: ',
      ticketPlaceholder: 'સમસ્યા કે વિચાર જણાવો…', ticketSend: 'સબમિટ કરો', ticketSent: 'આભાર - ઍપના માલિકને મોકલાયું.',
      ticketFailed: 'મોકલી શકાયું નહીં. તમારું જોડાણ તપાસો અને ફરી પ્રયાસ કરો.', ticketEmpty: 'પહેલા થોડા શબ્દો લખો.',
      ticketSentWithNumber: 'મોકલાયું - તમારો ટિકિટ નંબર {num} છે. સંદર્ભ માટે તેને સાચવી રાખો.',
      ticketAttachHeading: 'જોડાણ (વૈકલ્પિક)', ticketAttachAdd: 'સ્ક્રીનશોટ કે ફાઇલ ઉમેરો',
      ticketAttachRemove: 'દૂર કરો', ticketAttachTooBig: 'આ ફાઇલ ઘણી મોટી છે (મહત્તમ 8 MB).',
      ticketAttachUploading: 'જોડાણ અપલોડ થઈ રહ્યું છે…', ticketAttachFailed: 'જોડાણ અપલોડ ન થઈ શક્યું - ટિકિટ તેના વિના મોકલાયું.',
      ticketAdminHeading: 'ટિકિટો', ticketAdminEmpty: 'હજુ કોઈ ટિકિટ નથી.', ticketAdminLoadFailed: 'ટિકિટ લોડ કરી શકાયા નહીં.',
      ticketAdminAttachment: 'જોડાણ',
      ticketStatusOpen: 'ખુલ્લું', ticketStatusDone: 'ઉકેલાયું', ticketMarkDone: 'ઉકેલાયું તરીકે ચિહ્નિત કરો', ticketMarkOpen: 'ફરી ખોલો',
      obSkip: 'છોડો', obNext: 'આગળ', obDone: 'સમજાઈ ગયું',
      obStep1Title: 'દેશ પ્રમાણે સમાચાર', obStep1Body: 'દરેક ધ્વજ એક દેશ છે જેના સમાચાર તૈયાર છે - સીધા તેના સમાચાર પર જવા ટેપ કરો.',
      obStep2Title: 'શોધો', obStep2Body: 'તમારા ફીડની દરેક વાર્તામાં શોધો - હેડલાઇન, સારાંશ, અને કંપનીના નામ.',
      obStep3Title: 'દેશ, ક્ષેત્ર અને મહત્વ', obStep3Body: 'ફીડને એક દેશ કે ક્ષેત્ર પૂરતું મર્યાદિત કરો, અથવા ફક્ત ક્રિટિકલ/હાઈ પ્રાથમિકતાના સમાચાર બતાવો.',
      obStep4Title: 'એક ન્યૂઝ કાર્ડ', obStep4Body: 'વધુ વાંચવા સમાચાર પર ટેપ કરો, સેવ કરવા જમણી બાજુ સ્વાઇપ કરો, અથવા હટાવવા ડાબી બાજુ સ્વાઇપ કરો.',
      obStep5Title: 'સેવ કરેલ', obStep5Body: 'સમાચારને જમણી બાજુ સ્વાઇપ કરો અથવા સેવ પર ટેપ કરો. સેવ કરેલા સમાચાર તમે દૂર ન કરો ત્યાં સુધી તમારા ખાતામાં રહે છે, સાઇન આઉટ પછી પણ.',
      obStep6Title: 'ઇન્વેસ્ટમેન્ટ', obStep6Body: 'તમારી વોચલિસ્ટની કંપનીઓના સમાચાર, તેમના લોગો સાથે. વધુ સમાચાર માટે સેટિંગ્સમાં કંપનીની ટેલિગ્રામ ચેનલ જોડો.',
      obStep7Title: 'સેટિંગ્સ', obStep7Body: 'દેખાવ, ચેનલો, તમારી વોચલિસ્ટ, ડેઇલી અપેટાઇટ (દિવસમાં કેટલા સમાચાર), નોટિફિકેશન (સમાચાર અને ઇન્વેસ્ટમેન્ટ એલર્ટ, દર 20-40 મિનિટે એકસાથે, શાંત સમય સાથે), એક્સપોર્ટ અને પ્રતિસાદ.',
      obStep8Title: 'સેન્ટિમેન્ટ બોર્ડ', obStep8Body: 'વપરાશકર્તાઓએ ટ્રેક કરેલો દરેક સ્ટોક, આજના તેજી/મંદી મૂડ સાથે. દરેક સ્ટોક પર દિવસમાં એક વોટ આપો, કારણ લખો, અને કોઈ પણ સ્ટોક શોધો.',
      pulseLabel: 'વપરાશકર્તાઓનો મત:', pulseBull: 'તેજી', pulseBear: 'મંદી',
      communityPending: 'મત ટૂંક સમયમાં અહીં દેખાશે.',
      agPulseTitle: 'વોટ કરવા સાઇન ઇન કરો', agPulseBody: 'મફત ખાતું ખાતરી કરે છે કે દરેક વ્યક્તિ ફક્ત એક જ વાર વોટ કરે - વાંચવા પર કોઈ મર્યાદા નથી, ફક્ત વોટિંગ પર.',
      notifNewsLabel: 'ન્યૂઝ નોટિફિકેશન',
      notifNewsHint: 'તમારી ન્યૂઝ ફીડના મહત્વના સમાચાર.',
      notifStockLabel: 'સ્ટોક નોટિફિકેશન',
      notifStockHint: 'તમે ટ્રેક કરો છો તે કંપનીઓના સમાચાર અને તમારી Investment ચેનલોની પોસ્ટ. તે તમારી પ્રાથમિકતા સેટિંગથી નીચે હોય તો પણ આવે છે.',
      notifSlotsLabel: 'સૂચનાનો સમય',
      notifSlotsHint: 'સમાચારની સૂચનાઓ સવારે 9, બપોરે 1, સાંજે 4, સાંજે 7 અને રાત્રે 10 વાગ્યે (તમારા સમય મુજબ) આવે છે. દરેકમાં છેલ્લી સૂચના પછીના સમાચાર હોય છે, સૌથી મહત્વના પહેલાં.',
      notifPerDay: 'દિવસમાં વધુમાં વધુ {n} નોટિફિકેશન. ક્રિટિકલ સમાચાર આગામી નોટિફિકેશનમાં સૌથી ઉપર.',
      notifBothOff: 'બંને બંધ છે, તેથી કોઈ નોટિફિકેશન મોકલવામાં આવશે નહીં. મેળવવા માટે એક ચાલુ કરો.',
      sbNoVotes: 'છેલ્લા 24 કલાકમાં હજી કોઈ વોટ નથી. પહેલો વોટ તમારો આપો.',
      sbVote: 'વોટ આજે',
      sbVotes: 'વોટ આજે',
      sbYourList: 'તમારી યાદી',
      sbYourView: 'આજે તમારો મત:',
      sbChangeHint: 'તમે તેને આજે ગમે ત્યારે બદલી શકો છો.',
      sbWhy: 'કેમ? (વૈકલ્પિક)',
      sbWhyPh: 'તમારું કારણ જણાવો - પરિણામ, મૂલ્યાંકન, સમાચાર, ચાર્ટ… (2000 અક્ષરો સુધી)',
      sbCancel: 'રદ કરો',
      sbPost: 'વોટ પોસ્ટ કરો',
      sbReasons: 'કારણો',
      sbDelete: 'કાઢી નાખો',
      appetiteAllShort: 'બધું',
      savedNewsHead: 'ન્યૂઝ',
      savedInvestHead: 'ઇન્વેસ્ટમેન્ટ',
      darkMode: 'ડાર્ક મોડ',
      languageHeading: 'ભાષા',
      moreOptions: 'વધુ વિકલ્પો',
      justForMe: 'ફક્ત મારા માટે',
      ticketStatusProgress: 'કામ ચાલુ',
      ticketMarkProgress: 'આના પર કામ ચાલુ છે',
      ticketReplyLabel: 'મોકલનાર માટે નોંધ (તેમને આ દેખાશે)',
      ticketReplyPh: 'દા.ત. આજના અપડેટમાં સુધાર્યું - જણાવવા બદલ આભાર!',
      ticketNeedReason: 'ઉકેલાયું તરીકે ચિહ્નિત કરતા પહેલા મોકલનાર માટે ટૂંકી નોંધ લખો.',
      ticketSavedDone: 'ઉકેલાયું તરીકે ચિહ્નિત. મોકલનારને તમારી નોંધ દેખાશે.',
      ticketSavedProgress: 'કામ ચાલુ તરીકે ચિહ્નિત. મોકલનારને તમારી નોંધ દેખાશે.',
      ticketSavedOpen: 'ફરી ખોલ્યું.',
      ticketDelete: 'ટિકિટ કાઢી નાખો',
      ticketDeleted: 'ટિકિટ કાઢી નાખી.',
      ticketUpdateToast: 'તમારી ટિકિટ પર અપડેટ',
      ticketView: 'જુઓ',
      ticketMine: 'તમારી ટિકિટો',
      ticketNew: 'નવું',
      ticketOwnerReply: 'QwickSignal નો જવાબ',
      ticketUpdatesSub: 'તમારી ટિકિટ પર {n} અપડેટ',
      sbGuestNote: 'વોટ કરવા અને તમારું કારણ લખવા સાઇન ઇન કરો. બોર્ડ કોઈ પણ વાંચી શકે છે.',
      sbGuestBtn: 'વોટ કરવા સાઇન ઇન કરો',
      sbHoldHint: 'તમારું કારણ. વિકલ્પો માટે દબાવી રાખો.',
      sbDeleted: 'કારણ કાઢી નાખ્યું.',
      undo: 'પાછું લો',
      sbNoReasons: 'હજી કોઈ કારણ પોસ્ટ થયું નથી.',
      sbShowAll: 'બધું બતાવો',
      sbOffline: 'બોર્ડ અત્યારે ઉપલબ્ધ નથી - આ ડિવાઇસ પર છેલ્લે જોયેલું બતાવીએ છીએ.',
      sbNoMatch: 'આ શોધ સાથે કોઈ સ્ટોક મળ્યો નથી.',
      sbEmpty: 'હજી કોઈ સ્ટોક નથી. સેટિંગ્સમાં તમારી વોચલિસ્ટમાં કંપનીઓ ઉમેરો, તે અહીં બધાના વોટ માટે દેખાશે.',
      sbMore: 'વધુ બતાવો',
      sbSearchPh: 'સ્ટોક શોધો',
      sbNote: 'આજનો મૂડ: છેલ્લા 24 કલાકના વોટ, દરેક વ્યક્તિનો દરેક સ્ટોક પર એક. આ વપરાશકર્તાઓના મત છે, રોકાણ સલાહ નથી.',
      sbPosted: 'વોટ પોસ્ટ થયો',
      sbFailed: 'પોસ્ટ ન થઈ શક્યું - કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.',
      sbDeleteConfirm: 'આ કારણ કાઢી નાખવું? તેની સાથે તમારો વોટ પણ દૂર થશે.',
      agBoardTitle: 'વોટ કરવા સાઇન ઇન કરો',
      agBoardBody: 'મફત ખાતું દરેક વ્યક્તિને દરેક સ્ટોક પર દિવસમાં એક વોટ સુધી મર્યાદિત રાખે છે. બોર્ડ વાંચવા ખાતાની જરૂર નથી.',
      obStepRTitle: 'સમાચાર રિફ્રેશ કરો', obStepRBody: 'QwickSignal ની બાજુની પાંચ પટ્ટીઓ રિફ્રેશ બટન છે. તાજા સમાચાર લાવવા ગમે ત્યારે દબાવો. લોડ થતી વખતે તે હલે છે.',
      obStep0Title: 'તમારી ગેરહાજરીમાં',
      obStep0Body: 'પાછા આવો ત્યારે આ કાર્ડ છેલ્લી મુલાકાત પછી શું બદલાયું તે જણાવે છે - સીધા ત્યાં જવા લાઇન પર ટેપ કરો.',
      obReplay: 'ટૂર ફરી જુઓ'
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
  // Language moved from the header into Settings -> Language (owner, 14 Oct).
  const LANG_NAMES = { en: 'English', hi: 'हिंदी (Hindi)', mr: 'मराठी (Marathi)', gu: 'ગુજરાતી (Gujarati)' };
  function renderLangChoices() {
    const box = $('#langChoices');
    if (!box) return;
    box.innerHTML = Object.entries(LANG_NAMES).map(([code, name]) =>
      `<button type="button" class="lang-row${code === currentLang ? ' active' : ''}" role="radio" aria-checked="${code === currentLang}" data-lang="${code}">
        <span>${esc(name)}</span><span class="lang-tick" aria-hidden="true">${code === currentLang ? '✓' : ''}</span></button>`).join('');
  }
  function setLang(lang) {
    currentLang = I18N[lang] ? lang : 'en';
    try { localStorage.setItem(LANG_KEY, currentLang); } catch (e) { /* private browsing etc. */ }
    applyI18n();
    renderAll(); renderCountryViewer();   // re-render the news itself too, not just the app chrome
  }

  /* ---------- Appearance (light/dark) ----------
     Mirrors loadLang()/setLang() above exactly: a plain on-device preference (THEME_KEY), not synced
     across devices via Sync - the index.html :root/@media blocks already do the actual color-swapping
     (see the THEME comment there), this module only ever sets/clears data-theme="light"/"dark" on
     <html> and keeps the <meta name=theme-color> tag that matches the ACTIVE theme in sync, so the
     browser's own chrome (status bar, task switcher card) matches too. "system" (the default - no
     explicit choice made yet) removes data-theme entirely so prefers-color-scheme alone decides, which
     is exactly how the app behaved before this setting existed - approving dark mode never changes what
     a visitor who's never touched this setting sees. */
  const THEME_KEY = 'qs-theme-v1';
  const THEME_LABEL = { system: 'Default', light: 'Light', dark: 'Dark' };
  // Appearance is now a single "Dark mode" switch (owner, 14 Oct). Until it is touched the app follows the
  // phone's own setting; the switch always shows the look that is actually on screen.
  function themeActive() {
    const pref = Theme.pref();
    if (pref !== 'system') return pref;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  const Theme = {
    pref() { try { const v = localStorage.getItem(THEME_KEY); return (v === 'light' || v === 'dark') ? v : 'system'; } catch (e) { return 'system'; } },
    set(pref) {
      try {
        if (pref === 'light' || pref === 'dark') localStorage.setItem(THEME_KEY, pref);
        else localStorage.removeItem(THEME_KEY);
      } catch (e) { /* private browsing etc: choice just won't survive a reload */ }
      this.apply();
    },
    apply() {
      const pref = this.pref();
      if (pref === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', pref);
      // Which theme is ACTUALLY showing right now - "system" resolves through the OS setting, so the
      // meta-tag sync below needs the resolved value, not the raw preference.
      const active = pref === 'system'
        ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : pref;
      const light = $('meta[name="theme-color"][media*="light"]');
      const dark = $('meta[name="theme-color"][media*="dark"]');
      // Both scoped tags get the SAME content, matching the active theme - the browser still only honors
      // the one whose media query matches, but keeping them equal means an explicit in-app choice (which
      // can disagree with the OS setting) is reflected correctly rather than relying on a media match
      // that may point the other way.
      const color = active === 'dark' ? '#18140F' : '#F9ECDC';
      if (light) light.setAttribute('content', color);
      if (dark) dark.setAttribute('content', color);
      const dm = $('#darkModeSwitch');
      if (dm) dm.checked = active === 'dark';
    }
  };

  /* ---------- Digest: "since you left" summary ----------
     User's request: a short recap of what arrived while the app wasn't being looked at, shown when it's
     opened again - not a server feature (no new pipeline/API/cost), just a client-side read of data
     already on the device: S.live (already-fetched stories) and S.reviewed (already-tracked read state,
     see SeenTracker above). "Since you left" only means something after a real gap, not every 2-minute
     background poll (AUTO_REFRESH_MS) or tab switch - so this tracks its own lastActiveAt, separate from
     S.lastLive (which is about feed freshness, not user presence), and only treats the app as having
     been "left" once that gap passes GAP_MS. Device-local only (localStorage), like Theme/loadLang() -
     presence isn't account data and has no reason to sync across devices. */
  const DIGEST_LAST_ACTIVE_KEY = 'qs-digest-lastactive-v1';
  const DIGEST_GAP_MS = 20 * 60e3;      // below this, "away" was probably just a tab switch, not a real absence
  const DIGEST_DISMISS_KEY = 'qs-digest-dismissed-v1';   // per-load only (see renderDigest) - not persisted
  const Digest = {
    lastActive() { try { return parseInt(localStorage.getItem(DIGEST_LAST_ACTIVE_KEY), 10) || 0; } catch (e) { return 0; } },
    touch() { try { localStorage.setItem(DIGEST_LAST_ACTIVE_KEY, String(Date.now())); } catch (e) { /* ignore */ } },
    // Returns the moment the user was last here if that was long enough ago to count as having left, or 0
    // otherwise. renderDigest() needs the timestamp itself, not just a yes/no, because "since you left"
    // has to mean stories that ARRIVED after that moment - counting every unread story instead would
    // claim credit for a backlog the person had already scrolled past before closing the app. Touches the
    // timestamp immediately, so a second call in the same session (another loadLive()) returns 0.
    consumeGap() {
      const last = this.lastActive();
      this.touch();
      if (!last) return 0;                 // first-ever load on this device - nothing to recap yet
      return (Date.now() - last) >= DIGEST_GAP_MS ? last : 0;
    }
  };
  // Keeps lastActive current while the app is actually in front of the user, so the NEXT open measures
  // the gap from when they truly stopped looking, not from whenever start() last happened to run.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Digest.touch(); });
  window.addEventListener('pagehide', () => Digest.touch());

  // awaySince: the ms timestamp the user was last here, or 0 for "don't show this" (no real gap, or a
  // first-ever launch) - see Digest.consumeGap().
  // News and Investment each get their own card, counting only their own stories, and each is dismissed
  // separately. The moment the person was away is kept, so switching tabs redraws the right card.
  let digestAwaySince = 0;
  function renderDigest(awaySince) {
    const box = $('#digestCard');
    if (!box) return;
    if (awaySince !== undefined) digestAwaySince = awaySince;
    awaySince = digestAwaySince;
    const invMode = S.mode === 'investment', dismissKey = DIGEST_DISMISS_KEY + (invMode ? '-inv' : '-news');
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(dismissKey) === '1'; } catch (e) { /* ignore */ }
    if (!awaySince || dismissed) { box.hidden = true; return; }
    // "Since you left" means both halves literally: published AFTER the moment they stopped looking (not
    // merely unread - a backlog they'd already scrolled past before closing the app isn't news to them),
    // and still worth showing (not dismissed/expired, in their channel selection). Live items only; a
    // manually-added one never "arrived" while they were away.
    const unread = S.live.filter(it => it.addedAt > awaySince && !S.reviewed.has(it.id)
      && itemStatus(it) !== 'dismissed'
      && (invMode ? isCompanyStory(it) : channelVisible(it)));
    if (!unread.length) { box.hidden = true; return; }
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    unread.forEach(it => { if (counts[it.importance] != null) counts[it.importance]++; });
    const rows = ['Critical', 'High', 'Medium', 'Low']
      .map(k => `<div class="digest-row ${k.toLowerCase() === 'critical' ? 'crit' : k.toLowerCase()}${counts[k] ? '' : ' none'}">
          <span class="dg-count">${counts[k]}</span><span class="dg-label">${esc(k)}</span>
        </div>`).join('');
    box.hidden = false;
    box.innerHTML = `
      <div class="digest-head">
        <h2>${unread.length} ${invMode ? (unread.length === 1 ? 'company update' : 'company updates') : (unread.length === 1 ? 'story' : 'stories')} since you left</h2>
        <button type="button" class="digest-close" aria-label="Dismiss">&times;</button>
      </div>
      <div class="digest-rows">${rows}</div>
    `;
    box.querySelector('.digest-close').addEventListener('click', () => {
      try { sessionStorage.setItem(dismissKey, '1'); } catch (e) { /* ignore */ }
      box.hidden = true;
    });
  }

  /* ---------- Appetite: how much news this person actually wants ----------
     The priority floor in Settings > Notifications asks people to think in the app's own vocabulary
     ("High and above"), which is a question about how QwickSignal classifies things rather than a
     question about their life. This asks the one they can answer without knowing anything about the
     app - "about 15 stories a day" - and works backwards to the floor that lands nearest it.

     No new tracking is needed to do that. feed.json is a rolling 24-hour window (prune() in
     pipeline.py), so simply counting the live stories this visitor can see IS their stories-per-day
     figure, broken down by priority, measured rather than guessed.

     Two honesty constraints shape the whole feature:
       1. Four priority tiers are coarse, so an exact match to a target is usually impossible. Every
          screen shows the number it actually resolved to, never the target, and the full ladder of
          options with their real counts is visible so the choice can be made directly instead.
       2. Nothing is ever deleted or permanently hidden. Everything below the floor stays in the app,
          one tap away, and the feed says plainly how much is sitting there.

     Device-local (like Theme and language), and it drives the push floor it replaces - see syncPush()
     below and the note in renderNotifBox(). */
  const APPETITE_KEY = 'qs-appetite-v1';
  // A slider now (owner, 14 Oct): 20, 40, 60, 80, 100 stories a day, or Everything (0 = don't filter).
  const APPETITE_CHOICES = [20, 40, 60, 80, 100];
  const Appetite = {
    // Session-only: "Show the rest" reveals everything below the floor until the next launch. Kept out
    // of storage deliberately, so revealing once doesn't quietly undo the setting for good.
    revealed: false,

    target() {
      try {
        const n = parseInt(localStorage.getItem(APPETITE_KEY), 10);
        if (!(n > 0)) return 0;
        // A choice saved under the old 5-40 scale moves to the nearest new step.
        return APPETITE_CHOICES.reduce((best, c) => Math.abs(c - n) < Math.abs(best - n) ? c : best, APPETITE_CHOICES[0]);
      } catch (e) { return 0; }
    },
    set(n) {
      const v = APPETITE_CHOICES.includes(n) ? n : 0;
      try {
        if (v) localStorage.setItem(APPETITE_KEY, String(v));
        else localStorage.removeItem(APPETITE_KEY);
      } catch (e) { /* private browsing: holds for this session only */ }
      this.revealed = false;
      track('appetite_set', { target: v });
      this.syncPush();
    },
    on() { return this.target() > 0; },

    // Stories per day by priority, for this visitor's channel selection.
    volume() {
      const v = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      // Counted over every story in scope INCLUDING ones the person has skipped. This used to count only what
      // was still on screen, so skipping one story shrank the numbers, the cut-off priority moved to the next
      // level, and a whole batch of other stories vanished at once - and Undo brought them all back, which
      // looked like the page reloading.
      all().forEach(it => {
        if (!it.live || itemStatus(it) === 'expired' || !channelVisible(it)) return;
        if (v[it.importance] != null) v[it.importance]++;
      });
      return v;
    },
    // The four choosable floors with their cumulative daily counts, most important first.
    ladder() {
      const v = this.volume();
      let run = 0;
      return E.IMP_ORDER.map(lv => { run += v[lv]; return { floor: lv, own: v[lv], count: run }; });
    },
    // The floor landing nearest the target. Ties and overshoots are both possible and both fine - what
    // matters is that the resolved count is what gets displayed.
    solve(target) {
      const t = target == null ? this.target() : target;
      const rungs = this.ladder();
      const all = rungs[rungs.length - 1];
      if (!t) return { floor: 'Low', count: all.count, over: false };
      let best = rungs[0];
      rungs.forEach(r => { if (Math.abs(r.count - t) < Math.abs(best.count - t)) best = r; });
      return { floor: best.floor, count: best.count, over: best.count > t };
    },
    // Active only when a target is set AND there is a real feed to measure. Without the second check a
    // cold start (S.live still empty) would resolve to a zero-count floor and hide the entire feed.
    active() {
      if (!this.on()) return false;
      const rungs = this.ladder();
      return rungs[rungs.length - 1].count > 0;
    },
    floor() { return this.active() ? this.solve().floor : 'Low'; },
    allows(it) { return E.impRank(it.importance) >= E.impRank(this.floor()); },
    // How many stories this visitor would otherwise see are sitting below the floor right now.
    hidden() {
      if (!this.active()) return 0;
      const r = E.impRank(this.floor());
      return visibleItems().filter(it => E.impRank(it.importance) < r).length;
    },

    /* The resolved floor also becomes the push floor, so "about 15 a day" governs what interrupts you
       as well as what the feed leads with - otherwise the two settings would quietly disagree. Only
       ever raises or lowers min_imp while appetite is on; turning appetite off leaves the last value in
       place rather than resetting a choice the person may now want to keep. */
    syncPush() {
      if (!this.active() || !Push.isOn()) return;
      const want = this.solve().floor;
      if (Push.prefs().minImp !== want) Push.savePrefs({ minImp: want });
    }
  };

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

  // Several strings in ONE request (the endpoint accepts repeated q=). Each string comes back as one or more
  // [translated, original] segments, so the answer is matched to its string by rebuilding the original text
  // piece by piece. If that does not add up exactly - or the endpoint ignores the extra strings - this throws
  // 'MAPFAIL' and the caller falls back to one request per string, for good. It can never mix up two stories.
  async function translateMany(texts, lang) {
    const qs = texts.map(t => '&q=' + encodeURIComponent(t)).join('');
    const r = await fetch(`${TR_ENDPOINT}?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t${qs}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const segs = ((await r.json())[0]) || [];
    const outs = [];
    let i = 0, orig = '', tr = '';
    for (const seg of segs) {
      if (i >= texts.length) throw new Error('MAPFAIL');
      tr += seg[0] || ''; orig += seg[1] || '';
      if (orig.length > texts[i].length) throw new Error('MAPFAIL');
      if (orig.length === texts[i].length) {
        if (orig !== texts[i]) throw new Error('MAPFAIL');
        outs.push(tr); orig = ''; tr = ''; i++;
      }
    }
    if (i !== texts.length) throw new Error('MAPFAIL');
    return outs;
  }

  // Swaps the translated text into cards already on screen, in place - no innerHTML rebuild, so nothing
  // flashes, replays its fade-in, loses scroll position, or drops an in-progress swipe/tap. This is what
  // actually fixes the "choppy, bouncy" feeling: a full renderList()/renderAll() used to run after every
  // single card's translation landed (up to TR_CONCURRENCY at once), tearing down and rebuilding the whole
  // list each time. Only touches nodes whose text actually changed, so untranslated/unaffected cards are
  // left completely alone.
  function patchTranslations() {
    if (currentLang === 'en') return;
    const byId = new Map(all().map(x => [x.id, x]));
    $$('#list .entry[data-id], #savedList .entry[data-id], #savedInvestList .entry[data-id]').forEach(card => {
      const it = byId.get(card.dataset.id);
      if (!it) return;
      const hl = card.querySelector('.entry-text > .hl, :scope > .hl');
      if (hl && it.headline) { const v = trOf(it.headline); if (hl.textContent !== v) hl.textContent = v; }
      const sum = card.querySelector('.entry-text > .sum, :scope > .sum');
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
  // Concurrency adapts: a few requests at once normally, more while the QR gate is preparing the first screen,
  // and fewer for a few seconds after any request fails (the free endpoint throttles bursts).
  let TR_CONCURRENCY = 4;   // QRGate raises this while it prepares the first screen
  let trThrottleUntil = 0;
  const TR_FAILS = new Map();   // key -> failed attempts so far
  const TR_MAX_TRIES = 6;
  const TR_GAVE = new Set();    // strings that kept failing: left in English for now, tried again in 15s (never cached as English)
  const trLimit = () => Date.now() < trThrottleUntil ? 2 : TR_CONCURRENCY;
  let trActive = 0;
  const trQueue = [];
  let trBatchOK = true;          // turned off for good the first time a batched answer can't be matched up
  const TR_BATCH_N = 6, TR_BATCH_CHARS = 1800;
  function trPump() {
    while (trActive < trLimit() && trQueue.length) {
      const group = [], keys = [];
      let chars = 0;
      while (trQueue.length && group.length < (trBatchOK ? TR_BATCH_N : 1)) {
        const text = trQueue[0], key = trKey(text);
        if (TR_CACHE.has(key) || TR_PENDING.has(key)) { trQueue.shift(); continue; }
        if (group.length && chars + text.length > TR_BATCH_CHARS) break;
        trQueue.shift(); group.push(text); keys.push(key); chars += text.length; TR_PENDING.add(key);
      }
      if (!group.length) continue;
      trActive++;
      const lang = currentLang;
      (group.length > 1 ? translateMany(group, lang) : translateOne(group[0], lang).then(o => [o]))
        .then(outs => group.forEach((text, i) => { TR_CACHE.set(keys[i], outs[i] || text); TR_FAILS.delete(keys[i]); }))
        .catch(err => {
          if (err && err.message === 'MAPFAIL') {            // batching doesn't work here: one by one from now on
            trBatchOK = false;
            for (let i = group.length - 1; i >= 0; i--) { TR_PENDING.delete(keys[i]); trQueue.unshift(group[i]); }
            return;
          }
          // A hiccup (throttling, a dropped connection) must NOT leave the story in English for good: try again
          // a little later, a few times, and only then give up on that string.
          trThrottleUntil = Date.now() + 6000;
          group.forEach((text, i) => {
            const n = (TR_FAILS.get(keys[i]) || 0) + 1;
            TR_FAILS.set(keys[i], n);
            if (n < TR_MAX_TRIES) setTimeout(() => { if (!TR_CACHE.has(keys[i])) { trQueue.push(text); trPump(); } }, 1200 * n);
            else {
              TR_GAVE.add(keys[i]);
              setTimeout(() => { TR_GAVE.delete(keys[i]); TR_FAILS.delete(keys[i]); if (!TR_CACHE.has(keys[i])) { trQueue.push(text); trPump(); } }, 15000);
            }
          });
        })
        .finally(() => { keys.forEach(k => TR_PENDING.delete(k)); trActive--; trRefreshSoon(); trPump(); });
    }
    if (trQueue.length && trActive === 0) setTimeout(trPump, 500);   // everything paused by the throttle: look again
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
    tab: 'brief',
    open: new Set(),
    exportRange: 'today',
    f: { range: '7d', country: '', sector: '', imp: '', q: '', view: 'priority', investSector: '' },
    syncCode: null,          // this device's sync code (also usable on other devices to share state)
    saved: new Set(),        // article ids saved by the user (Phase B, kept here so Sync can use it early)
    dismissed: new Set(),    // article ids dismissed by the user (Phase B)
    myChannels: new Set(),   // Telegram channels this user has chosen to follow (empty = follow everything)
    hiddenChannels: new Set(), // channels this user has explicitly removed/hidden from their own Telegram list
    reviewed: new Set(),     // article ids the user has opened in the Country Status viewer (Phase C)
    bvOpen: new Set(),       // companies whose broker-view panel is open on the Investment tab
    myCompanies: new Set(),  // companies this user is tracking (invested in / watching) - News/Investment toggle
    myInvestChannels: new Set(), // Telegram channels linked specifically for Investment mode - local/personal
                                  // only (unlike myChannels/Channels.*, there's no shared owner-curated pool
                                  // here; this is simpler on purpose, same personal-list pattern as myCompanies)
    mode: 'news',            // 'news' (country-grouped, unchanged) or 'investment' (sector->company groups, tracked companies only)
    cv: null,                // { country, idx, stories } while the Country Status viewer is open; not persisted
    settingsPage: null       // id of the open Settings drill-down sub-page (e.g. 'notifications'), or null while
                             // on the Settings destinations list - see openSettingsPage()/closeSettingsPage()
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
  const SYNC_DIRTY_KEY = 'qs-sync-dirty-v1';   // see pushSoon()/push()/init() below for what this guards against
  const SYNC_RECENT_CAP = 2000;   // reviewed/dismissed ids kept in sync - see snapshot(); firestore.rules allows 5000
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
    // No Storage bucket here: ticket attachments (Tickets.submit() below) are stored as base64 text directly
    // on the Firestore ticket document, not in Firebase Storage - Storage requires the project to be on
    // Firebase's paid "Blaze" plan, which the owner decided against. See the TICKET_ATTACH_MAX_BYTES comment
    // in renderTicketBox() for the size-limit rationale.
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
      INVALID_PASSWORD: 'Incorrect email or password. Forgot it? Tap “Forgot password?”.',
      INVALID_LOGIN_CREDENTIALS: 'Incorrect email or password. Forgot it? Tap “Forgot password?”.',
      RESET_PASSWORD_EXCEED_LIMIT: 'Too many reset emails – wait a while and try again.',
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
    // Forgot password: Firebase emails a link to choose a new password (free on the Spark plan). Separate
    // from _call() because it signs nobody in - there is no session in the reply to apply.
    async sendPasswordReset(email) {
      try {
        const r = await fetch(`${IDTOOLKIT}/accounts:sendOobCode?key=${FIREBASE.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }) });
        if (r.ok) return { ok: true };
        const d = await r.json().catch(() => ({}));
        return { ok: false, error: authErrorMessage(d) };
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

    // BUG FIX: a change (track a company, save a story, follow a channel...) used to be considered "safe"
    // the moment pushSoon() wrote it to the local cache, but the local cache is only ever read back by
    // Sync.init() on THIS SAME device/browser - it is never what makes a change durable across a real app
    // restart on mobile, where the OS can and does kill a PWA outright (not just background it) well before
    // pushSoon()'s 600ms debounce timer fires. The actual durable copy is the Firestore doc push() writes -
    // and until that network call lands, init()'s own pull() on the next launch unconditionally overwrites
    // S.* with whatever the server still has (see pull() below), silently discarding the unsent change with
    // no error shown anywhere. This flag tracks "is there a change sitting only in the local cache that the
    // server doesn't have yet" - set synchronously the instant a change is made (isDirty() below), cleared
    // only once push() gets a real HTTP-ok response back. init() checks it before trusting a pull().
    isDirty() { try { return localStorage.getItem(SYNC_DIRTY_KEY) === '1'; } catch (e) { return false; } },
    markDirty() { try { localStorage.setItem(SYNC_DIRTY_KEY, '1'); } catch (e) { /* ignore */ } },
    clearDirty() { try { localStorage.removeItem(SYNC_DIRTY_KEY); } catch (e) { /* ignore */ } },

    async init() {
      let code = this.localCode();
      if (!code) { code = newSyncCode(); this.saveLocalCode(code); }
      this.code = code;
      S.syncCode = code;
      const cached = this.cacheRead();       // show something instantly; the network read (if any) refines it after
      if (cached) this.applyRecord(cached);
      // If an earlier launch made a change that never actually made it to the server (app closed/killed
      // before pushSoon()'s debounced push() fired, or the device was offline at the time), the local cache
      // is AHEAD of the server - pulling now would silently throw that change away. Push the cached state up
      // first so it becomes the server's copy; only once nothing is outstanding do we fall back to the
      // normal pull-is-truth behavior. If this push also fails (still offline), the dirty flag stays set and
      // the same recovery is retried on the next launch.
      if ((this.code || Auth.uid) && this.isDirty()) { await this.push(); return; }
      await this.pull();
    },

    async switchTo(code) {
      code = (code || '').trim().toUpperCase();
      if (!validSyncCode(code)) { toast('That code doesn\u2019t look right. It should look like QS-AB12-CD34.'); return false; }
      this.saveLocalCode(code);
      this.code = code;
      S.syncCode = code;
      this.cacheWrite(null);
      this.clearDirty();   // any unsent change belonged to the PREVIOUS code's doc, not this one - don't push it there
      S.saved = new Set(); S.dismissed = new Set(); S.myChannels = new Set(); S.hiddenChannels = new Set(); S.reviewed = new Set(); S.myCompanies = new Set(); S.myInvestChannels = new Set();
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
      S.myInvestChannels = new Set(rec.investChannels || []);
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
        setTimeout(() => SavedCloud.reconcile(), 0);   // contents of stories saved on other devices
        if (!Auth.uid) this.cacheWrite(rec);    // the local cache is a guest-mode-only convenience
        this.ready = true;
        this.lastPullFoundDoc = true;
        return true;
      } catch (e) {
        this.ready = false;           // network trouble or first run offline: keep working from the local cache
        return false;
      }
    },

    // Snapshot of S's syncable fields, as a plain object - shared by the immediate cache write below and
    // the (possibly much later) network push, so both always agree on exactly what "current state" means.
    //
    // BUG FIX: reviewed and dismissed were never pruned, and firestore.rules caps each at 5000 entries. The
    // app marks every story scrolled past as reviewed (SeenTracker), and the feed publishes ~280 stories a
    // day, so an active reader crosses 5000 in under three weeks - at which point Firestore rejects the
    // ENTIRE document on every save and nothing (companies, channels, saved stories) syncs again. Both
    // lists only matter for stories still in the 24-hour feed, so keeping the most recent SYNC_RECENT_CAP
    // ids is far more than enough. A Set keeps insertion order, so the tail IS the most recent. saved is
    // deliberately never trimmed: those are the user's own explicit choices.
    snapshot() {
      const recent = set => { const a = [...set]; return a.length > SYNC_RECENT_CAP ? a.slice(-SYNC_RECENT_CAP) : a; };
      return { saved: [...S.saved], dismissed: recent(S.dismissed), channels: [...S.myChannels], hiddenChannels: [...S.hiddenChannels], reviewed: recent(S.reviewed), companies: [...S.myCompanies], investChannels: [...S.myInvestChannels] };
    },

    // Reads the server copy WITHOUT applying it - push() needs to look before it writes (see below).
    async fetchRecord() {
      try {
        const r = await fetch(this.docUrl(), { cache: 'no-store', headers: await this.authHeaders() });
        if (r.status === 404) return { status: 'missing' };
        if (!r.ok) return { status: 'error', code: r.status };
        const doc = await r.json();
        return { status: 'found', rec: fsFieldsToObject(doc.fields) };
      } catch (e) { return { status: 'error' }; }
    },

    // Adds anything in rec that S doesn't already have. Union, never replace: when two copies of the same
    // account disagree and it isn't certain which is newer, keeping both is the only choice that can't
    // lose data. The cost is that something removed in one copy can reappear from the other - a far
    // smaller harm than a watchlist vanishing. Returns how many items were added.
    mergeInto(rec) {
      let added = 0;
      const add = (set, arr) => (arr || []).forEach(x => { if (!set.has(x)) { set.add(x); added++; } });
      add(S.saved, rec.saved); add(S.dismissed, rec.dismissed); add(S.myChannels, rec.channels);
      add(S.hiddenChannels, rec.hiddenChannels); add(S.reviewed, rec.reviewed);
      add(S.myCompanies, rec.companies); add(S.myInvestChannels, rec.investChannels);
      return added;
    },
    rerender() { renderAll(); renderChannels(); renderInvestChannels(); renderInvestmentBox(); },

    // A per-account copy kept ONLY when signing out couldn't confirm the account's latest state reached
    // the server (offline, or a rejected write). completeAuth() merges it back in on the next sign-in to
    // the same account and deletes it once the server has it.
    backupKey(uid) { return 'qs-sync-backup-v1-' + uid; },
    readBackup(uid) { try { return JSON.parse(localStorage.getItem(this.backupKey(uid)) || 'null'); } catch (e) { return null; } },
    writeBackup(uid, rec) {
      const prev = this.readBackup(uid);
      if (prev) for (const k in prev) rec[k] = [...new Set((prev[k] || []).concat(rec[k] || []))];   // never drop an older unsent backup
      try { localStorage.setItem(this.backupKey(uid), JSON.stringify(rec)); } catch (e) { /* storage full */ }
    },
    clearBackup(uid) { try { localStorage.removeItem(this.backupKey(uid)); } catch (e) { /* ignore */ } },

    // A save the SERVER refused (4xx) is not a network blip - it will fail identically every time until
    // something is fixed. That is exactly how the missing-investChannels bug went unnoticed for days: every
    // save failed silently while the on-device copy made everything look fine. Logged every time, shown to
    // the user once per session.
    _rejectReported: false,
    reportRejected(status, body) {
      console.error('[QwickSignal] sync save rejected by the server (HTTP ' + status + '):', body);
      if (this._rejectReported) return;
      this._rejectReported = true;
      toast('Couldn’t save to your account just now. Your changes are kept on this device and will keep retrying.');
    },

    async push() {
      if (!this.code && !Auth.uid) return false;
      // NEVER write blind. Until this session has successfully read the server's copy (ready), the local
      // state can't be trusted to be complete - right after signing in while offline, for instance, S.* is
      // empty, and a single tap that triggers a save would otherwise overwrite the account's real data with
      // that near-empty state. So look first, fold in anything the server has that this device doesn't,
      // and only then write. If the server can't be reached at all, don't write - stay dirty and retry.
      if (!this.ready) {
        const got = await this.fetchRecord();
        if (got.status === 'error') return false;
        if (got.status === 'found' && this.mergeInto(got.rec)) this.rerender();
      }
      const rec = this.snapshot();
      // Written for a signed-in account too, not just guests, as a crash-recovery fallback (see pushSoon()
      // below). Previously the comment here said Sync.init()'s pull() "still always overwrites this with
      // the server's copy whenever the network succeeds" - that was the actual bug (see isDirty()'s own
      // comment above): if THIS push never lands before the app restarts, the next init() would pull the
      // server's older copy and silently discard this change. init() now checks isDirty() first and pushes
      // instead of pulling whenever a change is still outstanding, so this cache write is the thing that
      // makes that recovery possible, not just a crash-recovery nicety.
      this.cacheWrite(rec);
      try {
        const fields = { saved: toFsValue(rec.saved), dismissed: toFsValue(rec.dismissed), channels: toFsValue(rec.channels), hiddenChannels: toFsValue(rec.hiddenChannels), reviewed: toFsValue(rec.reviewed), companies: toFsValue(rec.companies), investChannels: toFsValue(rec.investChannels) };
        const headers = Object.assign({ 'Content-Type': 'application/json' }, await this.authHeaders());
        // The account's masked name ("raj•••") rides along so the Sentiment board can show who tracks a stock.
        // If the published firestore.rules don't allow the field yet, the write is refused - then retry once
        // without it and stop sending it, so sync itself is never affected.
        let sendDn = false;
        try { sendDn = !!Auth.uid && !!Auth.email && Date.now() - Number(localStorage.getItem('qs-nodn-v1') || 0) > 864e5; } catch (e) { sendDn = !!Auth.uid && !!Auth.email; }   // storage blocked: send; refused lately: retried after a day
        const dnFields = sendDn ? Object.assign({}, fields, { dn: { stringValue: Board.maskedName() } }) : fields;
        let r = await fetch(this.docUrl(), { method: 'PATCH', headers, body: JSON.stringify({ fields: dnFields }) });
        if (!r.ok && sendDn && r.status >= 400 && r.status < 500) {
          try { localStorage.setItem('qs-nodn-v1', String(Date.now())); } catch (e) { /* storage blocked */ }
          r = await fetch(this.docUrl(), { method: 'PATCH', headers, body: JSON.stringify({ fields }) });
        }
        if (!r.ok) {
          if (r.status >= 400 && r.status < 500) this.reportRejected(r.status, await r.text().catch(() => ''));
          throw new Error('HTTP ' + r.status);
        }
        this.ready = true;
        this.clearDirty();             // confirmed on the server now - nothing left for the next launch to recover
        if (Auth.uid) this.clearBackup(Auth.uid);   // whatever a past sign-out set aside is now on the server too
        return true;
      } catch (e) {
        return false;                 // still only local; isDirty() stays set so the next launch (or next pushSoon) retries
      }
    },

    // BUG FIX (original): pushSoon() used to ONLY schedule Sync.push() 600ms later, with nothing saved
    // anywhere in the meantime - not even the local cache, since that write used to live inside push()
    // itself, behind the same debounce, and only ever for a signed-OUT guest at that. A real cost of that:
    // add a company (or save a story, follow a channel, etc), then switch away from the tab/app quickly -
    // many mobile browsers suspend or discard a backgrounded page's timers, so the 600ms setTimeout never
    // fires, nothing is ever written to localStorage, and the next load's Sync.init() (cacheRead() finding
    // nothing new, then pull() loading the server's older copy) shows the watchlist exactly as it was before
    // the add - the new company is just gone, with no error. Fixed by writing the local cache SYNCHRONOUSLY,
    // right here, on every call, for both guest and signed-in.
    //
    // BUG FIX (this round): that first fix made the change survive on THIS device's own localStorage, but
    // did nothing about Sync.init()'s pull() on the NEXT launch still unconditionally overwriting S.* with
    // the server's copy - so if the debounced push() below hadn't actually landed yet (app killed within
    // that 600ms window, or offline at the time), the very next launch would pull the server's stale copy
    // over the correct local one, and the add would vanish again despite being "saved" from the user's
    // point of view. markDirty() here is the other half of that fix: it records, synchronously and
    // immediately, that a push is now owed to the server. init() checks it on the next launch and pushes the
    // (newer) local state up first instead of blindly pulling the (older) server state down; push() above
    // only clears it once the server has actually confirmed the write.
    //
    // The timer handle now lives on the object (not a closure) so signOut() can cancel it: a save still
    // pending when someone signs out used to fire AFTER S.* had been cleared and Auth.uid nulled, writing
    // an empty record into the guest doc.
    _pushTimer: null,
    cancelPending() { clearTimeout(this._pushTimer); this._pushTimer = null; },
    pushSoon: () => {
      Sync.cacheWrite(Sync.snapshot());
      Sync.markDirty();
      clearTimeout(Sync._pushTimer);
      Sync._pushTimer = setTimeout(() => { Sync._pushTimer = null; Sync.push(); }, 600);
    }
  };

  /* ---------- Phase E: account UI ---------- */
  // Runs right after a successful sign-up/sign-in/Google call. Auth.uid is already set at this point, so
  // Sync.pull() below reads this account's own qs_users/{uid} doc instead of the guest one.
  async function completeAuth() {
    const hadGuestData = !!(S.saved.size || S.dismissed.size || S.myChannels.size || S.hiddenChannels.size || S.reviewed.size || S.myCompanies.size || S.myInvestChannels.size);
    const clearState = () => { S.saved = new Set(); S.dismissed = new Set(); S.myChannels = new Set(); S.hiddenChannels = new Set(); S.reviewed = new Set(); S.myCompanies = new Set(); S.myInvestChannels = new Set(); };
    Sync.lastPullFoundDoc = false;   // pull() only sets this on success - don't let a previous call's answer leak in
    const pulled = await Sync.pull();
    let msg = 'Signed in as ' + Auth.email + '.';
    if (!pulled) {
      // Couldn't reach the account at all, so whether it already has data is unknown. Showing the guest
      // data as if it were the account's would be misleading, and offering to merge it is a question that
      // can't be answered yet. Start empty; push() refuses to write until it has read the server copy
      // (see push()), so nothing the user does meanwhile can overwrite the account's real data.
      clearState();
      msg = 'Signed in as ' + Auth.email + '. Your saved data will appear once you’re back online.';
    } else if (hadGuestData && !Sync.lastPullFoundDoc) {
      // pull() found no existing doc for this account (a brand-new account, or a returning one that never
      // synced from this browser before) - S.* still holds the guest data, unchanged. If the account already
      // had its own cloud data, pull() has just loaded it - nothing to offer merging in.
      const bring = confirm('Bring your existing saved articles, dismissed items and followed channels into this account?');
      if (!bring) clearState();
      else { Sync.cacheWrite(Sync.snapshot()); Sync.markDirty(); await Sync.push(); }   // dirty: retried next launch if this push fails
      if (bring) msg = 'Signed in as ' + Auth.email + '. Your existing data is now saved to this account.';
    }
    // Anything set aside by an earlier sign-out that couldn't confirm its last save (see signOut()) comes
    // back now, merged with whatever the account already had, then saved.
    const backup = Auth.uid ? Sync.readBackup(Auth.uid) : null;
    if (backup) {
      const restored = Sync.mergeInto(backup);
      Sync.cacheWrite(Sync.snapshot()); Sync.markDirty();
      await Sync.push();   // clears the backup itself on success; on failure the dirty flag retries next launch
      if (restored) msg = 'Signed in as ' + Auth.email + '. Restored ' + restored + ' change' + (restored === 1 ? '' : 's') + ' that hadn’t reached your account before you signed out.';
    }
    toast(msg);
    SavedCloud.tried.clear();
    setTimeout(() => SavedCloud.reconcile(), 0);   // stories saved on the account's other devices
    Push.syncAccount();   // notifications now personalised from THIS account's portfolio
    TicketNews.rows = null; setTimeout(() => { TicketNews.check(); Board.publishMine(); }, 1500);
    renderAccount(); renderAll(); renderChannels(); renderInvestChannels(); renderSyncCode(); renderTicketBox(); renderTicketAdmin(); renderInvestmentBox();
    resumeAfterSignIn();
    Onboarding.afterSignIn();
  }

  // BUG FIX: signing out used to clear the device's copy of the account's data immediately, without first
  // checking the server actually had it. Whenever the last save hadn't landed - still inside the 600ms
  // debounce, offline, or (for days) refused outright by the missing-investChannels rule - that clear was
  // the moment the data was destroyed. Now: finish any pending save while still signed in, and if the
  // server can't confirm it, set the account's state aside on this device for completeAuth() to restore.
  let signingOut = false;
  async function signOut() {
    if (signingOut) return;          // a double tap shouldn't run the flush twice
    signingOut = true;
    try {
      const uid = Auth.uid;
      Sync.cancelPending();
      let keptBackup = false;
      if (uid && Sync.isDirty()) {
        if (!(await Sync.push())) { Sync.writeBackup(uid, Sync.snapshot()); keptBackup = true; }
      }
      signOutNow(keptBackup);
    } finally { signingOut = false; }
  }
  function signOutNow(keptBackup) {
    Auth.signOut();
    S.saved = new Set(); S.dismissed = new Set(); S.myChannels = new Set(); S.hiddenChannels = new Set(); S.reviewed = new Set(); S.myCompanies = new Set(); S.myInvestChannels = new Set();
    // Sync.cacheWrite() now runs for a signed-in account too (see pushSoon()'s bug fix above), so the cache
    // left behind by the account that's signing out has to be cleared here - otherwise a DIFFERENT account
    // signing in next on this same browser could briefly see the previous account's cached watchlist/saves
    // for the moment before Sync.init()'s pull() overwrites it with their own.
    Push.syncAccount();   // detach the account that left: no more alerts about its portfolio here
    Sync.cacheWrite(null);
    // The dirty flag belonged to the account that's leaving - clearing it here (rather than leaving it set)
    // stops the NEXT account that signs in on this browser from having isDirty() misfire and push ITS
    // just-loaded state up as if it were an unsent change of its own.
    Sync.clearDirty();
    renderAccount(); renderAll(); renderChannels(); renderInvestChannels(); renderSyncCode(); renderTicketBox(); renderTicketAdmin(); renderInvestmentBox();
    toast(keptBackup
      ? 'Signed out. Some changes hadn’t reached your account yet. They’re kept on this device and come back when you sign in again.'
      : 'Signed out. Back to guest mode on this device.');
    Sync.pull().then(() => { renderAll(); renderChannels(); renderInvestChannels(); });    // fall back to this browser's guest sync code
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
      // Single shared exit point for every way someone can leave the landing screen (sign-in, sign-up,
      // Google, guest) - the natural place to kick off the onboarding tour for a first-time visitor.
      // Onboarding.maybeStart() checks its own "already seen" flag, so this is safe to call every time.
      setTimeout(() => Onboarding.maybeStart(), 300);
    },
    // Called once at boot: if this device/tab already has a reason to skip (a real signed-in session, or a
    // guest choice made earlier in this same tab/session), skip straight past the landing screen (same
    // "land them on Signals" outcome either way, since setTab('brief') already runs unconditionally
    // elsewhere in start()). Otherwise show it and wire its controls - done here rather than
    // unconditionally so a returning, already-decided visitor never pays for the Google button init or
    // seeing the screen flash up first.
    init() {
      // Returning visitors skip the landing screen, but still get a tour they haven't seen - this is how
      // people already using the app meet the rewritten tour (ONBOARD_KEY v2) once.
      if (this.seen()) { setTimeout(() => Onboarding.maybeStart(), 800); return; }
      this.show();
      const form = $('#landingAuthForm');
      if (form) form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const mode = (ev.submitter && ev.submitter.dataset.mode) || 'signin';
        const email = $('#landingEmail').value.trim(), pass = $('#landingPass').value;
        if (!email || pass.length < 6) { toast('Enter an email and a password of at least 6 characters.'); return; }
        // Signing in and loading the account's saved data can take a few seconds on a phone connection.
        // Without feedback people tapped Create account or Google meanwhile (seen in the owner's recording),
        // so every door is locked and the tapped button says what is happening until it finishes.
        if (this.busy) return;
        const btns = [...form.querySelectorAll('button'), ...$$('#landingGuestBtn, #landingGoogleBtn')];
        const tapped = ev.submitter || form.querySelector('[data-mode="signin"]');
        const label = tapped.textContent;
        const setBusy = on => {
          this.busy = on;
          btns.forEach(b => { if (b.tagName === 'BUTTON') b.disabled = on; else b.classList.toggle('is-busy', on); });
          tapped.textContent = on ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : label;
          tapped.setAttribute('aria-busy', on ? 'true' : 'false');
        };
        setBusy(true);
        try {
          const r = mode === 'signup' ? await Auth.signUp(email, pass) : await Auth.signIn(email, pass);
          if (!r.ok) { toast(r.error); return; }
          track(mode === 'signup' ? 'sign_up' : 'sign_in', { method: 'email' });
          tapped.textContent = 'Loading your data…';
          await completeAuth();
          this.dismiss(false);
        } finally { setBusy(false); }
      });
      const guestBtn = $('#landingGuestBtn');
      if (guestBtn) guestBtn.addEventListener('click', () => { track('continue_as_guest'); this.dismiss(true); });
    }
  };

  /* ---------- Onboarding walkthrough ----------
     User's own words, reporting real feedback from an Instagram ad campaign: "few people didn't get what
     the app does and have to figure out on their own which kind of turns them off from the app." A short,
     skippable spotlight tour, shown once per device right after the landing screen is dismissed (sign-in,
     sign-up, Google, or guest - whichever door they came in through), pointing at the real controls rather
     than a set of generic slides. Covers the full Signals page top to bottom first (country-wise news cards,
     search, the country/sector/priority filters, a sample news card), then the tab bar (Saved, the mode
     switch and its double-tap requirement, Export, Settings) - the order a person's eye would actually travel
     down the screen, rather than tab-bar-first. Shown once ever per device (ONBOARD_KEY in localStorage) -
     unlike Landing's guest flag, this does NOT reset on sign-out, since the goal is purely "has this browser
     seen the tour," not tied to any account.
     A step whose anchor element doesn't exist, or is hidden/zero-size at the moment the tour reaches it (the
     country-card row in particular - #countryStatus only exists at all once there's at least one story to
     show - and the first #list entry - is empty until the live feed has actually loaded, which can take
     longer than maybeStart()'s initial delay on a slow connection) is skipped rather than shown pointing at
     nothing, via _firstVisibleStep()/_nextVisibleIdx() below. */
  // v2: the tour was rewritten for the current app (since-you-left card, Sentiment board, Daily appetite,
  // bundled notifications), so everyone sees the new version once - including people who saw v1.
  // Settings -> "Replay the tour" shows it again any time (Onboarding.replay()).
  const ONBOARD_KEY = 'qs-onboard-seen-v2';
  const Onboarding = {
    seen() { try { return localStorage.getItem(ONBOARD_KEY) === '1'; } catch (e) { return false; } },
    markSeen() { try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) { /* private browsing etc. */ } },
    // Owner, 24 Oct: the tour walks through every tab, opening each one as it goes (go), so it can point at the
    // real controls there. A step whose control isn't on screen (e.g. no tracked stocks yet) is skipped.
    steps: [
      { sec: 'News', anchor: '#liveBar .iconbtn', titleKey: 'obStepRTitle', bodyKey: 'obStepRBody', go: () => setTab('brief') },
      { sec: 'News', anchor: '#digestCard', titleKey: 'obStep0Title', bodyKey: 'obStep0Body' },
      { sec: 'News', anchor: '#countryStatus', titleKey: 'obStep1Title', bodyKey: 'obStep1Body' },
      { sec: 'News', anchor: '#q', titleKey: 'obStep2Title', bodyKey: 'obStep2Body' },
      { sec: 'News', anchor: '#countryFilter', titleKey: 'obStep3Title', bodyKey: 'obStep3Body' },
      { sec: 'News', anchor: '#list .entry', titleKey: 'obStep4Title', bodyKey: 'obStep4Body' },
      { sec: 'Investment', anchor: '#list .grp-company', titleKey: 'obInvCardTitle', bodyKey: 'obInvCardBody', go: () => setTab('investment') },
      { sec: 'Investment', anchor: '#investEmpty .btn', titleKey: 'obInvEmptyTitle', bodyKey: 'obInvEmptyBody', go: () => setTab('investment') },
      { sec: 'Investment', anchor: '#otherCoHead', titleKey: 'obInvOtherTitle', bodyKey: 'obInvOtherBody' },
      { sec: 'Sentiment board', anchor: '#sbBody .sb-card, #sbBody .sb-row', titleKey: 'obBoardTitle', bodyKey: 'obBoardBody', go: () => setTab('community') },
      { sec: 'Sentiment board', anchor: '#communityEmpty .btn', titleKey: 'obBoardEmptyTitle', bodyKey: 'obBoardEmptyBody', go: () => setTab('community') },
      { sec: 'Settings', anchor: '.settingsnav-item[data-v="explore"]', titleKey: 'obExploreTitle', bodyKey: 'obExploreBody', go: () => setTab('settings') },
      { sec: 'Settings', anchor: '.settingsnav-item[data-v="investwatchlist"]', titleKey: 'obImportTitle', bodyKey: 'obImportBody', go: () => setTab('settings') },
      { sec: 'Settings', anchor: '.settingsnav-item[data-v="saved"]', titleKey: 'obSavedTitle', bodyKey: 'obSavedBody', go: () => setTab('settings') },
      { sec: 'Settings', anchor: '[data-tab="settings"]', titleKey: 'obStep7Title', bodyKey: 'obStep7Body', go: () => setTab('settings') }
    ],
    running: false,
    _idx: 0,
    _visibleAnchor(sel) {
      const el = $(sel);
      if (!el || el.hidden) return null;
      const r = el.getBoundingClientRect();
      return (r.width > 0 && r.height > 0) ? el : null;
    },
    // First step whose anchor actually exists/is visible right now, starting from `from` - used both to
    // find where to start and, from _renderStep()'s Next handler, to skip past any step that isn't ready.
    _nextVisibleIdx(from) {
      for (let i = from; i < this.steps.length; i++) {
        if (this._visibleAnchor(this.steps[i].anchor)) return i;
      }
      return -1;
    },
    // Opens the tab a step needs, then finds the first step from `from` whose control is really on screen.
    async _seek(from) {
      for (let i = from; i < this.steps.length; i++) {
        const st = this.steps[i];
        if (st.go) { try { st.go(); } catch (e) { /* ignore */ } window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 350)); }
        const el = this._visibleAnchor(st.anchor);
        if (el) { el.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 120)); return i; }
      }
      return -1;
    },
    // A fresh sign-in shows the tour (owner, 24 Oct), even if this device has seen it before.
    afterSignIn() { setTimeout(() => { if (!this.running) this.replay(); }, 1500); },
    // Called once at boot, after Landing has already been dismissed (or skipped because this device already
    // had a reason to skip it) - see Landing.dismiss()'s call site. Does nothing if already seen, or if the
    // tab bar itself isn't present for some reason (defensive - should always be there). Waits briefly for
    // the first live-feed load to settle (up to ~2.5s, polling every 150ms) before picking the first step, so
    // the country-card row and a sample news card - both empty until then - have real content to point at on
    // a typical connection; on a slow/offline device this gives up and starts anyway, skipping whichever of
    // those two steps still has nothing to show (see _nextVisibleIdx()) rather than hanging indefinitely.
    async maybeStart() {
      if (this.seen() || this.running) return;
      if (!$('.tabs')) return;
      for (let waited = 0; waited < 2500; waited += 150) {
        if (this._visibleAnchor('#list .entry')) break;
        await new Promise(r => setTimeout(r, 150));
      }
      this.running = true;
      const start = await this._seek(0);
      if (start < 0) { this._finish(); return; }   // nothing at all to point at - don't show an empty tour
      this._idx = start;
      track('onboarding_start');
      this._renderStep();
    },
    // From Settings: back to the Signals page (where the first steps point), then run the tour from the top.
    replay() {
      try { closeSettingsPage(); } catch (e) { /* not open */ }
      setTab('brief');
      window.scrollTo(0, 0);
      track('onboarding_replay');
      this.running = true;
      setTimeout(async () => {
        const start = await this._seek(0);
        if (start < 0) { this._finish(); return; }
        this._idx = start;
        this._renderStep();
      }, 250);
    },
    _renderStep() {
      const step = this.steps[this._idx];
      const anchorEl = step ? this._visibleAnchor(step.anchor) : null;
      const overlay = $('#obOverlay');
      if (!step || !anchorEl || !overlay) { this._finish(); return; }
      overlay.hidden = false;
      document.body.classList.add('ob-active');
      const rect = anchorEl.getBoundingClientRect();
      const hole = $('#obHole', overlay);
      // A padded rectangular cutout around the real control (CSS box-shadow spotlight technique - see
      // .ob-hole in index.html) rather than a copy of the control, so the actual thing the person will look
      // at next is what's lit up, not a picture of it. Kept tight (small pad, no min-size floor) per the
      // owner's explicit request that this box read as "highlighting," not covering half the screen.
      const pad = 4;
      hole.style.left = (rect.left - pad) + 'px';
      hole.style.top = (rect.top - pad) + 'px';
      hole.style.width = (rect.width + pad * 2) + 'px';
      hole.style.height = (rect.height + pad * 2) + 'px';
      const card = $('#obCard', overlay);
      const isLast = this._idx >= this.steps.length - 1;
      card.innerHTML = `
        <p class="ob-sec">${esc(step.sec || '')}</p>
        <h3 class="ob-title">${esc(t(step.titleKey))}</h3>
        <p class="ob-body">${esc(t(step.bodyKey))}</p>
        <div class="ob-actions">
          <button type="button" id="obSkipBtn" class="ob-skip">${esc(t('obSkip'))}</button>
          <button type="button" id="obNextBtn" class="btn primary small">${esc(isLast ? t('obDone') : t('obNext'))}</button>
        </div>
      `;
      // Position the card above or below the spotlighted control, whichever has more room, and clamp it
      // within the viewport both ways - earlier steps now point at controls near the TOP of the page (the
      // country-card row, search, filters), not just the tab bar at the bottom, so both branches are
      // exercised in practice (not just kept correct for a hypothetical future step, as before).
      const cardH = card.offsetHeight || 140;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const showBelow = spaceBelow >= cardH + 20 || spaceBelow >= spaceAbove;
      if (showBelow) {
        card.style.top = Math.min(rect.bottom + pad + 12, window.innerHeight - cardH - 12) + 'px';
        card.style.bottom = '';
      } else {
        card.style.bottom = (window.innerHeight - rect.top + pad + 12) + 'px';
        card.style.top = '';
      }
      const cardW = card.offsetWidth || 260;
      let left = rect.left + rect.width / 2 - cardW / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - cardW - 12));
      card.style.left = left + 'px';
      $('#obSkipBtn', card).addEventListener('click', () => { track('onboarding_skip', { step: this._idx }); this._finish(); });
      $('#obNextBtn', card).addEventListener('click', async () => {
        $('#obNextBtn', card).disabled = true;
        const next = await this._seek(this._idx + 1);
        if (next < 0) { track('onboarding_complete'); this._finish(); return; }
        this._idx = next;
        this._renderStep();
      });
    },
    _finish() {
      const overlay = $('#obOverlay');
      if (overlay) overlay.hidden = true;
      document.body.classList.remove('ob-active');
      this.markSeen();
      if (this.running) { this.running = false; setTab('brief'); window.scrollTo(0, 0); }   // end where the app starts
    }
  };

  // "Forgot password?" on the landing screen and in Settings -> Account. Uses whatever is typed in that
  // form's email box, so there is no extra screen to fill in.
  let resetBusy = false;
  async function forgotPassword(btn) {
    const input = $('#' + (btn.dataset.email || 'landingEmail'));
    const status = $('#' + (btn.dataset.status || 'landingFpStatus'));
    // The answer is written right under the link as well as in a toast - a toast alone is easy to miss,
    // and on the sign-in screen it used to be hidden behind the screen itself.
    const say = (msg, kind) => {
      if (status) { status.textContent = msg; status.className = 'fp-status' + (kind ? ' ' + kind : ''); status.hidden = false; }
      else toast(msg);
    };
    const email = input ? input.value.trim() : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      say('Type the email you signed up with in the box above, then tap “Forgot password?” again.', 'warn');
      if (input) input.focus();
      return;
    }
    if (resetBusy) return;
    resetBusy = true;
    const label = btn.querySelector('span') || btn;
    const text = label.textContent;
    btn.disabled = true; label.textContent = 'Sending…';
    try {
      const r = await Auth.sendPasswordReset(email);
      if (r.ok) {
        say('Reset link sent to ' + email + '. Open the email (check Spam/Promotions too), choose a new password, then sign in here.', 'ok');
        track('password_reset_sent');
      } else say(r.error, 'warn');
    } finally { resetBusy = false; btn.disabled = false; label.textContent = text; }
  }

  // When a signed-out person hits a sign-in gate (adding a Telegram channel or a company, voting...), the
  // gate's "Go to Account" now really opens the sign-in form, and once they are signed in the app takes them
  // back to the page they were on and finishes what they were doing - e.g. the channel they typed gets added.
  // Before, "Go to Account" only switched to the Settings tab (still showing the channel page, no sign-in
  // form in sight), so people could not work out how to add channels after logging in.
  let gateResume = null;
  function rememberGateResume() {
    const page = S.tab === 'settings' && S.settingsPage && S.settingsPage !== 'account' ? S.settingsPage : null;
    const inputs = {};
    if (page) $$('#sp-' + page + ' .lp-add input').forEach(i => { if (i.id && i.value.trim()) inputs[i.id] = i.value; });
    gateResume = page ? { page, inputs, tab: 'settings' } : (S.tab && S.tab !== 'settings' ? { tab: S.tab } : null);
  }
  // After ANY sign-in (sign-in screen, Settings -> Account, Google), the person lands on the News tab
  // (owner, 13 Oct: "New user -> logged in -> news tab"). If they were signing in to add a Telegram channel
  // or a company, that add is finished quietly on the way (its own message confirms it), so nothing typed
  // is lost - they just aren't left sitting in Settings.
  function resumeAfterSignIn() {
    const r = gateResume; gateResume = null;
    if (r && r.page) {
      Object.entries(r.inputs).forEach(([id, v]) => {
        const i = $('#' + id); if (!i) return;
        i.value = v;
        const b = i.closest('.lp-add') && i.closest('.lp-add').querySelector('button');
        if (b) b.click();            // finish the add they started
      });
    }
    if (S.settingsPage) closeSettingsPage();
    setTab('brief');
    window.scrollTo(0, 0);
  }

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
        <form id="nickForm" class="acct-nick">
          <label for="nickInput" class="acct-nicklbl">Nickname on the Sentiment board</label>
          <div class="lp-add"><input id="nickInput" type="text" maxlength="16" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Investor ${esc(Board.maskedName().slice(-4))}" value="${esc(Board.nick())}"><button type="submit" class="btn small">Save</button></div>
          <p class="lp-sub">Shown beside your votes and stocks instead of your email. 3 to 16 letters, numbers, spaces, _ . -. Leave empty to stay anonymous.</p>
        </form>
        <button id="signOutBtn" class="btn small">${t('signOut')}</button>`;
      $('#signOutBtn').addEventListener('click', signOut);
      $('#nickForm').addEventListener('submit', ev => {
        ev.preventDefault();
        if (!Board.setNick($('#nickInput').value)) { toast('Use 3 to 16 letters, numbers, spaces, _ . -'); return; }
        toast(Board.nick() ? 'Nickname saved.' : 'Nickname cleared. You will show as ' + Board.maskedName() + '.');
      });
      $('#syncBlock').hidden = true;     // the account is now this device's identity; the manual code is redundant
    } else {
      box.innerHTML = `
        <form id="authForm" class="acct-form">
          <label class="vh" for="authEmail">${t('signInEmail')}</label>
          <input id="authEmail" type="email" autocomplete="email" placeholder="Enter your Gmail" required>
          <label class="vh" for="authPass">${t('signInPassword')}</label>
          <input id="authPass" type="password" autocomplete="current-password" placeholder="${esc(t('signInPassword'))}" minlength="6" required>
          <button type="button" class="forgot-pw" data-act="forgotPw" data-email="authEmail" data-status="authFpStatus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4"/><path d="M10.5 12.5 20 3M16 7l3 3M14 9l2 2"/></svg><span>${esc(t('forgotPw'))}</span></button>
          <p class="fp-status" id="authFpStatus" role="status" aria-live="polite" hidden></p>
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

  // Settings > Daily appetite. The ladder underneath the choice is deliberately informational rather
  // than a second set of controls: there is one thing to decide here (how much), and the ladder exists
  // so the number it resolves to is never a surprise.
  const APPETITE_IMP_KEY = { Critical: 'notifImpCritical', High: 'notifImpHigh', Medium: 'notifImpMedium', Low: 'notifImpLow' };
  function renderAppetiteBox() {
    const box = $('#appetiteBox');
    if (!box) return;
    const target = Appetite.target();
    const rungs = Appetite.ladder();
    const total = rungs[rungs.length - 1].count;
    const activeFloor = Appetite.active() ? Appetite.floor() : '';

    // Slider stops: 20, 40, 60, 80, 100, Everything. Position 5 = Everything (target 0).
    const stops = APPETITE_CHOICES.concat([0]);
    const label = n => n ? String(n) : t('appetiteAll');
    const idx = Math.max(0, stops.indexOf(target));
    const choices = `<div class="ap-slider" style="--p:${idx / (stops.length - 1)}">
        <output class="ap-bubble" id="apBubble" for="apRange">${esc(label(target))}</output>
        <input type="range" id="apRange" class="ap-range" min="0" max="${stops.length - 1}" step="1" value="${idx}"
          aria-label="${esc(t('appetiteHeading'))}" aria-valuetext="${esc(label(target))}">
        <div class="ap-ticks" aria-hidden="true">${stops.map((n, i) => `<span style="--i:${i}"${i === idx ? ' class="on"' : ''}>${esc(n ? String(n) : t('appetiteAllShort'))}</span>`).join('')}</div>
      </div>`;

    let readout;
    if (!total) {
      // Cold start, or a channel selection with nothing in it yet - say so rather than show a zero.
      readout = `<p class="ap-note">${esc(t('appetiteNoData'))}</p>`;
    } else if (target) {
      const r = Appetite.solve();
      // A target below the Critical count can't be honoured: the only way to deliver fewer would be to
      // hold back Critical stories, which this never does. Saying so plainly matters, because on a busy
      // channel set several of the offered targets land on this same floor - leaving that unexplained
      // would make the choices look interchangeable, or worse, ignored.
      const forced = r.floor === 'Critical' && r.count > target;
      readout = `<div class="ap-big">${r.count} <span>${esc(t('appetitePerDay'))}</span></div>
        <p class="ap-note">${esc(t('appetiteResolved'))} <b>${esc(t(APPETITE_IMP_KEY[r.floor]))}</b>.
        ${esc(forced ? t('appetiteFloorNote') : t('appetiteApprox'))}</p>`;
    } else {
      readout = `<div class="ap-big">${total} <span>${esc(t('appetitePerDay'))}</span></div>`;
    }

    const ladder = total ? `<div class="ap-ladder">
        <p class="ap-ladhead">${esc(t('appetiteLadderHead'))}</p>
        ${rungs.map(r => `<div class="ap-rung${activeFloor === r.floor ? ' active' : ''}">
            <span class="ap-rl">${esc(t(APPETITE_IMP_KEY[r.floor]))}</span>
            <span class="ap-rc">${r.count}</span>
          </div>`).join('')}
      </div>` : '';

    box.innerHTML = `<div class="ap-choices">${choices}</div>
      <div class="ap-readout">${readout}</div>
      ${ladder}
      <p class="ap-foot">${esc(t('appetiteKeptNote'))}</p>
      ${target ? `<p class="ap-foot">${esc(t('appetitePushNote'))}</p>` : ''}`;
    const range = $('#apRange', box);
    if (range) {
      const slider = range.closest('.ap-slider'), bubble = $('#apBubble', box);
      range.addEventListener('input', () => {        // move the bubble and fill while dragging
        const i = +range.value;
        slider.style.setProperty('--p', String(i / (stops.length - 1)));
        bubble.textContent = label(stops[i]);
        range.setAttribute('aria-valuetext', label(stops[i]));
        $$('.ap-ticks span', slider).forEach((sp, k) => sp.classList.toggle('on', k === i));
      });
      range.addEventListener('change', () => {       // apply on release
        Appetite.set(stops[+range.value]);
        renderAppetiteBox(); renderSettingsNav(); renderControls(); renderList();
        const r2 = $('#apRange'); if (r2) r2.focus();
      });
    }
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
    const p = Push.prefs();
    // Investment alerts come from the account's portfolio, so they need an account with something in it.
    const canInvest = !!(Auth.uid && (S.myCompanies.size || S.myInvestChannels.size));
    const impLabels = { Critical: t('notifImpCritical'), High: t('notifImpHigh'), Medium: t('notifImpMedium'), Low: t('notifImpLow') };
    // Two switches (owner, 13 Oct): News and Stocks. Both on = both kinds, combined into the same
    // notifications; one on = only that kind; both off = none. Then how many notifications in each of the
    // day's three times (morning, afternoon, evening): 1 or 2. Quiet hours and the daily/weekly summary were
    // removed here - the three daytime roundups do both jobs.
    const sw = (id, checked, disabled) => `<input type="checkbox" role="switch" id="${id}" class="np-switch"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}>`;
    const bothOff = !p.news && !(p.invest && canInvest);
    const prefsUI = !on ? '' : `
      <div class="notif-prefs">
        <div class="np-row">
          <label class="np-label" for="npNews">${t('notifNewsLabel')}</label>
          ${sw('npNews', p.news)}
        </div>
        <p class="np-hint">${t('notifNewsHint')}</p>
        ${p.news ? `<div class="np-row np-sub">
          <label class="np-label" for="npMinImp">${t('notifTierLabel')}</label>
          <select id="npMinImp" class="np-select">
            ${PUSH_IMP_TIERS.map(k => `<option value="${k}"${p.minImp === k ? ' selected' : ''}>${esc(impLabels[k])}</option>`).join('')}
          </select>
        </div>
        <p class="np-hint np-sub">${Appetite.on() ? esc(t('notifAppetiteManaged')) : t('notifTierHint')}</p>` : ''}
        <div class="np-row">
          <label class="np-label" for="npInvest">${t('notifStockLabel')}</label>
          ${sw('npInvest', p.invest && canInvest, !canInvest)}
        </div>
        <p class="np-hint">${canInvest ? t('notifStockHint') : t('notifInvestNeedCompanies')}</p>
        ${bothOff ? `<p class="np-warn" role="status">${t('notifBothOff')}</p>` : ''}
        <div class="np-row"><span class="np-label">${t('notifSlotsLabel')}</span></div>
        <p class="np-hint">${t('notifSlotsHint')}</p>
      </div>`;
    box.innerHTML = (on
      ? `<p class="lp-syncnote">${t('notifOn')}</p><button id="notifBtn" class="btn small">${t('notifDisable')}</button>`
      : `<button id="notifBtn" class="btn primary small">${t('notifEnable')}</button>`) + prefsUI;
    $('#notifBtn').addEventListener('click', async () => {
      $('#notifBtn').disabled = true;
      if (on) { await Push.unsubscribe(); } else {
        const r = await Push.subscribe();
        if (!r.ok) { toast(r.error); }
      }
      renderNotifBox();
    });
    const minImp = $('#npMinImp'), news = $('#npNews');
    if (news) news.addEventListener('change', async () => {
      await Push.savePrefs({ news: news.checked });
      track('push_news_toggle', { on: news.checked });
      renderNotifBox();
    });

    if (minImp) minImp.addEventListener('change', () => {
      // Setting the floor by hand takes it back off the daily appetite. Without this the next feed
      // refresh would quietly overwrite the choice just made here, which is the kind of disagreement
      // between two settings that makes an app feel broken.
      if (Appetite.on()) { Appetite.set(0); renderSettingsNav(); }
      Push.savePrefs({ minImp: minImp.value });
      renderNotifBox();
    });
    const invest = $('#npInvest');
    if (invest) invest.addEventListener('change', async () => {
      await Push.savePrefs({ invest: invest.checked });
      track('push_invest_toggle', { on: invest.checked });
      renderNotifBox();
    });
  }

  /* ---------- Owner: how people respond to notifications ----------
     Two sources, both readable only by the owner (firestore.rules):
       qs_push_stats/<UTC date>  how many the pipeline SENT that day, by kind (record_push_stats() in pipeline.py)
       qs_push_events            what each device then did - shown / opened / dismissed (sw.js)
     Each notification ends up in exactly one outcome: opened, swiped away, or ignored (shown, then neither
     within 24 hours). Notifications younger than 24 hours with no response yet are "still waiting" and kept
     out of the percentages, which would otherwise read low for a few hours after every send. */
  const PUSH_KIND_LABEL = { news: 'News', invest: 'Watchlist', mixed: 'News + watchlist', digest: 'Daily/weekly digest' };
  const PushStats = {
    days: 7,
    async load(days) {
      const token = await Auth.bearerToken();
      if (!token) throw new Error('not signed in');
      const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const query = { structuredQuery: {
        from: [{ collectionId: 'qs_push_events' }],
        where: { fieldFilter: { field: { fieldPath: 'at' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: since } } },
        limit: 20000 } };
      const r = await fetch(`${FS_BASE}:runQuery`, { method: 'POST', headers, body: JSON.stringify(query) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const events = (await r.json()).filter(row => row.document).map(row => fsFieldsToObject(row.document.fields));
      const dates = [];
      for (let i = 0; i < days; i++) dates.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
      const docs = await Promise.all(dates.map(d => fetch(`${FS_BASE}/qs_push_stats/${d}`, { headers })
        .then(res => (res.ok ? res.json() : null)).catch(() => null)));
      const sent = {};
      docs.forEach(doc => {
        if (!doc || !doc.fields) return;
        const o = fsFieldsToObject(doc.fields);
        for (const k in o) sent[k] = (sent[k] || 0) + (Number(o[k]) || 0);
      });
      return { events, sent };
    },
    // Folds raw events into one record per notification, then counts outcomes overall, by kind, and by the
    // device's local time of day (3-hour blocks). An 'opened' whose 'shown' report was lost (offline at the
    // time) still counts as delivered - it plainly arrived.
    summarise(events, now = Date.now()) {
      const recs = new Map();
      events.forEach(ev => {
        if (!ev || !ev.nid) return;
        const r = recs.get(ev.nid) || { kind: ev.kind || 'news', hour: null, shownAt: null, firstAt: null, opened: false, dismissed: false };
        const at = Date.parse(ev.at) || 0;
        if (r.firstAt === null || at < r.firstAt) r.firstAt = at;
        if (ev.action === 'shown') { r.shownAt = at; r.hour = ev.hour; }
        else if (ev.action === 'opened') r.opened = true;
        else if (ev.action === 'dismissed') r.dismissed = true;
        if (r.hour === null && typeof ev.hour === 'number') r.hour = ev.hour;
        recs.set(ev.nid, r);
      });
      const blank = () => ({ delivered: 0, opened: 0, dismissed: 0, ignored: 0, waiting: 0 });
      const total = blank(), byKind = {}, byHour = Array.from({ length: 8 }, blank);
      recs.forEach(r => {
        const since = r.shownAt !== null ? r.shownAt : r.firstAt;
        const outcome = r.opened ? 'opened' : r.dismissed ? 'dismissed' : (now - since > 864e5 ? 'ignored' : 'waiting');
        const buckets = [total, byKind[r.kind] || (byKind[r.kind] = blank())];
        if (typeof r.hour === 'number' && r.hour >= 0 && r.hour <= 23) buckets.push(byHour[Math.floor(r.hour / 3)]);
        buckets.forEach(b => { b.delivered++; b[outcome]++; });
      });
      return { total, byKind, byHour };
    }
  };
  const settled = b => b.opened + b.dismissed + b.ignored;
  const pct = (n, d) => (d ? Math.round((n / d) * 100) + '%' : '–');

  async function renderPushStats() {
    const box = $('#pushStatsBox');
    if (!box) return;
    if (!isOwner()) { box.innerHTML = ''; return; }
    const days = PushStats.days;
    const seg = `<div class="seg ps-range" role="group" aria-label="Period">
        ${[7, 30].map(d => `<button type="button" data-ps-days="${d}" aria-pressed="${d === days}">${d} days</button>`).join('')}
      </div>`;
    box.innerHTML = seg + '<p class="lp-syncnote">Loading…</p>';
    let data;
    try { data = await PushStats.load(days); }
    catch (e) {
      box.innerHTML = seg + `<p class="lp-syncnote">Couldn’t load the stats (${esc(e.message)}). If this persists, check that the latest firestore.rules are published.</p>`;
      return;
    }
    const s = PushStats.summarise(data.events);
    const t = s.total, n = settled(t), sentTotal = data.sent.sent || 0;
    const bar = b => {
      const d = settled(b);
      if (!d) return '<div class="ps-bar ps-bar-empty"></div>';
      return `<div class="ps-bar" role="img" aria-label="Opened ${pct(b.opened, d)}, swiped away ${pct(b.dismissed, d)}, ignored ${pct(b.ignored, d)}">
          <i class="ps-o" style="width:${(b.opened / d) * 100}%"></i><i class="ps-d" style="width:${(b.dismissed / d) * 100}%"></i><i class="ps-i" style="width:${(b.ignored / d) * 100}%"></i></div>`;
    };
    const kinds = ['news', 'invest', 'mixed', 'digest'].filter(k => s.byKind[k]);
    const hours = s.byHour.map((b, i) => ({ b, label: String(i * 3).padStart(2, '0') + '–' + String(i * 3 + 3).padStart(2, '0') }));
    const maxHour = Math.max(1, ...s.byHour.map(settled));
    box.innerHTML = seg + (t.delivered === 0
      ? `<p class="lp-syncnote">No responses recorded in the last ${days} days. Responses are counted from the first notification sent after this update.</p>`
      : `<div class="ps-tiles">
          <div class="ps-tile"><b>${sentTotal || '–'}</b><span>sent</span></div>
          <div class="ps-tile"><b>${t.delivered}</b><span>delivered${sentTotal ? ' (' + pct(t.delivered, sentTotal) + ')' : ''}</span></div>
          <div class="ps-tile ps-good"><b>${pct(t.opened, n)}</b><span>opened</span></div>
          <div class="ps-tile"><b>${pct(t.ignored, n)}</b><span>ignored</span></div>
        </div>
        <div class="ps-section">
          ${bar(t)}
          <div class="ps-legend"><span><em class="ps-o"></em>Opened ${t.opened}</span><span><em class="ps-d"></em>Swiped away ${t.dismissed}</span><span><em class="ps-i"></em>Ignored ${t.ignored}</span></div>
          ${t.waiting ? `<p class="ps-note">${t.waiting} sent in the last 24 hours ${t.waiting === 1 ? 'has' : 'have'} no response yet and ${t.waiting === 1 ? 'isn’t' : 'aren’t'} counted above.</p>` : ''}
        </div>
        <div class="ps-section">
          <h3 class="ps-h">By type</h3>
          <div class="ps-table">
            ${kinds.map(k => { const b = s.byKind[k]; return `<div class="ps-row">
                <span class="ps-name">${esc(PUSH_KIND_LABEL[k] || k)}</span>
                <span class="ps-num">${pct(b.opened, settled(b))} opened</span>
                <span class="ps-sub">${settled(b)} settled</span>
                ${bar(b)}
              </div>`; }).join('')}
          </div>
        </div>
        <div class="ps-section">
          <h3 class="ps-h">By time of day</h3>
          <p class="ps-note">On the reader’s own clock. Bar length is how many arrived then; the number is how many were opened.</p>
          <div class="ps-hours">
            ${hours.map(({ b, label }) => `<div class="ps-hour">
                <span class="ps-hl">${label}</span>
                <span class="ps-ht"><i style="width:${(settled(b) / maxHour) * 100}%"></i></span>
                <span class="ps-hv">${settled(b) ? pct(b.opened, settled(b)) + ' of ' + settled(b) : '–'}</span>
              </div>`).join('')}
          </div>
        </div>
        <p class="ps-note">Ignored means shown, then neither opened nor swiped away within 24 hours. iPhones don’t report a swipe-away, so on iPhones those count as ignored.</p>`);
    $$('[data-ps-days]', box).forEach(btn => btn.addEventListener('click', () => {
      PushStats.days = Number(btn.dataset.psDays);
      renderPushStats();
    }));
  }

  // Feedback/bug submission card. Requires an account (per the owner's request: tickets are now tied to a
  // real identity, same reasoning as gating Telegram +Add and cross-device sync) - a signed-out visitor sees
  // a login prompt instead of the form, via openAuthGate(), not a disabled textarea they can type into and
  // then get rejected on submit.
  //
  // Bug/Feedback only (Support dropped - per the owner's request to keep this to the two kinds that need a
  // ticket number and a reply, old "support" tickets already in Firestore still display fine via
  // ticketKindSupport's surviving translation string in renderTicketAdmin()). Picking a bubble pre-fills the
  // textarea with a literal "Bug: "/"Feedback: " prefix (ticketPrefixBug/ticketPrefixFeedback) that the user
  // types after, not an invisible tag applied at submit time. Switching bubbles mid-draft swaps only that
  // leading prefix text and leaves whatever the user already typed after it untouched.
  const TICKET_MAX = 2000;
  // Attachments are stored as base64 directly on the ticket document (Tickets.submit() below), not in
  // Firebase Storage - Storage requires the project to be on Firebase's paid "Blaze" plan (billing account),
  // which the owner decided not to set up for what is, in practice, a handful of small screenshots. The
  // tradeoff: base64 text is ~33% larger than the original file, and Firestore caps a whole document at 1 MiB
  // (1,048,576 bytes) INCLUDING the message text and every other field, not just the attachment - so this cap
  // is deliberately much lower than a real Storage upload would need. 600 KB of raw file comfortably covers a
  // phone screenshot (a typical screenshot is 200-500 KB) while leaving headroom under the 1 MiB document
  // limit after base64 inflation (~800 KB) plus the message text and other fields.
  const TICKET_ATTACH_MAX_BYTES = 600 * 1024;
  let ticketAttachFile = null; // the File object staged for reading, or null - cleared on every renderTicketBox() and on successful/failed submit
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
    ticketAttachFile = null;
    box.innerHTML = `
      <div class="tcard">
        <div class="tseg" id="ticketKindSeg" role="group" aria-label="${esc(t('feedbackHeading'))}">
          <button data-v="bug" aria-pressed="true">${esc(t('ticketKindBug'))}</button>
          <button data-v="feedback" aria-pressed="false">${esc(t('ticketKindFeedback'))}</button>
        </div>
        <textarea id="ticketMsg" class="tmsg" rows="4" maxlength="${TICKET_MAX}" placeholder="${esc(t('ticketPlaceholder'))}">${esc(t('ticketPrefixBug'))}</textarea>
        <div class="tfoot">
          <span class="tcount" id="ticketCount">0 / ${TICKET_MAX}</span>
        </div>
        <div class="tattach">
          <div class="tattach-label">${esc(t('ticketAttachHeading'))}</div>
          <div id="ticketAttachRow"></div>
        </div>
        <button id="ticketSendBtn" class="btn primary small">${esc(t('ticketSend'))}</button>
      </div>
      <div id="myTickets" class="my-tickets"></div>
    `;
    renderMyTickets();
    let kind = 'bug';
    const PREFIXES = { bug: t('ticketPrefixBug'), feedback: t('ticketPrefixFeedback') };
    const ta = $('#ticketMsg', box), count = $('#ticketCount', box);
    const updateCount = () => { count.textContent = ta.value.length + ' / ' + TICKET_MAX; };
    updateCount();
    $$('#ticketKindSeg button', box).forEach(b => b.addEventListener('click', () => {
      const prevPrefix = PREFIXES[kind];
      kind = b.dataset.v;
      $$('#ticketKindSeg button', box).forEach(x => x.setAttribute('aria-pressed', x === b));
      // Swap just the old prefix for the new one, wherever the cursor is, so anything the user already typed
      // after it survives the switch. Falls back to simply prepending the new prefix if the textarea's
      // current text doesn't start with the prefix we expect (e.g. the user deleted it by hand).
      const rest = ta.value.startsWith(prevPrefix) ? ta.value.slice(prevPrefix.length) : ta.value;
      ta.value = PREFIXES[kind] + rest;
      updateCount();
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }));
    ta.addEventListener('input', updateCount);
    // Attachment: a real file input styled as a button, swapped for a filename + remove button once a file
    // is staged. Nothing uploads until Submit is pressed - this just stages the File object in memory.
    const attachRow = $('#ticketAttachRow', box);
    function renderAttachRow() {
      if (!ticketAttachFile) {
        attachRow.innerHTML = `
          <label class="btn small" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
            ${esc(t('ticketAttachAdd'))}
            <input id="ticketAttachInput" type="file" accept="image/*,.pdf,.txt,.log" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden">
          </label>`;
        $('#ticketAttachInput', attachRow).addEventListener('change', (ev) => {
          const f = ev.target.files && ev.target.files[0];
          if (!f) return;
          if (f.size > TICKET_ATTACH_MAX_BYTES) { toast(t('ticketAttachTooBig')); ev.target.value = ''; return; }
          ticketAttachFile = f;
          renderAttachRow();
        });
      } else {
        attachRow.innerHTML = `
          <span class="tattach-file">
            <span class="tattach-name">${esc(ticketAttachFile.name)}</span>
            <button type="button" id="ticketAttachRemoveBtn" class="btn small">${esc(t('ticketAttachRemove'))}</button>
          </span>`;
        $('#ticketAttachRemoveBtn', attachRow).addEventListener('click', () => { ticketAttachFile = null; renderAttachRow(); });
      }
    }
    renderAttachRow();
    $('#ticketSendBtn', box).addEventListener('click', async () => {
      const btn = $('#ticketSendBtn', box);
      btn.disabled = true;
      const attachFile = ticketAttachFile;
      if (attachFile) btn.textContent = t('ticketAttachUploading');
      const r = await Tickets.submit(kind, ta.value, attachFile);
      btn.disabled = false;
      btn.textContent = t('ticketSend');
      if (r.ok) {
        ta.value = PREFIXES[kind];
        updateCount();
        ticketAttachFile = null;
        renderAttachRow();
        toast(r.ticketNumber ? t('ticketSentWithNumber').replace('{num}', r.ticketNumber) : t('ticketSent'));
        if (r.attachFailed) toast(t('ticketAttachFailed'));
      } else {
        toast(r.error);
      }
    });
  }

  // Owner-only ticket list. Block itself stays hidden (removed from layout, not just display:none in spirit
  // - the "hidden" attribute) for anyone whose isOwner() is false, so a non-owner never even sees an empty
  // "Tickets" heading or triggers the owner-gated Firestore query.
  const TICKET_STATUS = { open: 'ticketStatusOpen', in_progress: 'ticketStatusProgress', done: 'ticketStatusDone' };
  // SECURITY (14 Oct review): a ticket's attachment fields are written by whoever sent it. They used to be
  // dropped straight into the link's href, so a crafted ticket could inject markup into the OWNER's page.
  // The link is only drawn when the data is plain base64 and the type is one of a few harmless file types.
  const SAFE_ATTACH_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
  function safeAttachment(tk) {
    if (!tk.attachment_data || !/^[A-Za-z0-9+/]+=*$/.test(tk.attachment_data)) return '';
    const type = String(tk.attachment_type || '').toLowerCase();
    return SAFE_ATTACH_TYPES.includes(type) ? type : 'application/octet-stream';
  }
  /* Telling people what happened to their ticket (owner, 14 Oct). When the owner marks a ticket "In
     progress" or "Resolved" with a note, the person who raised it sees it: a message the next time they open
     the app ("Update on your ticket QS-...: Resolved - <note>"), a count on Settings -> Feedback & support,
     and the status and note under "Your tickets" there. One small read per app open, signed-in users only. */
  const TicketNews = {
    rows: null, unseen: 0,
    key() { return 'qs-ticket-seen-v1-' + Auth.uid; },
    seen() { try { return JSON.parse(localStorage.getItem(this.key()) || '{}') || {}; } catch (e) { return {}; } },
    markSeen() {
      if (!Auth.uid || !this.rows) return;
      const m = this.seen();
      this.rows.forEach(r => { if (r.updated_at) m[r.id] = r.updated_at; });
      try { localStorage.setItem(this.key(), JSON.stringify(m)); } catch (e) { /* ignore */ }
      this.unseen = 0;
      renderSettingsNav();
    },
    async check() {
      if (!Auth.uid) { this.rows = null; this.unseen = 0; return; }
      const rows = await Tickets.mine();
      if (!rows) return;
      this.rows = rows;
      const seen = this.seen();
      const fresh = rows.filter(r => r.updated_at && seen[r.id] !== r.updated_at);
      this.unseen = fresh.length;
      renderSettingsNav();
      if (S.tab === 'settings' && S.settingsPage === 'feedback') { renderMyTickets(); return; }
      if (fresh.length) {
        const tk = fresh[0], st = TICKET_STATUS[tk.status] ? tk.status : 'open';
        const note = tk.reply ? ' – ' + (tk.reply.length > 90 ? tk.reply.slice(0, 88) + '…' : tk.reply) : '';
        toastAction(`${esc(t('ticketUpdateToast'))} ${esc(tk.ticket_number || '')}: <b>${esc(t(TICKET_STATUS[st]))}</b>${esc(note)} <button class="link inline" data-act="tkview">${esc(t('ticketView'))}</button>`, 10000);
      }
    }
  };
  async function renderMyTickets() {
    const box = $('#myTickets');
    if (!box || !Auth.uid) return;
    if (!TicketNews.rows) { box.innerHTML = ''; await TicketNews.check(); }
    const rows = TicketNews.rows || [];
    if (!rows.length) { box.innerHTML = ''; return; }
    const seen = TicketNews.seen();
    box.innerHTML = `<h3 class="my-tk-head">${esc(t('ticketMine'))}</h3>` + rows.map(tk => {
      const st = TICKET_STATUS[tk.status] ? tk.status : 'open';
      const isNew = tk.updated_at && seen[tk.id] !== tk.updated_at;
      const msg = String(tk.message || '').replace(/^(Bug|Feedback|Support):\s*/i, '');
      return `<div class="my-tk">
        <div class="tk-top"><b class="my-tk-num">${esc(tk.ticket_number || '')}</b><span class="tk-status s-${st}">${esc(t(TICKET_STATUS[st]))}</span>${isNew ? `<span class="my-tk-new">${esc(t('ticketNew'))}</span>` : ''}</div>
        <p class="my-tk-msg">${esc(msg.length > 140 ? msg.slice(0, 138) + '…' : msg)}</p>
        ${tk.reply ? `<p class="my-tk-reply"><span>${esc(t('ticketOwnerReply'))}</span>${esc(tk.reply)}</p>` : ''}
      </div>`;
    }).join('');
    TicketNews.markSeen();
  }
  let ticketFilter = 'open', ticketRows = null;
  // Owner's ticket desk (owner, 14 Oct): a filter (Open / In progress / Resolved), one card per ticket with
  // its reference, sender and message, a note box for the reply the sender will see, and two clear actions.
  // Delete (for junk) sits behind the "..." so it can't be hit by accident.
  async function renderTicketAdmin(reload = true) {
    const block = $('#ticketAdminBlock');
    const box = $('#ticketAdminBox');
    if (!block || !box) return;
    if (!isOwner()) { block.hidden = true; return; }
    block.hidden = false;
    if (reload || !ticketRows) {
      box.innerHTML = '<p class="lp-syncnote">…</p>';
      ticketRows = await Tickets.listAll();
    }
    const rows = ticketRows;
    if (rows === null) { box.innerHTML = `<p class="lp-syncnote">${t('ticketAdminLoadFailed')}</p>`; return; }
    const st = tk => TICKET_STATUS[tk.status] ? tk.status : 'open';
    const counts = { open: 0, in_progress: 0, done: 0 };
    rows.forEach(tk => counts[st(tk)]++);
    const filters = [['open', 'ticketStatusOpen'], ['in_progress', 'ticketStatusProgress'], ['done', 'ticketStatusDone']];
    const shown = rows.filter(tk => st(tk) === ticketFilter);
    box.innerHTML = `<div class="tseg tk-filter" role="tablist">${filters.map(([k, key]) =>
        `<button role="tab" data-tkfilter="${k}" aria-pressed="${ticketFilter === k}">${esc(t(key))} <span>${counts[k]}</span></button>`).join('')}</div>
      ${shown.length ? shown.map(tk => {
        const s1 = st(tk);
        const kindLabel = tk.kind === 'bug' ? t('ticketKindBug') : tk.kind === 'support' ? t('ticketKindSupport') : t('ticketKindFeedback');
        const when = tk.created_at ? fmtDateTime(new Date(tk.created_at).getTime()) : '';
        const msg = String(tk.message || '').replace(/^(Bug|Feedback|Support):\s*/i, '');
        return `<article class="tk-card" data-id="${esc(tk.id)}">
          <header class="tk-top">
            <span class="tk-kind">${esc(kindLabel)}</span>
            <span class="tk-status s-${s1}">${esc(t(TICKET_STATUS[s1]))}</span>
            <button class="lp-more" data-act="tkmore" data-v="${esc(tk.id)}" aria-label="${esc(t('moreOptions'))}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>
          </header>
          <div class="tk-meta">${tk.ticket_number ? `<b>${esc(tk.ticket_number)}</b>` : ''}<span>${esc(when)}</span>${tk.user_email ? `<span class="tk-email">${esc(tk.user_email)}</span>` : ''}</div>
          <p class="tk-msg">${escapeHtml(msg)}</p>
          ${safeAttachment(tk) ? `<a href="data:${safeAttachment(tk)};base64,${tk.attachment_data}" download="${esc(tk.attachment_name || 'attachment')}" class="tk-attach">📎 ${esc(tk.attachment_name || t('ticketAdminAttachment'))}</a>` : ''}
          <label class="tk-replylbl" for="tkr-${esc(tk.id)}">${esc(t('ticketReplyLabel'))}</label>
          <textarea id="tkr-${esc(tk.id)}" class="tk-reply" rows="2" maxlength="1000" placeholder="${esc(t('ticketReplyPh'))}">${esc(tk.reply || '')}</textarea>
          <div class="tk-btns">${s1 === 'done'
            ? `<button class="btn small" data-act="tkset" data-v="open">${esc(t('ticketMarkOpen'))}</button>`
            : `${s1 === 'open' ? `<button class="btn small" data-act="tkset" data-v="in_progress">${esc(t('ticketMarkProgress'))}</button>` : ''}
               <button class="btn primary small" data-act="tkset" data-v="done">${esc(t('ticketMarkDone'))}</button>`}</div>
        </article>`;
      }).join('') : `<p class="lp-syncnote">${esc(t('ticketAdminEmpty'))}</p>`}`;
    $$('[data-tkfilter]', box).forEach(b => b.addEventListener('click', () => { ticketFilter = b.dataset.tkfilter; renderTicketAdmin(false); }));
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
  let catalogCache = null;      // every qs_channels record, see Channels.catalog()
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
      // Linking a channel needs an account. The link itself lives in the person's own account (Sync); the
      // pipeline then files any channel nobody has approved yet as "pending" in qs_channels, and the owner
      // approves it in Explore channels. Browsers can no longer write to qs_channels (see firestore.rules),
      // so nobody can flood the shared list or make the pipeline fetch an arbitrary channel.
      if (!Auth.uid) { openAuthGate('agAddChannelsTitle', 'agAddChannelsBody'); return false; }
      const name = normalizeChannel(raw);
      if (!CHANNEL_RX.test(name)) { toast('Use the form t/channelname \u2013 letters, numbers and underscores only.'); return false; }
      const lower = name.toLowerCase();
      if (S.myChannels.size >= 200) { toast('You can link up to 200 channels.'); return false; }
      if (S.myChannels.has(lower)) { toast('t/' + lower + ' is already in your News channels.'); return false; }
      S.myChannels.add(lower); S.hiddenChannels.delete(lower); Sync.pushSoon();
      track('add_channel', { channel: lower });
      const known = ((catalogCache || []).find(c => c.channel === lower) || {}).status === 'approved' || (defaultChannelsCache || []).includes(lower);
      toast(known ? 't/' + lower + ' added to your News channels.' : 't/' + lower + ' added. It shows up once the owner approves it.');
      renderChannels(); renderExplore(); renderSettingsNav();
      return true;
    },

    // Every record in qs_channels: {channel, status, category}. listApproved() keeps its old meaning (names of
    // the approved ones) for the callers that only need that.
    async catalog() {
      // Everyone but the owner reads the list from channel_stats.json (published by the pipeline), so opening
      // Explore costs no database reads however many people do it. The owner reads the live records, which
      // also include the channels still waiting for approval.
      if (!isOwner()) {
        await ChanStats.load();
        const d = ChanStats.data;
        if (d && Array.isArray(d.catalog)) {
          catalogCache = d.catalog.filter(x => x && CHANNEL_RX.test(String(x.c))).map(x => ({ channel: String(x.c).toLowerCase(), status: 'approved', category: x.k || '' }));
          return catalogCache;
        }
      }
      try {
        const r = await fetch(`${FS_BASE}:runQuery?key=${FIREBASE.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'qs_channels' }], limit: 1000 } })
        });
        if (!r.ok) { lastChannelError = await describeFailure(r, null); return null; }
        lastChannelError = null;
        const rows = await r.json();
        catalogCache = rows.filter(x => x.document).map(x => {
          const f = fsFieldsToObject(x.document.fields);
          return { channel: String(f.channel || '').toLowerCase(), status: f.status || 'pending', category: f.category || '' };
        }).filter(c => CHANNEL_RX.test(c.channel));
        return catalogCache;
      } catch (e) {
        lastChannelError = await describeFailure(null, e);
        return null;
      }
    },
    async listApproved() {
      const c = await this.catalog();
      return c ? c.filter(x => x.status === 'approved').map(x => x.channel) : null;
    },
    // Owner only (enforced by firestore.rules): the category every user sees for a channel in Explore. A built-in
    // channel (sources.yml) has no record yet, so the first correction creates one, marked approved.
    async setCategory(name, cat) {
      if (!isOwner()) { toast('Only the owner account can change a channel\u2019s category for everyone.'); return false; }
      const lower = name.toLowerCase();
      try {
        const have = (catalogCache || []).find(c => c.channel === lower);
        const fields = have ? { category: toFsValue(cat) }
          : { channel: toFsValue(lower), status: toFsValue('approved'), category: toFsValue(cat), added_by: toFsValue('owner'), added_at: toFsValue(new Date().toISOString()) };
        const mask = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + k).join('&');
        const r = await fetch(`${FS_BASE}/qs_channels/${encodeURIComponent(lower)}?${mask}&key=${FIREBASE.apiKey}`, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders()), body: JSON.stringify({ fields }) });
        if (!r.ok) { toast('Couldn\u2019t change t/' + lower + ': ' + await describeFailure(r, null)); return false; }
        if (have) have.category = cat; else (catalogCache || (catalogCache = [])).push({ channel: lower, status: 'approved', category: cat });
        toast('t/' + lower + ' now shows as ' + (cat === 'investment' ? 'Investment' : 'News') + ' for everyone (other users see it within about 30 minutes).');
        return true;
      } catch (e) { toast('Couldn\u2019t change t/' + lower + ': ' + await describeFailure(null, e)); return false; }
    },
    // Owner only (enforced by firestore.rules): approve or reject a channel people have linked.
    async setStatus(name, status) {
      if (!isOwner()) { toast('Only the owner account can approve channels.'); return false; }
      try {
        const url = `${FS_BASE}/qs_channels/${encodeURIComponent(name.toLowerCase())}?updateMask.fieldPaths=status&key=${FIREBASE.apiKey}`;
        const r = await fetch(url, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders()), body: JSON.stringify({ fields: { status: toFsValue(status) } }) });
        if (!r.ok) { const why = await describeFailure(r, null); toast('Couldn\u2019t update t/' + name + ': ' + why); return false; }
        approvedChannelsCache = null; catalogCache = null;
        toast('t/' + name + (status === 'approved' ? ' approved. It will be fetched on the next pipeline run.' : ' rejected.'));
        return true;
      } catch (e) { toast('Couldn\u2019t update t/' + name + ': ' + await describeFailure(null, e)); return false; }
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
        approvedChannelsCache = null; catalogCache = null;   // force the next channel-list render to drop it
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
      Board.publishMine();                // it appears on everyone's Sentiment board
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

  /* ---------- Telegram channels for Investment mode ----------
     Mirrors Companies above, not Channels: purely personal data (S.myInvestChannels, synced the same way as
     myCompanies), no shared pool or owner-curation step, since linking a channel just for one's own
     market-news tracking has no "approved for everyone" concept the way the News-mode channel pool does. */
  const InvestChannels = {
    add(raw) {
      if (!Auth.uid) { openAuthGate('agAddChannelsTitle', 'agAddChannelsBody'); return false; }
      const name = normalizeChannel(raw);
      if (!CHANNEL_RX.test(name)) { toast('Use the form t/channelname – letters, numbers and underscores only.'); return false; }
      const lower = name.toLowerCase();
      if (S.myInvestChannels.has(lower)) { toast('t/' + lower + ' is already linked.'); return false; }
      S.myInvestChannels.add(lower);
      Sync.pushSoon();
      track('invest_channel_add', { channel: lower });
      toast('t/' + lower + ' linked for Investment.');
      renderInvestChannels();
      return true;
    },
    remove(name) {
      S.myInvestChannels.delete(name.toLowerCase());
      Sync.pushSoon();
      track('invest_channel_remove', { channel: name });
      renderInvestChannels();
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
  /* Per-device alert preferences, stored on this device's own qs_push_subs doc so the pipeline can honour
     them when it decides who to push (parse_push_prefs()/sub_wants() in pipeline.py). Kept in
     localStorage too, purely so Settings can render the current choice instantly without a read back.
     Device-scoped on purpose, like Theme: "quiet hours on my phone" shouldn't mute a desktop. */
  const PUSH_PREFS_KEY = 'qs-push-prefs-v1';
  // news / invest: the two switches in Settings -> Notifications ("News notifications", "Stock
  // notifications"). perSlot: how many notifications in each of the day's three times - morning, afternoon,
  // evening (owner, 13 Oct). quiet/digest are kept only so older saved choices still read; the three daytime
  // slots replaced both.
  const PUSH_PREFS_DEFAULT = { minImp: 'Low', quiet: false, digest: 'off', news: true, invest: false, perSlot: 2 };
  // Fields an older firestore.rules doesn't know yet. If a save is refused because of them, it is retried
  // without them, so turning notifications on keeps working until the new rules are published.
  const PUSH_NEW_FIELDS = ['news', 'per_slot'];
  const PUSH_IMP_TIERS = ['Critical', 'High', 'Medium', 'Low'];
  const Push = {
    supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
    // Reflects this device's own subscription bookkeeping, not the live OS permission (which can change
    // behind our back in the browser's own settings) - renderNotifBox() checks Notification.permission too.
    isOn() { try { return localStorage.getItem('qs-push-on-v1') === '1'; } catch (e) { return false; } },
    setOn(v) { try { localStorage.setItem('qs-push-on-v1', v ? '1' : '0'); } catch (e) { /* ignore */ } },

    prefs() {
      try {
        const raw = JSON.parse(localStorage.getItem(PUSH_PREFS_KEY) || 'null');
        if (!raw || typeof raw !== 'object') return Object.assign({}, PUSH_PREFS_DEFAULT);
        return {
          minImp: PUSH_IMP_TIERS.includes(raw.minImp) ? raw.minImp : PUSH_PREFS_DEFAULT.minImp,
          quiet: !!raw.quiet,
          digest: ['off', 'daily', 'weekly'].includes(raw.digest) ? raw.digest : 'off',
          news: raw.news !== false,
          invest: !!raw.invest,
          // The 1-or-2 choice was taken off the screen (owner, 13 Oct): everyone gets up to 2 per slot.
          perSlot: 2
        };
      } catch (e) { return Object.assign({}, PUSH_PREFS_DEFAULT); }
    },
    // Writes the choice locally first (so the UI is never out of step with what the person just tapped),
    // then pushes it to Firestore. A failed write leaves the local copy as the truth and is retried by the
    // next resync()/subscribe(), which always sends the current prefs along with the keys.
    async savePrefs(patch) {
      const next = Object.assign(this.prefs(), patch || {});
      try { localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      if (!this.isOn()) return next;    // nothing subscribed yet: the choice ships with the next subscribe()
      try {
        const fields = this.prefFields(next);
        if (Auth.uid) fields.uid = toFsValue(Auth.uid);
        // uid is always in the mask: present in the body when signed in, absent when signed out - and a
        // masked field missing from the body is deleted, which is exactly what signing out should do.
        const mask = Object.keys(fields).concat(Auth.uid ? [] : ['uid']);
        await this.writeSub(fields, mask);
      } catch (e) { /* local copy stands; resync() will carry it up later */ }
      return next;
    },
    prefFields(p) {
      const pr = p || this.prefs();
      return {
        min_imp: toFsValue(pr.minImp),
        quiet: toFsValue(!!pr.quiet),
        digest: toFsValue(pr.digest),
        // The pipeline needs this device's UTC offset to work out ITS local quiet hours / digest time.
        // Negated because getTimezoneOffset() reports minutes to ADD to local to reach UTC, the opposite sign.
        tz_min: toFsValue(-new Date().getTimezoneOffset()),
        // Investment notifications. The pipeline personalises them from the signed-in account's own
        // portfolio (its tracked companies and linked channels), read directly - see run_push() in
        // pipeline.py - so this only says yes/no. watch is sent empty on purpose: older versions put a copy
        // of the watchlist here, and this clears it out.
        invest: toFsValue(!!pr.invest),
        watch: toFsValue([]),
        news: toFsValue(pr.news !== false),
        per_slot: toFsValue(pr.perSlot === 1 ? 1 : 2)
      };
    },
    // PATCH this device's signup. mask = null writes the whole document (subscribe); otherwise only the
    // listed fields. Retried once without the newest fields if the published rules don't accept them yet.
    async writeSub(fields, mask) {
      const send = async (f, m) => fetch(`${FS_BASE}/qs_push_subs/${pushId()}?key=${FIREBASE.apiKey}` +
        (m ? '&' + m.map(k => 'updateMask.fieldPaths=' + k).join('&') : ''), {
        method: 'PATCH', headers: await this.pushHeaders(), body: JSON.stringify({ fields: f })
      });
      let r = await send(fields, mask);
      if ((r.status === 400 || r.status === 403) && PUSH_NEW_FIELDS.some(k => k in fields)) {
        const f = Object.assign({}, fields); PUSH_NEW_FIELDS.forEach(k => delete f[k]);
        r = await send(f, mask && mask.filter(k => !PUSH_NEW_FIELDS.includes(k)));
      }
      return r;
    },
    // Which account this device's notifications belong to. firestore.rules only accept a uid that matches
    // the signed-in user making the write (hence pushHeaders() sending the login token), so nobody can
    // attach someone else's account and receive alerts about their portfolio.
    async pushHeaders() {
      const h = { 'Content-Type': 'application/json' };
      if (Auth.uid) { const tok = await Auth.bearerToken(); if (tok) h.Authorization = 'Bearer ' + tok; }
      return h;
    },
    // Re-saves this device's preferences when the account on it changes (sign-in, sign-out, first load),
    // so the account link always matches who is signed in. A no-op while notifications are off.
    syncAccount() {
      if (this.isOn()) this.savePrefs({});
    },

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
        const fields = Object.assign({
          endpoint: toFsValue(j.endpoint),
          p256dh: toFsValue((j.keys || {}).p256dh || ''),
          auth: toFsValue((j.keys || {}).auth || ''),
          created_at: toFsValue(new Date().toISOString())
        }, this.prefFields());   // carries this device's alert preferences on every (re)subscribe
        if (Auth.uid) fields.uid = toFsValue(Auth.uid);
        const r = await this.writeSub(fields, null);
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

  /* ---------- Tickets (bug reports / feedback) ----------
     User's own words: "It is becoming difficult for me to track each and every bugs / additional features
     which needs to be added - Kindly add a ticket system where user can raise the ticket [...] Which I can
     only see as the owner of the app and take actions on it." Originally no login required to submit, same
     shape as qs_push_subs/qs_channels; now requires sign-in (see submit() below) so a ticket can carry a real
     human-readable reference number tied to an account rather than an anonymous write. Still write-only for
     a normal visitor, get/list restricted to the owner account by firestore.rules - not just hidden in the
     UI, since a client-side check alone is never real security (same note as isOwner() elsewhere in this
     file). */
  const Tickets = {
    // A short human-friendly ticket number shown to the user as their reference (e.g. in a support reply
    // outside the app), separate from the Firestore document id (an opaque "tk..." string used only as a
    // storage key, never shown to anyone). Format: QS-XXXX-XXXX using an unambiguous alphabet (no 0/O/1/I)
    // so it's easy to read back over a phone call or type into an email. Collision risk is negligible for a
    // single-owner ticket volume and isn't worth a round-trip to check uniqueness before every submit.
    _TICKET_NUM_ALPHABET: '23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
    genTicketNumber() {
      const A = this._TICKET_NUM_ALPHABET;
      const part = () => Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('');
      return `QS-${part()}-${part()}`;
    },

    // Reads one file as base64 for storing directly on the ticket document - no Firebase Storage involved
    // (that would need the project on a paid "Blaze" plan, which the owner decided against for what amounts
    // to a handful of small screenshots). Returns { data, type, name } on success, or null on any failure
    // (the FileReader API rejecting, an unreadable file, etc) - submit() below treats a null here as "send
    // the ticket text anyway, just without the attachment" rather than blocking the whole submission.
    // TICKET_ATTACH_MAX_BYTES already caps the file size before this is even called (renderTicketBox()'s
    // file-input handler), so this is a pure local read with no network step and nothing that can fail due
    // to connectivity - only a corrupt/unreadable file triggers the catch below in practice.
    readAttachment(file) {
      return new Promise(resolve => {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            // reader.result is a data: URL ("data:image/png;base64,iVBORw0...") - only the base64 payload
            // after the comma is stored, since the MIME type is kept separately (attachment_type) and
            // reconstructed into a fresh data: URL when rendering it back (renderTicketAdmin()), rather than
            // storing the redundant "data:...;base64," prefix itself in Firestore.
            const result = String(reader.result || '');
            const comma = result.indexOf(',');
            if (comma < 0) { resolve(null); return; }
            resolve({ data: result.slice(comma + 1), type: file.type || 'application/octet-stream', name: (file.name || 'attachment').slice(-120) });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        } catch (e) {
          resolve(null);
        }
      });
    },

    // Requires sign-in (per the owner's request - tickets are now tied to a real account, same reasoning
    // as gating Telegram +Add and cross-device sync). Checked here too, not just in the UI (renderTicketBox()
    // hides the form for guests) and in firestore.rules (the real enforcement) - a client-side check alone
    // is never real security by itself, same note as isOwner() elsewhere in this file.
    // `file` is an optional File object (from the attachment picker in renderTicketBox()) - omitted or null
    // for a ticket with no attachment.
    async submit(kind, message, file) {
      if (!Auth.uid) return { ok: false, error: t('feedbackLoginTitle') };
      const text = (message || '').trim();
      if (!text) return { ok: false, error: t('ticketEmpty') };
      const id = 'tk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      const ticketNumber = this.genTicketNumber();
      let attachment = null, attachFailed = false;
      if (file) {
        attachment = await this.readAttachment(file);
        if (!attachment) attachFailed = true;
      }
      const fields = {
        kind: toFsValue(kind || 'feedback'),
        message: toFsValue(text.slice(0, 4000)),
        status: toFsValue('open'),
        created_at: toFsValue(new Date().toISOString()),
        ticket_number: toFsValue(ticketNumber),
        // Tags this ticket to the submitting account, so the owner can tell who reported what (user's own
        // request) - firestore.rules checks this matches the caller's own auth token on write.
        user_id: toFsValue(Auth.uid),
        // Still kept alongside user_id for a quick human-readable look in renderTicketAdmin() without having
        // to cross-reference an account by uid - always the signed-in account's own address, never empty,
        // since submit() requires Auth.uid above.
        user_email: toFsValue(Auth.email || ''),
      };
      if (attachment) {
        fields.attachment_data = toFsValue(attachment.data);
        fields.attachment_type = toFsValue(attachment.type);
        fields.attachment_name = toFsValue(attachment.name);
      }
      try {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders());
        const r = await fetch(`${FS_BASE}/qs_tickets/${id}?key=${FIREBASE.apiKey}`, {
          method: 'PATCH', headers, body: JSON.stringify({ fields })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        track('ticket_submit', { kind: kind || 'feedback', has_attachment: !!attachment });
        return { ok: true, ticketNumber, attachFailed };
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
    // Owner: set a ticket's status with a note for the person who raised it (owner, 14 Oct). status is
    // 'open' | 'in_progress' | 'done'; reply is shown to that person in the app.
    async update(id, status, reply) {
      if (!isOwner()) return false;
      try {
        const fields = { status: toFsValue(status), reply: toFsValue((reply || '').slice(0, 1000)), updated_at: toFsValue(new Date().toISOString()) };
        const r = await fetch(`${FS_BASE}/qs_tickets/${id}?updateMask.fieldPaths=status&updateMask.fieldPaths=reply&updateMask.fieldPaths=updated_at&key=${FIREBASE.apiKey}`, {
          method: 'PATCH',
          headers: Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders()),
          body: JSON.stringify({ fields })
        });
        return r.ok;
      } catch (e) { return false; }
    },
    setStatus(id, status) { return this.update(id, status, ''); },
    // Owner: delete a ticket outright (spam / garbage).
    async remove(id) {
      if (!isOwner()) return false;
      try {
        const r = await fetch(`${FS_BASE}/qs_tickets/${id}?key=${FIREBASE.apiKey}`, { method: 'DELETE', headers: await Sync.authHeaders() });
        return r.ok;
      } catch (e) { return false; }
    },
    // The signed-in person's own tickets (firestore.rules let anyone read tickets they raised, and only
    // those - the query has to ask for them by user_id for that to be allowed).
    async mine() {
      if (!Auth.uid) return null;
      try {
        const r = await fetch(`${FS_BASE}:runQuery?key=${FIREBASE.apiKey}`, {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders()),
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'qs_tickets' }],
            where: { fieldFilter: { field: { fieldPath: 'user_id' }, op: 'EQUAL', value: toFsValue(Auth.uid) } } } })
        });
        if (!r.ok) return null;
        return (await r.json()).filter(x => x.document).map(x => {
          const o = fsFieldsToObject(x.document.fields); o.id = x.document.name.split('/').pop();
          delete o.attachment_data; return o;
        }).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      } catch (e) { return null; }
    }
  };

  /* ---------- Archive (permanent story history) ----------
     feed.json keeps only 24h of stories (pipeline.py's prune() rewrites it every run) - so once a story
     ages out, its text/headline/score are gone from the only place they ever lived, for everyone,
     permanently. qs_archive (see firestore.rules) is where the pipeline writes a small permanent record of
     a story at the exact moment it would otherwise vanish without a trace (see write_archive() in
     pipeline.py). This module reads that collection back so a story's detail view can show "this is part of
     an ongoing situation" even once the earlier parts are no longer live.

     Thread grouping is done HERE, client-side, not server-side: company tagging (it.companies, from
     findCompanies()/E.analyze() - see mapRules()/mapLive() above) is already computed fresh on every client
     for every item, live or archived, so re-deriving the grouping here keeps exactly one source of truth
     for "what company is this story about" instead of a second copy maintained in Python. The grouping rule
     itself (per the owner's explicit choice) is simple: two stories are "the same thread" if they share at
     least one company. This will over-group once in a while (two unrelated stories about the same company
     in the same week) and under-group often (two related stories that don't share an explicit company
     mention) - a known, accepted starting point, not a finished algorithm; refining it needs real
     accumulated archive data to tune against, which doesn't exist yet on a brand new deploy of this feature. */
  const Archive = {
    _cache: new Map(),   // story's raw (un-prefixed) id -> array of archive records, or null while pending
    // Every archived record this visitor has ever fetched, kept around so a second story that shares a
    // company with an already-fetched one doesn't need its own round trip - see forStory() below.
    _all: [],
    _loadedAll: false,

    // One-time, best-effort fetch of the whole qs_archive collection (capped - see LIMIT) so thread
    // matching has something to search against. Deliberately NOT scoped to one company server-side: a
    // structured Firestore query needs an index per field it filters/orders on, and this collection is
    // small enough (a handful of KB per record, see write_archive()'s docstring) that listing it once and
    // filtering client-side is simpler and avoids an index-management step in the Firebase console this
    // app has otherwise never needed.
    async _loadAll() {
      if (this._loadedAll) return;
      this._loadedAll = true;   // set up front so a failed attempt doesn't retry forever on every card open
      try {
        const r = await fetch(`${FS_BASE}:runQuery?key=${FIREBASE.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'qs_archive' }], limit: 2000 } })
        });
        if (!r.ok) return;
        const rows = await r.json();
        this._all = rows.filter(x => x.document).map(x => {
          const o = fsFieldsToObject(x.document.fields);
          o.id = x.document.name.split('/').pop();
          return o;
        });
      } catch (e) { /* leave _all empty; forStory() below just finds nothing, same as "no thread" */ }
    },

    // Returns the archived records that share a company with `it` (a live, client-mapped item - see
    // mapRules()/mapLive()), sorted oldest-first so a timeline reads as a developing story, or [] if none
    // match or it.companies is empty (nothing to group on). Cached per story id so re-opening the same card
    // doesn't redo the scan.
    async forStory(it) {
      const rawId = it.id.replace(/^L/, '');
      if (this._cache.has(rawId)) return this._cache.get(rawId);
      await this._loadAll();
      const companies = new Set(it.companies || []);
      const matches = companies.size
        ? this._all.filter(a => a.id !== rawId && (a.companies || []).some(c => companies.has(c)))
            .sort((a, b) => (a.published || '').localeCompare(b.published || ''))
        : [];
      this._cache.set(rawId, matches);
      return matches;
    }
  };

  /* ---------- Pulse (Phase 1 community: one-tap bullish/bearish sentiment) ----------
     PER COMPANY, not per story. The first version of this voted per individual story, which looked right
     in isolation but broke down in practice: a company with 3 separate news items (a broker upgrade, an
     acquisition, a broker downgrade) ended up with 3 unrelated little polls, and a person who voted
     Bullish on two and Bearish on the third had no way to tell "what does the crowd think of this stock"
     from that - each bar was really just a reaction to one headline, not a read on the company. Voting is
     now one Bullish/Bearish choice per person per COMPANY, shown once above that company's whole story
     list (see renderInvestmentList()), and it applies to every story about that company automatically -
     there's nothing left to vote on per card.

     Two Firestore collections (see firestore.rules): qs_pulse/{companySlug} is the public-read aggregate
     {bull, bear} the UI displays, and qs_pulse_votes/{companySlug_uid} is the private per-(company,voter)
     record that actually enforces "one vote per person per company" - a running total alone can't stop
     someone tapping 500 times, so that real dedup has to live somewhere server-checkable, and this is it.
     The two are always written together from vote() below; a request that updates one but not the other
     (a dropped connection mid-sequence) is a known, accepted inconsistency - worst case a vote is
     double-counted or missed once, never a security hole and never user-generated text to moderate (see
     the project's own PM phasing notes on why Phase 1 has nothing to moderate by construction).

     Firestore's increment transform (used for the 2nd+ vote on a company) requires the target document to
     already exist - it does NOT create one - so the FIRST vote on any company has to be a plain create
     with explicit {bull:1,bear:0} or {bull:0,bear:1}, and every vote after that is an update. vote() below
     tries create first and falls back to update on ALREADY_EXISTS, rather than reading the doc first to
     decide, since that read-then-write shape has a race (two people's first vote landing at once) that
     try-create-then-fall-back doesn't. */
  const Pulse = {
    _cache: new Map(),     // companySlug -> { bull, bear } aggregate, or undefined if never fetched
    _mine: new Map(),      // companySlug -> 'bull'|'bear'|null (this signed-in user's own vote), or undefined if never fetched

    // Deterministic, Firestore-doc-id-safe key for a company name: lowercase, strip to [a-z0-9], join
    // with single hyphens. This (not the raw company string) is what both collections are keyed by, so
    // "Marico", "MARICO" and "marico " all vote into the same place, and the id is always valid regardless
    // of punctuation (&, ', ., commas) a company's display name might contain - see COMPANY_NAME_RX above
    // for the characters a tracked company name can actually have.
    companySlug(company) {
      return (company || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'company';
    },
    voteDocId(slug, uid) { return slug + '_' + uid; },

    // Best-effort read of the public aggregate plus (if signed in) the caller's own vote, both cached per
    // company so re-rendering the same company group is instant. Kicked off once per company the first
    // time its group is rendered in Investment mode (see renderInvestmentList()), then re-rendered into
    // once it resolves - same pattern Archive.forStory() uses for the per-story thread timeline.
    async forCompany(company) {
      const slug = this.companySlug(company);
      const tasks = [];
      if (!this._cache.has(slug)) {
        tasks.push((async () => {
          try {
            const r = await fetch(`${FS_BASE}/qs_pulse/${slug}?key=${FIREBASE.apiKey}`, { cache: 'no-store' });
            if (r.status === 404) { this._cache.set(slug, { bull: 0, bear: 0 }); return; }
            if (!r.ok) return;   // leave uncached; try again next time this group renders
            const doc = await r.json();
            const rec = fsFieldsToObject(doc.fields);
            this._cache.set(slug, { bull: rec.bull || 0, bear: rec.bear || 0 });
          } catch (e) { /* offline etc: leave uncached, same as "not loaded yet" */ }
        })());
      }
      if (Auth.uid && !this._mine.has(slug)) {
        tasks.push((async () => {
          try {
            const r = await fetch(`${FS_BASE}/qs_pulse_votes/${this.voteDocId(slug, Auth.uid)}?key=${FIREBASE.apiKey}`, {
              headers: await Sync.authHeaders(), cache: 'no-store'
            });
            if (r.status === 404) { this._mine.set(slug, null); return; }
            if (!r.ok) return;
            const doc = await r.json();
            const rec = fsFieldsToObject(doc.fields);
            this._mine.set(slug, rec.choice || null);
          } catch (e) { /* leave uncached */ }
        })());
      }
      if (tasks.length) await Promise.all(tasks);
    },

    // Current aggregate for a company, synchronous - reads whatever forCompany() last cached (null if
    // never fetched, same convention as Archive._cache.get() used by threadHTML()).
    counts(company) {
      return this._cache.get(this.companySlug(company)) || null;
    },
    mine(company) {
      return this._mine.get(this.companySlug(company)) || null;
    },

    // choice is 'bull' or 'bear'. Handles all three cases: first-ever vote on this company (create), a new
    // voter on an already-voted-on company (increment), and an existing voter switching their pick (move
    // one from their old choice to their new one). Optimistically updates the local caches before the
    // network call resolves so the tap feels instant, then reconciles or reverts on failure - same
    // honesty-over-silent-drift pattern as Channels.follow()/tgfollow above.
    async vote(company, choice) {
      if (!Auth.uid) { openAuthGate('agPulseTitle', 'agPulseBody'); return false; }
      const slug = this.companySlug(company);
      const prev = this._mine.get(slug) || null;
      if (prev === choice) return true;   // tapping the same choice twice is a no-op, not an "undo"
      const before = this._cache.get(slug) || { bull: 0, bear: 0 };
      const after = Object.assign({}, before);
      if (prev) after[prev] = Math.max(0, after[prev] - 1);   // switching: release the old choice
      after[choice] = (after[choice] || 0) + 1;
      this._cache.set(slug, after);
      this._mine.set(slug, choice);
      try {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, await Sync.authHeaders());
        const voteId = this.voteDocId(slug, Auth.uid);
        const voteBody = JSON.stringify({ fields: {
          company_slug: toFsValue(slug), uid: toFsValue(Auth.uid), choice: toFsValue(choice), voted_at: toFsValue(new Date().toISOString())
        } });
        const voteR = await fetch(`${FS_BASE}/qs_pulse_votes/${voteId}?key=${FIREBASE.apiKey}`, { method: 'PATCH', headers, body: voteBody });
        if (!voteR.ok) throw new Error(await describeFailure(voteR, null));

        // The aggregate write depends on whether this company has ever had a vote before. Try a plain
        // create first (works only when the doc doesn't exist yet); if it already exists, fall back to an
        // increment-transform update instead of re-reading first (see module doc-comment above for why).
        const createBody = JSON.stringify({ fields: { bull: toFsValue(choice === 'bull' ? 1 : 0), bear: toFsValue(choice === 'bear' ? 1 : 0) } });
        const createR = await fetch(`${FS_BASE}/qs_pulse?documentId=${slug}&key=${FIREBASE.apiKey}`, { method: 'POST', headers, body: createBody });
        if (createR.status === 409 || createR.status === 400) {
          // Doc already exists (or this isn't genuinely the first vote anymore) - move one vote via a
          // commit with field transforms: +1 on the new choice, and if switching, -1 on the old one too.
          const transforms = [{ fieldPath: choice, increment: { integerValue: '1' } }];
          if (prev) transforms.push({ fieldPath: prev, increment: { integerValue: '-1' } });
          const commitBody = JSON.stringify({ writes: [{
            transform: { document: `${FS_BASE}/qs_pulse/${slug}`, fieldTransforms: transforms }
          }] });
          const commitR = await fetch(`${FS_BASE}:commit?key=${FIREBASE.apiKey}`, { method: 'POST', headers, body: commitBody });
          if (!commitR.ok) throw new Error(await describeFailure(commitR, null));
        } else if (!createR.ok) {
          throw new Error(await describeFailure(createR, null));
        }
        track('pulse_vote', { choice, switched: !!prev });
        return true;
      } catch (e) {
        // Revert the optimistic update - this company's counts/mine go back to "not reliably known" so the
        // next render re-fetches fresh truth instead of displaying a number that never actually landed.
        this._cache.delete(slug);
        this._mine.set(slug, prev);
        toast('Couldn’t record your vote: ' + (e && e.message ? e.message : String(e)));
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
        if (!isOwner()) {                       // the pipeline publishes the defaults too: no database read per visitor
          await ChanStats.load();
          const d = ChanStats.data;
          if (d && Array.isArray(d.defaults)) { defaultChannelsCache = d.defaults.map(c => String(c).toLowerCase()); return; }
        }
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
  // Unread outranks everything else, including importance: a read Critical story sinks below an unread
  // Low one, because "read" means the user already saw it - ranking it above unread stories just makes
  // someone re-scan something they've dealt with to reach what they haven't. Within the same read/unread
  // group, importance still decides order (Critical first), then recency, exactly as before. See
  // SeenTracker below for how/when a story actually becomes "read" without requiring a tap to open it.
  const byPriority = (a, b) =>
    (S.reviewed.has(a.id) ? 1 : 0) - (S.reviewed.has(b.id) ? 1 : 0) ||
    E.impRank(b.importance) - E.impRank(a.importance) || b.addedAt - a.addedAt;
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
    if (it.inv) return false;   // a post from a channel linked only for Investment: shown in the Investment tab, never in News
    if (isCompanyStory(it)) return false;   // names a company: it lives in the Investment tab (owner, 24 Oct)
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
      // Daily appetite (see the Appetite module): holds back everything below the resolved floor until
      // "Show the rest" is tapped. Three deliberate exemptions - a saved story is never hidden, an
      // explicit priority selection always wins over the automatic floor, and the priority dropdown's
      // own counts (skip === 'imp') stay true so a tier never reads "0" when choosing it would reveal it.
      if (skip !== 'imp' && st !== 'saved' && !f.imp && Appetite.active() && !Appetite.revealed
        && !Appetite.allows(it)) return false;
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

  /* ---------- Company Status (Investment mode's equivalent of Country Status) ----------
     Same WhatsApp-Status-style ring row as countryGroups()/renderCountryBar() above, just keyed by tracked
     COMPANY instead of country - one ring per company in S.myCompanies, segments per active story about
     that company, most-recently-active / has-unread companies floating first. Unlike investmentGroups()
     (which nests sector -> company -> stories for the grouped list), this is a flat per-company list
     because the status row, like the country one, is a single horizontal strip with no sector grouping. */
  function companyGroups() {
    const want = S.myCompanies;
    if (!want.size) return [];
    const byCompany = new Map();
    for (const name of want) byCompany.set(name, []);   // every tracked company gets a ring even with 0 stories
    for (const it of all()) {
      if (itemStatus(it) !== 'active') continue;         // saved/dismissed/expired don't appear here
      const matched = (it.companies || []).filter(c => want.has(c));
      matched.forEach(c => byCompany.get(c).push(it));
    }
    const groups = [...byCompany.entries()].map(([company, stories]) => {
      stories.sort((a, b) => b.addedAt - a.addedAt);
      return { company, stories, unread: stories.some(s => !S.reviewed.has(s.id)), latest: stories.length ? stories[0].addedAt : 0 };
    });
    groups.sort((a, b) => (b.unread - a.unread) || (b.latest - a.latest) || a.company.localeCompare(b.company));
    return groups;
  }

  /* ---------- Investment tab: sector -> tracked-company groups ----------
     Deliberately NOT filtered by channelVisible()/followed channels - the Investment tab is scoped by
     which COMPANIES the user tracks, not which Telegram channels they follow, so a story about a tracked
     company should show here even if it came from a channel the user hasn't followed in the News tab.
     Still excludes dismissed/expired exactly like the News tab (a dismissed story should stay dismissed
     everywhere), and still respects the current search/priority filters via filtered-style logic in
     renderList(), same as the News tab's By-country/By-sector grouping. */
  // Owner, 24 Oct: every story that names a company belongs to the Investment tab, not News. A tracked
  // company's stories open from its card's News button; stories about other companies are listed below the
  // cards. The News tab keeps everything else (geopolitics, policy, and so on).
  const isCompanyStory = it => !!(it && (it.companies || []).length);
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

  // Company Status bar: Investment mode's equivalent of the country ring row above, same .cstatus/.cstop/
  // .qs-ring markup and ringGradient() math, just keyed by tracked company (companyGroups()) and showing
  // each company's initial instead of a flag emoji, since companies don't have one. Opens the SAME shared
  // viewer modal as the country bar (see openCompany()/the generalized S.cv below) rather than a second
  // modal - the viewer only cares about a flat ordered list of {name, stories}, which both bars produce.
  function renderCompanyBar() {
    const box = $('#companyStatus');
    if (!box) return;
    box.hidden = true; box.innerHTML = '';      // removed from the Investment tab (owner, 24 Oct)
    return;
    const groups = companyGroups();
    box.hidden = !groups.length;
    if (!groups.length) { box.innerHTML = ''; return; }
    box.innerHTML = groups.map(g => {
      const n = g.stories.length;
      const label = esc(g.company) + ' – ' + n + (n === 1 ? ' story' : ' stories') + (g.unread ? ', new' : '');
      return `<button class="cstop" data-act="opencompany" data-c="${esc(g.company)}" aria-label="${label}">
        <span class="qs-ring" style="background:${ringGradient(g.stories)}">${companyLogoHTML(g.company, 'qs-ring-inner')}</span>
        <span class="cstop-name">${esc(g.company)}</span>
      </button>`;
    }).join('');
  }

  // S.cv keeps the whole ordered list of groups (frozen at the moment the viewer opened, so the row
  // doesn't reshuffle under the user's thumb mid-session as reviewed state changes reorder it), which kind
  // of row opened it ('country' or 'company' - decides flag-vs-initial and which bar gets re-rendered on
  // close), plus which group and which story within it is current - so ">" can walk off the end of one
  // group straight into the next, the way swiping past the last status/story usually works.
  function cvStories() { return S.cv.groups[S.cv.groupIdx].stories; }
  function cvName() { const g = S.cv.groups[S.cv.groupIdx]; return S.cv.kind === 'company' ? g.company : g.country; }

  function openCountry(country) {
    const groups = countryGroups();
    const gi = groups.findIndex(x => x.country === country);
    if (gi === -1 || !groups[gi].stories.length) return;
    S.cv = { kind: 'country', groups, groupIdx: gi, idx: 0 };
    $('#countryViewer').hidden = false;
    document.body.classList.add('cv-lock');
    renderCountryViewer();
    markCurrentReviewed();
  }

  function openCompany(company) {
    const groups = companyGroups();
    const gi = groups.findIndex(x => x.company === company);
    if (gi === -1 || !groups[gi].stories.length) return;
    S.cv = { kind: 'company', groups, groupIdx: gi, idx: 0 };
    $('#countryViewer').hidden = false;
    document.body.classList.add('cv-lock');
    renderCountryViewer();
    markCurrentReviewed();
  }

  function closeCountryViewer() {
    if (!S.cv) return;
    const kind = S.cv.kind;
    S.cv = null;
    $('#countryViewer').hidden = true;
    document.body.classList.remove('cv-lock');
    // ring segments may have flipped from unread to reviewed while open - refresh whichever bar was open.
    if (kind === 'company') renderCompanyBar(); else renderCountryBar();
  }

  function markCurrentReviewed() {
    if (!S.cv) return;
    const it = cvStories()[S.cv.idx];
    if (!it || S.reviewed.has(it.id)) return;
    S.reviewed.add(it.id);
    Sync.pushSoon();
    renderCountryViewer();   // update the dash for the now-reviewed story without a full re-render
  }

  /* ---------- SeenTracker: marking a card "read" without requiring a tap ----------
     With 300+ stories in the list, most users skim headlines scrolling past rather than tapping every
     card open - markCurrentReviewed() above only fires inside the separate Country/Company Status
     viewer modal, so the main Signals/Investment list had no way to learn "the user actually saw this"
     at all. A flat "visible for N seconds" timer is the obvious first idea, but it has a real failure
     mode: a fast flick-scroll carries a card through the viewport in well under a second, so a timer
     short enough to catch normal reading pace also marks cards "read" during a scroll the user never
     paused on - and a timer long enough to avoid that false-positive makes genuinely-read cards wait
     too long during slow, attentive scrolling.

     So this gates the dwell timer on TWO signals together, not one:
       1. Visibility fraction - a card must be at least IO_THRESHOLD (60%) on-screen, via
          IntersectionObserver, which is native and event-driven (no polling every card's
          getBoundingClientRect on every scroll frame).
       2. Scroll having actually settled - lastScrollAt is updated on every scroll event, and a card's
          dwell timer is only allowed to START while scroll has been quiet for SCROLL_SETTLE_MS; if the
          page is still moving, the card is "passing through" the viewport, not being read, however much
          of it is technically visible.
     Only once both hold for READ_DWELL_MS does a card actually get marked reviewed. Leaving the 60%
     region, or scrolling resuming, cancels a pending timer outright - re-entering starts a fresh one,
     never resumes a partial count, so a card genuinely has to sit still on screen once, uninterrupted.

     Per the owner's explicit call: marking reviewed never triggers an immediate re-render/re-sort here -
     byPriority (which now ranks unread above read) is only re-applied the next time renderList()/
     renderInvestmentList() runs on their own (pull-to-refresh, the 60s auto-poll, tab switch, etc.), so
     cards never visibly reshuffle under a user's thumb mid-scroll. */
  const SEEN = {
    io: null,
    pending: new Map(),       // element -> timeout id, for cards currently mid-dwell
    lastScrollAt: 0,
    settleCheckRaf: null,
  };
  const IO_THRESHOLD = 0.6;
  const READ_DWELL_MS = 1500;
  const SCROLL_SETTLE_MS = 150;

  function seenScrollSettled() {
    return Date.now() - SEEN.lastScrollAt >= SCROLL_SETTLE_MS;
  }

  // Called once a card has been >=IO_THRESHOLD visible continuously; re-checks scroll-settle on a short
  // rAf loop rather than starting the real dwell timer immediately, since the card may have crossed the
  // threshold mid-flick (still moving) rather than at rest.
  function seenArm(el, id) {
    if (S.reviewed.has(id) || SEEN.pending.has(el)) return;
    const tryStart = () => {
      if (!SEEN.pending.has(el)) return;   // cancelled (left the viewport) while waiting to settle
      if (!seenScrollSettled()) { SEEN.pending.set(el, requestAnimationFrame(tryStart)); return; }
      const timeoutId = setTimeout(() => {
        SEEN.pending.delete(el);
        if (S.reviewed.has(id)) return;
        S.reviewed.add(id);
        Sync.pushSoon();   // background persist only - no renderList()/renderAll() call, by design (see above)
      }, READ_DWELL_MS);
      SEEN.pending.set(el, timeoutId);
    };
    SEEN.pending.set(el, requestAnimationFrame(tryStart));
  }

  // Cancels whatever's pending for this card - a rAf settle-check or a live dwell timeout, both stored
  // the same way in SEEN.pending since only one is ever active per element at a time. Harmless (and a
  // no-op) to call on a card that was never armed, since cancelAnimationFrame/clearTimeout both silently
  // ignore an id that doesn't correspond to their own kind of handle.
  function seenDisarm(el) {
    const handle = SEEN.pending.get(el);
    if (handle == null) return;
    cancelAnimationFrame(handle);
    clearTimeout(handle);
    SEEN.pending.delete(el);
  }

  function seenInit() {
    if (SEEN.io) return;   // already set up - observe()/unobserve() calls below are enough from here on
    window.addEventListener('scroll', () => { SEEN.lastScrollAt = Date.now(); }, { passive: true });
    SEEN.io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const el = entry.target, id = el.dataset.id;
        if (!id) continue;
        if (entry.intersectionRatio >= IO_THRESHOLD) seenArm(el, id);
        else seenDisarm(el);
      }
    }, { threshold: [IO_THRESHOLD] });
  }

  // Re-points the observer at exactly the cards currently in the DOM - called at the end of every
  // renderList()/renderInvestmentList()/renderSaved(), since those replace #list's/#savedList's
  // innerHTML wholesale each time, which silently drops every previous observe() target along with the
  // old nodes. disconnect() first, rather than tracking individual unobserve() calls, because there's no
  // cheaper way to know which of the old elements even still exist once innerHTML has already been
  // reassigned - and re-observing a fresh, fully-current set is exactly as correct either way.
  function seenObserveVisible(container) {
    seenInit();
    SEEN.io.disconnect();
    SEEN.pending.forEach((handle) => { cancelAnimationFrame(handle); clearTimeout(handle); });
    SEEN.pending.clear();
    if (!container) return;
    container.querySelectorAll('.entry[data-id]').forEach(el => {
      if (!S.reviewed.has(el.dataset.id)) SEEN.io.observe(el);
    });
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
    // Past an edge: move on to the next (or previous) country's/company's stories, starting from its near
    // end, instead of just stopping - this is the ">" transition between groups.
    const gi = S.cv.groupIdx + (delta > 0 ? 1 : -1);
    if (gi < 0 || gi >= S.cv.groups.length) { closeCountryViewer(); return; }   // no more groups either way: done
    S.cv.groupIdx = gi;
    S.cv.idx = delta > 0 ? 0 : S.cv.groups[gi].stories.length - 1;
    renderCountryViewer();
    markCurrentReviewed();
  }

  // Story photo / cover on the story card: switched off for now at the owner's request (13 Oct) - no story
  // has a photo yet. Set to true to bring back the photo (or the flag cover when there is none).
  const CV_SHOW_MEDIA = false;
  function renderCountryViewer() {
    if (!S.cv) return;
    const name = cvName(), idx = S.cv.idx, stories = cvStories();
    const it = stories[idx];
    ensureTranslated(collectTranslatable([it]));   // just the current story - no need to translate every story in every country up front
    const dashes = stories.map((s, i) => {
      const cls = i < idx ? 'seen' : (i === idx ? 'current' : '');
      return `<span class="cv-dash ${cls}"></span>`;
    }).join('');
    // Story-card layout the owner asked for (12 Oct, from a reference screenshot): badge + name + share +
    // close on top, then a large headline, a short summary, and the story's photo in a rounded frame.
    $('#cvDashes').innerHTML = dashes;
    const isCo = S.cv.kind === 'company';
    const glyph = isCo ? companyLogoHTML(name, 'gc-ring-inner') : esc(flagOf(name));
    $('#cvBadge').innerHTML = glyph;
    $('#cvTitle').textContent = name;
    $('#cvPos').textContent = `${idx + 1} / ${stories.length}`;
    const headline = trOf(it.headline);
    const hlCls = headline.length > 130 ? ' cv-hl-l' : headline.length > 70 ? ' cv-hl-m' : '';
    const imp = (it.importance || '').toLowerCase();
    // A broken or expired photo link falls back to the cover instead of an empty frame.
    const cover = `<div class="cv-media cv-cover"><span class="cv-cover-glyph">${glyph}</span>
        <span class="cv-cover-name">${esc(name)}</span>${it.sector && it.sector !== 'Other' ? `<span class="cv-cover-sect">${esc(it.sector)}</span>` : ''}</div>`;
    const media = it.image
      ? `<div class="cv-media"><img src="${esc(it.image.url)}" alt="" loading="lazy" data-onerr="cover" ></div>`
      : cover;
    const body = $('#cvBody');
    body.innerHTML = `
      <h1 class="cv-headline${hlCls}">${esc(headline)}</h1>
      ${''/* the summary under the headline was removed (owner, 22 Oct): the card shows the headline only */}
      ${''/* time, priority and sector were removed from the story card (owner, 14 Oct) */}
      ${CV_SHOW_MEDIA ? media : ''}
    `;
    const m = body.querySelector('.cv-media');
    if (m && it.image) m.dataset.fallback = cover;
    // A quick crossfade so moving between stories - and especially between countries/companies - reads as
    // a smooth transition rather than a hard cut.
    body.classList.remove('cv-fade'); void body.offsetWidth; body.classList.add('cv-fade');
  }

  // A short summary for the story card: the story's own summary, minus any repeat of the headline and the
  // flag/dash prefix some sources put in front, cut at a word near 240 characters.
  function cvSummary(it, headline) {
    const clean = x => String(x || '').replace(/^[^\p{L}\p{N}"“'‘(]+/u, '').replace(/\s+/g, ' ').trim();
    const norm = x => clean(x).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '');
    let s = clean(trOf(it.summary || ''));
    const h = norm(headline);
    if (s && h && norm(s).startsWith(h.slice(0, Math.min(h.length, 60)))) {
      // the summary repeats the headline: keep only what comes after it
      const words = clean(headline).split(' ').length;
      s = s.split(' ').slice(words).join(' ').replace(/^[^\p{L}\p{N}"“'‘(]+/u, '');
    }
    if (s.length < 30) s = clean(it.why || '');
    if (s.length < 30) return '';
    if (s.length > 240) s = s.slice(0, 240).replace(/\s+\S*$/, '') + '…';
    return s;
  }
  // Share the story on view: the phone's share sheet where there is one, otherwise copy a link.
  async function cvShare() {
    if (!S.cv) return;
    const it = cvStories()[S.cv.idx];
    if (!it) return;
    const url = location.origin + location.pathname + '#' + encodeURIComponent(it.id);
    const text = trOf(it.headline);
    track('story_share', { id: it.id });
    try {
      if (navigator.share) { await navigator.share({ title: 'QwickSignal', text, url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text + '\n' + url); toast('Link copied. Paste it anywhere to share.'); }
    catch (e) { toast(url); }
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
    SavedStore.save();
    SavedCloud.put(all().find(it => it.id === id));
    Sync.pushSoon();
    keepScroll(renderAll);
    toast('Saved. Find it any time under Saved.');
    track('save_story', { id });
  }
  // Only "Remove from Saved" takes a story out of Saved, and it can be undone like a dismiss.
  function unsaveItem(id) {
    S.saved.delete(id);
    SavedCloud.remove(id);
    Sync.pushSoon();
    renderAll();
    toastAction('Removed from Saved. <button class="link inline" data-act="undo-unsave" data-id="' + esc(id) + '">Undo</button>', 5000);
    track('unsave_story', { id });
  }
  function undoUnsave(id) {
    S.saved.add(id);
    SavedStore.save();
    SavedCloud.put(all().find(it => it.id === id));
    Sync.pushSoon();
    renderAll();
    clearTimeout(toastTimer);
    $('#toast').classList.remove('show');
    track('undo_unsave', { id });
  }
  // Swiping a story away clears it from the feed. It used to also delete it from Saved, so saving a story
  // and then swiping it out of Signals silently lost it (owner's recording, 12 Oct). A saved story now
  // stays in Saved until "Remove from Saved" is tapped there.
  // Re-rendering the lists replaces their markup; without this the page can jump back toward the top, which on a
  // long feed looked like the whole page reloading after Skip or Undo.
  function keepScroll(fn) {
    const el = document.scrollingElement || document.documentElement;
    const y = el.scrollTop;
    fn();
    el.scrollTop = y;
    requestAnimationFrame(() => { if (Math.abs(el.scrollTop - y) > 2) el.scrollTop = y; });
  }
  // Takes ONE card out of the News list in place - it folds away, its group heading count drops by one, and no
  // other card is touched. Rebuilding the whole list for every skip made the page flash and (on a long feed)
  // look like it was reloading.
  function removeCardInPlace(wrap) {
    let head = wrap.previousElementSibling;
    while (head && !head.classList.contains('grp')) head = head.previousElementSibling;
    if (head) {
      const n = head.querySelector('.n');
      if (n) n.textContent = String(Math.max(0, (parseInt(n.textContent, 10) || 1) - 1));
    }
    wrap.style.height = wrap.offsetHeight + 'px';
    wrap.style.overflow = 'hidden';
    wrap.style.transition = 'height .2s ease, margin .2s ease, opacity .2s ease';
    void wrap.offsetHeight;                                  // lock in the starting height, then fold
    wrap.style.height = '0'; wrap.style.marginBottom = '0'; wrap.style.opacity = '0';
    setTimeout(() => {
      const next = wrap.nextElementSibling;
      wrap.remove();
      if (head && !(next && next.classList.contains('entrywrap'))) {
        const after = head.nextElementSibling;
        if (!(after && after.classList.contains('entrywrap'))) head.remove();   // that group is now empty
      }
      if (!$('#list .entrywrap')) renderList();                                 // nothing left: show the empty message
    }, 230);
  }
  function dismissItem(id, wrap) {
    const wasSaved = S.saved.has(id);
    S.dismissed.add(id);
    Sync.pushSoon();
    if (wrap && wrap.isConnected && S.mode === 'news' && !SWIPE.active) {
      removeCardInPlace(wrap);
      renderCountryBar(); renderControls();
    } else keepScroll(renderAll);
    toastAction((wasSaved ? 'Hidden from the feed. Still in Saved. ' : 'Dismissed. ')
      + '<button class="link inline" data-act="undo-dismiss" data-id="' + esc(id) + '">Undo</button>', 5000);
    track('dismiss_story', { id, saved: wasSaved });
  }
  function undoDismiss(id) {
    S.dismissed.delete(id);
    Sync.pushSoon();
    keepScroll(renderAll);
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
      : `<a class="btn-watch" href="${esc(safeUrl(info.url))}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${tri}Watch on ${v.platform === 'youtube' ? 'YouTube' : 'original source'}</a>`;
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
    $('#vmOpen').href = safeUrl(info.url);
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
    rememberGateResume();
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
     (click the ticker name top-left of the chart) is the real correction path for anything guessed wrong.
     A fresh script tag is created on every open (rather than a single reused one) because the widget's
     config is baked in at script-load time - there's no documented "change symbol" call for this
     particular embed, so a different company means a fresh widget. */
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

  // News display, Style A (left-accent card): the card already carried a left border colored by priority
  // (.entry.imp-* -> --c, set long ago) but the footer never named the priority in words - a quick scan of
  // the list could see "something is more urgent" from the border color alone, but not which level without
  // opening the card. impChipHTML() adds a small dot-count + label chip (●●● Critical / ●● High / ● Medium,
  // Low gets a plain label with no dots - it's the resting/default level, nothing to call out) using the
  // same IMP_TITLES wording and IMP_VAR colors already used elsewhere (the Signals priority-group headers,
  // the importance bar), so this is a new rendering of existing vocabulary, not a new taxonomy.
  const IMP_DOTS = { Critical: '●●●', High: '●●', Medium: '●', Low: '' };
  function impChipHTML(importance) {
    const label = { Critical: 'Critical', High: 'High', Medium: 'Medium', Low: 'Low' }[importance] || importance;
    const dots = IMP_DOTS[importance] || '';
    return `<span class="imp-chip" style="color:${IMP_VAR[importance] || 'var(--ink2)'}">${dots ? dots + ' ' : ''}${esc(label)}</span>`;
  }

  function entryHTML(it) {
    const open = S.open.has(it.id);
    const n = (it.sources || []).length;
    const rel = (it.related || []).length;
    // Closed-card thumbnail only (CSS also hides it via .entry.open .entry-thumb as a second safety net) -
    // a real headline photo from image_intel.py when one was found, otherwise nothing is rendered at all
    // rather than a placeholder box, so stories without a match just keep today's clean text-only look.
    const thumb = (!open && it.image && it.image.url)
      ? `<div class="entry-thumb"><img src="${esc(it.image.url)}" alt="" loading="lazy" data-onerr="thumb"></div>` : '';
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
      <div class="foot">${impChipHTML(it.importance)}${n > 1 ? `<span>${n} sources</span>` : ''}${rel ? `<span>${rel} related</span>` : ''}<span title="${esc(fmtDateTime(it.addedAt))}">${ago(it.addedAt)}</span><span class="ts">${esc(fmtDateTime(it.addedAt))}</span></div>
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
      ? `<div class="entry-thumb"><img src="${esc(it.image.url)}" alt="" loading="lazy" data-onerr="thumb"></div>` : '';
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
      <div class="foot">${impChipHTML(it.importance)}${n > 1 ? `<span>${n} sources</span>` : ''}<span title="${esc(fmtDateTime(it.addedAt))}">${ago(it.addedAt)}</span><span class="ts">${esc(fmtDateTime(it.addedAt))}</span></div>
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
    const wrap = card.closest('.entrywrap');
    setTimeout(() => { if (dx < 0) dismissItem(id, wrap); else saveItem(id); }, 200);
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


  // Renders a company's ring icon - its real logo when one loads, the existing plain initial-letter circle
  // otherwise. Used everywhere a company gets one of these rings: Investment's company cards, the Community
  // tab, the Company Status bar, and the shared story-viewer modal's company glyph. innerClass is whichever
  // of .qs-ring-inner/.gc-ring-inner that call site already used for the initial - kept so the existing ring
  // CSS (size, border, background) continues to apply unchanged whichever way this renders.
  //
  // BUG FIX: this used to go straight to Google's public favicon service (google.com/s2/favicons) as the
  // ONLY logo source, with the plain letter circle as the only fallback. In real use (not this sandbox,
  // which can't reach google.com at all to test either way) that endpoint turned out to fail outright for
  // users - it's an unofficial, undocumented Google API with "no published terms, rate limits, or uptime
  // commitment" (it can reject or rate-limit hotlinked traffic from arbitrary third-party sites at any
  // time, with no warning) - so every company silently fell back to its letter, which is exactly the
  // "logos don't fetch, I just get letters" report. Fixed by trying each company's OWN site favicon FIRST
  // (https://{domain}/favicon.ico - a standard, first-party file every real company domain is expected to
  // serve, not a third-party service that can be blocked independently of the company's own site), with
  // Google's endpoint kept only as a SECOND attempt, and the letter circle as the final fallback if both
  // image loads fail. onerror chains through a small ordered list of candidate URLs instead of jumping
  // straight to the letter on the first failure.
  //
  // Domain guess comes from guessLogoDomain() - same "never a hard claim" spirit as guessSymbol() guessing a
  // ticker. Caveat carried over from the Google-only version: Google's endpoint can return a generic grey
  // globe placeholder (a real, loadable image) for a domain with no icon on file, rather than failing in a
  // way onerror can catch - so an occasional generic globe for an obscure/freehand company, if the direct
  // favicon.ico attempt also fails to resolve, is the accepted trade-off of a free, no-key source.
  /* ---------- Company logos: the sharpest available source wins ----------
     BUG FIX (blurry logos): the previous version took the first source that loaded at all, and tried the
     company's own /favicon.ico first. A favicon is usually 16-32px; the company ring draws it at ~38 CSS px,
     which on a 3x phone screen is ~115 real pixels - a 4-7x stretch, hence the blur. Nothing ever checked
     how big the image actually was.

     Now every candidate is loaded off-screen first and MEASURED (naturalWidth needs no CORS), and the
     largest wins. The first one at LOGO_HQ_PX or more ends the search early. All sources are free with no
     key or account:
       1. /apple-touch-icon.png - first-party, conventionally 180x180, made for exactly this use
       2. Google's favicon service at sz=256 - returns the largest icon Google has for the site
       3. DuckDuckGo's icon service - a second independent index
       4. /favicon.ico - smallest, last resort
     The ring shows the company's initial (crisp) while this runs, then swaps in the winner. The result is
     cached on the device for two weeks, so it is measured once per company rather than on every render;
     re-renders happen every couple of minutes and would otherwise re-probe and flicker. */
  const LOGO_CACHE_KEY = 'qs-logo-v1';
  const LOGO_TTL_MS = 14 * 864e5;
  const LOGO_MISS_TTL_MS = 6 * 3600e3;   // "no logo found" is re-checked sooner: it may have been a bad connection
  const LOGO_HQ_PX = 96;                 // sharp at the largest ring on a 2x screen, and close to it on 3x
  const LOGO_MIN_PX = 32;                // smaller than this can't be shown without obvious blur - use the initial
  const Logos = {
    mem: null,
    pending: new Map(),
    all() {
      if (this.mem) return this.mem;
      try { this.mem = JSON.parse(localStorage.getItem(LOGO_CACHE_KEY) || '{}') || {}; } catch (e) { this.mem = {}; }
      return this.mem;
    },
    save() { try { localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(this.all())); } catch (e) { /* storage full */ } },
    // {u, w, t} for a usable logo, {u: null, t} for "none worth showing", undefined if unknown or expired.
    get(domain) {
      const e = this.all()[domain];
      if (!e) return undefined;
      const ttl = e.u ? LOGO_TTL_MS : LOGO_MISS_TTL_MS;
      return (Date.now() - (e.t || 0) > ttl) ? undefined : e;
    },
    forget(domain) { delete this.all()[domain]; this.save(); },
    candidates(d) {
      const e = encodeURIComponent(d);
      return [
        'https://' + d + '/apple-touch-icon.png',
        'https://www.google.com/s2/favicons?sz=256&domain=' + e,
        'https://icons.duckduckgo.com/ip3/' + e + '.ico',
        'https://' + d + '/favicon.ico'
      ];
    },
    // Loads one candidate off-screen and reports its real size; null for a failure, a non-image, or a
    // source that hangs (6s cap, so one slow host can't stall the rest).
    probe(url) {
      return new Promise(resolve => {
        const im = new Image();
        let done = false;
        const finish = v => { if (!done) { done = true; resolve(v); } };
        im.referrerPolicy = 'no-referrer';
        im.decoding = 'async';
        im.onload = () => finish(im.naturalWidth ? { u: url, w: Math.min(im.naturalWidth, im.naturalHeight) } : null);
        im.onerror = () => finish(null);
        setTimeout(() => finish(null), 6000);
        im.src = url;
      });
    },
    resolve(domain) {
      if (this.pending.has(domain)) return this.pending.get(domain);
      const job = (async () => {
        let best = null;
        for (const u of this.candidates(domain)) {
          const r = await this.probe(u);
          if (!r) continue;
          if (!best || r.w > best.w) best = r;
          if (r.w >= LOGO_HQ_PX) break;
        }
        const entry = best && best.w >= LOGO_MIN_PX ? { u: best.u, w: best.w, t: Date.now() } : { u: null, t: Date.now() };
        // Don't record "no logo" while offline - every probe failing then says nothing about the company.
        if (entry.u || navigator.onLine !== false) { this.all()[domain] = entry; this.save(); }
        this.pending.delete(domain);
        this.upgrade(domain, entry);
        return entry;
      })();
      this.pending.set(domain, job);
      return job;
    },
    // Swaps every ring still showing this company's initial for the logo just found. Queried at completion
    // time, not captured up front, so rings re-rendered while the probe was running are upgraded too.
    upgrade(domain, entry) {
      document.querySelectorAll('[data-logo-pending]').forEach(el => {
        if (el.dataset.logoPending !== domain) return;
        el.removeAttribute('data-logo-pending');
        if (entry.u) el.outerHTML = logoImgHTML(el.dataset.logoCls, entry, el.dataset.logoInitial, domain);
      });
    }
  };
  function logoImgHTML(cls, entry, initial, domain) {
    // A logo that cleared LOGO_MIN_PX but not LOGO_HQ_PX is drawn smaller inside its plate (the -lq class),
    // so it is stretched less and stays reasonably sharp instead of being blown up to full size.
    const lq = entry.w < LOGO_HQ_PX ? ` ${cls}-lq` : '';
    return `<span class="${cls} ${cls}-logo${lq}"><img src="${esc(entry.u)}" alt="" decoding="async" referrerpolicy="no-referrer"
      data-logo-domain="${esc(domain)}" data-logo-cls="${esc(cls)}" data-logo-initial="${esc(initial)}"
      data-onerr="logo"></span>`;
  }
  // A cached logo URL that has since stopped working (the site moved its icon): drop the cache entry and
  // fall back to the initial. The next render probes again. Global because inline onerror="" runs outside
  // this closure; it only reads values back from data-* attributes, never from interpolated strings.
  // (Pages are served with a Content-Security-Policy that forbids inline handlers, so images mark themselves
  // with data-onerr and this one capturing listener handles the failure.)
  document.addEventListener('error', ev => {
    const img = ev.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.onerr) return;
    const kind = img.dataset.onerr;
    if (kind === 'logo') window.__qsLogoFail(img);
    else if (kind === 'thumb') { const w = img.closest('.entry-thumb'); if (w) w.remove(); }
    else if (kind === 'cover') { const w = img.parentNode; if (w && w.dataset.fallback) w.outerHTML = w.dataset.fallback; }
  }, true);
  window.__qsLogoFail = img => {
    img.onerror = null;
    Logos.forget(img.dataset.logoDomain);
    const s = document.createElement('span');
    s.className = img.dataset.logoCls;
    s.textContent = img.dataset.logoInitial;
    (img.parentElement || img).replaceWith(s);
  };

  function companyLogoHTML(company, innerClass) {
    const initial = (company || '?').trim().charAt(0).toUpperCase() || '?';
    const domain = E.guessLogoDomain(company || '');
    const plain = `<span class="${innerClass}">${esc(initial)}</span>`;
    if (!domain) return plain;
    const hit = Logos.get(domain);
    if (hit) return hit.u ? logoImgHTML(innerClass, hit, initial, domain) : plain;
    // Unknown yet: show the initial now and measure the candidates in the background. Deferred a tick so
    // the caller has inserted this markup before upgrade() goes looking for it.
    setTimeout(() => Logos.resolve(domain), 0);
    return `<span class="${innerClass}" data-logo-pending="${esc(domain)}" data-logo-cls="${esc(innerClass)}" data-logo-initial="${esc(initial)}">${esc(initial)}</span>`;
  }

  // Thread timeline block: stories from Archive.forStory() that share a company with `it`. Synchronous -
  // reads whatever Archive's cache already has (populated by the async fetch kicked off when this card was
  // opened; see the data-act click handler's "opening" branch). Empty before that fetch resolves, same as
  // the thread simply not existing yet - re-rendered once real data arrives, no spinner/placeholder needed
  // since the window between open and re-render is normally under a second.
  // Sentiment-pulse row, PER COMPANY: rendered once per tracked company in the dedicated Community/Pulse tab
  // (see renderCommunity()), not per story and no longer inline inside Investment's story groups either -
  // see the Pulse module's own doc-comment for why it's company-scoped, and renderCommunity()'s own comment
  // for why it moved to its own tab. Synchronous, same convention as threadHTML() below - reads whatever
  // Pulse.forCompany() last cached; the actual fetch is kicked off the first time a company's row renders
  // (see renderCommunity()) and this re-renders once it resolves. Shows nothing (not even a loading state)
  // until the first fetch lands, same as the thread timeline.
  function pulseHTML(company) {
    const counts = Pulse.counts(company);
    if (!counts) return '';
    const mine = Pulse.mine(company);
    const total = counts.bull + counts.bear;
    const bullPct = total ? Math.round((counts.bull / total) * 100) : 50;
    // Accessibility fix: the bar's bull/bear split used to be readable by fill color alone. A text
    // percentage pair above it (read before either color is interpreted) plus a stripe texture on the
    // bear fill (CSS, see .fill-bear) mean the split no longer depends on being able to tell red from
    // green - see the CSS comment above .pulse-pct for the full reasoning.
    return `<div class="pulse-row">
        <b>${esc(t('pulseLabel'))}</b>
        <div class="pulse-pct"><span class="pct-bull">▲ ${bullPct}%</span><span class="pct-bear">▼ ${100 - bullPct}%</span></div>
        <div class="pulse-bar"><span class="fill-bull" style="width:${bullPct}%"></span><span class="fill-bear" style="width:${100 - bullPct}%"></span></div>
        <div class="pulse-btns">
          <button class="pulse-btn bull${mine === 'bull' ? ' active' : ''}" data-act="pulse" data-v="bull" data-company="${esc(company)}">▲ ${esc(t('pulseBull'))} <span class="pulse-count">${counts.bull}</span></button>
          <button class="pulse-btn bear${mine === 'bear' ? ' active' : ''}" data-act="pulse" data-v="bear" data-company="${esc(company)}">▼ ${esc(t('pulseBear'))} <span class="pulse-count">${counts.bear}</span></button>
        </div>
      </div>`;
  }

  function threadHTML(it) {
    const matches = Archive._cache.get(it.id.replace(/^L/, '')) || [];
    if (!matches.length) return '';
    const IMP_VAR2 = { Critical: 'var(--crit)', High: 'var(--high)', Medium: 'var(--med)', Low: 'var(--low)' };
    const rows = matches.map(a => `<li>
        <span class="thr-date">${esc((a.published || '').slice(0, 10))}</span>
        <span class="thr-imp" style="color:${IMP_VAR2[a.importance] || 'var(--ink2)'}">${esc(a.importance || '')}</span>
        <span class="thr-hl">${esc(a.headline || '')}</span>
      </li>`).join('');
    return `<div class="thread"><b>Part of an ongoing situation</b><ul class="thr-list">${rows}
        <li class="thr-current"><span class="thr-date">${esc(it.date || dayISO(it.addedAt))}</span><span class="thr-imp" style="color:${IMP_VAR2[it.importance] || 'var(--ink2)'}">${esc(it.importance)}</span><span class="thr-hl">${esc(it.headline)} <i>(this story)</i></span></li>
      </ul></div>`;
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
        ${row('Sources', (it.sources || []).map(s => s.url ? `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)).join(', '))}
      </dl>
      ${rel.length ? `<div class="rel"><b>Related stories</b>${rel.map(r => `<button class="link" data-act="goto" data-id="${r.id}">${flagOf(r.country)} ${esc(r.headline)}</button>`).join('')}</div>` : ''}
      ${threadHTML(it)}
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

  // Fills #investSectorFilter from whichever sectors the user's tracked companies actually fall under right
  // now (investmentGroups() already computes this, sorted by story volume), plus a leading "All sectors"
  // option - same idea as fillSelect()'s News-mode dropdowns, but simpler (no per-option counts, and the
  // list only ever changes when companies are tracked/untracked, not on every render) so it's kept as its
  // own small helper rather than overloading fillSelect() with a third shape. Only rebuilds the <option>
  // list when the actual sector set changed (dataset.sig guard, same trick fillSelect() uses), so a normal
  // re-render (new stories arriving, a vote, etc) never resets whatever the user has selected mid-session.
  function syncInvestSectorFilter(groups) {
    const sel = $('#investSectorFilter');
    if (!sel) return;
    const sectors = groups.map(g => g.sector);
    const sig = sectors.join('\u0001');
    if (sel.dataset.sig !== sig) {
      const html = `<option value="">${esc(t('investAllSectors'))}</option>` +
        sectors.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
      sel.innerHTML = html;
      sel.dataset.sig = sig;
    }
    // The previously-selected sector can stop existing (its last tracked company was removed, or a sector
    // simply has no tracked companies left to report) - fall back to "All sectors" rather than silently
    // showing a dropdown stuck on a value no longer in its own option list.
    if (S.f.investSector && !sectors.includes(S.f.investSector)) S.f.investSector = '';
    sel.value = S.f.investSector;
  }

  // Every Telegram channel that carried a story - all its sources, not just the first, because a post from a
  // linked channel that duplicated a story already running is merged into it rather than listed on its own.
  function itemChannels(it) {
    const out = new Set();
    (it.sources || []).forEach(src => {
      const m = src && /^Telegram:\s*(.+)$/i.exec(src.name || '');
      if (m) out.add(m[1].trim().toLowerCase());
    });
    return out;
  }
  /* Posts from the channels linked under Settings > Telegram channels for Investment. Those channels used to
     be saved and then never read by anything; the pipeline now fetches them, and this is where their posts
     land - in Investment only, never News (channelVisible() only follows News channels). A post that names a
     tracked company already appears under that company above, so it isn't repeated here. Hidden while a
     sector filter is on, since channel posts don't belong to a sector. */
  function investChannelSectionHTML(groups) {
    if (!S.myInvestChannels.size || S.f.investSector) return '';
    const listed = new Set();
    groups.forEach(g => g.companies.forEach(c => c.stories.forEach(st => listed.add(st.id))));
    const stories = all().filter(it => {
      if (!it.live || listed.has(it.id) || isCompanyStory(it)) return false;   // company stories sit under their card or in "Other companies"
      const st = itemStatus(it);
      if (st === 'dismissed' || st === 'expired') return false;
      for (const ch of itemChannels(it)) if (S.myInvestChannels.has(ch)) return true;
      return false;
    }).sort(byPriority);
    return groupHead(esc(t('investFromChannels')), stories.length) + (stories.length
      ? stories.map(entryWrapHTML).join('')
      : `<p class="empty-note">${esc(t('investChannelsEmpty'))}</p>`);
  }

  /* ---------- Broker view ----------
     brokers.json (written by the pipeline from the research-call posts on linked channels such as stocksresult)
     holds one record per broker call: broker, company, rating (BUY/HOLD/SELL), target, action (raised / cut /
     upgrade / downgrade / initiate / maintain) and when. This reads them into a per-stock consensus: how many
     brokers say buy / hold / sell on their latest call, the average target, and the last 30 days' direction of
     travel. Shown inline on the Investment card (Sentiment tile) and on the Sentiment board. */
  const BROKER_TTL_MS = 10 * 60e3;
  const Brokers = {
    calls: [], at: 0, loading: null, ok: false,
    norm(s) { return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ''); },
    load(force) {
      if (!force && this.ok && Date.now() - this.at < BROKER_TTL_MS) return Promise.resolve();
      if (this.loading) return this.loading;
      this.loading = getJSON('brokers.json').then(b => {
        this.at = Date.now();
        if (b && Array.isArray(b.calls)) { this.calls = b.calls.filter(c => c && c.company && c.broker); this.ok = true; }
        else this.ok = true;        // file not published yet: behave as "no calls", try again after the TTL
      }).catch(() => { /* leave as is */ }).finally(() => { this.loading = null; });
      return this.loading;
    },
    keys(name) {
      const k = Board.known(name), set = new Set([this.norm(name)]);
      if (k) { set.add(this.norm(k.name)); (k.aliases || []).forEach(x => set.add(this.norm(x))); if (k.ticker) set.add(this.norm(k.ticker)); }
      set.delete('');
      return set;
    },
    forCompany(name) {
      const keys = this.keys(name);
      return this.calls.filter(c => keys.has(this.norm(c.company)) || (c.ticker && keys.has(this.norm(c.ticker))));
    },
    // Newest call per broker, plus the summary figures.
    summary(name) {
      const all = this.forCompany(name).slice().sort((x, y) => (y.at || '').localeCompare(x.at || ''));
      const latest = [], seen = new Set();
      all.forEach(c => { const k = this.norm(c.broker); if (!seen.has(k)) { seen.add(k); latest.push(c); } });
      const n = { BUY: 0, HOLD: 0, SELL: 0 };
      latest.forEach(c => { if (n[c.rating] != null) n[c.rating]++; });
      const rated = n.BUY + n.HOLD + n.SELL;
      const tps = latest.map(c => Number(c.target)).filter(x => x > 0);
      const since = Date.now() - 30 * 864e5;
      let up = 0, down = 0;
      all.forEach(c => {
        if ((Date.parse(c.at) || 0) < since) return;
        if (c.action === 'raised' || c.action === 'upgrade') up++;
        else if (c.action === 'cut' || c.action === 'downgrade') down++;
      });
      const score = rated ? (n.BUY - n.SELL) / rated : 0;
      return { latest, n, rated, avg: tps.length ? tps.reduce((x, y) => x + y, 0) / tps.length : 0,
        up, down, tone: !rated ? '' : score >= 0.34 ? 'bull' : score <= -0.34 ? 'bear' : 'mix', total: all.length };
    },
    money(x) { return '₹' + Math.round(Number(x)).toLocaleString('en-IN'); },
    toneLabel(tone) { return t(tone === 'bull' ? 'bvBullish' : tone === 'bear' ? 'bvBearish' : 'bvNeutral'); },
    actionLabel(a) {
      return { raised: 'bvRaised', cut: 'bvCut', upgrade: 'bvUpgrade', downgrade: 'bvDowngrade', initiate: 'bvInitiate', maintain: 'bvMaintain' }[a] || '';
    },
    // Compact one-line verdict used on the Sentiment board row.
    chipHTML(name) {
      if (!this.ok) return '';
      const s = this.summary(name);
      if (!s.rated) return '';
      return `<span class="bk-chip ${s.tone}" title="${esc(t('bvTitle'))}">${esc(this.toneLabel(s.tone))} · ${s.rated}</span>`;
    },
    panelHTML(name, inBoard) {
      if (!this.ok) return `<div class="bv" data-bv="${esc(name)}"><p class="bv-note">${esc(t('bvLoading'))}</p></div>`;
      const s = this.summary(name);
      if (!s.rated) return `<div class="bv" data-bv="${esc(name)}"><h4 class="bv-h">${esc(t('bvTitle'))}</h4><p class="bv-note">${esc(t('bvNone'))}</p></div>`;
      const pct = k => Math.round(s.n[k] / s.rated * 100);
      const row = c => {
        const act = this.actionLabel(c.action), rate = c.rating ? c.rating.toLowerCase() : '';
        const prev = c.prev && c.target && c.prev !== c.target ? `<s>${esc(this.money(c.prev))}</s> → ` : '';
        return `<li class="bv-row">
          <span class="bv-b">${esc(c.broker)}</span>
          <span class="bv-r ${rate}">${esc(c.rating ? t('bv' + c.rating.charAt(0) + c.rating.slice(1).toLowerCase()) : '–')}</span>
          <span class="bv-t">${c.target ? prev + '<b>' + esc(this.money(c.target)) + '</b>' : ''}</span>
          <span class="bv-a ${esc(c.action)}">${act ? esc(t(act)) : ''}</span>
          <span class="bv-ago">${esc(ago(Date.parse(c.at) || Date.now()))}</span>
          ${c.note ? `<span class="bv-n">${esc(c.note)}</span>` : ''}
        </li>`;
      };
      const crowd = (() => {
        const sl = Pulse.companySlug(Board.canon(name)), st = Board.stats(sl);
        if (!st || !st.total) return `<span class="bv-crowd-n">${esc(t('bvNoVotes'))}</span>`;
        const b = Math.round(st.bull / st.total * 100);
        return `<b class="${b >= 50 ? 'pct-bull' : 'pct-bear'}">${b >= 50 ? '▲ ' + b + '% ' + esc(t('pulseBull')) : '▼ ' + (100 - b) + '% ' + esc(t('pulseBear'))}</b> <span class="bv-crowd-n">${st.total} ${esc(t(st.total === 1 ? 'sbVote' : 'sbVotes'))}</span>`;
      })();
      return `<div class="bv" data-bv="${esc(name)}">
        <div class="bv-head"><h4 class="bv-h">${esc(t('bvTitle'))}</h4><span class="bk-chip ${s.tone}">${esc(this.toneLabel(s.tone))}</span></div>
        <div class="bv-bar" role="img" aria-label="${s.n.BUY} ${esc(t('bvBuy'))}, ${s.n.HOLD} ${esc(t('bvHold'))}, ${s.n.SELL} ${esc(t('bvSell'))}">
          ${s.n.BUY ? `<span class="b" style="flex:${s.n.BUY}">${pct('BUY')}%</span>` : ''}${s.n.HOLD ? `<span class="h" style="flex:${s.n.HOLD}">${pct('HOLD')}%</span>` : ''}${s.n.SELL ? `<span class="s" style="flex:${s.n.SELL}">${pct('SELL')}%</span>` : ''}
        </div>
        <p class="bv-legend"><span class="b">${s.n.BUY} ${esc(t('bvBuy'))}</span><span class="h">${s.n.HOLD} ${esc(t('bvHold'))}</span><span class="s">${s.n.SELL} ${esc(t('bvSell'))}</span><span>${s.rated} ${esc(t('bvBrokers'))}</span></p>
        <div class="bv-facts">
          ${s.avg ? `<div><span>${esc(t('bvAvgTarget'))}</span><b>${esc(this.money(s.avg))}</b></div>` : ''}
          <div><span>${esc(t('bvMomentum'))}</span><b><i class="up">▲ ${s.up} ${esc(t('bvMoves'))}</i> <i class="dn">▼ ${s.down} ${esc(t('bvMovesDown'))}</i></b></div>
        </div>
        <ul class="bv-list">${s.latest.map(row).join('')}</ul>
        <div class="bv-crowd"><span>${esc(t('bvCrowd'))}</span> ${crowd}
          ${inBoard ? '' : `<button type="button" class="link" data-act="sbJump" data-v="${esc(name)}">${esc(t('bvOpenBoard'))}</button>`}</div>
        <p class="bv-foot">${esc(t('bvFoot'))}</p>
      </div>`;
    }
  };

  // Stories about companies this person does not track, newest first, below their own company cards.
  function otherCompanyNewsHTML() {
    const want = S.myCompanies, sec = S.f.investSector;
    const items = all().filter(it => {
      const st = itemStatus(it);
      if (st === 'dismissed' || st === 'expired' || !isCompanyStory(it)) return false;
      if (it.companies.some(c => want.has(c))) return false;
      if (sec) {
        const k = E.COMPANIES.find(c => c.name === it.companies[0]);
        if (((k && k.sector) || it.sector || 'Other') !== sec) return false;
      }
      return true;
    }).sort((x, y) => y.addedAt - x.addedAt);
    if (!items.length) return '';
    return '<div id="otherCoHead">' + groupHead(esc('Other companies in the news'), items.length) + '</div>' + items.map(entryWrapHTML).join('');
  }

  // A company's own news page (owner, 24 Oct): its stories as ordinary story cards, the same cards as the
  // News tab, opened from the News button on the company's card. Drawn into #list so swiping, saving and
  // skipping work exactly as they do everywhere else.
  function companyPageHTML(co) {
    const items = all().filter(it => {
      const st = itemStatus(it);
      return st !== 'dismissed' && st !== 'expired' && (it.companies || []).includes(co);
    }).sort(byPriority);
    return `<div class="co-page-head">
        <button type="button" class="settingspage-back" data-act="coBack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Investment</span></button>
        <div class="co-page-title"><span class="gc-ring">${companyLogoHTML(co, 'gc-ring-inner')}</span><h2>${esc(co)}</h2><span class="n">${items.length}</span></div>
      </div>` + (items.length ? items.map(entryWrapHTML).join('') : `<div class="empty"><p>${esc(t('investNoNews'))}</p></div>`);
  }

  function renderInvestmentList() {
    // Same guard as renderList(): don't yank #list's DOM out from under an in-progress swipe gesture.
    if (SWIPE.active) { SWIPE.renderPending = true; return; }
    const box = $('#list');
    const sectorSel = $('#investSectorFilter');
    if (S.coPage) {
      if (sectorSel) sectorSel.hidden = true;
      const dg = $('#digestCard'); if (dg) dg.hidden = true;
      box.innerHTML = companyPageHTML(S.coPage);
      seenObserveVisible(box);
      return;
    }
    if (sectorSel && S.mode === 'investment') sectorSel.hidden = false;
    const allGroups = investmentGroups();
    const empty = $('#investEmpty');
    const channelHTML = investChannelSectionHTML(allGroups);
    const otherHTML = otherCompanyNewsHTML();
    if (!S.myCompanies.size) {
      if (empty) empty.hidden = false;
      box.innerHTML = otherHTML + channelHTML;     // other companies' news and linked channels still show, under the "track companies" prompt
      seenObserveVisible(box);
      return;
    }
    if (empty) empty.hidden = true;
    syncInvestSectorFilter(allGroups);
    const groups = S.f.investSector ? allGroups.filter(g => g.sector === S.f.investSector) : allGroups;
    let html = '';
    for (const g of groups) {
      const companyBlocks = g.companies.map(c => {
        const stories = c.stories;
        const body = '';
        return `<h3 class="grp-company" data-co="${esc(c.company)}" tabindex="0" aria-label="${esc(c.company)}. ${esc(t('lpHint'))}">
          <div class="gc-top">
            <span class="gc-ring">${companyLogoHTML(c.company, 'gc-ring-inner')}</span>
            <span class="gc-name">${esc(c.company)}</span><span class="n">${stories.length}</span>
          </div>
          <div class="gc-tiles" role="group" aria-label="${esc(c.company)}">
            <button class="gc-tile btn-chart" data-act="viewChart" data-v="${esc(c.company)}" data-sector="${esc(g.sector)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/></svg><span>${esc(t('tileChart'))}</span></button>
            <button class="gc-tile gc-news" data-act="viewNews" data-v="${esc(c.company)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg><span>${esc(t('tileNews'))}</span></button>
            <button class="gc-tile gc-sent${S.bvOpen.has(c.company) ? ' on' : ''}" data-act="viewSent" data-v="${esc(c.company)}" aria-expanded="${S.bvOpen.has(c.company)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg><span>${esc(t('tileSent'))}</span></button>
          </div>
          ${S.bvOpen.has(c.company) ? Brokers.panelHTML(c.company) : ''}
        </h3>${body}`;
      }).join('');
      const sectorTotal = g.companies.reduce((n, c) => n + c.stories.length, 0);
      html += groupHead(esc(g.sector), sectorTotal) + companyBlocks;
    }
    let lpUsed = false; try { lpUsed = !!localStorage.getItem('qs-lp-used-v1'); } catch (e) { /* storage blocked */ }
    const hint = html && !lpUsed ? `<p class="lp-tip">${esc(t('lpHint'))}</p>` : '';
    box.innerHTML = hint + (html || `<div class="empty"><p>${esc(t('investNoNews'))}</p></div>`) + otherHTML + channelHTML;
    seenObserveVisible(box);
    // Sentiment pulse no longer renders inline here - per the user's explicit "Dedicated Pulse screen"
    // choice, it moved to its own Community tab (see renderCommunity()), which lists every tracked company
    // once, with its sentiment bar, independent of whether that company currently has news. Nothing to
    // fetch or patch in on an Investment render any more.
  }

  // Community/Pulse tab: one row per tracked company (S.myCompanies), each with its collective bull/bear
  // sentiment bar and vote buttons (pulseHTML()/Pulse module - unchanged from the per-company redesign
  // earlier this round). Deliberately NOT scoped to companies that currently have news, unlike Investment's
  // story groups - this is a company-sentiment screen, not a story feed, so a company with nothing new to
  // report today still keeps its place and its crowd read here (per the user's confirmed "list of all your
  // tracked companies with their sentiment bars in one place" answer). Companies are listed alphabetically,
  // same convention as the Investment watchlist's own list in Settings.
  /* ---------- Sentiment board ----------
     Replaces the old Community tab's all-time bull/bear counter. Owner's design:
       - lists EVERY stock anyone keeps in their watchlist (board.json, published by the pipeline from all
         accounts - names and how many track each, never who), plus this person's own list and anything
         voted on; anyone can vote on any of them
       - shows TODAY'S MOOD: votes from the last 24 hours, one per person per stock (the newest counts),
         updating the moment someone votes
       - a vote can carry a reason (optional, up to 2000 characters); reasons are the comments under each stock
       - search narrows the list, and finds any known company even if nobody tracks it yet
     Votes live in qs_sent_votes, one document per (stock, person, day) - see firestore.rules.

     Free-plan care: Firestore charges a read per document returned. Reloading every comment on every visit
     would eat the 50,000-a-day allowance quickly, so loaded votes are kept on the device and later visits
     ask only for votes newer than the newest one already held. A full reload happens every 6 hours to
     catch deletions (a deleted comment can linger on other phones until then). */
  const BOARD_WINDOW_MS = 24 * 3600e3;      // today's mood
  const BOARD_KEEP_MS = 7 * 864e5;          // comments shown from the last 7 days
  const BOARD_FULL_EVERY_MS = 6 * 3600e3;
  const BOARD_REASON_MAX = 2000;
  const BOARD_PAGE = 30;                    // rows drawn at a time; "Show more" reveals the next 30
  const BOARD_STORE = 'qs-board-v1';
  const BOARD_UNDO_MS = 5000;
  const Board = {
    list: [], votes: new Map(), maxAt: 0, fullAt: 0, loading: null, error: false,
    q: '', open: null, pick: null, draft: '', shown: BOARD_PAGE, allComments: new Set(), busy: false,

    restore() {
      try {
        const d = JSON.parse(localStorage.getItem(BOARD_STORE) || 'null');
        if (!d) return;
        this.list = d.list || [];
        this.votes = new Map((d.votes || []).map(v => [v.id, v]));
        this.maxAt = d.maxAt || 0;
        this.fullAt = d.fullAt || 0;
        this.pub = new Map(d.pub || []); this.pubAt = d.pubAt || 0; this.pubFullAt = d.pubFullAt || 0;
      } catch (e) { /* start fresh */ }
    },
    persist() {
      try {
        localStorage.setItem(BOARD_STORE, JSON.stringify({ list: this.list, votes: [...this.votes.values()],
          maxAt: this.maxAt, fullAt: this.fullAt, pub: [...this.pub], pubAt: this.pubAt, pubFullAt: this.pubFullAt }));
      } catch (e) { /* storage full: still works, just reloads more next time */ }
    },
    known(name) {
      const n = String(name || '').trim().toLowerCase();
      if (!n) return null;
      return E.COMPANIES.find(c => c.name.toLowerCase() === n || c.aliases.some(a => a.toLowerCase() === n)
        || (c.ticker && c.ticker.toLowerCase() === n)) || null;
    },
    // One spelling per company however it was typed ("Nvda", "NVIDIA" -> "Nvidia"), so each stock is listed
    // and voted on in exactly one place.
    canon(name) { const k = this.known(name); return k ? k.name : String(name || '').trim(); },
    slug(name) { return Pulse.companySlug(this.canon(name)); },
    // The day a vote belongs to, in Indian time - the "one vote per stock per day" bucket.
    istDay() { return new Date(Date.now() + 330 * 60e3).toISOString().slice(0, 10); },
    // What other people see next to a vote or a tracked stock. Never derived from the email address: it is the
    // nickname the person chose in Account, or a neutral "Investor 4F2A" built from a hash of their account id.
    nick() { try { return (localStorage.getItem('qs-nick-v1') || '').trim(); } catch (e) { return ''; } },
    setNick(v) {
      const s = String(v || '').replace(/\s+/g, ' ').trim();
      if (s && !/^[\p{L}\p{N} _.-]{3,16}$/u.test(s)) return false;
      try { s ? localStorage.setItem('qs-nick-v1', s) : localStorage.removeItem('qs-nick-v1'); } catch (e) { /* storage blocked */ }
      Sync.pushSoon(); return true;
    },
    maskedName() {
      const n = this.nick(); if (n) return n;
      let h = 0; const u = String(Auth.uid || 'x');
      for (let i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0;
      return 'Investor ' + h.toString(16).toUpperCase().padStart(4, '0').slice(-4);
    },

    async loadList() {
      const b = await getJSON('board.json');
      if (b && Array.isArray(b.companies)) this.list = b.companies.filter(c => c && c.name);
    },
    async loadVotes() {
      const full = !this.fullAt || Date.now() - this.fullAt > BOARD_FULL_EVERY_MS;
      // A full load starts from votes.json (the pipeline's snapshot of the last 7 days, a static file) and only
      // asks the database for votes newer than that, so a crowd opening the board doesn't each read thousands
      // of documents. If the snapshot isn't there, it falls back to reading the whole window directly.
      let snapMax = 0, snapVotes = null;
      if (full) {
        try {
          const snap = await getJSON('votes.json');
          if (snap && Array.isArray(snap.votes)) {
            snapVotes = snap.votes.filter(v => v && v.slug && (v.choice === 'bull' || v.choice === 'bear') && typeof v.at === 'number');
            snapMax = Math.max(0, ...snapVotes.map(v => v.at));
          }
        } catch (e) { /* fall back to the database */ }
      }
      const since = full ? (snapVotes ? Math.max(snapMax - 5000, Date.now() - BOARD_KEEP_MS) : Date.now() - BOARD_KEEP_MS) : this.maxAt - 5000;
      const query = { structuredQuery: {
        from: [{ collectionId: 'qs_sent_votes' }],
        where: { fieldFilter: { field: { fieldPath: 'at' }, op: 'GREATER_THAN_OR_EQUAL',
          value: { timestampValue: new Date(since).toISOString() } } },
        orderBy: [{ field: { fieldPath: 'at' }, direction: 'DESCENDING' }],
        limit: 3000 } };
      const r = await fetch(`${FS_BASE}:runQuery?key=${FIREBASE.apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const rows = (await r.json()).filter(x => x.document);
      if (full) {
        this.votes = new Map();
        (snapVotes || []).forEach(v => this.votes.set(String(v.id), { id: String(v.id), slug: String(v.slug), company: String(v.company || ''), uid: String(v.uid || ''),
          choice: v.choice, reason: String(v.reason || ''), name: String(v.name || ''), at: v.at }));
      }
      rows.forEach(x => {
        const f = x.document.fields || {}, s = k => (f[k] && f[k].stringValue) || '';
        const v = { id: x.document.name.split('/').pop(), slug: s('slug'), company: s('company'), uid: s('uid'),
          choice: s('choice'), reason: s('reason'), name: s('name'), at: Date.parse((f.at || {}).timestampValue) || 0 };
        if (v.slug && (v.choice === 'bull' || v.choice === 'bear')) this.votes.set(v.id, v);
      });
      const cutoff = Date.now() - BOARD_KEEP_MS;
      for (const [id, v] of this.votes) if (v.at < cutoff) this.votes.delete(id);
      this.maxAt = Math.max(this.maxAt, ...[...this.votes.values()].map(v => v.at), 0);
      if (full) this.fullAt = Date.now();
    },
    /* Every stock anyone tracks, WITHOUT needing the pipeline's service key (owner, 14 Oct: users' stocks
       weren't showing because board.json was never produced). Each signed-in person's app adds the
       companies on their own watchlist to qs_board_stocks - one document per stock, holding only its name,
       so nothing says who tracks it. Read incrementally like the votes; a full re-read once a day. */
    pub: new Map(), pubAt: 0, pubFullAt: 0,
    async loadPublic() {
      if (this.list && this.list.length) return;       // the pipeline's board.json already lists every tracked stock: no database read
      const full = !this.pubFullAt || Date.now() - this.pubFullAt > 864e5;
      const sq = { from: [{ collectionId: 'qs_board_stocks' }], limit: 3000 };
      if (!full && this.pubAt) sq.where = { fieldFilter: { field: { fieldPath: 'at' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: new Date(this.pubAt - 5000).toISOString() } } };
      try {
        const r = await fetch(`${FS_BASE}:runQuery?key=${FIREBASE.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: sq }) });
        if (!r.ok) return;                      // e.g. rules not published yet: the board still works without it
        const rows = (await r.json()).filter(x => x.document);
        if (full) this.pub = new Map();
        rows.forEach(x => {
          const f = x.document.fields || {}, name = (f.name || {}).stringValue, at = Date.parse((f.at || {}).timestampValue) || 0;
          if (name) this.pub.set(x.document.name.split('/').pop(), name);
          if (at > this.pubAt) this.pubAt = at;
        });
        if (full) this.pubFullAt = Date.now();
      } catch (e) { /* offline: keep the last list */ }
    },
    // Adds this person's watchlist to the shared list (only names not added from this device before).
    async publishMine() {
      if (!Auth.uid || !S.myCompanies.size) return;
      const key = 'qs-board-pub-v1-' + Auth.uid;
      let done; try { done = new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch (e) { done = new Set(); }
      const todo = [...S.myCompanies].map(n => this.canon(n)).filter(n => n && n.length <= 80 && !done.has(Pulse.companySlug(n))).slice(0, 50);
      if (!todo.length) return;
      const tok = await Auth.bearerToken(); if (!tok) return;
      const base = `projects/${FIREBASE.projectId}/databases/(default)/documents/qs_board_stocks/`;
      try {
        const r = await fetch(`${FS_BASE}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
          body: JSON.stringify({ writes: todo.map(n => ({ update: { name: base + Pulse.companySlug(n), fields: { name: toFsValue(n), slug: toFsValue(Pulse.companySlug(n)) } },
            updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] })) }) });
        if (!r.ok) return;
        todo.forEach(n => { done.add(Pulse.companySlug(n)); this.pub.set(Pulse.companySlug(n), n); });
        try { localStorage.setItem(key, JSON.stringify([...done])); } catch (e) { /* ignore */ }
      } catch (e) { /* retried next time */ }
    },
    async refresh() {
      if (this.loading) return this.loading;
      this.loading = (async () => {
        try { await Promise.all([this.loadList(), this.loadVotes(), this.loadPublic()]); this.error = false; this.persist(); }
        catch (e) { this.error = true; }
        finally { this.loading = null; }
      })();
      return this.loading;
    },

    // Today's mood: the newest vote per person in the last 24 hours.
    stats(slug) {
      const now = Date.now(), latest = new Map();
      this.votes.forEach(v => {
        if (v.slug !== slug || now - v.at > BOARD_WINDOW_MS || this.deleting.has(v.id)) return;
        const p = latest.get(v.uid);
        if (!p || v.at > p.at) latest.set(v.uid, v);
      });
      let bull = 0, bear = 0;
      latest.forEach(v => { if (v.choice === 'bull') bull++; else bear++; });
      return { bull, bear, total: bull + bear };
    },
    comments(slug) { return [...this.votes.values()].filter(v => v.slug === slug && v.reason && !this.deleting.has(v.id)).sort((a, b) => b.at - a.at); },
    mine(slug) { const id = `${slug}_${Auth.uid}_${this.istDay()}`; return Auth.uid && !this.deleting.has(id) ? this.votes.get(id) || null : null; },
    // Delete with Undo (owner, 13 Oct): the reason disappears at once, and is only removed from the server
    // after the Undo message has gone (BOARD_UNDO_MS) - so Undo works for the owner deleting someone else's
    // reason too, which could not be re-created afterwards.
    deleting: new Map(),
    softDelete(id) {
      if (this.deleting.has(id)) return;
      this.deleting.set(id, setTimeout(async () => {
        try { await this.remove(id); } catch (e) { toast(t('sbFailed')); }
        this.deleting.delete(id);
        if (S.tab === 'community') renderBoardBody();
      }, BOARD_UNDO_MS));
    },
    undoDelete(id) {
      const tm = this.deleting.get(id);
      if (tm == null) return;
      clearTimeout(tm); this.deleting.delete(id);
    },

    // Every stock to show: everyone's watchlists, this person's own (so a stock they just added appears
    // before the next pipeline scan), and anything voted on recently.
    entries() {
      const by = new Map();
      const add = (name, trackers, who) => {
        const n = this.canon(name), slug = Pulse.companySlug(n);
        if (!n) return;
        const e = by.get(slug) || { name: n, slug, trackers: 0, mine: false, by: [] };
        e.trackers = Math.max(e.trackers, trackers || 0);
        if (who && who.length) e.by = [...new Set(e.by.concat(who))];
        by.set(slug, e);
      };
      this.list.forEach(c => add(c.name, c.trackers, c.by));
      this.pub.forEach(name => add(name, 0));
      S.myCompanies.forEach(n => add(n, 1));
      this.votes.forEach(v => add(v.company, 0));
      const mineSlugs = new Set([...S.myCompanies].map(n => this.slug(n)));
      const out = [...by.values()].map(e => Object.assign(e, { mine: mineSlugs.has(e.slug), stats: this.stats(e.slug) }));
      return out.sort((a, b) => (b.mine - a.mine) || (b.stats.total - a.stats.total) || (b.trackers - a.trackers)
        || a.name.localeCompare(b.name));
    },

    async post(company, choice, reason) {
      const name = this.canon(company), slug = Pulse.companySlug(name), day = this.istDay();
      const id = `${slug}_${Auth.uid}_${day}`;
      const docName = `projects/${FIREBASE.projectId}/databases/(default)/documents/qs_sent_votes/${id}`;
      const fields = { slug, company: name, uid: Auth.uid, day, choice, reason: reason.slice(0, BOARD_REASON_MAX), name: this.maskedName() };
      const tok = await Auth.bearerToken();
      const r = await fetch(`${FS_BASE}:commit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ writes: [{
          update: { name: docName, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toFsValue(v)])) },
          // the server's own clock - firestore.rules refuse any other value, so votes can't be backdated
          updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }] }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      // Show it straight away; the next refresh brings the server's exact timestamp.
      this.votes.set(id, Object.assign({ id, at: Date.now() }, fields));
      this.maxAt = Math.max(this.maxAt, Date.now() - 60e3);
      this.persist();
      track('board_vote', { choice, with_reason: !!reason });
    },
    async remove(id) {
      const tok = await Auth.bearerToken();
      const r = await fetch(`${FS_BASE}/qs_sent_votes/${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      this.votes.delete(id);
      this.persist();
    }
  };
  Board.restore();

  // Crowd mood for an opened stock (design: big percentage, label, bar, bull/bear counts).
  function crowdTone(st) {
    if (!st || !st.total) return '';
    const b = Math.round(st.bull / st.total * 100);
    return b >= 55 ? 'bull' : b <= 45 ? 'bear' : 'mix';
  }
  function moodHTML(st) {
    if (!st.total) return `<div class="sb-mood"><p class="sb-none">${esc(t('sbNoVotes'))}</p></div>`;
    const bull = Math.round(st.bull / st.total * 100), tone = crowdTone(st);
    return `<div class="sb-mood">
      <div class="sb-mood-h">${esc(t('sbCrowdToday'))}</div>
      <div class="sb-mood-n"><b class="${tone}">${bull}%</b><span class="${tone}">${esc(Brokers.toneLabel(tone))}</span><em>${st.total} ${esc(t(st.total === 1 ? 'sbVote' : 'sbVotes'))}</em></div>
      <div class="pulse-bar"><span class="fill-bull" style="width:${bull}%"></span><span class="fill-bear" style="width:${100 - bull}%"></span></div>
      <div class="sb-mood-c"><span class="pct-bull">${esc(t('pulseBull'))} ${st.bull}</span><span class="pct-bear">${esc(t('pulseBear'))} ${st.total - st.bull}</span></div>
    </div>`;
  }
  // Shown when the brokers' verdict and the crowd's lean differ.
  function disagreeHTML(e, st) {
    if (!Brokers.ok || !st || st.total < 3) return '';
    const s = Brokers.summary(e.name);
    if (!s.rated) return '';
    const ct = crowdTone(st);
    if (!ct || ct === s.tone) return '';
    const lean = tone => t(tone === 'bull' ? 'bvLeanBuy' : tone === 'bear' ? 'bvLeanSell' : 'bvLeanSplit');
    const crowd = t(ct === 'bull' ? 'bvCrowdBull' : ct === 'bear' ? 'bvCrowdBear' : 'bvCrowdMix');
    return `<div class="sb-split" role="note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg>
      <p><b>${esc(t('bvDisagree'))}</b> ${esc(lean(s.tone))} ${esc(crowd)}</p></div>`;
  }

  function boardBarHTML(st) {
    if (!st.total) return `<p class="sb-none">${esc(t('sbNoVotes'))}</p>`;
    const bull = Math.round((st.bull / st.total) * 100);
    return `<div class="pulse-pct"><span class="pct-bull">▲ ${bull}% ${esc(t('pulseBull'))}</span><span class="pct-bear">▼ ${100 - bull}% ${esc(t('pulseBear'))}</span></div>
      <div class="pulse-bar"><span class="fill-bull" style="width:${bull}%"></span><span class="fill-bear" style="width:${100 - bull}%"></span></div>
      <p class="sb-count">${st.total} ${esc(t(st.total === 1 ? 'sbVote' : 'sbVotes'))}</p>`;
  }

  function boardCardHTML(e) {
    const st = e.stats, mine = Board.mine(e.slug), isOpen = Board.open === e.slug;
    const head = `<button type="button" class="sb-row" data-act="sbOpen" data-v="${esc(e.slug)}" aria-expanded="${isOpen}">
        <span class="gc-ring">${isOpen || e.mine ? companyLogoHTML(e.name, 'gc-ring-inner') : `<span class="gc-ring-inner">${esc(e.name.charAt(0).toUpperCase())}</span>`}</span>
        <span class="sb-name">${esc(e.name)}${Brokers.chipHTML(e.name)}${e.mine ? ` <span class="sb-mine">${esc(t('sbYourList'))}</span>` : ''}</span>
        <span class="sb-mini">${st.total ? `<b class="pct-bull">▲${Math.round(st.bull / st.total * 100)}%</b> <span>${st.total}</span>` : '–'}</span>
        <span class="sb-chev" aria-hidden="true">${isOpen ? '−' : '+'}</span>
      </button>`;
    if (!isOpen) return `<article class="sb-card">${head}</article>`;
    const pick = Board.pick || (mine && mine.choice) || '';
    // Signed-out visitors can read the board but not vote or comment (owner, 13 Oct). Instead of vote buttons
    // they see one line and a sign-in button; firestore.rules refuse a vote without an account anyway.
    const vote = !Auth.uid ? `<div class="sb-vote sb-guest"><p class="sb-yours">${esc(t('sbGuestNote'))}</p>
        <button class="btn primary small" data-act="sbSignIn">${esc(t('sbGuestBtn'))}</button></div>` : `<div class="sb-vote">
        ${mine ? `<p class="sb-yours">${esc(t('sbYourView'))} <b class="${mine.choice === 'bull' ? 'pct-bull' : 'pct-bear'}">${mine.choice === 'bull' ? '▲ ' + esc(t('pulseBull')) : '▼ ' + esc(t('pulseBear'))}</b>. ${esc(t('sbChangeHint'))}</p>` : ''}
        <div class="pulse-btns">
          <button class="pulse-btn bull${pick === 'bull' ? ' active' : ''}" data-act="sbPick" data-v="bull">▲ ${esc(t('pulseBull'))}</button>
          <button class="pulse-btn bear${pick === 'bear' ? ' active' : ''}" data-act="sbPick" data-v="bear">▼ ${esc(t('pulseBear'))}</button>
        </div>
        ${Board.pick ? `<label class="sb-why" for="sbReason">${esc(t('sbWhy'))}</label>
          <textarea id="sbReason" class="sb-text" maxlength="${BOARD_REASON_MAX}" rows="4" placeholder="${esc(t('sbWhyPh'))}">${esc(Board.draft)}</textarea>
          <div class="sb-post"><span class="sb-left" id="sbLeft">${BOARD_REASON_MAX - Board.draft.length}</span>
            <button class="btn small" data-act="sbCancel">${esc(t('sbCancel'))}</button>
            <button class="btn primary small" data-act="sbPost" ${Board.busy ? 'disabled' : ''}>${esc(t('sbPost'))}</button></div>` : ''}
      </div>`;
    const all = Board.comments(e.slug), showAll = Board.allComments.has(e.slug), list = showAll ? all : all.slice(0, 3);
    const comments = `<div class="sb-comments">
        <h3 class="sb-ch">${esc(t('sbReasons'))} <span>${all.length}</span></h3>
        ${list.length ? list.map(c => { const canDel = !!(Auth.uid && (c.uid === Auth.uid || isOwner())); return `<div class="sb-c${canDel ? ' sb-c-del' : ''}"${canDel ? ` data-del="${esc(c.id)}" tabindex="0" aria-label="${esc(t('sbHoldHint'))}"` : ''}>
            <div class="sb-cmeta"><b class="${c.choice === 'bull' ? 'pct-bull' : 'pct-bear'}">${c.choice === 'bull' ? '▲ ' + esc(t('pulseBull')) : '▼ ' + esc(t('pulseBear'))}</b>
              <span>${esc(c.name || 'user')}</span><span>${esc(ago(c.at))}</span></div>
            <p class="sb-ctext">${esc(c.reason)}</p></div>`; }).join('')
          : `<p class="sb-none">${esc(t('sbNoReasons'))}</p>`}
        ${all.length > 3 && !showAll ? `<button class="link" data-act="sbAll" data-v="${esc(e.slug)}">${esc(t('sbShowAll'))} (${all.length})</button>` : ''}
      </div>`;
    const trk = e.trackers ? `<p class="sb-by"><b>${e.trackers}</b> ${esc(t(e.trackers === 1 ? 'sbTracker' : 'sbTrackers'))}${e.by && e.by.length ? ': ' + esc(e.by.slice(0, 8).join(', ')) + (e.trackers > Math.min(e.by.length, 8) ? ' +' + (e.trackers - Math.min(e.by.length, 8)) : '') : ''}</p>` : '';
    return `<article class="sb-card open">${head}<div class="sb-body">${trk}${moodHTML(st)}${disagreeHTML(e, st)}${Brokers.ok && Brokers.summary(e.name).rated ? Brokers.panelHTML(e.name, true) : ''}${vote}${comments}</div></article>`;
  }

  function renderBoardBody() {
    const box = $('#sbBody');
    if (!box) return;
    // Owner, 24 Oct: the board shows only this person's own watchlist (still with how many people track each
    // stock, the brokers' view, voting and reasons). Search narrows within that list only.
    let entries = Board.entries().filter(e => e.mine);
    const empty = $('#communityEmpty');
    if (empty) empty.hidden = !!S.myCompanies.size;
    const top = $('#communityList .sb-top'); if (top) top.hidden = !S.myCompanies.size;
    if (!S.myCompanies.size) { box.innerHTML = ''; return; }
    const q = Board.q.trim().toLowerCase();
    if (q) {
      entries = entries.filter(e => e.name.toLowerCase().includes(q)
        || (Board.known(e.name) || { aliases: [] }).aliases.some(a => a.toLowerCase().includes(q)));
    }
    const shown = q ? entries : entries.slice(0, Board.shown);
    box.innerHTML = (Board.error && !Board.votes.size ? `<p class="lp-syncnote">${esc(t('sbOffline'))}</p>` : '')
      + (shown.length ? shown.map(boardCardHTML).join('')
        : `<p class="sb-none">${esc(q ? t('sbNoMatch') : t('sbEmpty'))}</p>`)
      + (!q && entries.length > shown.length ? `<button class="btn block" data-act="sbMore">${esc(t('sbMore'))} (${entries.length - shown.length})</button>` : '');
    const ta = $('#sbReason');
    if (ta) ta.addEventListener('input', () => { Board.draft = ta.value; const l = $('#sbLeft'); if (l) l.textContent = BOARD_REASON_MAX - ta.value.length; });
  }

  /* Long press (owner, 13 Oct: "similar to Instagram"): no Delete button is shown on reasons any more.
     Pressing and holding your own reason (or any reason, for the owner) for half a second slides up a sheet
     with Delete and Cancel. A right-click / the context-menu key does the same on a computer, and Enter or
     Delete on a focused reason does it from the keyboard. */
  const LONG_PRESS_MS = 500;
  // Bottom sheet of actions. Used by the long press on a board reason and by the "..." on channel rows.
  // items: [{ label, act, v, danger }] - each becomes a button that runs the normal data-act handler.
  const ActionSheet = {
    target: null,
    open(target, items, title) {
      this.target = target;
      let el = $('#actionSheet');
      if (!el) {
        el = document.createElement('div');
        el.id = 'actionSheet'; el.className = 'asheet-wrap'; el.hidden = true;
        document.body.appendChild(el);
      }
      const list = items || [{ label: t('sbDelete'), act: 'sbSheetDel', danger: true }];
      el.innerHTML = `<div class="asheet-back" data-act="sbSheetCancel"></div>
        <div class="asheet" role="dialog" aria-modal="true" aria-label="${esc(typeof target === 'string' ? target : '')}">
          <div class="asheet-group">${title ? `<p class="asheet-title">${esc(title)}</p>` : ''}${list.map(it => `<button type="button" class="asheet-btn${it.danger ? ' danger' : ''}" data-act="${esc(it.act)}"${it.v != null ? ` data-v="${esc(it.v)}"` : ''}>${esc(it.label)}</button>`).join('')}</div>
          <button type="button" class="asheet-btn" data-act="sbSheetCancel">${esc(t('sbCancel'))}</button>
        </div>`;
      clearTimeout(toastTimer); $('#toast').classList.remove('show');   // an old message must not cover the sheet
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('show'));
      const first = el.querySelector('.asheet-btn'); if (first) first.focus();
    },
    close() {
      const el = $('#actionSheet');
      this.target = null;
      if (!el) return;
      el.classList.remove('show');
      setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 200);
    }
  };
  (function wireLongPress() {
    let timer = null, startX = 0, startY = 0, fired = false;
    const cancel = () => { clearTimeout(timer); timer = null; };
    document.addEventListener('pointerdown', ev => {
      const c = ev.target.closest && ev.target.closest('#sbBody [data-del]');
      if (!c || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      fired = false; startX = ev.clientX; startY = ev.clientY;
      cancel();
      timer = setTimeout(() => {
        timer = null; fired = true;
        if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { /* not supported */ }
        ActionSheet.open(c.dataset.del);
      }, LONG_PRESS_MS);
    });
    document.addEventListener('pointermove', ev => { if (timer && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) cancel(); });
    ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, cancel));
    window.addEventListener('scroll', cancel, { passive: true });
    // Phones also fire contextmenu on a long press; that and a right-click both open the same sheet.
    document.addEventListener('contextmenu', ev => {
      const c = ev.target.closest && ev.target.closest('#sbBody [data-del]');
      if (!c) return;
      ev.preventDefault();
      cancel();
      if (!fired) ActionSheet.open(c.dataset.del);
    });
    document.addEventListener('keydown', ev => {
      const sheet = $('#actionSheet');
      if (sheet && !sheet.hidden && ev.key === 'Escape') { ActionSheet.close(); return; }
      const c = ev.target.closest && ev.target.closest('#sbBody [data-del]');
      if (c && (ev.key === 'Enter' || ev.key === 'Delete' || ev.key === 'ContextMenu')) { ev.preventDefault(); ActionSheet.open(c.dataset.del); }
    });
  })();

  /* Long press on a stock card (Investment tab) slides up a sheet with "Remove stock". Replaces the old X
     button, which was too easy to hit by accident. Also opens from the keyboard (Enter / Menu key) and with a
     right-click on a computer. */
  (function wireStockLongPress() {
    let timer = null, sx = 0, sy = 0, fired = false, firedAt = 0;
    const card = ev => ev.target.closest && ev.target.closest('#list .grp-company[data-co]');
    const cancel = () => { clearTimeout(timer); timer = null; };
    const open = c => {
      let first = true; try { first = !localStorage.getItem('qs-lp-used-v1'); localStorage.setItem('qs-lp-used-v1', '1'); } catch (e) { /* storage blocked */ }
      if (first) $$('.lp-tip').forEach(el => el.remove());
      ActionSheet.open(c.dataset.co, [{ label: t('removeStock'), act: 'untrack', v: c.dataset.co, danger: true }], c.dataset.co);
    };
    document.addEventListener('pointerdown', ev => {
      const c = card(ev);
      if (!c || ev.target.closest('.bv') || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      fired = false; sx = ev.clientX; sy = ev.clientY; cancel();
      timer = setTimeout(() => {
        timer = null; fired = true; firedAt = Date.now();
        if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { /* not supported */ }
        open(c);
      }, LONG_PRESS_MS);
    });
    document.addEventListener('pointermove', ev => { if (timer && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) cancel(); });
    ['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, cancel));
    window.addEventListener('scroll', cancel, { passive: true });
    // The finger lifting after a long press must not also press the tile underneath it.
    document.addEventListener('click', ev => {
      if (fired && Date.now() - firedAt < 800 && card(ev)) { ev.stopPropagation(); ev.preventDefault(); fired = false; }
    }, true);
    document.addEventListener('contextmenu', ev => {
      const c = card(ev);
      if (!c || ev.target.closest('.bv')) return;
      ev.preventDefault(); cancel();
      if (!fired) open(c);
    });
    document.addEventListener('keydown', ev => {
      const c = ev.target.classList && ev.target.classList.contains('grp-company') ? ev.target : null;
      if (c && (ev.key === 'Enter' || ev.key === 'ContextMenu' || ev.key === 'Delete')) { ev.preventDefault(); open(c); }
    });
  })();

  function renderCommunity() {
    const box = $('#communityList');
    if (!box) return;
    const empty = $('#communityEmpty');
    if (empty) empty.hidden = !!S.myCompanies.size;     // the board lists this person's own stocks only
    if (!$('#sbSearch')) {
      box.innerHTML = `<div class="sb-top">
          <input id="sbSearch" class="sb-search" type="search" autocomplete="off" placeholder="${esc(t('sbSearchPh'))}" aria-label="${esc(t('sbSearchPh'))}">
        </div><div id="sbBody"></div>`;
      $('#sbSearch').addEventListener('input', ev => { Board.q = ev.target.value; renderBoardBody(); });
    }
    renderBoardBody();
    if (!Board.loading && Date.now() - (Board.lastTry || 0) > 60e3) {
      Board.lastTry = Date.now();
      Board.refresh().then(() => { if (S.tab === 'community') renderBoardBody(); });
    }
  }
  // While the board is open, pick up other people's votes every minute (only new ones are fetched).
  setInterval(() => {
    if (S.tab !== 'community' || document.hidden || Board.pick) return;
    Board.refresh().then(() => { if (S.tab === 'community' && !Board.pick) renderBoardBody(); });
  }, 60e3);

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
      seenObserveVisible(box);
      return;
    }
    if (!items.length) {
      // A real active filter (country/sector/importance/search) gets "Clear filters"; the 7-day default range
      // hiding items that simply expired or were dismissed is not a "filter" the person set, so it gets a plainer
      // message instead of a button that clears nothing meaningful.
      const hasRealFilter = !!(S.f.country || S.f.sector || S.f.imp || S.f.q);
      const heldBack = Appetite.hidden();
      box.innerHTML = (!hasRealFilter && heldBack)
        // Nothing cleared the appetite floor today. That is the feature working, not an empty feed, so it
        // says so and offers the way through instead of "Nothing here right now".
        ? `<div class="empty"><p>${esc(t('appetiteDoneTitle'))}</p>
            <p>${heldBack} ${esc(t('appetiteRestSub'))}</p>
            <button class="btn" data-act="appetiteRest">${esc(t('appetiteRestBtn'))}</button></div>`
        : hasRealFilter
        ? `<div class="empty"><p>No items match these filters.</p><button class="btn" data-act="reset">Clear filters</button></div>`
        : `<div class="empty"><p>Nothing here right now.</p><p>Stories move here as they come in, and drop off the list automatically after 24 hours unless you save them.</p></div>`;
      seenObserveVisible(box);
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
    box.innerHTML = html + appetiteRestHTML();
    seenObserveVisible(box);
  }

  /* The row closing the feed when a daily appetite is set. It is always present while anything is held
     back, and it states the count: a filter that quietly shrinks someone's feed without saying by how
     much is precisely what makes people stop trusting it and go back to reading everything. */
  function appetiteRestHTML() {
    if (!Appetite.active()) return '';
    if (Appetite.revealed) {
      return `<div class="appetite-rest">
          <p class="ar-sub">${esc(t('appetiteShowingAll'))}</p>
          <button class="btn small" data-act="appetiteFold">${esc(t('appetiteFoldBtn'))}</button>
        </div>`;
    }
    const n = Appetite.hidden();
    if (!n) return '';
    return `<div class="appetite-rest">
        <p class="ar-title">${esc(t('appetiteDoneTitle'))}</p>
        <p class="ar-sub">${n} ${esc(t('appetiteRestSub'))}</p>
        <button class="btn small" data-act="appetiteRest">${esc(t('appetiteRestBtn'))}</button>
      </div>`;
  }

  // Saved is split by mode, same as the main feed: a saved story that's tagged with one of the user's
  // tracked companies is "investment-related" and shows in Investment mode's own list
  // (#savedInvestList); everything else (including a story tagged with a company the user doesn't
  // track) is Signal/News content and stays in the original #savedList. Both lists are kept rendered
  // together and shown/hidden by setMode(), so switching modes never re-fetches, just toggles.
  function renderSaved() {
    const newsBox = $('#savedList'), investBox = $('#savedInvestList');
    if (!newsBox && !investBox) return;
    const items = savedItems();
    ensureTranslated(collectTranslatable(items));
    const isInvestItem = isCompanyStory;
    const newsItems = items.filter(it => !isInvestItem(it));
    const investItems = items.filter(isInvestItem);
    const head = (key, n) => `<h2 class="saved-head">${esc(t(key))} <span>${n}</span></h2>`;
    if (!items.length) {
      newsBox.hidden = false;
      newsBox.innerHTML = `<div class="empty"><p>Nothing saved yet.</p><p>Swipe a story right, or tap Save, to keep it here for good.</p></div>`;
      if (investBox) { investBox.hidden = true; investBox.innerHTML = ''; }
      return;
    }
    newsBox.hidden = !newsItems.length;
    newsBox.innerHTML = newsItems.length ? head('savedNewsHead', newsItems.length) + newsItems.map(savedCardHTML).join('') : '';
    if (investBox) {
      investBox.hidden = !investItems.length;
      investBox.innerHTML = investItems.length ? head('savedInvestHead', investItems.length) + investItems.map(savedCardHTML).join('') : '';
    }
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
  /* ---------- Channel popularity ----------
     channel_stats.json (pipeline): {accounts, channels:{name:{news:n, investment:n}}}. A channel's share is the
     number of signed-in accounts that linked it in that category, out of all signed-in accounts. */
  const ChanStats = {
    data: null, at: 0, loading: null,
    load() {
      if (this.data && Date.now() - this.at < 10 * 60e3) return Promise.resolve();
      if (this.loading) return this.loading;
      this.loading = getJSON('channel_stats.json').then(d => { this.at = Date.now(); if (d && d.channels) this.data = d; })
        .catch(() => { /* keep what we have */ }).finally(() => { this.loading = null; });
      return this.loading;
    },
    pct(name, cat) {
      if (!this.data || !this.data.accounts) return null;
      const n = ((this.data.channels[String(name).toLowerCase()] || {})[cat]) || 0;
      return { n, total: this.data.accounts, p: n ? Math.max(1, Math.round(n / this.data.accounts * 100)) : 0 };
    },
    // The share of accounts that linked a channel, behind an "i" button (owner, 24 Oct) - Explore only.
    info(name) {
      // Percentage only (owner, 24 Oct): never a count of users. "users" is once per account across both lists;
      // an older stats file without it falls back to the larger of the two lists.
      let txt = 'Not counted yet. The figure updates every 30 minutes.';
      const d = this.data;
      if (d && d.accounts) {
        const c = d.channels[String(name).toLowerCase()] || {};
        const n = c.users != null ? c.users : Math.max(c.news || 0, c.investment || 0);
        txt = n ? Math.max(1, Math.round(n / d.accounts * 100)) + '% of users have linked this channel.' : 'Not linked by any users yet.';
      }
      return `<span class="lc-info"><button type="button" class="info-i" aria-label="Share of users who linked t/${esc(name)}" aria-expanded="false">i</button><span class="info-pop" role="tooltip">${esc(txt)}</span></span>`;
    },
    html(name, cat, key) {
      const s = this.pct(name, key || cat);
      if (!s) return '';
      return `<span class="lc-stat ${cat === 'investment' ? 'inv' : 'news'}" title="${s.n} of ${s.total} accounts"><span class="bar" aria-hidden="true"><i style="width:${s.p}%"></i></span><span>${s.p}% of users</span></span>`;
    }
  };
  function renderPopularChannels() {
    const box = $('#lcPopular'), wrap = $('#lcPopularBox');
    if (!box || !wrap) return;
    const d = ChanStats.data;
    const rows = d ? Object.entries(d.channels).map(([name, c]) => ({ name, n: c.investment || 0 }))
      .filter(r => r.n >= 2 && !S.myInvestChannels.has(r.name)).sort((x, y) => y.n - x.n).slice(0, 6) : [];
    wrap.hidden = !rows.length;
    box.innerHTML = rows.map(r => `<div class="lp-row lp-chanrow">${chanMain(r.name, '')}
      <div class="lp-rowbtns"><button class="follow" data-act="tginvlink" data-v="${esc(r.name)}">Link</button></div></div>`).join('');
  }
  function refreshChannelStats() {
    Promise.all([ChanStats.load(), Channels.catalog()]).then(() => { renderChannels(); renderInvestChannels(); renderPopularChannels(); renderExplore(); });
  }

  // Which list a channel belongs in: what the record says, else whichever list more accounts put it in.
  function channelCategory(c) {
    if (c && (c.category === 'news' || c.category === 'investment')) return c.category;
    const st = (ChanStats.data && ChanStats.data.channels[c.channel]) || {};
    return (st.investment || 0) > (st.news || 0) ? 'investment' : 'news';
  }
  const catPill = cat => `<span class="lc-cat ${cat === 'investment' ? 'inv' : 'news'}">${cat === 'investment' ? 'Investment' : 'News'}</span>`;
  function channelStatus(name) {       // 'approved' | 'pending' | null (unknown: catalog not loaded)
    if ((defaultChannelsCache || []).includes(name)) return 'approved';
    if (!catalogCache) return null;
    const c = catalogCache.find(x => x.channel === name);
    return c ? c.status : 'pending';
  }
  // Channel rows (owner-approved layout A, 24 Oct): the full name on line 1, never cut off; line 2 holds the
  // category label (only where it tells channels apart), the approval badge and, in Explore, the "i".
  const chanMain = (name, line2) => `<div class="lc-main"><span class="lc-name">t/${esc(name)}</span>${line2 ? `<span class="lc-sub">${line2}</span>` : ''}</div>`;
  const waitingBadge = '<span class="lc-wait" title="The owner has not approved this channel yet, so nothing is fetched from it">Awaiting approval</span>';

  // Explore channels: everything on QwickSignal, with category and share of accounts. Tap Link to add one to
  // your own News or Investment list (it goes to the list matching its category).
  let exploreFilter = '';
  async function renderExplore() {
    const box = $('#exList'); if (!box) return;
    if (catalogCache === null) await Channels.catalog();
    if (defaultChannelsCache === null) await DefaultChannels.load();
    const owner = isOwner();
    const rows = new Map();
    (defaultChannelsCache || []).forEach(n => rows.set(n, { channel: n, status: 'approved', category: '' }));
    (catalogCache || []).forEach(c => { if (c.status === 'approved' || owner) rows.set(c.channel, Object.assign({}, rows.get(c.channel), c)); });
    const users = n => ((ChanStats.data && ChanStats.data.channels[n]) || {}).users || 0;
    const list = [...rows.values()].map(c => Object.assign(c, { cat: channelCategory(c) }));
    const approved = list.filter(c => c.status === 'approved' && (!exploreFilter || c.cat === exploreFilter))
      .sort((x, y) => users(y.channel) - users(x.channel) || x.channel.localeCompare(y.channel));
    $$('.ex-chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === exploreFilter)));
    if (catalogCache === null && !approved.length) {
      box.innerHTML = '<p class="lp-empty">' + esc(t('couldntLoadChannels')) + (lastChannelError ? ' <br><span class="lp-errdetail">' + esc(lastChannelError) + '</span>' : '') + '</p>';
    } else if (!approved.length) {
      box.innerHTML = '<p class="lp-empty">No channels here yet.</p>';
    } else {
      box.innerHTML = approved.map(c => {
        const name = c.channel, inv = c.cat === 'investment';
        const linked = inv ? S.myInvestChannels.has(name) : (S.myChannels.has(name) && !S.hiddenChannels.has(name));
        return `<div class="lp-row lp-chanrow">${chanMain(name, (exploreFilter ? '' : catPill(c.cat)) + ChanStats.info(name))}
          <div class="lp-rowbtns"><button class="follow${linked ? ' on' : ''}" data-act="exlink" data-v="${esc(name)}" data-cat="${c.cat}" aria-pressed="${linked}" aria-label="${linked ? 'Unlink' : 'Link'} t/${esc(name)}">${linked ? 'Linked' : 'Link'}</button>
          ${owner ? `<button class="lp-more" data-act="tgmore" data-where="explore" data-cat="${c.cat}" data-v="${esc(name)}" data-default="${(defaultChannelsCache || []).includes(name) ? 1 : 0}" aria-label="${esc(t('moreOptions'))} t/${esc(name)}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>` : ''}</div></div>`;
      }).join('');
    }
    // Owner: channels waiting for a decision.
    const pbox = $('#exPendingBox'), plist = $('#exPending');
    const pend = owner ? list.filter(c => c.status === 'pending') : [];
    if (pbox) pbox.hidden = !pend.length;
    if (plist) plist.innerHTML = pend.map(c => `<div class="lp-row lp-chanrow">${chanMain(c.channel, catPill(c.cat) + ChanStats.info(c.channel))}
      <div class="lp-rowbtns"><button class="follow on" data-act="exapprove" data-v="${esc(c.channel)}">Approve</button><button class="follow" data-act="exreject" data-v="${esc(c.channel)}">Reject</button></div></div>`).join('');
  }

  // Linked news channels: the channels this account follows for the News tab.
  async function renderChannels() {
    const box = $('#tgList'), note = $('#tgSyncNote');
    if (!box) return;
    renderTelegramGate();
    if (note) note.textContent = Sync.ready ? '' : 'Working from this device only until the sync service is reachable.';
    if (defaultChannelsCache === null) await DefaultChannels.load();
    const defaults = defaultChannelsCache || [];

    // Signed out: the owner-picked default channels only, read-only.
    if (!Auth.uid) {
      if (!defaults.length) { box.innerHTML = '<p class="lp-empty">' + esc(t('noChannelsYet')) + '</p>'; return; }
      box.innerHTML = defaults.map(lower => `<div class="lp-row lp-chanrow">${chanMain(lower, '<span class="lp-defaultbadge">' + esc(t('defaultBadge')) + '</span>')}</div>`).join('');
      return;
    }
    if (catalogCache === null) await Channels.catalog();
    const owner = isOwner();
    const mine = [...S.myChannels].filter(n => !S.hiddenChannels.has(n)).sort((a, b) => a.localeCompare(b));
    if (!mine.length) {
      box.innerHTML = '<p class="lp-empty">You have not picked any channels yet' + (defaults.length ? ', so News shows the ' + defaults.length + ' default channels.' : '.') +
        ' Open <button type="button" class="lc-linkbtn" data-act="spopen" data-v="explore">Explore channels</button> to choose.</p>';
      return;
    }
    box.innerHTML = mine.map(name => {
      const isDefault = defaults.includes(name), st = channelStatus(name);
      return `<div class="lp-row lp-chanrow">${chanMain(name, (isDefault ? '<span class="lp-defaultbadge">' + esc(t('defaultBadge')) + '</span>' : '') + (st === 'pending' ? waitingBadge : ''))}
      <div class="lp-rowbtns"><button class="follow lp-remove" data-act="tgfollow" data-v="${esc(name)}" aria-label="${esc(t('remove'))} t/${esc(name)}">${esc(t('remove'))}</button>
      <button class="lp-more" data-act="tgmore" data-where="news" data-v="${esc(name)}" data-default="${isDefault ? 1 : 0}" aria-label="${esc(t('moreOptions'))} t/${esc(name)}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div></div>`;
    }).join('');
  }

  document.addEventListener('change', ev => { if (ev.target && ev.target.id === 'impFile') HoldingsImport.handle(ev.target.files && ev.target.files[0]); });

  /* ---------- Import holdings from a broker ----------
     Brokers don't offer a free way to read a portfolio directly, so this reads what the person downloads from
     them, entirely on this device (nothing is uploaded):
       - CSV or Excel (.xlsx) holdings reports: Zerodha, Groww, Upstox, ICICI Direct, HDFC Securities, Angel One...
       - a depository statement (CDSL / NSDL "CAS", PDF), which lists every broker's holdings at once.
     Every company found is matched to the app's company list; the person reviews the list and confirms before
     anything is added. */
  const HoldingsImport = {
    found: [], busy: false, pdfPass: null, pdfBuf: null,
    norm(s) {
      return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\b(limited|ltd|inc|corporation|corp|company|co|the|eq|new)\b/g, ' ').replace(/\s+/g, '');
    },
    index() {
      if (this._idx) return this._idx;
      const m = new Map();
      E.COMPANIES.forEach(c => {
        [c.name, ...(c.aliases || []), c.ticker].filter(Boolean).forEach(k => { const n = this.norm(k); if (n && !m.has(n)) m.set(n, c.name); });
      });
      return (this._idx = m);
    },
    match(raw) {
      let s = String(raw || '').trim().replace(/-(BE|EQ|BL|BZ|SM|ST|X1|N\d)$/i, '').replace(/\s+/g, ' ');
      if (!s || s.length < 2 || /^[\d.,\-\s%]+$/.test(s)) return null;
      const hit = this.index().get(this.norm(s));
      return hit ? { raw: s, name: hit, known: true } : { raw: s, name: s.replace(/\b([A-Za-z])([A-Za-z]*)/g, (x, f, r) => f.toUpperCase() + r.toLowerCase()), known: false };
    },
    csvRows(text) {
      const rows = []; let row = [], cell = '', q = false;
      const delim = (text.split('\n', 1)[0].match(/;/g) || []).length > (text.split('\n', 1)[0].match(/,/g) || []).length ? ';' : ',';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
        else if (ch === '"') q = true;
        else if (ch === delim) { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (ch !== '\r') cell += ch;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      return rows;
    },
    // .xlsx is a zip of XML files; read it with the browser's own inflate so no library is needed.
    async xlsxRows(buf) {
      const dv = new DataView(buf), u8 = new Uint8Array(buf);
      let eocd = -1;
      for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      if (eocd < 0) throw new Error('not a zip');
      const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
      const files = {};
      for (let k = 0; k < n; k++) {
        const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
        const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
        const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
        files[name] = { method, csize, off };
        p += 46 + nl + el + cl;
      }
      const read = async name => {
        const f = files[name]; if (!f) return null;
        const o = f.off, ln = dv.getUint16(o + 26, true), le = dv.getUint16(o + 28, true);
        const data = u8.subarray(o + 30 + ln + le, o + 30 + ln + le + f.csize);
        if (f.method === 0) return new TextDecoder().decode(data);
        const ds = new DecompressionStream('deflate-raw');
        const out = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
        return new TextDecoder().decode(out);
      };
      const xml = s => new DOMParser().parseFromString(s, 'application/xml');
      const sst = [];
      const ss = await read('xl/sharedStrings.xml');
      if (ss) xml(ss).querySelectorAll('si').forEach(si => sst.push([...si.querySelectorAll('t')].map(t => t.textContent).join('')));
      const sheetName = Object.keys(files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((x, y) => parseInt(x.match(/\d+/)[0]) - parseInt(y.match(/\d+/)[0]))[0];
      if (!sheetName) throw new Error('no sheet');
      const doc = xml(await read(sheetName)), rows = [];
      doc.querySelectorAll('sheetData > row').forEach(r => {
        const cells = [];
        r.querySelectorAll('c').forEach(c => {
          const ref = (c.getAttribute('r') || '').match(/^([A-Z]+)/); if (!ref) return;
          let col = 0; for (const ch of ref[1]) col = col * 26 + ch.charCodeAt(0) - 64;
          const t = c.getAttribute('t'), v = c.querySelector('v');
          cells[col - 1] = t === 's' ? (sst[+v.textContent] || '') : t === 'inlineStr' ? [...c.querySelectorAll('t')].map(x => x.textContent).join('') : (v ? v.textContent : '');
        });
        rows.push(Array.from(cells, x => x == null ? '' : x));
      });
      return rows;
    },
    // Names of companies from rows of a holdings table.
    fromRows(rows) {
      const HEAD = /^(instrument|symbol|trading symbol|scrip( name)?|scrip symbol|stock( name)?|stock symbol|company( name)?|security( name)?|name of the (instrument|security)|name|ticker)$/i;
      let hi = -1, cols = [];
      for (let i = 0; i < Math.min(rows.length, 60) && hi < 0; i++) {
        const c = (rows[i] || []).map((x, j) => HEAD.test(String(x).trim()) ? j : -1).filter(j => j >= 0);
        if (c.length) { hi = i; cols = c; }
      }
      const out = [];
      if (hi >= 0) {
        const nameCol = cols.find(j => /name/i.test(rows[hi][j])) ?? cols[0];
        for (let i = hi + 1; i < rows.length; i++) {
          const r = rows[i] || [];
          const cell = String(r[nameCol] || '').trim();
          if (!cell || /^(total|grand total|note|disclaimer)/i.test(cell)) continue;
          out.push(cell);
        }
        return out;
      }
      rows.forEach(r => (r || []).forEach(c => { const s = String(c || '').trim(); if (s.length >= 2 && s.length <= 60 && /[A-Za-z]/.test(s)) out.push(s); }));
      return out;
    },
    // Depository statement text: "INE002A01018 RELIANCE INDUSTRIES LIMITED 10 ..."
    fromCAS(text) {
      const out = [], rx = /\b(INE[0-9A-Z]{9})\s+([A-Z][A-Z0-9 &.\-\/()']{2,70}?)(?=\s+(?:\d|-\s*\d|NIL)|\s{2,}|$)/g;
      let m;
      while ((m = rx.exec(text.replace(/\s+/g, ' '))) !== null) out.push(m[2].replace(/\s*\b(EQUITY SHARES?|EQ|EQUITY)\b.*$/i, '').replace(/ - .*$/, '').replace(/[\s\-]+$/, '').trim());
      return out;
    },
    build(names) {
      const seen = new Set(), list = [];
      names.forEach(raw => {
        const m = this.match(raw); if (!m) return;
        const key = m.name.toLowerCase();
        if (seen.has(key)) return; seen.add(key); list.push(m);
      });
      return list.sort((x, y) => (y.known - x.known) || x.name.localeCompare(y.name));
    },
    async loadPdfJs() {
      if (window.pdfjsLib) return window.pdfjsLib;
      const BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = BASE + 'pdf.min.js'; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); });
      // A worker must come from this page's own origin: fetch the library's worker and serve it from a blob.
      const w = await (await fetch(BASE + 'pdf.worker.min.js')).text();
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([w], { type: 'text/javascript' }));
      return window.pdfjsLib;
    },
    async pdfText(buf, password) {
      const lib = await this.loadPdfJs();
      const doc = await lib.getDocument({ data: buf.slice(0), password: password || undefined }).promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const pg = await doc.getPage(i), tc = await pg.getTextContent();
        text += tc.items.map(x => x.str).join(' ') + '\n';
      }
      return text;
    },
    // ---- screen ----
    sheet() {
      let el = $('#impSheet');
      if (!el) { el = document.createElement('div'); el.id = 'impSheet'; el.className = 'asheet-wrap'; el.hidden = true; document.body.appendChild(el); }
      return el;
    },
    show(inner) {
      const el = this.sheet();
      el.innerHTML = `<div class="asheet-back" data-act="impClose"></div><div class="asheet imp" role="dialog" aria-modal="true" aria-label="${esc(t('impTitle'))}">${inner}</div>`;
      el.hidden = false; requestAnimationFrame(() => el.classList.add('show'));
    },
    close() { const el = $('#impSheet'); if (!el) return; el.classList.remove('show'); setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 200); },
    pick() {
      if (!Auth.uid) { openAuthGate('agTrackCompanyTitle', 'agTrackCompanyBody'); return; }
      const inp = $('#impFile'); if (inp) { inp.value = ''; inp.click(); }
    },
    reading() { this.show(`<div class="imp-card"><h3 class="imp-h">${esc(t('impReading'))}</h3><p class="imp-sub">${esc(t('impPrivate'))}</p></div>`); },
    async handle(file) {
      if (!file) return;
      this.reading();
      const name = file.name.toLowerCase();
      try {
        let names = [];
        if (/\.pdf$/.test(name)) { this.pdfBuf = await file.arrayBuffer(); this.pdfPass = null; return await this.runPdf(''); }
        if (/\.xlsx$/.test(name)) names = this.fromRows(await this.xlsxRows(await file.arrayBuffer()));
        else if (/\.xls$/.test(name)) return this.fail(t('impXls'));
        else names = this.fromRows(this.csvRows(await file.text()));
        this.review(this.build(names));
      } catch (e) { this.fail(t('impFail')); }
    },
    async runPdf(password) {
      try {
        const text = await this.pdfText(this.pdfBuf, password);
        const names = this.fromCAS(text);
        this.review(this.build(names));
      } catch (e) {
        if (e && (e.name === 'PasswordException' || /password/i.test(e.message || ''))) {
          this.show(`<div class="imp-card"><h3 class="imp-h">${esc(t('impPassTitle'))}</h3><p class="imp-sub">${esc(t('impPassBody'))}</p>
            <input id="impPass" class="imp-input" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${esc(t('impPassTitle'))}">
            ${password ? `<p class="imp-err">${esc(t('impPassWrong'))}</p>` : ''}
            <div class="imp-actions"><button class="btn small" data-act="impClose">${esc(t('sbCancel'))}</button><button class="btn primary small" data-act="impPass">${esc(t('impUnlock'))}</button></div></div>`);
          const i = $('#impPass'); if (i) i.focus();
        } else this.fail(t('impPdfFail'));
      }
    },
    fail(msg) {
      this.show(`<div class="imp-card"><h3 class="imp-h">${esc(t('impTitle'))}</h3><p class="imp-sub">${esc(msg)}</p>
        <div class="imp-actions"><button class="btn primary small" data-act="impClose">${esc(t('impDone'))}</button></div></div>`);
    },
    review(list) {
      this.found = list;
      if (!list.length) return this.fail(t('impNone'));
      const have = S.myCompanies;
      const row = (c, i) => `<label class="imp-row"><input type="checkbox" data-imp="${i}" ${have.has(c.name) ? 'disabled' : (c.known ? 'checked' : '')}>
        <span class="imp-n">${esc(c.name)}${have.has(c.name) ? `<em>${esc(t('impHave'))}</em>` : ''}</span></label>`;
      const known = list.map((c, i) => [c, i]).filter(([c]) => c.known), other = list.map((c, i) => [c, i]).filter(([c]) => !c.known);
      const fresh = known.filter(([c]) => !have.has(c.name)).length;
      this.show(`<div class="imp-card"><h3 class="imp-h">${esc(t('impFound').replace('{n}', list.length))}</h3>
        <p class="imp-sub">${esc(t('impReview'))}</p>
        <div class="imp-list">
          ${known.map(([c, i]) => row(c, i)).join('')}
          ${other.length ? `<p class="imp-sec">${esc(t('impUnknown'))}</p>${other.map(([c, i]) => row(c, i)).join('')}` : ''}
        </div>
        <div class="imp-actions"><button class="btn small" data-act="impClose">${esc(t('sbCancel'))}</button>
          <button class="btn primary small" data-act="impAdd" id="impAddBtn">${esc(t('impAdd'))} (${fresh})</button></div></div>`);
      const box = $('#impSheet');
      box.addEventListener('change', () => { const n = box.querySelectorAll('input[data-imp]:checked').length; const b = $('#impAddBtn'); if (b) b.textContent = t('impAdd') + ' (' + n + ')'; });
    },
    add() {
      const picks = [...document.querySelectorAll('#impSheet input[data-imp]:checked')].map(i => this.found[+i.dataset.imp]).filter(Boolean);
      const room = 300 - S.myCompanies.size;
      let added = 0;
      picks.forEach(c => { if (added < room && !S.myCompanies.has(c.name) && COMPANY_NAME_RX.test(c.name)) { S.myCompanies.add(c.name); added++; } });
      if (added) { Sync.pushSoon(); Board.publishMine(); track('import_holdings', { n: added }); renderInvestmentBox(); renderAll(); }
      this.close();
      toast(added ? t('impAdded').replace('{n}', added) : t('impNothing'));
    }
  };

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

  // Telegram channels linked specifically for Investment mode. Deliberately a simpler, local-only personal
  // list (same pattern as the investment watchlist above) rather than the shared, owner-curated pool the
  // News-mode Telegram block uses (Channels.*/DefaultChannels) - there is no cross-user approval concept for
  // a channel someone links just for their own market-news tracking. Kept in its own S.myInvestChannels set
  // so the two channel lists never mix: a channel linked here does not appear in or affect the News list.
  function renderInvestChannels() {
    const box = $('#tgInvList'), gate = $('#tgInvGateNote');
    if (!box) return;
    if (gate) gate.hidden = !!Auth.uid;
    if (!S.myInvestChannels.size) {
      box.innerHTML = `<p class="lp-empty">${esc(t('noChannelsYet'))}</p>`;
    } else {
      box.innerHTML = [...S.myInvestChannels].sort((a, b) => a.localeCompare(b)).map(name => `<div class="lp-row">
        ${chanMain(name, channelStatus(name) === 'pending' ? waitingBadge : '')}
        <div class="lp-rowbtns">
          <button class="follow lp-remove" data-act="tginvremove" data-v="${esc(name)}" aria-label="${esc(t('remove'))} t/${esc(name)}">${esc(t('remove'))}</button>
          <button class="lp-more" data-act="tgmore" data-where="inv" data-v="${esc(name)}" data-default="${(defaultChannelsCache || []).includes(name) ? 1 : 0}" aria-label="${esc(t('moreOptions'))} t/${esc(name)}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>
        </div>
      </div>`).join('');
    }
  }

  // What Export should pull together depends on the current mode, same as the main feed/Saved/Settings
  // already do - exporting used to always use visibleItems() (News-mode data) even while the user was
  // sitting in Investment mode, so "Export report" from the Investment tab silently downloaded a News
  // report instead. In Investment mode this is the flat union of every story matched to a tracked company
  // (the same source investmentGroups() builds its sector->company nesting from), deduped by id since one
  // story can be tagged with more than one tracked company.
  function exportItems() {
    if (S.mode === 'investment') {
      const want = S.myCompanies;
      if (!want.size) return [];
      const seen = new Set(), out = [];
      for (const it of all()) {
        const st = itemStatus(it);
        if (st === 'dismissed' || st === 'expired') continue;
        if (!(it.companies || []).some(c => want.has(c))) continue;
        if (seen.has(it.id)) continue;
        seen.add(it.id); out.push(it);
      }
      return out;
    }
    return visibleItems();
  }

  async function renderExport() {
    $$('#exportSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.exportRange));
    const c = exportItems().filter(i => inRange(i, S.exportRange)).length;
    $('#exportCount').textContent = c + (c === 1 ? ' item' : ' items') + ' in this period' + (S.mode === 'investment' ? ' (Investment)' : '');
  }
  function renderAll() {
    if (S.mode === 'investment') { renderList(); renderCompanyBar(); if (S.tab === 'settings' && S.settingsPage === 'saved') renderSaved(); return; }
    renderControls(); renderList(); renderExport(); renderCountryBar();
    if (S.tab === 'settings' && S.settingsPage === 'saved') renderSaved();
    // keep the just-added cards in sync when they are toggled
  }

  /* ---------- News/Signal / Investment mode ----------
     S.mode is now a plain CONSEQUENCE of which tab is open, not an independent toggle a visitor switches
     with its own gesture. Signals/Saved/Settings keep S.mode = 'news'; Investment (its own, directly-
     tappable tab now - see setTab()) sets it to 'investment'. This used to be driven by a single combined
     #modeSym button (double-tap to flip between a Signal icon and a candlestick icon, sitting inside a
     filled red circle) layered on top of the 'brief' tab slot - replaced per the user's explicit "5 tabs,
     not 4 icons" request: Signals, Saved, Investment, Community, Settings, each a plain, always-visible,
     single-tap button, with Investment promoted to a first-class tab instead of a mode hidden behind a
     gesture. setMode() itself is kept as an internal helper (called only from setTab() now) so the large
     block of mode-scoped rendering below - which several other render paths still correctly key off
     S.mode rather than S.tab (exportItems(), renderCompanyBar(), the PDF/CSV export masthead, etc) -
     didn't need to be rewritten, just re-triggered from a different place. */
  function setMode(mode) {
    if (mode === S.mode) return;
    S.mode = mode;
    renderDigest();      // the "since you left" card belongs to the tab being shown
    track('mode_view', { mode });
    // The News-only chrome (country status ring, country/sector/priority dropdown filters) has no meaning in
    // Investment mode, which has its own sector dropdown instead (#investSectorFilter, swapped in below) -
    // hide it rather than render it against the wrong data. #rangeSeg/#sectors/#countries/#viewSeg are left
    // alone entirely: they're already permanently hidden in the markup (their buttons are commented out -
    // unused/future UI), independent of mode. The priority dropdown (#viewFilter) is hidden here too, at the
    // user's explicit request - Investment mode doesn't apply S.f.imp as a filter, so hiding the control
    // without also dropping its effect would otherwise leave stories silently filtered by a priority value
    // selected back in News mode, with no visible control in Investment mode to explain or clear it.
    const investmentOnlyHide = ['#countryStatus', '#countryFilter', '#sectorFilter', '#hasFilter', '#viewFilter'];
    if (mode === 'investment') {
      investmentOnlyHide.forEach(sel => { const el = $(sel); if (el) el.hidden = true; });
      // Investment mode swaps the free-text search box for its own sector dropdown (#investSectorFilter) -
      // see renderInvestmentList()'s own comment for why a sector picker is more useful here than typing a
      // search term, now that sector is a real filter instead of just a grouping label.
      const qBox = $('#q'); if (qBox) qBox.hidden = true;
      const sectorBox = $('#investSectorFilter'); if (sectorBox) sectorBox.hidden = false;
      renderInvestmentList();
      renderCompanyBar();   // Company Status: the Investment-mode counterpart of the country ring row
    } else {
      // renderControls() fills countryFilter/sectorFilter but never un-hides them (it only reacts to filter
      // state, not mode), so that's cleared here first; #countryStatus/#hasFilter are restored by
      // renderCountryBar()/renderControls() themselves right after. #viewFilter (priority) is a plain static
      // dropdown with no render function of its own, so it's un-hidden explicitly here too, the same way -
      // otherwise coming back to News mode from Investment would leave it hidden forever.
      ['#countryFilter', '#sectorFilter', '#viewFilter'].forEach(sel => { const el = $(sel); if (el) el.hidden = false; });
      const qBox = $('#q'); if (qBox) qBox.hidden = false;
      const sectorBox = $('#investSectorFilter'); if (sectorBox) sectorBox.hidden = true;
      const companyBar = $('#companyStatus'); if (companyBar) { companyBar.hidden = true; companyBar.innerHTML = ''; }
      renderControls(); renderList(); renderCountryBar();
    }
    // Settings: the News-channels / Investment-watchlist destinations in #settingsNavList are mode-scoped
    // (SETTINGS_SECTIONS' own `mode` field, filtered in renderSettingsNav()) - refresh the list so the right
    // one shows, and back out of a sub-page that no longer applies to the new mode (e.g. News channels was
    // open and the mode flipped to Investment - that destination isn't listed anymore, so its sub-page
    // shouldn't be either; closeSettingsPage() is a harmless no-op if no sub-page was open).
    if (S.tab === 'settings') {
      renderInvestmentBox(); renderChannels(); renderInvestChannels();
      renderSettingsNav();
    }
    // Saved: swap which saved-items list shows, re-render if that tab happens to be open already.
    // Saved now always shows BOTH groups (News, then Investment). It used to show only the group matching
    // the last mode, so arriving at Saved from the Investment tab hid every saved news story (owner, 14 Oct).
    if (S.tab === 'settings' && S.settingsPage === 'saved') renderSaved();
    // Export: the item count shown there (and what Download PDF/CSV will actually pull - see
    // exportItems()) depends on mode, so refresh it if that settings sub-page happens to be open already
    // (Export now lives under Settings, not its own tab - see SETTINGS_SECTIONS/openSettingsPage()).
    if (S.tab === 'settings' && S.settingsPage === 'export') renderExport();
  }

  /* ---------- Settings: drill-down navigation (Option 2) ----------
     Settings used to be one long scroll of every block, in a fixed order, all always visible. That's now
     replaced by a short list of destinations (#settingsHome, built by renderSettingsNav()) plus one
     .settingspage wrapper per destination, shown one at a time by openSettingsPage()/closeSettingsPage().
     Every existing block inside a .settingspage - #accountBox, #tgList, #invList, #notifBox, #getAppBox,
     #ticketBox, #ticketAdminBox, etc. - kept its id and is still populated by exactly the render function
     that always populated it (renderAccount(), renderChannels(), ...), called from the same places as
     before (setTab('settings') below, and setMode()'s mode-swap block) - this only changes which wrapper is
     visible, never how a block's content is produced, so none of that existing logic needed to change. */
  const SETTINGS_SECTIONS = [
    { id: 'appearance', mode: null, icon: 'theme', title: 'Appearance', subKey: () => themeActive() === 'dark' ? 'Dark mode' : 'Light mode', count: null },
    { id: 'language', mode: null, icon: 'globe', title: 'Language', subKey: () => LANG_NAMES[currentLang] || 'English', count: null },
    { id: 'explore', mode: null, icon: 'compass', title: 'Explore channels', subKey: () => 'Every channel on QwickSignal', count: null },
    { id: 'linkchannels', mode: null, icon: 'wifi', title: 'Linked news channels', subKey: () => S.myChannels.size + ' linked', count: () => S.myChannels.size },
    { id: 'investwatchlist', mode: null, icon: 'candle', title: 'Linked investment channels & watchlist', subKey: () => S.myInvestChannels.size + ' channels · ' + S.myCompanies.size + ' stocks', count: () => S.myInvestChannels.size + S.myCompanies.size },
    { id: 'saved', mode: null, icon: 'bookmark', title: 'Saved stories', subKey: () => S.saved.size + ' saved', count: () => S.saved.size },
    { id: 'appetite', mode: null, icon: 'gauge', title: 'Daily appetite', subKey: () => Appetite.on() ? Appetite.target() + ' stories a day' : 'Everything', count: null },
    { id: 'notifications', mode: null, icon: 'bell', title: 'Notifications', subKey: () => 'New story alerts', count: null },
    { id: 'export', mode: null, icon: 'export', title: 'Export', subKey: () => 'Save a report or the raw table', count: null },
    // Hidden for now at the owner's request (not yet confirmed working). The page and its code are kept, so
    // restoring this one line brings it back.
    // { id: 'getapp', mode: null, icon: 'plus', title: 'Get the app', subKey: () => 'Install on this device', count: null },
    { id: 'feedback', mode: null, icon: 'help', title: 'Feedback & support', subKey: () => TicketNews.unseen ? t('ticketUpdatesSub').replace('{n}', TicketNews.unseen) : (isOwner() ? 'Send feedback · view tickets' : 'Send feedback'), count: () => TicketNews.unseen || null },
    // owner: true - listed only for the owner account (renderSettingsNav) and refused for anyone else
    // (openSettingsPage). The data behind it is owner-only in firestore.rules too; this just hides the door.
    { id: 'pushstats', mode: null, owner: true, icon: 'chart', title: 'Notification stats', subKey: () => 'Opened, swiped away, ignored', count: null }
  ];
  const SN_ICON = {
    theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    wifi: '<path d="M2 8.5a19 19 0 0 1 20 0M5.5 12.5a13.5 13.5 0 0 1 13 0M9 16.5a7.5 7.5 0 0 1 6 0"/><circle cx="12" cy="20" r="1.2" fill="currentColor" stroke="none"/>',
    candle: '<circle cx="10.5" cy="10.5" r="7.25"/><path d="M15.8 15.8 21 21" stroke-width="2.6"/><path d="M7 14v-1.6M9.5 14v-3.1M12 14v-2.2M14.5 14v-4.6" stroke-width="1.5"/><path d="M6.6 9.6l2.6-2.4 2.1 1.7 3.4-3.1M13.3 5.6h2.1v2.1" stroke-width="1.4"/>',
    bell: '<path d="M12 2a7 7 0 0 1 7 7c0 5 2 7 2 7H3s2-2 2-7a7 7 0 0 1 7-7z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0"/>',
    gauge: '<path d="M3.5 18a8.5 8.5 0 1 1 17 0"/><path d="M12 18l4.2-4.8"/><circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    chart: '<path d="M3 21h18"/><path d="M6 17v-5M11 17V6M16 17v-8M21 17V3"/>'
  };
  function renderSettingsNav() {
    const avatar = $('#snAcctAvatar'), title = $('#snAcctTitle'), sub = $('#snAcctSub');
    if (avatar) {
      if (Auth.uid) {
        const initial = (Auth.email || '?').trim().charAt(0).toUpperCase() || '?';
        avatar.textContent = initial;
        if (sub) sub.textContent = Auth.email || '';
      } else {
        avatar.textContent = '?';
        if (sub) sub.textContent = 'Sign in to keep your saves and channels with you';
      }
    }
    const list = $('#settingsNavList');
    if (!list) return;
    // Both the News-channels and Investment-watchlist destinations are listed now, regardless of S.mode -
    // Settings used to show only whichever one matched the old combined mode-toggle's current position
    // (so seeing "Investment watchlist" meant first switching the whole app into Investment mode), but now
    // that Investment is its own separate tab, Settings is reached the same way from either Signals or
    // Investment and must offer both destinations every time, not hide one depending on which tab a visitor
    // arrived from. The `mode` field on each section is kept only for subKey()/count() styling elsewhere,
    // not as a filter here any more.
    const html = SETTINGS_SECTIONS
      .filter(s => !s.owner || isOwner())
      .map(s => {
        const n = s.count ? s.count() : null;
        return `<button type="button" class="settingsnav-item" data-act="spopen" data-v="${s.id}">
          <svg class="sn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SN_ICON[s.icon]}</svg>
          <span class="sn-text"><span class="sn-title">${esc(s.title)}</span><span class="sn-sub">${esc(s.subKey())}</span></span>
          ${n !== null ? `<span class="sn-count">${n}</span>` : ''}
          <span class="sn-chevron" aria-hidden="true">›</span>
        </button>`;
      }).join('');
    list.innerHTML = html;
  }
  function openSettingsPage(id) {
    const page = $('#sp-' + id);
    if (!page) return;
    const section = SETTINGS_SECTIONS.find(x => x.id === id);
    if (section && section.owner && !isOwner()) return;
    $('#settingsHome').classList.add('sp-hidden');
    $$('.settingspage').forEach(p => p.classList.add('sp-hidden'));
    page.classList.remove('sp-hidden');
    $('#view-settings').classList.add('sp-open');   // hides the big black "Settings" title; the red back link stays
    S.settingsPage = id;
    window.scrollTo(0, 0);
    track('settings_section_open', { section: id });
    if (id === 'export') renderExport();
    if (id === 'language') renderLangChoices();
    if (id === 'appearance') Theme.apply();
    if (id === 'appetite') renderAppetiteBox();
    if (id === 'pushstats') renderPushStats();
    if (id === 'linkchannels' || id === 'investwatchlist' || id === 'explore') refreshChannelStats();
    if (id === 'saved') renderSaved();
  }
  function closeSettingsPage() {
    $$('.settingspage').forEach(p => p.classList.add('sp-hidden'));
    const home = $('#settingsHome');
    if (home) home.classList.remove('sp-hidden');
    $('#view-settings').classList.remove('sp-open');
    S.settingsPage = null;
    renderSettingsNav();
    window.scrollTo(0, 0);
  }

  /* ---------- tabs ---------- */
  // Tabs map 1:1 to the 5 bottom-bar buttons (Signals, Saved, Investment, Community, Settings). 'brief' and
  // 'investment' are two DIFFERENT tabs now but share one underlying screen, #view-brief, the same way
  // S.mode already split that single screen's content in two before this round - see setMode() above. So
  // switching to either tab both shows #view-brief AND pins S.mode to match, rather than leaving mode as a
  // separate thing a visitor could set out of step with which of the two tabs they're on.
  function setTab(name) {
    if (name === 'saved') { setTab('settings'); openSettingsPage('saved'); return; }   // Saved now lives in Settings
    S.coPage = null;                     // a company's news page closes whenever the tab changes
    if (name !== S.tab) track('tab_view', { tab: name });
    S.tab = name;
    const screen = (name === 'investment') ? 'brief' : name;
    $$('.view').forEach(v => v.hidden = v.id !== 'view-' + screen);
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name));
    window.scrollTo(0, 0);
    if (name === 'brief' || name === 'investment') {
      setMode(name === 'investment' ? 'investment' : 'news');
      // setMode() only re-renders when the mode actually changed (e.g. arriving at Investment from
      // Settings, already in investment mode from a previous visit) - force a render here too so the
      // screen is never stale on a tab switch that didn't also cross a mode boundary.
      if (S.mode === 'investment') { renderInvestmentList(); renderCompanyBar(); } else { renderControls(); renderList(); }
    }
    if (name === 'community') { renderCommunity(); Brokers.load().then(() => { if (S.tab === 'community' && !Board.pick) renderBoardBody(); }); }
    // Settings used to be the app's default first screen ("Link Pages"), so its Account/Telegram/Appearance
    // blocks were always rendered on load regardless of which tab was showing. Now that it's reached only via
    // the Settings tab, re-render its dynamic bits on every visit so they're never stale (e.g. after signing
    // in from the landing page while this tab wasn't open yet).
    if (name === 'settings') {
      renderAccount(); renderChannels(); renderInvestChannels(); renderSyncCode(); renderGetApp(); renderAppetiteBox(); renderNotifBox(); renderTicketBox(); renderTicketAdmin(); renderInvestmentBox();
      renderSettingsNav();
      // Always land on the destinations list, never a sub-page left open from a previous visit - a user who
      // drilled into Notifications last time and then switched tabs would otherwise find Settings reopening
      // straight into that sub-page instead of the list, with no visible way back to the other destinations.
      closeSettingsPage();
    }
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
    const items = exportItems().filter(i => inRange(i, S.exportRange)).sort(byPriority);
    if (!items.length) { toast('Nothing to export for that period.'); return; }
    const tag = S.mode === 'investment' ? 'qwicksignal-investment-' : 'qwicksignal-';
    download(tag + dayISO(Date.now()) + '.csv', E.toCSV(items), 'text/csv;charset=utf-8');
    toast('CSV saved to Downloads.');
    track('export', { format: 'csv', range: S.exportRange, count: items.length, mode: S.mode });
  }

  async function exportPDF() {
    const items = exportItems().filter(i => inRange(i, S.exportRange)).sort(byPriority);
    if (!items.length) { toast('Nothing to export for that period.'); return; }
    toast('Building the PDF\u2026');
    track('export', { format: 'pdf', range: S.exportRange, count: items.length, mode: S.mode });
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

    // masthead - titled "Investment Report" while exporting from Investment mode, so the PDF itself makes
    // clear which report this is rather than always reading as the News one.
    doc.setFillColor(...INK); doc.rect(0, 0, PW, 92, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(23);
    doc.text('QwickSignal ' + (S.mode === 'investment' ? 'Investment Report' : 'Report'), M, 44);
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
        // Investment mode leads the meta line with which tracked company/companies this story matched
        // (what the user actually tracks it by), ahead of country/sector - that's the field that mattered
        // enough to end up in this export in the first place.
        const trackedHere = S.mode === 'investment' ? (it.companies || []).filter(c => S.myCompanies.has(c)) : [];
        const metaBits = [
          trackedHere.length ? trackedHere.join(', ') : null,
          it.country, it.sector + (it.subsector ? ' / ' + it.subsector : ''), it.importance,
          (it.sources || []).length > 1 ? it.sources.length + ' sources' : null
        ].filter(Boolean);
        put(metaBits.join('  |  '), { size: 8.5, color: GREY, indent: 14, after: 2 });
        if (it.summary) put(it.summary, { size: 9.5, indent: 14, after: 9 }); else y += 7;
      });
    });

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 130, 140);
      doc.text('QwickSignal, generated on device   |   page ' + p + ' of ' + pages, PW / 2, PH - 22, { align: 'center' });
    }
    const pdfTag = S.mode === 'investment' ? 'QwickSignal-Investment-Report-' : 'QwickSignal-Report-';
    doc.save(pdfTag + dayISO(Date.now()) + '.pdf');
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
    // BUG FIX: the Appearance buttons carry data-theme-choice, which the lookup below never matched - so
    // el came back null and every tap on Default/Light/Dark was silently ignored. Handled first, directly.
    const infoBtn = ev.target.closest('.info-i');
    $$('.info-i[aria-expanded="true"]').forEach(b => { if (b !== infoBtn) b.setAttribute('aria-expanded', 'false'); });
    if (infoBtn) { infoBtn.setAttribute('aria-expanded', String(infoBtn.getAttribute('aria-expanded') !== 'true')); return; }
    const langBtn = ev.target.closest('#langChoices [data-lang]');
    if (langBtn) { setLang(langBtn.dataset.lang); renderLangChoices(); renderSettingsNav(); return; }
    const el = ev.target.closest('[data-act],[data-tab],[data-v]');
    if (el && el.dataset.tab) { setTab(el.dataset.tab); return; }
    if (el && el.closest('#rangeSeg')) { S.f.range = el.dataset.v; renderControls(); renderList(); return; }
    if (el && el.closest('#viewSeg')) { S.f.view = el.dataset.v; renderControls(); renderList(); return; }
    if (el && el.closest('#exportSeg')) { S.exportRange = el.dataset.v; renderExport(); return; }
    const act = el && el.dataset.act;
    if (act && el.closest('#actionSheet') && act !== 'sbSheetDel' && act !== 'sbSheetCancel') ActionSheet.close();
    if (act) {
     try {
      const v = el.dataset.v;
      if (act === 'untrack') { Companies.remove(v); }
      else if (act === 'tginvremove') { InvestChannels.remove(v); }
      else if (act === 'spopen') { openSettingsPage(v); }
      else if (act === 'spback') { closeSettingsPage(); }
      else if (act === 'chmove') {
        const [name, to] = String(v).split('|');
        if (!Auth.uid) { openAuthGate('agAddChannelsTitle', 'agAddChannelsBody'); }
        else {
          if (to === 'investment') { S.myChannels.delete(name); S.myInvestChannels.add(name); }
          else { S.myInvestChannels.delete(name); S.myChannels.add(name); S.hiddenChannels.delete(name); }
          Sync.pushSoon(); track('channel_move', { channel: name, to });
          toast('t/' + name + ' moved to your ' + (to === 'investment' ? 'Investment' : 'News') + ' channels.');
          renderChannels(); renderInvestChannels(); renderExplore(); renderSettingsNav(); renderAll();
        }
      }
      else if (act === 'chcat') {
        const [name, to] = String(v).split('|');
        if (await Channels.setCategory(name, to)) { renderExplore(); renderChannels(); renderInvestChannels(); }
      }
      else if (act === 'exfilter') { exploreFilter = v || ''; renderExplore(); }
      else if (act === 'exlink') {
        const inv = el.dataset.cat === 'investment';
        const was = inv ? S.myInvestChannels.has(v) : S.myChannels.has(v);
        if (!Auth.uid) { openAuthGate('agAddChannelsTitle', 'agAddChannelsBody'); }
        else {
          if (inv) { was ? InvestChannels.remove(v) : InvestChannels.add(v); }
          else if (was) { Channels.unfollow(v); toast('t/' + v + ' removed from your News channels.'); }
          else { await Channels.propose(v); }
          renderExplore(); renderChannels(); renderInvestChannels(); renderSettingsNav(); renderAll();
        }
      }
      else if (act === 'exapprove' || act === 'exreject') {
        if (await Channels.setStatus(v, act === 'exapprove' ? 'approved' : 'rejected')) { await Channels.catalog(); renderExplore(); }
      }
      else if (act === 'tginvlink') { if (InvestChannels.add(v)) renderPopularChannels(); }
      else if (act === 'impPick') { HoldingsImport.pick(); }
      else if (act === 'impClose') { HoldingsImport.close(); }
      else if (act === 'impAdd') { HoldingsImport.add(); }
      else if (act === 'impPass') { const i = $('#impPass'); if (i && i.value) HoldingsImport.runPdf(i.value.trim()); }
      else if (act === 'gotoWatchlist') { setTab('settings'); openSettingsPage('investwatchlist'); const inp = $('#invInput'); if (inp) inp.focus(); }
      else if (act === 'viewChart') { openChartModal(v, el, el.dataset.sector); }
      else if (act === 'viewNews') {
        S.coPage = v; track('company_page', { company: v });
        renderInvestmentList(); window.scrollTo(0, 0);
      }
      else if (act === 'coBack') {
        const co = S.coPage; S.coPage = null; renderInvestmentList(); renderDigest();
        const card = co && document.querySelector('#list .grp-company[data-co="' + CSS.escape(co) + '"]');
        if (card) card.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
      }
      else if (act === 'viewSent') {
        if (S.bvOpen.has(v)) S.bvOpen.delete(v); else S.bvOpen.add(v);
        renderInvestmentList();
        if (S.bvOpen.has(v)) Brokers.load().then(() => { if (S.bvOpen.has(v) && S.mode === 'investment' && S.tab !== 'community') renderInvestmentList(); });
      }
      else if (act === 'sbJump') {
        const slug = Pulse.companySlug(Board.canon(v));
        Board.open = slug; Board.pick = null; Board.draft = ''; Board.q = '';
        setTab('community');
      }
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
      else if (act === 'pulse') {
        // Voting is per company now (see the Pulse module). pulseHTML() only ever renders inside the
        // Community tab these days (renderCommunity()), so that's the only screen that ever needs
        // re-painting after a vote - a full re-render is the simple correct fix here, not a targeted
        // outerHTML patch. This does NOT re-fetch anything: Pulse.vote() already updated _cache/_mine
        // optimistically before this await resolves, so renderCommunity()'s own "only fetch what's still
        // uncached" check (see its own comment) finds nothing new to fetch and just re-paints with the
        // fresh local data.
        await Pulse.vote(el.dataset.company, v);
        if (S.tab === 'community') renderCommunity();
      }
      else if (act === 'sbOpen') {
        Board.open = Board.open === v ? null : v; Board.pick = null; Board.draft = ''; renderBoardBody();
      }
      else if (act === 'sbPick') {
        if (!Auth.uid) { openAuthGate('agBoardTitle', 'agBoardBody'); return; }
        Board.pick = v; renderBoardBody();
        const ta = $('#sbReason'); if (ta) ta.focus();
      }
      else if (act === 'sbCancel') { Board.pick = null; Board.draft = ''; renderBoardBody(); }
      else if (act === 'sbPost') {
        const entry = Board.entries().find(x => x.slug === Board.open)
          || E.COMPANIES.find(c => Pulse.companySlug(c.name) === Board.open) || null;
        if (!entry || !Board.pick || Board.busy) return;
        Board.busy = true; renderBoardBody();
        try {
          await Board.post(entry.name, Board.pick, (Board.draft || '').trim());
          Board.pick = null; Board.draft = ''; toast(t('sbPosted'));
        } catch (e) { toast(t('sbFailed')); }
        Board.busy = false; renderBoardBody();
        Board.refresh().then(() => { if (S.tab === 'community' && !Board.pick) renderBoardBody(); });
      }
      else if (act === 'sbSheetDel') {
        const id = ActionSheet.target; ActionSheet.close();
        if (!id) return;
        Board.softDelete(id);
        renderBoardBody();
        toastAction(esc(t('sbDeleted')) + ' <button class="link inline" data-act="sbUndoDel" data-id="' + esc(id) + '">' + esc(t('undo')) + '</button>', BOARD_UNDO_MS);
        track('board_delete', {});
      }
      else if (act === 'sbSheetCancel') { ActionSheet.close(); }
      else if (act === 'tkset') {
        const card = el.closest('.tk-card'), id = card && card.dataset.id;
        if (!id) return;
        const reply = ($('.tk-reply', card) || {}).value || '';
        if (v === 'done' && !reply.trim()) { toast(t('ticketNeedReason')); $('.tk-reply', card).focus(); return; }
        el.disabled = true;
        const ok = await Tickets.update(id, v, reply.trim());
        toast(ok ? t(v === 'done' ? 'ticketSavedDone' : v === 'in_progress' ? 'ticketSavedProgress' : 'ticketSavedOpen') : t('ticketFailed'));
        renderTicketAdmin();
      }
      else if (act === 'tkmore') { ActionSheet.open(t('ticketAdminHeading'), [{ label: t('ticketDelete'), act: 'tkdel', v, danger: true }]); }
      else if (act === 'tkdel') {
        const ok = await Tickets.remove(v);
        toast(ok ? t('ticketDeleted') : t('ticketFailed'));
        renderTicketAdmin();
      }
      else if (act === 'tkview') { clearTimeout(toastTimer); $('#toast').classList.remove('show'); setTab('settings'); openSettingsPage('feedback'); }
      else if (act === 'tgmore') {
        const isDef = el.dataset.default === '1', where = el.dataset.where || 'news';
        const items = [];
        // Anyone can move a channel between their own News and Investment lists (owner, 24 Oct).
        if (where === 'news') {
          items.push({ label: 'Move to my Investment channels', act: 'chmove', v: v + '|investment' });
          items.push({ label: t('remove') + ' (' + t('justForMe') + ')', act: 'tghide', v });
        } else if (where === 'inv') {
          items.push({ label: 'Move to my News channels', act: 'chmove', v: v + '|news' });
        }
        if (isOwner()) {
          // The owner can also correct the category every user sees in Explore channels.
          const cur = el.dataset.cat || channelCategory(Object.assign({ channel: v }, (catalogCache || []).find(c => c.channel === v) || {}));
          const to = cur === 'investment' ? 'news' : 'investment';
          items.push({ label: 'Show as ' + (to === 'investment' ? 'Investment' : 'News') + ' for everyone', act: 'chcat', v: v + '|' + to });
          items.push({ label: isDef ? t('removeDefault') : t('setDefault'), act: 'tgdefault', v });
          items.push({ label: t('removeShared'), act: 'tgremove', v, danger: true });
        }
        ActionSheet.open('t/' + v, items);
      }
      else if (act === 'sbSignIn') { openAuthGate('agBoardTitle', 'agBoardBody'); }
      else if (act === 'sbUndoDel') {
        Board.undoDelete(el.dataset.id);
        clearTimeout(toastTimer); $('#toast').classList.remove('show');
        renderBoardBody();
      }
      else if (act === 'sbAll') { Board.allComments.add(v); renderBoardBody(); }
      else if (act === 'sbMore') { Board.shown += BOARD_PAGE; renderBoardBody(); }
      else if (act === 'obReplay') { Onboarding.replay(); }
      else if (act === 'forgotPw') { forgotPassword(el); }
      else if (act === 'agclose') { closeAuthGate(); }
      else if (act === 'agGoto') {
        closeAuthGate(); setTab('settings');
        if (Auth.uid) { /* already signed in */ } else { openSettingsPage('account'); const eb = $('#authEmail'); if (eb) setTimeout(() => eb.focus(), 50); }
      }
      else if (act === 'fi') { S.f.imp = v; if (S.mode === 'investment') renderInvestmentList(); else { renderControls(); renderList(); } }
      else if (act === 'fc') { S.f.country = S.f.country === v ? '' : v; renderControls(); renderList(); }
      else if (act === 'fs') { S.f.sector = S.f.sector === v ? '' : v; renderControls(); renderList(); }
      else if (act === 'reset') { S.f = Object.assign(S.f, { country: '', sector: '', imp: '', q: '', range: 'all' }); $('#q').value = ''; if (S.mode === 'investment') renderInvestmentList(); else { renderControls(); renderList(); } }
      else if (act === 'appetiteSet') { Appetite.set(parseInt(v, 10) || 0); renderAppetiteBox(); renderSettingsNav(); renderControls(); renderList(); }
      else if (act === 'appetiteRest') { Appetite.revealed = true; track('appetite_reveal', {}); renderControls(); renderList(); }
      else if (act === 'appetiteFold') { Appetite.revealed = false; renderControls(); renderList(); window.scrollTo(0, 0); }
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
      else if (act === 'opencompany') { track('open_company_viewer', { company: el.dataset.c }); openCompany(el.dataset.c); }
      else if (act === 'cvclose') { closeCountryViewer(); }
      else if (act === 'cvshare') { cvShare(); }
      else if (act === 'cvprev') { cvGo(-1); }
      else if (act === 'cvnext') { cvGo(1); }
      else if (act === 'save') { saveItem(el.dataset.id); }
      else if (act === 'unsave') { unsaveItem(el.dataset.id); }
      else if (act === 'dismiss') { dismissItem(el.dataset.id); }
      else if (act === 'undo-dismiss') { undoDismiss(el.dataset.id); }
      else if (act === 'undo-unsave') { undoUnsave(el.dataset.id); }
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
      if (it) card.outerHTML = card.closest('#savedList,#savedInvestList') ? savedCardHTML(it) : entryHTML(it);
      // Thread timeline needs a network round trip (qs_archive), so it isn't ready on the very first
      // render above - kick the fetch off now the card is open, then re-render just this one card once it
      // resolves. Cached per story id (see Archive.forStory()), so re-opening the same card later is
      // instant and does no further network work. Skipped entirely for an already-saved item being
      // un-rendered (opening false) and for non-live manual items (it.live false), which were never
      // archived in the first place.
      if (opening && it && it.live) {
        Archive.forStory(it).then(() => {
          if (!S.open.has(id)) return;    // closed again before this resolved - nothing to update
          const freshCard = document.querySelector(`.entry[data-id="${CSS.escape(id)}"]`);
          if (freshCard) freshCard.outerHTML = freshCard.closest('#savedList,#savedInvestList') ? savedCardHTML(it) : entryHTML(it);
        });
      }
      // Sentiment pulse is fetched/rendered per COMPANY now, not per story - see renderInvestmentList()'s
      // own fetch-then-patch-in logic and the Pulse module's doc-comment. Nothing to do here on a card
      // open any more; a story card opening/closing has no effect on pulse data.
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
    else if (t.id === 'investSectorFilter') { S.f.investSector = t.value; renderInvestmentList(); }
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
  $('#tgInvAdd').addEventListener('click', () => {
    const inp = $('#tgInvInput'); const v = inp.value;
    if (!v.trim()) return;
    const ok = InvestChannels.add(v);
    if (ok) inp.value = '';
  });
  $('#tgInvInput').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('#tgInvAdd').click(); } });
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
      video: x.video || null,
      inv: !!x.inv,   // posted only in channels linked for Investment: kept out of News (see channelVisible)
      // Every story in today's feed takes this path (ai:false), and it never carried the headline photo
      // over - so a photo found by the image step could not show anywhere. Same rule as mapLive().
      image: (x.image && x.image.status === 'found' && x.image.url) ? { url: x.image.url, source: x.image.source || '' } : null
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
      inv: !!x.inv,
      // Headline images (image_intel.py): a real news photo Google's Custom Search index returned for this
      // headline, or null if none was found (or none was searched for yet - only Critical/High stories get
      // searched, see image_max_per_run/image_importance in sources.yml). Never re-hosted, just linked.
      image: (x.image && x.image.status === 'found' && x.image.url) ? { url: x.image.url, source: x.image.source || '' } : null
    };
  }
  const readCache = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const writeCache = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full */ } };

  function dedupeById(list) {
    const seen = new Set();
    return list.filter(it => it && !seen.has(it.id) && seen.add(it.id));
  }
  // Saved stories' contents, kept on the device. The feed only holds the last 24 hours, so a saved story
  // that aged out of it used to survive only until the app was closed - after a reload its id was still
  // "saved" but there was nothing left to show. Now a copy of each saved story is kept here and put back.
  const SAVED_STORE = 'qs-saved-items-v1';
  const SavedStore = {
    load() {
      try { const d = JSON.parse(localStorage.getItem(SAVED_STORE) || '[]'); return Array.isArray(d) ? d : []; }
      catch (e) { return []; }
    },
    save() {
      const byId = new Map(this.load().map(it => [it.id, it]));
      all().forEach(it => { if (S.saved.has(it.id)) byId.set(it.id, it); });
      const keep = [...byId.values()].filter(it => S.saved.has(it.id));
      try { localStorage.setItem(SAVED_STORE, JSON.stringify(keep)); } catch (e) { /* storage full: still works this session */ }
    }
  };

  /* Saved stories' contents in the ACCOUNT, not just on one phone. The account always synced which stories
     were saved (their ids), but not the stories themselves - and the news feed only holds the last 24 hours.
     So a story saved on a phone and opened on a laptop two days later had nothing to show. Each saved story
     is now also stored under the account (qs_users/<uid>/saved_items/<id>, readable only by that account -
     see firestore.rules). A device fetches only the ones it is missing, so it costs a handful of reads.
     Free plan: one small write per save, one read per missing story. */
  const SavedCloud = {
    tried: new Set(),        // ids already looked up this session (found or not) - never asked twice
    busy: false,
    base() { return `${FS_BASE}/qs_users/${Auth.uid}/saved_items`; },
    docId(id) { return String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120); },
    uploadedKey() { return 'qs-saved-cloud-v1-' + Auth.uid; },
    uploaded() { try { return new Set(JSON.parse(localStorage.getItem(this.uploadedKey()) || '[]')); } catch (e) { return new Set(); } },
    markUploaded(ids, on) {
      const u = this.uploaded(); ids.forEach(id => on ? u.add(id) : u.delete(id));
      try { localStorage.setItem(this.uploadedKey(), JSON.stringify([...u])); } catch (e) { /* storage full */ }
    },
    async headers() { const t = await Auth.bearerToken(); return t ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t } : null; },
    async put(it) {
      if (!Auth.uid || !it) return false;
      const h = await this.headers(); if (!h) return false;
      const json = JSON.stringify(it);
      if (json.length > 20000) return false;
      try {
        const r = await fetch(`${this.base()}/${this.docId(it.id)}`, { method: 'PATCH', headers: h,
          body: JSON.stringify({ fields: { item: { stringValue: json }, at: { timestampValue: new Date().toISOString() } } }) });
        if (r.ok) { this.markUploaded([it.id], true); return true; }
      } catch (e) { /* offline: reconcile() uploads it next time */ }
      return false;
    },
    async remove(id) {
      if (!Auth.uid) return;
      const h = await this.headers(); if (!h) return;
      try {
        const r = await fetch(`${this.base()}/${this.docId(id)}`, { method: 'DELETE', headers: h });
        if (r.ok || r.status === 404) this.markUploaded([id], false);
      } catch (e) { /* the copy just lingers; it is ignored unless the story is saved again */ }
    },
    // Fill in saved stories this device has no copy of, and upload any this device has that the account lacks.
    async reconcile() {
      if (!Auth.uid || this.busy) return;
      this.busy = true;
      try {
        const have = new Map(all().map(it => [it.id, it]));
        const missing = [...S.saved].filter(id => !have.has(id) && !this.tried.has(id));
        if (missing.length) {
          const h = await this.headers();
          if (h) {
            const prefix = `projects/${FIREBASE.projectId}/databases/(default)/documents/qs_users/${Auth.uid}/saved_items/`;
            const got = [];
            for (let i = 0; i < missing.length; i += 100) {
              const chunk = missing.slice(i, i + 100);
              const r = await fetch(`${FS_BASE}:batchGet`, { method: 'POST', headers: h,
                body: JSON.stringify({ documents: chunk.map(id => prefix + this.docId(id)) }) });
              if (!r.ok) break;
              chunk.forEach(id => this.tried.add(id));
              (await r.json()).forEach(x => {
                const f = x.found && x.found.fields;
                if (!f || !f.item) return;
                try { const it = JSON.parse(f.item.stringValue); if (it && it.id && S.saved.has(it.id)) got.push(it); } catch (e) { /* skip a damaged copy */ }
              });
            }
            if (got.length) {
              const ids = new Set(all().map(it => it.id));
              got.forEach(it => { if (!ids.has(it.id)) { S.live.push(it); ids.add(it.id); } });
              this.markUploaded(got.map(it => it.id), true);
              SavedStore.save();
              renderAll();
            }
          }
        }
        // Backfill: stories saved before this existed, or saved while offline.
        const up = this.uploaded();
        const toUpload = [...S.saved].filter(id => !up.has(id) && have.has(id)).slice(0, 50);
        for (const id of toUpload) await this.put(have.get(id));
      } finally { this.busy = false; }
    }
  };

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
      // BUG FIX: this used to just be `S.live = items.map(mapLive)`, a straight replace. feed.json is a
      // rolling window from the pipeline (recent items only, not a permanent archive), so any story old
      // enough to have scrolled out of that window would vanish from S.live the moment this ran - which
      // happens on every load and again every ~2 minutes while the app is open (AUTO_REFRESH_MS below).
      // Since all() is just S.items.concat(S.live), a SAVED story is just as exposed to this as any other:
      // itemStatus()'s saved-items-never-expire check never even runs, because the item itself is gone,
      // not merely marked expired. That's what "Saved articles disappear after 24h" actually was - not a
      // bug in the 24h lifecycle check (which already exempts saved items correctly), but this feed refresh
      // silently discarding the underlying item data for anything saved that aged out of the upstream feed.
      // Fix: a saved story that's present in the OLD S.live but missing from the new feed is kept, not
      // dropped - carried over as-is, fully preserving its headline/summary/etc. Only applies to S.saved;
      // a dismissed or already-expired-when-live-and-unsaved item still ages out normally, matching the
      // saved-items-are-the-one-exception intent the rest of the app already has (itemStatus(), savedItems()).
      // CLONE BUG FIX (owner, 12 Oct: "news are getting cloned up" after saving and refreshing): app ids are
      // 'L' + the pipeline's id, but this set held the bare pipeline ids, so it never matched and EVERY saved
      // story was carried over again next to its fresh copy - one more duplicate on each refresh (manual, or
      // the automatic one every couple of minutes). Duplicates shared an id, so swiping one away also took
      // its copies with it, which is the "skipping one skips several" report. Compare like with like, and
      // never let one id appear twice whatever the source.
      const freshList = dedupeById(items.map(mapLive));
      const freshIds = new Set(freshList.map(it => it.id));
      const kept = new Map();
      S.live.concat(SavedStore.load()).forEach(it => {
        if (it && S.saved.has(it.id) && !freshIds.has(it.id) && !kept.has(it.id)) kept.set(it.id, it);
      });
      S.live = freshList.concat([...kept.values()]);
      SavedStore.save();
      SavedCloud.reconcile();
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
    // Deep links from the market / vote notifications (no story id): "qs:market", "qs:board", "qs:board:<Company>"
    if (/^qs:/.test(id)) {
      const parts = id.split(':'), co = parts.slice(2).join(':');
      if (parts[1] === 'board') {
        if (co) { Board.open = Pulse.companySlug(Board.canon(co)); Board.pick = null; Board.draft = ''; Board.q = ''; }
        setTab('community');
      } else setTab('brief');
      return;
    }
    // A company story lives in the Investment tab: a tracked company's opens in that company's story viewer,
    // any other company's is shown in "Other companies in the news" below the cards.
    const story = all().find(x => x.id === id);
    if (story && isCompanyStory(story)) {
      S.open.add(id);
      setTab('investment');
      const co = story.companies.find(c => S.myCompanies.has(c));
      S.coPage = co || null;              // a tracked company's story opens on that company's news page
      S.f.investSector = '';
      renderInvestmentList();
      const el = document.querySelector('#view-brief .entry[data-id="' + id + '"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
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

  /* ---------- QR entry gate (owner, 20 Oct) ----------
     Only for people who arrive through the printed QR code, whose address carries ?src=qr. They are asked for a
     news language first; a loading screen then holds until the first stories are translated, so the first thing
     they see is readable news, not English cards swapping language one by one. Any other way in (a shared link,
     the installed app, a bookmark) never carries ?src=qr, so none of this runs and nothing about it changes.
     Uses the same free translation path as Settings -> Language: no new service, no cost. */
  const QRGate = {
    active: /[?&]src=qr(&|$)/.test(location.search),
    MAX_WAIT_MS: 90000,        // never trap someone behind the loader if translation is slow or blocked
    TXT: {
      hi: ['आपकी खबरें तैयार हो रही हैं', 'सभी खबरों का हिंदी में अनुवाद हो रहा है', 'खबरें'],
      mr: ['तुमच्या बातम्या तयार होत आहेत', 'सर्व बातम्यांचे मराठीत भाषांतर सुरू आहे', 'बातम्या'],
      gu: ['તમારા સમાચાર તૈયાર થઈ રહ્યા છે', 'બધા સમાચારનો ગુજરાતીમાં અનુવાદ થઈ રહ્યો છે', 'સમાચાર']
    },
    init(firstLoad) {
      if (!this.active) return;
      track('qr_entry');
      // Drop the marker from the address so a refresh doesn't ask again; the page is already in QR mode.
      try {
        const u = new URL(location.href); u.searchParams.delete('src');
        history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
      } catch (e) { /* address bar left as is */ }
      this.ready = Promise.resolve(firstLoad).catch(() => {});
      $$('#qrGate [data-qlang]').forEach(b => b.addEventListener('click', () => this.pick(b.dataset.qlang)));
    },
    async pick(lang) {
      if (this.busy) return; this.busy = true;
      track('qr_language', { lang });
      setLang(lang);
      if (lang === 'en' || !this.TXT[lang]) return this.finish(false);
      const [title, sub, unit] = this.TXT[lang];
      $('#qgLoadTitle').textContent = title; $('#qgLoadSub').textContent = sub;
      $('#qgPick').hidden = true; $('#qgLoad').hidden = false;
      const t0 = Date.now();
      await Promise.race([this.ready, new Promise(r => setTimeout(r, 15000))]);
      // Every story the News list can show: headline + summary, in the order the list shows them.
      let items = [];
      try { items = filtered().sort(byPriority); } catch (e) { items = []; }
      const pairs = items.map(it => [it.headline, it.summary].filter(Boolean)).filter(a => a.length);
      const texts = [...new Set(pairs.flat())];
      TR_CONCURRENCY = 6;
      const settled = x => TR_CACHE.has(trKey(x)) || TR_GAVE.has(trKey(x));
      const need = texts.filter(x => !TR_CACHE.has(trKey(x)));
      for (const x of need.slice().reverse()) {          // these first, ahead of anything else queued
        const i = trQueue.indexOf(x); if (i >= 0) trQueue.splice(i, 1);
        if (!TR_PENDING.has(trKey(x))) trQueue.unshift(x);
      }
      trPump();
      const total = pairs.length;
      await new Promise(res => {
        const tick = () => {
          const doneStr = texts.reduce((n, x) => n + (settled(x) ? 1 : 0), 0);
          const done = pairs.reduce((n, a) => n + (a.every(settled) ? 1 : 0), 0);
          $('#qgFill').style.width = (texts.length ? Math.max(6, Math.round(doneStr / texts.length * 100)) : 100) + '%';
          $('#qgCount').textContent = total ? `${done} / ${total} ${unit}` : '';
          if (doneStr >= texts.length || Date.now() - t0 > this.MAX_WAIT_MS) { this.timedOut = doneStr < texts.length; res(); } else setTimeout(tick, 250);
        };
        tick();
      });
      TR_CONCURRENCY = 4;
      this.finish(this.timedOut);
    },
    finish(slow) {
      document.documentElement.classList.remove('qr-entry');
      const g = $('#qrGate'); if (g) g.hidden = true;
      // A QR visitor who isn't signed in goes straight in as a guest (same as tapping "Continue as guest"),
      // instead of meeting the sign-in screen after having just chosen a language.
      if (!Landing.seen()) { track('qr_guest'); Landing.dismiss(true); }
      renderAll(); renderCountryViewer();
      if (slow) toast('Some stories will switch to your language in a moment.');
    }
  };

  /* ---------- start ---------- */
  (async function start() {
    setTimeout(dismissSplash, SPLASH_MIN_MS);
    setTimeout(() => { TicketNews.check(); Board.publishMine(); }, 6000);   // owner's ticket replies; this watchlist onto the board
    Theme.apply();
    // Re-sync the meta-tag color (not the data-theme attribute itself - that's only ever set by an
    // explicit choice) whenever the OS-level light/dark setting changes while on "System", so the
    // browser chrome color tracks a live OS theme switch, not just app launches.
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => { if (Theme.pref() === 'system') Theme.apply(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    }
    currentLang = loadLang();
    applyI18n();
    const dm = $('#darkModeSwitch');
    if (dm) dm.addEventListener('change', () => { Theme.set(dm.checked ? 'dark' : 'light'); renderSettingsNav(); track('theme_toggle', { dark: dm.checked }); });
    $('#today').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
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
    // Captured once, right at boot, before anything below can call Digest.touch() - this is the one
    // moment that actually reflects the gap since the app was last in front of the user.
    const awaySince = Digest.consumeGap();
    const firstLoad = loadLive();
    QRGate.init(firstLoad);   // no-op unless this visit came from the QR code
    firstLoad.then(() => { if (hashGotoId) gotoItem(hashGotoId); });
    // The default-channels list is public read, so it loads independently of sign-in - a guest should never
    // see a blank feed while waiting for anything auth-related.
    DefaultChannels.load().then(() => renderAll());
    // Phase E: restore any signed-in session first, so Sync.init() reads the right doc (account vs. guest
    // code) on the very first pull - neither ever blocks the news feed itself from loading. The digest
    // reads AFTER both this and the first loadLive() settle (reusing the SAME call above, not a second
    // fetch), so S.reviewed/S.live are the real, synced picture rather than whatever was on-device before
    // either resolved.
    Promise.all([Auth.restore().then(() => Sync.init()), firstLoad]).then(() => {
      renderAccount(); renderSyncCode(); renderChannels(); renderAll();
      renderDigest(awaySince);
      // Once per launch, not on every 2-minute poll: the resolved floor moves with the day's volume, and
      // re-pushing it to Firestore each time the feed ticks would churn for no benefit.
      Appetite.syncPush();
      Push.syncAccount();   // tie this device's notifications to whoever is signed in
    });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(reg => {
        Push.resync();
        // Browsers only check sw.js for a new VERSION on their own schedule (roughly once a day, often
        // less eager than that) - a tab left open across a deploy, or even a plain refresh soon after one,
        // can easily keep running the OLD cached app.js/index.html for a long time with no sign anything
        // is wrong, which is exactly how a shipped feature (e.g. this round's sentiment Pulse) can look
        // completely missing even though the right files are live on the server. Forcing an update() check
        // right after registration closes that gap: if a newer sw.js is already on the server, this starts
        // installing it immediately instead of waiting for the browser's own timer.
        reg.update().catch(() => {});
      }).catch(() => { }));
      // Once a new service worker actually takes control (it finished installing - skipWaiting()/
      // clients.claim() in sw.js - and is now live), every file this page fetches from here on is already
      // being served fresh/network-first by the NEW version, but this tab's own JS (app.js, already
      // parsed and running) is still the OLD code until the page itself reloads. One automatic reload is
      // what actually gets the new app.js running. Two guards: HAD_CONTROLLER skips the reload on a
      // brand-new visitor's very first load (there's no "old" controller to replace yet in that case -
      // controllerchange still fires once as the first SW takes over, and reloading then would just be a
      // pointless flash on someone who was never running stale code to begin with); RELOADING caps it to
      // once per tab regardless, since a reload loop would be far worse than a slightly-stale tab.
      const HAD_CONTROLLER = !!navigator.serviceWorker.controller;
      let RELOADING = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!HAD_CONTROLLER || RELOADING) return;
        RELOADING = true;
        location.reload();
      });
      // A push notification's "Check Now" tap (see sw.js's notificationclick): an already-open tab gets
      // focused and sent this message directly instead of relying on the hash above.
      navigator.serviceWorker.addEventListener('message', ev => {
        if (ev.data && ev.data.type === 'qs-goto' && ev.data.id) gotoItem(ev.data.id);
      });
    }
  })();
})();
