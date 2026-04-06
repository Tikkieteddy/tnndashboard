/**
 * TNN Dashboard — Google Apps Script Backend
 * ============================================
 * ทำหน้าที่เป็น API middleware ให้ dashboard ดึงข้อมูลจาก:
 *   1) Google Sheets (Looker data — team, categories, competitors, TrueHit)
 *   2) Google Search Console API (clicks, impressions, CTR, keywords)
 *   3) Google Analytics 4 Data API (sessions by channel)
 *
 * Deploy เป็น Web App → dashboard fetch JSON ตอนเปิดหน้าเว็บ
 */

// ─── CONFIG ───────────────────────────────────────────────
const CONFIG = {
  SHEET_ID: '1vuHDop1s4ZmydRIJsg0O26O1TsUKyeac0iU06Cl6NNY',
  GSC_SITE_URL: 'https://www.tnnthailand.com/',
  GA4_PROPERTY_ID: '', // ← ใส่ GA4 Property ID เช่น '123456789'
  CACHE_SECONDS: 3600, // cache 1 ชั่วโมง
};

// ─── MAIN ENTRY POINT ────────────────────────────────────
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'all';
  const weekParam = (e && e.parameter && e.parameter.week) || '';

  let result;
  try {
    switch (action) {
      case 'sheets':
        result = getSheetsData(weekParam);
        break;
      case 'gsc':
        result = getGSCData(weekParam);
        break;
      case 'ga4':
        result = getGA4Data(weekParam);
        break;
      case 'all':
      default:
        result = getAllData(weekParam);
        break;
    }
  } catch (err) {
    result = { error: err.message, stack: err.stack };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── COMBINED ─────────────────────────────────────────────
function getAllData(weekParam) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'allData_' + (weekParam || 'latest');
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const data = {
    sheets: getSheetsData(weekParam),
    gsc: getGSCData(weekParam),
    ga4: getGA4Data(weekParam),
    generatedAt: new Date().toISOString(),
  };

  // Cache for 1 hour (max 6 hours)
  try {
    cache.put(cacheKey, JSON.stringify(data), CONFIG.CACHE_SECONDS);
  } catch (e) { /* cache too large, skip */ }

  return data;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1) GOOGLE SHEETS DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getSheetsData(weekParam) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  return {
    teamPerformance: getTeamPerformance(ss, weekParam),
    weeklyPV: getWeeklyPV(ss),
    monthlyPV: getMonthlyPV(ss),
    competitors: getCompetitors(ss, weekParam),
    topCategories: getTopCategories(ss, weekParam),
    topArticles: getTopArticles(ss, weekParam),
    kpi: getKPI(ss, weekParam),
    targets: getTargets(ss),
  };
}

/**
 * Team Performance — ดึงจากชีต "actual target team week"
 * คืน: [{ team, target, pvActual, articles, gap, gapPct }, ...]
 */
function getTeamPerformance(ss, weekParam) {
  const sheet = ss.getSheetByName('actual target team week');
  if (!sheet) return { error: 'Sheet "actual target team week" not found' };

  const data = sheet.getDataRange().getValues();
  const header = data[0];
  // Find column indices
  const colTeam = header.indexOf('Team Name');
  const colWeek = header.indexOf('week');
  const colTarget = header.indexOf('PV Target');
  const colPV = header.indexOf('PV Actual');
  const colArticles = header.indexOf('Articles');

  // Determine target week
  let targetWeek = weekParam;
  if (!targetWeek) {
    // Find the latest week that has PV data
    const weeks = data.slice(1)
      .filter(r => r[colPV] && String(r[colPV]).trim() !== '')
      .map(r => String(r[colWeek]));
    targetWeek = weeks.length > 0 ? weeks[weeks.length - 1] : '';
  }

  const teams = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[colWeek]) === targetWeek && row[colPV] && String(row[colPV]).trim() !== '') {
      const pvActual = parseNum(row[colPV]);
      const target = parseNum(row[colTarget]);
      const articles = parseNum(row[colArticles]);
      teams.push({
        team: String(row[colTeam]),
        target: target,
        pvActual: pvActual,
        articles: articles,
        pvPerArticle: articles > 0 ? Math.round(pvActual / articles) : 0,
        gapPct: target > 0 ? round2((pvActual / target) * 100) : 0,
      });
    }
  }

  return { week: targetWeek, teams: teams.sort((a, b) => b.pvActual - a.pvActual) };
}

