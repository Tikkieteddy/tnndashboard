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
  CACHE_SECONDS: 300, // cache 5 นาที (ลดจาก 1 ชม. เพื่อให้ข้อมูลอัพเดตเร็วขึ้น)
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
      case 'debug':
        result = getDebugInfo();
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
  const cacheKey = 'allData_v5_' + (weekParam || 'latest');
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* corrupt cache, continue */ }
  }

  const data = {
    sheets: getSheetsData(weekParam),
    gsc: getGSCData(weekParam),
    ga4: getGA4Data(weekParam),
    generatedAt: new Date().toISOString(),
  };

  // Cache (max 6 hours)
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
    yearlyPV: getYearlyPV(ss),
    competitors: getCompetitors(ss, weekParam),
    topCategories: getTopCategories(ss, weekParam),
    topArticles: getTopArticles(ss, weekParam),
    kpi: getKPI(ss, weekParam),
    targets: getTargets(ss),
  };
}

/**
 * Team Performance — ดึงจากชีต "actual target team week"
 */
function getTeamPerformance(ss, weekParam) {
  try {
    const sheet = ss.getSheetByName('actual target team week');
    if (!sheet) return { week: '', teams: [] };

    const data = sheet.getDataRange().getValues();
    const header = data[0];
    const colTeam = findCol(header, ['Team Name', 'team', 'ทีม']);
    const colWeek = findCol(header, ['week', 'สัปดาห์']);
    const colTarget = findCol(header, ['PV Target', 'target']);
    const colPV = findCol(header, ['PV Actual', 'pv actual', 'pv']);
    const colArticles = findCol(header, ['Articles', 'articles', 'บทความ']);

    // Determine target week
    let targetWeek = weekParam;
    if (!targetWeek) {
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
        const articles = colArticles >= 0 ? parseNum(row[colArticles]) : 0;
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
  } catch (e) {
    return { week: '', teams: [] };
  }
}

/**
 * Weekly PV (TrueHit) — ดึงจากชีต "total week truehit"
 * ใช้ header-based detection เพื่อหา column ที่ถูกต้อง
 */
function getWeeklyPV(ss) {
  try {
    const sheet = ss.getSheetByName('total week truehit');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const header = data[0];

    // Use header-based column detection
    const colWeek = findCol(header, ['week', 'สัปดาห์', 'week_label']);
    const colPV = findCol(header, ['pageview', 'page view', 'pv', 'total pv', 'total pageview']);
    const colUIP = findCol(header, ['uip', 'unique ip', 'unique']);
    const colArticles = findCol(header, ['articles', 'article', 'บทความ', 'content', 'news']);

    // If no headers detected, try to infer from data patterns
    // The sheet might have: Col A = week label, Col B = date text, Col C = date text, Col D = PV number
    const weeks = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Get week label from first column or detected column
      let weekLabel = '';
      if (colWeek >= 0) {
        weekLabel = String(row[colWeek]);
      } else if (row[0]) {
        weekLabel = String(row[0]);
      }

      if (!weekLabel || weekLabel.trim() === '') continue;

      // Get PV - try detected column first, then find first large number
      let pv = 0, uip = 0, articles = 0;

      if (colPV >= 0) {
        pv = parseNum(row[colPV]);
      } else {
        // Find the first column with a large number (likely PV)
        for (let j = 1; j < row.length; j++) {
          const val = parseNum(row[j]);
          if (val > 1000) { // PV values are typically > 1000
            pv = val;
            break;
          }
        }
      }

      if (colUIP >= 0) {
        uip = parseNum(row[colUIP]);
      }

      if (colArticles >= 0) {
        articles = parseNum(row[colArticles]);
      }

      if (pv > 0 || uip > 0) {
        weeks.push({ weekLabel, pv, uip, articles });
      }
    }

    return weeks; // return ALL weeks — frontend will slice for chart display
  } catch (e) {
    return [];
  }
}

/**
 * Monthly PV — ดึงจากชีต "total month truehit"
 */
