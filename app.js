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

  /* ---------- companies (name | home country code | sector | extra aliases) ---------- */
  const COMPANY_ROWS = [
    'Tata Motors|IN|Automotive', 'Maruti Suzuki|IN|Automotive', 'Mahindra & Mahindra|IN|Automotive|Mahindra', 'Ashok Leyland|IN|Automotive',
    'Bajaj Auto|IN|Automotive', 'Tata Steel|IN|Metals & Mining', 'JSW Steel|IN|Metals & Mining', 'Hindalco|IN|Metals & Mining',
    'Reliance Industries|IN|Energy|Reliance', 'Infosys|IN|Technology', 'Tata Consultancy Services|IN|Technology|TCS', 'Wipro|IN|Technology',
    'HCLTech|IN|Technology', 'HDFC Bank|IN|Banking', 'ICICI Bank|IN|Banking', 'State Bank of India|IN|Banking|SBI', 'Adani|IN|Infrastructure',
    'Bharti Airtel|IN|Telecom|Airtel', 'Jio|IN|Telecom', 'Apple|US|Technology', 'Microsoft|US|Technology', 'Alphabet|US|Technology|Google',
    'Amazon|US|Consumer', 'Meta|US|Technology', 'Nvidia|US|Semiconductors', 'Tesla|US|Automotive', 'Intel|US|Semiconductors',
    'AMD|US|Semiconductors', 'Micron|US|Semiconductors', 'Qualcomm|US|Semiconductors', 'Broadcom|US|Semiconductors',
    'Applied Materials|US|Semiconductors', 'Lam Research|US|Semiconductors', 'KLA|US|Semiconductors', 'Boeing|US|Aerospace',
    'Ford|US|Automotive', 'General Motors|US|Automotive', 'ExxonMobil|US|Energy|Exxon', 'Chevron|US|Energy', 'JPMorgan|US|Banking',
    'Goldman Sachs|US|Finance', 'Pfizer|US|Pharmaceuticals', 'OpenAI|US|Technology', 'ASML|NL|Semiconductors', 'TSMC|TW|Semiconductors',
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
    return { name: p[0], code: p[1], sector: p[2], aliases: [p[0]].concat(p[3] ? p[3].split(';') : []) };
  });

  /* ---------- ticker guessing (View Chart, Investment tab) ----------
     No hand-maintained ticker list: instead, guessSymbol() below makes a best-effort guess straight from
     the company's name (and, where it helps, its home country from COMPANIES) and hands that to
     TradingView's Advanced Chart widget as the opening symbol. If the guess is wrong, the widget's own
     built-in symbol search (click the ticker name at the top-left of the chart - a standard feature of
     every TradingView embed) lets the user correct it in one click, right there, without leaving the chart.
     This covers every tracked company, known or freehand, with nothing to keep updated on this end. */
  const EXCHANGE_BY_COUNTRY = {
    IN: 'NSE', US: 'NASDAQ', GB: 'LSE', DE: 'XETR', JP: 'TSE', KR: 'KRX', CN: 'HKEX', TW: 'TPEX',
    FR: 'EURONEXT', NL: 'EURONEXT', AU: 'ASX', BR: 'BVMF', CH: 'SIX', SA: 'TADAWUL', RU: 'MOEX'
  };
  function guessSymbol(name) {
    const known = E.COMPANIES.find(c => c.name.toLowerCase() === name.toLowerCase()
      || c.aliases.some(a => a.toLowerCase() === name.toLowerCase()));
    const exch = (known && EXCHANGE_BY_COUNTRY[known.code]) || 'NASDAQ';
    // A plain, deterministic guess: strip anything that isn't a letter/number, uppercase it. Right far more
    // often than not for short, single-word names (AAPL, INFY-style), and for everything else the widget's
    // own search is the real correction path - this is a starting point, not a claim of accuracy.
    const ticker = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    return exch + ':' + ticker;
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
    COMPANIES, guessSymbol
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
      chartSearchHint: 'Wrong listing? Click the ticker name at the top-left of the chart to search for the right one.'
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
  function openChartModal(companyName, opener) {
    const box = $('#chartModal'), chart = $('#cmChart');
    if (!box || !chart) return;
    track('view_chart', { company: companyName });
    $('#cmTitle').textContent = companyName;
    const symbol = E.guessSymbol(companyName);
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
    chart.querySelector('.tradingview-widget-container__widget').appendChild(script);
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
        return `<h3 class="grp-company">${esc(c.company)}<span class="n">${stories.length}</span>
          <button class="link" data-act="viewChart" data-v="${esc(c.company)}">${esc(t('viewChart'))}</button>
          <button class="link lp-remove" data-act="untrack" data-v="${esc(c.company)}" aria-label="${esc(t('investRemove'))} ${esc(c.company)}">${esc(t('investRemove'))}</button>
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
      const v = el.dataset.v;
      if (act === 'untrack') { Companies.remove(v); }
      else if (act === 'gotoWatchlist') { setTab('settings'); const inp = $('#invInput'); if (inp) inp.focus(); }
      else if (act === 'viewChart') { openChartModal(v, el); }
      else if (act === 'cmclose') { closeChartModal(); }
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