/**
 * Weekly PV (TrueHit) — ดึงจากชีต "total week truehit"
 * คืน: [{ weekLabel, pv, uip, articles }, ...]  (4 สัปดาห์ล่าสุด)
 */
function getWeeklyPV(ss) {
  const sheet = ss.getSheetByName('total week truehit');
  if (!sheet) return { error: 'Sheet "total week truehit" not found' };

  const data = sheet.getDataRange().getValues();
  // Adapt based on actual column structure
  const weeks = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[1]) {
      weeks.push({
        weekLabel: String(row[0]),
        pv: parseNum(row[1]),
        uip: parseNum(row[2]),
        articles: parseNum(row[3]),
      });
    }
  }

  return weeks.slice(-4);  // last 4 weeks
}

/**
 * Monthly PV — ดึงจากชีต "total month truehit"
 */
function getMonthlyPV(ss) {
  const sheet = ss.getSheetByName('total month truehit');
  if (!sheet) return { error: 'Sheet "total month truehit" not found' };

  const data = sheet.getDataRange().getValues();
  const months = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[1]) {
      months.push({
        monthLabel: String(row[0]),
        pv: parseNum(row[1]),
      });
    }
  }
  return months;
}

/**
 * Competitor Data — ดึงจากชีต "competitor truehit"
 */
function getCompetitors(ss, weekParam) {
  const sheet = ss.getSheetByName('competitor truehit');
  if (!sheet) return { error: 'Sheet "competitor truehit" not found' };

  const data = sheet.getDataRange().getValues();
  // Return raw data for frontend to process
  return data.slice(0, Math.min(data.length, 50));
}

/**
 * Top Categories by PV and by Articles — ดึงจากชีต "All Performance2026 only"
 */
function getTopCategories(ss, weekParam) {
  const sheet = ss.getSheetByName('All Performance2026 only') || ss.getSheetByName('All Performance2026');
  if (!sheet) return { error: 'Performance sheet not found' };

  const data = sheet.getDataRange().getValues();
  const header = data[0];

  // Find columns
  const colCat = findCol(header, ['Category']);
  const colPV = findCol(header, ['Page View', 'PV', 'pageview']);
  const colWeekLabel = findCol(header, ['week_label']);

  if (colCat < 0 || colPV < 0) return { error: 'Cannot find Category/PV columns' };

  // Find latest week
  let latestWeek = '';
  if (colWeekLabel >= 0) {
    const allWeeks = [...new Set(data.slice(1).map(r => String(r[colWeekLabel])).filter(w => w && w.includes('2026')))];
    allWeeks.sort();
    latestWeek = weekParam || (allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : '');
  }

  // Aggregate by category for target week
  const catPV = {};
  const catCount = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const wl = colWeekLabel >= 0 ? String(row[colWeekLabel]) : '';
    if (latestWeek && wl !== latestWeek) continue;

    const cat = String(row[colCat]);
    const pv = parseNum(row[colPV]);
    catPV[cat] = (catPV[cat] || 0) + pv;
    catCount[cat] = (catCount[cat] || 0) + 1;
  }

  // Top 5 by PV
  const byPV = Object.entries(catPV)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, pv]) => ({ category: cat, pv: pv, articles: catCount[cat] || 0 }));

  // Top 5 by article count
  const byArticles = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, count]) => ({ category: cat, articles: count, pv: catPV[cat] || 0 }));

  return { week: latestWeek, byPV, byArticles };
}

/**
 * Top 5 Articles by PV
 */