function getMonthlyPV(ss) {
  try {
    // Try exact name first, then variations
    let sheet = ss.getSheetByName('total month truehit');
    if (!sheet) {
      // Try to find sheet with similar name
      const sheets = ss.getSheets();
      for (let i = 0; i < sheets.length; i++) {
        const name = sheets[i].getName().toLowerCase();
        if (name.includes('month') && name.includes('truehit')) {
          sheet = sheets[i];
          break;
        }
      }
    }
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const header = data[0];
    const colMonth = findCol(header, ['month', 'เดือน', 'month_label']);
    const colPV = findCol(header, ['pageview', 'page view', 'pv', 'total pv', 'total pageview']);
    const colUIP = findCol(header, ['uip', 'unique ip', 'unique']);

    const months = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      let monthLabel = '';
      if (colMonth >= 0) {
        monthLabel = String(row[colMonth]);
      } else if (row[0]) {
        monthLabel = String(row[0]);
      }

      if (!monthLabel || monthLabel.trim() === '') continue;

      let pv = 0, uip = 0;

      if (colPV >= 0) {
        pv = parseNum(row[colPV]);
      } else {
        // Find first large number
        for (let j = 1; j < row.length; j++) {
          const val = parseNum(row[j]);
          if (val > 1000) {
            pv = val;
            break;
          }
        }
      }

      if (colUIP >= 0) {
        uip = parseNum(row[colUIP]);
      }

      if (pv > 0 || monthLabel) {
        months.push({ monthLabel, pv, uip });
      }
    }

    return months;
  } catch (e) {
    return [];
  }
}

/**
 * Yearly PV — ดึงจากชีต "uip-pv yoy truehit"
 * Returns array of { year, pv } for yearly trend chart
 */
function getYearlyPV(ss) {
  try {
    let sheet = ss.getSheetByName('uip-pv yoy truehit');
    if (!sheet) {
      // Try to find sheet with similar name
      const sheets = ss.getSheets();
      for (let i = 0; i < sheets.length; i++) {
        const name = sheets[i].getName().toLowerCase();
        if (name.includes('yoy') && name.includes('truehit')) {
          sheet = sheets[i];
          break;
        }
      }
    }
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const header = data[0];
    const colYear = findCol(header, ['year', 'ปี', 'year_label']);
    const colPV = findCol(header, ['pageview', 'page view', 'pv', 'total pv', 'total pageview']);

    const years = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      let yearLabel = '';
      if (colYear >= 0) {
        yearLabel = String(row[colYear]);
      } else if (row[0]) {
        yearLabel = String(row[0]);
      }

      if (!yearLabel || yearLabel.trim() === '') continue;

      let pv = 0;
      if (colPV >= 0) {
        pv = parseNum(row[colPV]);
      } else {
        // Find first large number
        for (let j = 1; j < row.length; j++) {
          const val = parseNum(row[j]);
          if (val > 10000) {
            pv = val;
            break;
          }
        }
      }

      if (pv > 0 || yearLabel) {
        years.push({ year: yearLabel, pv: pv });
      }
    }

    return years;
  } catch (e) {
    return [];
  }
}

/**
 * Competitor Data — ดึงจากชีต "competitor truehit"
 * แปลงข้อมูลรายวันเป็น weekly summary ที่ frontend ใช้ได้เลย
 */