function getTopArticles(ss, weekParam) {
  const sheet = ss.getSheetByName('All Performance2026 only') || ss.getSheetByName('All Performance2026');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const colTitle = findCol(header, ['title']);
  const colPV = findCol(header, ['Page View', 'PV']);
  const colCat = findCol(header, ['Category']);
  const colAuthor = findCol(header, ['Author']);
  const colWeekLabel = findCol(header, ['week_label']);

  // Find latest week
  let latestWeek = '';
  if (colWeekLabel >= 0) {
    const allWeeks = [...new Set(data.slice(1).map(r => String(r[colWeekLabel])).filter(w => w && w.includes('2026')))];
    allWeeks.sort();
    latestWeek = weekParam || (allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : '');
  }

  const articles = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (latestWeek && colWeekLabel >= 0 && String(row[colWeekLabel]) !== latestWeek) continue;
    articles.push({
      title: colTitle >= 0 ? String(row[colTitle]) : '',
      pv: colPV >= 0 ? parseNum(row[colPV]) : 0,
      category: colCat >= 0 ? String(row[colCat]) : '',
      author: colAuthor >= 0 ? String(row[colAuthor]) : '',
    });
  }

  return articles.sort((a, b) => b.pv - a.pv).slice(0, 5);
}

/**
 * KPI Summary
 */
function getKPI(ss, weekParam) {
  const weekly = getWeeklyPV(ss);
  if (!Array.isArray(weekly) || weekly.length < 2) return {};

  const curr = weekly[weekly.length - 1];
  const prev = weekly[weekly.length - 2];

  return {
    totalPV: curr.pv,
    totalPVPrev: prev.pv,
    totalPVChange: prev.pv > 0 ? round2(((curr.pv - prev.pv) / prev.pv) * 100) : 0,
    totalUIP: curr.uip,
    totalUIPPrev: prev.uip,
    totalUIPChange: prev.uip > 0 ? round2(((curr.uip - prev.uip) / prev.uip) * 100) : 0,
    articles: curr.articles,
    articlesPrev: prev.articles,
    articlesChange: prev.articles > 0 ? round2(((curr.articles - prev.articles) / prev.articles) * 100) : 0,
    pvPerArticle: curr.articles > 0 ? Math.round(curr.pv / curr.articles) : 0,
    pvPerArticlePrev: prev.articles > 0 ? Math.round(prev.pv / prev.articles) : 0,
  };
}

/**
 * Team Targets
 */
function getTargets(ss) {
  const sheet = ss.getSheetByName('target team');
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const targets = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[1]) {
      targets[String(row[1])] = {
        priority: String(row[0]),
        yearTarget: parseNum(row[2]),
        monthTarget: parseNum(row[3]),
        weekTarget: parseNum(row[5]),
      };
    }
  }
  return targets;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2) GOOGLE SEARCH CONSOLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getGSCData(weekParam) {
  // Calculate date ranges: current week and previous week
  const { currStart, currEnd, prevStart, prevEnd } = getWeekDates(weekParam);

  // Current week totals
  const currTotals = queryGSC(currStart, currEnd, 'date');
  // Previous week totals
  const prevTotals = queryGSC(prevStart, prevEnd, 'date');

  // Top keywords by impressions
  const topKeywordsImp = queryGSCKeywords(currStart, currEnd, 'impressions', 5);
  // Top keywords by clicks
  const topKeywordsClk = queryGSCKeywords(currStart, currEnd, 'clicks', 5);

  return {
    currentWeek: { start: currStart, end: currEnd, ...aggregateGSC(currTotals) },
    previousWeek: { start: prevStart, end: prevEnd, ...aggregateGSC(prevTotals) },
    topKeywordsByImpressions: topKeywordsImp,
    topKeywordsByClicks: topKeywordsClk,
  };
}

function queryGSC(startDate, endDate, dimension) {
  try {
    const response = UrlFetchApp.fetch(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/' +
      encodeURIComponent(CONFIG.GSC_SITE_URL) +
      '/searchAnalytics/query',
      {
        method: 'POST',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        payload: JSON.stringify({
          startDate: startDate,
          endDate: endDate,
          dimensions: [dimension],
          rowLimit: 1000,
        }),
      }
    );
    return JSON.parse(response.getContentText());
  } catch (e) {
    return { error: e.message };
  }
}