function getCompetitors(ss, weekParam) {
  try {
    const sheet = ss.getSheetByName('competitor truehit');
    if (!sheet) return { headers: [], daily: [], weekly: {} };

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { headers: [], daily: [], weekly: {} };

    const header = data[0];

    // Parse competitor names from headers
    // Headers format: "date", "tnn uip", "tnn session", "tnn pageview", "tnn rank", "khaosod uip", etc.
    const competitors = {};
    const competitorOrder = [];

    for (let j = 1; j < header.length; j++) {
      const h = String(header[j]).toLowerCase().trim();
      const parts = h.split(' ');
      if (parts.length >= 2) {
        const name = parts[0];
        const metric = parts.slice(1).join(' ');
        if (!competitors[name]) {
          competitors[name] = {};
          competitorOrder.push(name);
        }
        if (metric.includes('pageview') || metric.includes('page view') || metric === 'pv') {
          competitors[name].pvCol = j;
        } else if (metric.includes('uip') || metric.includes('unique')) {
          competitors[name].uipCol = j;
        } else if (metric.includes('session')) {
          competitors[name].sessionCol = j;
        } else if (metric.includes('rank')) {
          competitors[name].rankCol = j;
        }
      }
    }

    // Calculate weekly aggregates
    // Determine which week we need
    const { currStart, currEnd, prevStart, prevEnd } = getWeekDates(weekParam);
    const currStartDate = new Date(currStart);
    const currEndDate = new Date(currEnd);
    const prevStartDate = new Date(prevStart);
    const prevEndDate = new Date(prevEnd);

    const weeklyPV = {};
    const prevWeeklyPV = {};

    competitorOrder.forEach(name => {
      weeklyPV[name] = 0;
      prevWeeklyPV[name] = 0;
    });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dateVal = row[0];
      let rowDate;
      if (dateVal instanceof Date) {
        rowDate = dateVal;
      } else {
        rowDate = new Date(String(dateVal));
      }

      if (isNaN(rowDate.getTime())) continue;

      // Normalize to date only (no time)
      const rd = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate());

      competitorOrder.forEach(name => {
        const pvCol = competitors[name].pvCol;
        if (pvCol === undefined) return;
        const pv = parseNum(row[pvCol]);

        if (rd >= currStartDate && rd <= currEndDate) {
          weeklyPV[name] += pv;
        }
        if (rd >= prevStartDate && rd <= prevEndDate) {
          prevWeeklyPV[name] += pv;
        }
      });
    }

    // Build result array sorted by current PV
    const result = competitorOrder.map(name => ({
      name: formatCompetitorName(name),
      nameKey: name,
      weeklyPV: weeklyPV[name],
      prevWeeklyPV: prevWeeklyPV[name],
      change: prevWeeklyPV[name] > 0
        ? round2(((weeklyPV[name] - prevWeeklyPV[name]) / prevWeeklyPV[name]) * 100)
        : 0,
    })).sort((a, b) => b.weeklyPV - a.weeklyPV);

    // Also return raw daily data for detailed charts (limited to recent 60 days)
    const recentDays = data.slice(Math.max(1, data.length - 60));
    const daily = recentDays.map(row => {
      const entry = { date: row[0] instanceof Date ? row[0].toISOString().split('T')[0] : String(row[0]) };
      competitorOrder.forEach(name => {
        if (competitors[name].pvCol !== undefined) {
          entry[name + '_pv'] = parseNum(row[competitors[name].pvCol]);
        }
        if (competitors[name].uipCol !== undefined) {
          entry[name + '_uip'] = parseNum(row[competitors[name].uipCol]);
        }
      });
      return entry;
    });

    return {
      weekly: result,
      daily: daily,
      competitorNames: competitorOrder.map(formatCompetitorName),
    };
  } catch (e) {
    return { weekly: [], daily: [], competitorNames: [] };
  }
}

/**
 * Format competitor name for display
 */
function formatCompetitorName(key) {
  const nameMap = {
    'tnn': 'TNN',
    'khaosod': 'Khaosod',
    'khao': 'Khaosod',
    'pptv': 'PPTV',
    'thairath': 'Thairath',
    'thairate': 'Thairath',
    'nation': 'Nation',
    'bright': 'Bright',
    'posttoday': 'PostToday',
    'prachachat': 'Prachachat',
    'bkkbiz': 'BkkBiz',
    'thansettakij': 'Thansettakij',
    'bangkokpost': 'BangkokPost',
    'amarin': 'Amarin',
  };
  return nameMap[key.toLowerCase()] || key;
}

/**
 * Top Categories by PV and by Articles — ดึงจากชีต "All Performance2026 only" หรือ "All Performance2026"
 */
function getTopCategories(ss, weekParam) {
  try {
    const sheet = ss.getSheetByName('All Performance2026 only') || ss.getSheetByName('All Performance2026');
    if (!sheet) return { week: '', byPV: [], byArticles: [] };

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { week: '', byPV: [], byArticles: [] };

    const header = data[0];

    // More comprehensive column name search
    const colCat = findCol(header, ['Category', 'category', 'หมวดหมู่', 'cat', 'section', 'desk']);
    const colPV = findCol(header, ['Page View', 'Pageview', 'PV', 'pageview', 'page_view', 'views', 'total_pv']);
    const colWeekLabel = findCol(header, ['week_label', 'week', 'สัปดาห์', 'Week']);
    const colArticles = findCol(header, ['Articles', 'article', 'article_count', 'count', 'num_articles', 'บทความ']);

    // Debug: log what columns were found
    const debug = {
      headerRow: header.map(String),
      colCat, colPV, colWeekLabel, colArticles,
    };

    if (colCat < 0) return { week: '', byPV: [], byArticles: [], debug };

    // Find latest week
    let latestWeek = '';
    if (colWeekLabel >= 0) {
      const allWeeks = [...new Set(data.slice(1).map(r => String(r[colWeekLabel])).filter(w => w && w.trim() !== ''))];
      allWeeks.sort();

      // If weekParam is "weekN" format, get the Nth week or fallback to latest
      if (weekParam && weekParam.match(/^week(\d+)$/i)) {
        const weekNum = parseInt(weekParam.match(/^week(\d+)$/i)[1], 10);
        // allWeeks are sorted chronologically, so weekN = allWeeks[N-1]
        if (weekNum > 0 && weekNum <= allWeeks.length) {
          latestWeek = allWeeks[weekNum - 1];
        } else {
          latestWeek = allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : '';
        }
      } else if (weekParam && allWeeks.includes(weekParam)) {
        latestWeek = weekParam;
      } else {
        latestWeek = allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : '';
      }
    }

    // Aggregate by category for target week
    const catPV = {};
    const catCount = {};
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const wl = colWeekLabel >= 0 ? String(row[colWeekLabel]) : '';
      if (latestWeek && wl !== latestWeek) continue;

      const cat = String(row[colCat]).trim();
      if (!cat) continue;

      const pv = colPV >= 0 ? parseNum(row[colPV]) : 0;
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
  } catch (e) {
    return { week: '', byPV: [], byArticles: [] };
  }
}

/**
 * Top 5 Articles by PV
 */
function getTopArticles(ss, weekParam) {
  try {
    const sheet = ss.getSheetByName('All Performance2026 only') || ss.getSheetByName('All Performance2026');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const header = data[0];
    const colTitle = findCol(header, ['title', 'หัวข้อ', 'headline', 'article_title', 'news_title']);
    const colPV = findCol(header, ['Page View', 'Pageview', 'PV', 'pageview', 'page_view', 'views', 'total_pv']);
    const colCat = findCol(header, ['Category', 'category', 'หมวดหมู่', 'cat', 'section', 'desk']);
    const colAuthor = findCol(header, ['Author', 'author', 'ผู้เขียน', 'writer', 'byline']);
    const colWeekLabel = findCol(header, ['week_label', 'week', 'สัปดาห์', 'Week']);

    if (colTitle < 0 && colPV < 0) return [];

    // Find latest week
    let latestWeek = '';
    if (colWeekLabel >= 0) {
      const allWeeks = [...new Set(data.slice(1).map(r => String(r[colWeekLabel])).filter(w => w && w.trim() !== ''))];
      allWeeks.sort();

      // If weekParam is "weekN" format, get the Nth week or fallback to latest
      if (weekParam && weekParam.match(/^week(\d+)$/i)) {
        const weekNum = parseInt(weekParam.match(/^week(\d+)$/i)[1], 10);
        // allWeeks are sorted chronologically, so weekN = allWeeks[N-1]
        if (weekNum > 0 && weekNum <= allWeeks.length) {
          latestWeek = allWeeks[weekNum - 1];
        } else {
          latestWeek = allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : '';
        }
      } else if (weekParam && allWeeks.includes(weekParam)) {
        latestWeek = weekParam;
      } else {
        latestWeek = allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : '';
      }
    }

    const articles = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (latestWeek && colWeekLabel >= 0 && String(row[colWeekLabel]) !== latestWeek) continue;

      const title = colTitle >= 0 ? String(row[colTitle]).trim() : '';
      const pv = colPV >= 0 ? parseNum(row[colPV]) : 0;
      if (!title || pv === 0) continue;

      articles.push({
        title: title,
        pv: pv,
        category: colCat >= 0 ? String(row[colCat]).trim() : '',
        author: colAuthor >= 0 ? String(row[colAuthor]).trim() : '',
      });
    }

    return articles.sort((a, b) => b.pv - a.pv).slice(0, 5);
  } catch (e) {
    return [];
  }
}

/**
 * KPI Summary
 */
function getKPI(ss, weekParam) {
  try {
    const weekly = getWeeklyPV(ss);
    if (!Array.isArray(weekly) || weekly.length === 0) return {};

    // Determine which week index to use based on weekParam
    let currIdx = weekly.length - 1; // default: latest
    if (weekParam && weekParam.match(/^week(\d+)$/i)) {
      const weekNum = parseInt(weekParam.match(/^week(\d+)$/i)[1], 10);
      if (weekNum > 0 && weekNum <= weekly.length) {
        currIdx = weekNum - 1;
      }
    }

    const prevIdx = currIdx > 0 ? currIdx - 1 : -1;

    if (prevIdx < 0) {
      // Only one week available
      return {
        totalPV: weekly[currIdx].pv,
        totalPVPrev: 0,
        totalPVChange: 0,
        totalUIP: weekly[currIdx].uip,
        totalUIPPrev: 0,
        totalUIPChange: 0,
        articles: weekly[currIdx].articles,
        articlesPrev: 0,
        articlesChange: 0,
        pvPerArticle: weekly[currIdx].articles > 0 ? Math.round(weekly[currIdx].pv / weekly[currIdx].articles) : 0,
        pvPerArticlePrev: 0,
      };
    }

    const curr = weekly[currIdx];
    const prev = weekly[prevIdx];

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
  } catch (e) {
    return {};
  }
}

/**
 * Team Targets
 */