function queryGSCKeywords(startDate, endDate, sortBy, limit) {
  try {
    const response = UrlFetchApp.fetch(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/' +
      encodeURIComponent(CONFIG.GSC_SITE_URL) +
      '/searchAnalytics/query',
      {
        method: 'POST',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        payload: JSON.stringify({
          startDate: startDate,
          endDate: endDate,
          dimensions: ['query'],
          rowLimit: limit || 5,
          orderBy: sortBy || 'impressions',
        }),
      }
    );
    const result = JSON.parse(response.getContentText());
    return (result.rows || []).map(r => ({
      keyword: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: round2(r.ctr * 100),
      position: round2(r.position),
    }));
  } catch (e) {
    return { error: e.message };
  }
}

function aggregateGSC(result) {
  if (result.error) return result;
  const rows = result.rows || [];
  let clicks = 0, impressions = 0, ctrSum = 0, posSum = 0;
  rows.forEach(r => {
    clicks += r.clicks;
    impressions += r.impressions;
    ctrSum += r.ctr;
    posSum += r.position;
  });
  const n = rows.length || 1;
  return {
    clicks: clicks,
    impressions: impressions,
    ctr: round2((clicks / (impressions || 1)) * 100),
    position: round2(posSum / n),
  };
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3) GOOGLE ANALYTICS 4
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getGA4Data(weekParam) {
  if (!CONFIG.GA4_PROPERTY_ID) {
    return { error: 'GA4_PROPERTY_ID not configured. Set it in CONFIG.' };
  }

  const { currStart, currEnd, prevStart, prevEnd } = getWeekDates(weekParam);

  const currSessions = queryGA4Sessions(currStart, currEnd);
  const prevSessions = queryGA4Sessions(prevStart, prevEnd);

  return {
    currentWeek: { start: currStart, end: currEnd, channels: currSessions },
    previousWeek: { start: prevStart, end: prevEnd, channels: prevSessions },
  };
}

function queryGA4Sessions(startDate, endDate) {
  try {
    const response = UrlFetchApp.fetch(
      'https://analyticsdata.googleapis.com/v1beta/properties/' +
      CONFIG.GA4_PROPERTY_ID + ':runReport',
      {
        method: 'POST',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        payload: JSON.stringify({
          dateRanges: [{ startDate: startDate, endDate: endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10,
        }),
      }
    );
    const result = JSON.parse(response.getContentText());
    return (result.rows || []).map(r => ({
      channel: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value, 10),
    }));
  } catch (e) {
    return { error: e.message };
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getWeekDates(weekParam) {
  // If weekParam = 'week13', parse it; otherwise use last complete week
  const today = new Date();
  let currEnd, currStart;

  if (weekParam && weekParam.match(/^week(\d+)$/)) {
    const weekNum = parseInt(weekParam.match(/^week(\d+)$/)[1], 10);
    // 2026 week 1 starts Dec 29, 2025
    const jan1 = new Date(2026, 0, 1); // Jan 1 2026
    const firstMonday = new Date(2025, 11, 29); // Dec 29 2025 = week 1
    currStart = new Date(firstMonday);
    currStart.setDate(currStart.getDate() + (weekNum - 1) * 7);
    currEnd = new Date(currStart);
    currEnd.setDate(currEnd.getDate() + 6);
  } else {
    // Last complete Monday-Sunday
    const dayOfWeek = today.getDay(); // 0=Sun
    const daysToLastSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
    currEnd = new Date(today);
    currEnd.setDate(today.getDate() - daysToLastSunday);
    currStart = new Date(currEnd);
    currStart.setDate(currEnd.getDate() - 6);
  }

  // Previous week
  const prevEnd = new Date(currStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - 6);

  return {
    currStart: fmtDate(currStart),
    currEnd: fmtDate(currEnd),
    prevStart: fmtDate(prevStart),
    prevEnd: fmtDate(prevEnd),
  };
}

function fmtDate(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function parseNum(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  return parseInt(String(v).replace(/,/g, ''), 10) || 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function findCol(header, names) {
  for (const name of names) {
    const idx = header.findIndex(h => String(h).toLowerCase().includes(name.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}