function getTargets(ss) {
  try {
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
  } catch (e) {
    return {};
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2) GOOGLE SEARCH CONSOLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getGSCData(weekParam) {
  try {
    const { currStart, currEnd, prevStart, prevEnd } = getWeekDates(weekParam);

    const currTotals = queryGSC(currStart, currEnd, 'date');
    const prevTotals = queryGSC(prevStart, prevEnd, 'date');
    const topKeywordsImp = queryGSCKeywords(currStart, currEnd, 'impressions', 5);
    const topKeywordsClk = queryGSCKeywords(currStart, currEnd, 'clicks', 5);

    return {
      currentWeek: { start: currStart, end: currEnd, ...safeAggregateGSC(currTotals) },
      previousWeek: { start: prevStart, end: prevEnd, ...safeAggregateGSC(prevTotals) },
      topKeywordsByImpressions: Array.isArray(topKeywordsImp) ? topKeywordsImp : [],
      topKeywordsByClicks: Array.isArray(topKeywordsClk) ? topKeywordsClk : [],
    };
  } catch (e) {
    return {
      currentWeek: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      previousWeek: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      topKeywordsByImpressions: [],
      topKeywordsByClicks: [],
    };
  }
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
    return { rows: [] };
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
    return [];
  }
}

/**
 * Safe aggregate that never returns error objects
 */
function safeAggregateGSC(result) {
  if (!result || result.error || !result.rows) {
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }
  const rows = result.rows || [];
  let clicks = 0, impressions = 0, posSum = 0;
  rows.forEach(r => {
    clicks += r.clicks;
    impressions += r.impressions;
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
    return {
      currentWeek: { channels: [] },
      previousWeek: { channels: [] },
    };
  }

  try {
    const { currStart, currEnd, prevStart, prevEnd } = getWeekDates(weekParam);
    const currSessions = queryGA4Sessions(currStart, currEnd);
    const prevSessions = queryGA4Sessions(prevStart, prevEnd);

    return {
      currentWeek: { start: currStart, end: currEnd, channels: Array.isArray(currSessions) ? currSessions : [] },
      previousWeek: { start: prevStart, end: prevEnd, channels: Array.isArray(prevSessions) ? prevSessions : [] },
    };
  } catch (e) {
    return {
      currentWeek: { channels: [] },
      previousWeek: { channels: [] },
    };
  }
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
    return [];
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEBUG — ดูข้อมูลดิบจาก sheet เพื่อเช็ค column mapping
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getDebugInfo() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const debug = { sheets: {} };

  // List all sheet names
  debug.sheetNames = ss.getSheets().map(s => s.getName());

  // Get first 3 rows of key sheets
  const keySheets = ['total week truehit', 'total month truehit', 'All Performance2026', 'All Performance2026 only', 'competitor truehit'];
  keySheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      debug.sheets[name] = {
        exists: true,
        rows: data.length,
        cols: data[0] ? data[0].length : 0,
        header: data[0] ? data[0].map(String) : [],
        sampleRow1: data[1] ? data[1].map(v => typeof v === 'object' && v instanceof Date ? v.toISOString() : String(v)) : [],
        sampleRow2: data[2] ? data[2].map(v => typeof v === 'object' && v instanceof Date ? v.toISOString() : String(v)) : [],
      };
    } else {
      debug.sheets[name] = { exists: false };
    }
  });

  return debug;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getWeekDates(weekParam) {
  const today = new Date();
  let currEnd, currStart;

  if (weekParam && weekParam.match(/^week(\d+)$/)) {
    const weekNum = parseInt(weekParam.match(/^week(\d+)$/)[1], 10);
    const firstMonday = new Date(2025, 11, 29); // Dec 29 2025 = week 1
    currStart = new Date(firstMonday);
    currStart.setDate(currStart.getDate() + (weekNum - 1) * 7);
    currEnd = new Date(currStart);
    currEnd.setDate(currEnd.getDate() + 6);
  } else {
    const dayOfWeek = today.getDay();
    const daysToLastSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
    currEnd = new Date(today);
    currEnd.setDate(today.getDate() - daysToLastSunday);
    currStart = new Date(currEnd);
    currStart.setDate(currEnd.getDate() - 6);
  }

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
  const s = String(v).replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function findCol(header, names) {
  for (const name of names) {
    const idx = header.findIndex(h => String(h).toLowerCase().trim() === name.toLowerCase().trim());
    if (idx >= 0) return idx;
  }
  // If exact match not found, try includes
  for (const name of names) {
    const idx = header.findIndex(h => String(h).toLowerCase().includes(name.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}
