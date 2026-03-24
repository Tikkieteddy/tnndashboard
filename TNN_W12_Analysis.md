# วิเคราะห์ TNN Week 12 (16–22 มี.ค. 2569)

---

## สรุปภาพรวม

สัปดาห์ที่ 12 เป็นสัปดาห์ขาลงต่อเนื่องของ TNN — ทั้ง Page Views, Sessions, และ SEO Clicks ลดลงพร้อมกัน สะท้อนปัญหาเชิงโครงสร้างที่ไม่ได้เกิดจาก seasonal effect เพียงอย่างเดียว

| ตัวชี้วัด | W12 | W11 | เปลี่ยนแปลง |
|---|---|---|---|
| **TrueHit PV** | 168,770 | 179,463 | **-5.96%** |
| **TrueHit UIP** | 100,824 | 119,479 | **-15.61%** |
| **GA Sessions** | 125,194 | 143,754 | **-12.9%** |
| **GSC Clicks** | 49,700 | 53,700 | **-7.4%** |
| **GSC Impressions** | 4.98M | 4.89M | **+1.8%** |
| **GSC CTR** | 1.0% | 1.1% | **-9.1%** |
| **จำนวนข่าว** | 719 | 729 | **-1.37%** |
| **PV/ข่าว** | 235 | 246 | **-4.47%** |

**จุดสังเกตสำคัญ:** Impressions เพิ่ม +1.8% แต่ Clicks ลดลง -7.4% → CTR ร่วงจาก 1.1% เป็น 1.0% แปลว่า Google แสดงผล TNN มากขึ้น แต่คนคลิกน้อยลง — ปัญหาอยู่ที่ Title/Description ไม่ดึงดูด

---

## 1. SEO Performance (Google Search Console)

### ตัวเลขหลัก
- **Clicks:** 49,700 (↓7.4% จาก 53,700)
- **Impressions:** 4.98M (↑1.8% จาก 4.89M)
- **CTR:** 1.0% (↓จาก 1.1%)
- **Average Position:** 7.1

### Top Keywords by Impressions (W12)

| Keyword | Impressions | Clicks | CTR |
|---|---|---|---|
| สภาพอากาศ | 368,773 | 180 | 0.05% |
| ดาวโจนส์ | 116,809 | 39 | 0.03% |
| พยากรณ์อากาศ | 103,011 | 69 | 0.07% |

**ปัญหาชัดเจน:** Keywords 3 อันดับแรกรวมกัน 588,593 Impressions แต่ได้แค่ 288 Clicks (CTR 0.05%) — เสีย opportunity มหาศาล

### Top Keywords by Clicks (W12)

| Keyword | Clicks | Impressions | CTR |
|---|---|---|---|
| ราคาทองวันนี้ รูปพรรณ | 1,009 | 19,443 | 5.2% |
| tnn16 | 851 | 2,725 | 31.2% |
| tnn | 556 | 1,482 | 37.5% |

**เปลี่ยนจาก W11:** สัปดาห์ก่อน "แอคมี่สามีใคร" ครองอันดับ 1 (2,844 clicks) — สัปดาห์นี้หายไปเพราะกระแสหมด ไม่มี viral content ใหม่มาแทน ทำให้ clicks รวมลดลง

### การเปลี่ยนแปลงเชิง Keyword

- **สภาพอากาศ:** Impressions เพิ่มจาก 255,452 → 368,773 (+44%) แต่ Clicks เพิ่มแค่ 116 → 180 — ตำแหน่งเฉลี่ย 7.5 ไม่ดีพอที่คนจะคลิก
- **ดาวโจนส์:** เป็น keyword ใหม่ที่เข้ามาใน Top 3 (116,809 imp) แทน ราคาทองวันนี้ ที่ลดจาก 241,718 → 54,673 imp
- **Brand keywords (tnn16, tnn, tnn live):** รวมกัน 1,889 clicks จาก 4,989 imp — CTR สูง 37.9% เป็นฐาน traffic ที่แข็งแกร่ง
- **Viral content (W11: แอคมี่):** หายไป — ไม่มี viral keywords ใหม่ทดแทน ทำให้ clicks หดตัว ~4,000 clicks จากส่วนนี้

---

## 2. Traffic Sources (Google Analytics)

### สัดส่วน Sessions W12 vs W11

| ช่องทาง | W12 | W11 | เปลี่ยนแปลง | สัดส่วน W12 |
|---|---|---|---|---|
| **Organic Search** | 62,166 | 67,104 | **-7.4%** | 49.7% |
| **Direct** | 30,261 | 35,844 | **-15.6%** | 24.2% |
| **Organic Social** | 27,049 | 35,401 | **-23.6%** | 21.6% |
| **Referral** | 4,051 | 3,678 | **+10.1%** | 3.2% |
| **Unassigned** | 1,571 | 1,595 | -1.5% | 1.3% |
| **อื่นๆ** | 96 | 132 | -27.3% | <0.1% |
| **รวม** | **125,194** | **143,754** | **-12.9%** | 100% |

### วิเคราะห์

- **Organic Social ลดลงหนักที่สุด (-23.6%):** จาก 35,401 → 27,049 sessions หายไป 8,352 sessions — สาเหตุหลักคือ viral content แอคมี่หมดกระแส ไม่มี viral post ใหม่ทดแทน
- **Direct ลดลง -15.6%:** จาก 35,844 → 30,261 — สะท้อนว่าผู้เข้าชมประจำลดลง อาจเกิดจากไม่มี breaking news ดึงดูด
- **Organic Search ลดลง -7.4%:** จาก 67,104 → 62,166 — สอดคล้องกับ GSC clicks ที่ลดลง 7.4% เช่นกัน
- **Referral เป็นช่องทางเดียวที่โต (+10.1%):** จาก 3,678 → 4,051 — แต่สัดส่วนเล็กมาก (3.2%)

**สัดส่วน traffic เปลี่ยน:** Organic Search ยังครอง 49.7% แต่ Organic Social ลดจาก 24.6% (W11) เหลือ 21.6% (W12)

---

## 3. ภาพรวม Week 12

### Performance ทีม (CMS Data)

| ทีม | PV (W12) | Target/สัปดาห์ | ทำได้ (%) |
|---|---|---|---|
| Online Web | 42,238 | 103,600 | 40.8% |
| Health | 6,205 | 20,300 | 30.6% |
| Wealth | 4,397 | 20,300 | 21.6% |
| Channel | 2,435 | 20,300 | 12.0% |

**ทุกทีมต่ำกว่า Target อย่างมาก** — ทีมที่ดีที่สุด (Online Web) ยังทำได้แค่ 40.8% ของเป้า

### CMS vs TrueHit Gap
- CMS PV: 53,058 / TrueHit PV: 168,770 → **ส่วนต่าง 115,712 PV (68.6%)**
- หมายความว่า 68.6% ของ traffic ไม่ได้มาจากเนื้อหา CMS โดยตรง — มาจาก evergreen content, old articles, หรือ aggregated pages

### อันดับเทียบคู่แข่ง (TrueHit PV)
- TNN อยู่ **อันดับ 8/10** ด้วย 168,770 PV
- BkkBiz นำที่ 2.44M (มากกว่า TNN **14.4 เท่า**)
- PV ลดลงต่อเนื่อง 4 สัปดาห์: 236K → 200K → 179K → 169K (**↓28.4% ใน 4 สัปดาห์**)

### YTD 2026
- TNN YTD: 2,473,196 PV (ณ 22 มี.ค.)
- Annual Target: 15,000,000 PV
- ทำได้: **16.5%** ของเป้าปี (ผ่านมา 22% ของปีแล้ว) → **ตามหลังเป้า**

---

## 4. จุดอ่อน / ปัญหา

1. **CTR ต่ำมากสำหรับ high-impression keywords:** สภาพอากาศ (368K imp, CTR 0.05%), ดาวโจนส์ (116K imp, CTR 0.03%) — Title/Description ไม่ตรง search intent
2. **ไม่มี viral content ทดแทน:** W11 มีกระแส "แอคมี่" ดัน clicks ถึง 2,844 — W12 ไม่มี viral keywords เลย ทำให้ clicks หดตัว
3. **Organic Social ร่วงแรง -23.6%:** สะท้อนว่า social content ขาดแรงดึงดูด ไม่มี shareable content ใหม่
4. **ทุกทีมต่ำกว่า Target:** ทีมที่ดีที่สุดทำได้แค่ 40.8% — Channel ทำได้เพียง 12%
5. **UIP ลดลงรุนแรง -15.61%:** ผู้เข้าชมจริงหายไป 18,655 คน — ปัญหา audience retention
6. **PV/ข่าว ลดลง -4.47%:** ลดจาก 246 → 235 views/ชิ้น แม้ผลิตข่าวใกล้เคียงกัน (719 vs 729) — คุณภาพเนื้อหาเป็นปัจจัย

---

## 5. โอกาส

1. **Impressions เพิ่ม +1.8%:** Google ยังแสดงผล TNN มากขึ้น — มี room สำหรับเพิ่ม CTR ถ้าปรับ Title/Description ให้ดีขึ้น แค่เพิ่ม CTR จาก 1.0% เป็น 1.5% จะได้ clicks เพิ่ม ~24,900/สัปดาห์
2. **Brand keywords แข็งแกร่ง:** tnn16 (CTR 31.2%), tnn (CTR 37.5%) — ฐาน brand loyalty ยังดี ควร leverage ด้วย branded content
3. **ราคาทอง เป็น keyword ที่ clicks ดี:** 1,009 clicks, CTR 5.2% — สร้าง dedicated gold price page ที่ update real-time ได้
4. **Referral เติบโต +10.1%:** ช่องทางเดียวที่โต — มี potential ในการขยาย partnerships
5. **สภาพอากาศ มี 368K impressions:** ถ้าปรับ content ให้ตรง search intent (พยากรณ์อากาศ real-time, interactive weather map) สามารถดึง clicks ได้มหาศาล — แค่ CTR 1% = 3,688 clicks/สัปดาห์
6. **Content Viral Cycle:** ทุก 1-2 สัปดาห์มีกระแสใหม่ (W11: แอคมี่) — ต้อง react เร็วและสร้าง optimized pages สำหรับ trending topics ทันที

---

## 6. Action Plan สัปดาห์หน้า (W13: 23–29 มี.ค.)

### เร่งด่วน (ทำทันที)

| ลำดับ | Action | เป้าหมาย | ผู้รับผิดชอบ |
|---|---|---|---|
| 1 | **ปรับ Meta Title/Description** ของ top 10 pages ที่มี impressions สูงสุดแต่ CTR ต่ำ (สภาพอากาศ, ดาวโจนส์, พยากรณ์อากาศ) | CTR เพิ่มจาก 0.05% → 0.5%+ | SEO / Online Web |
| 2 | **สร้างหน้า "ราคาทองวันนี้" dedicated page** ที่ update real-time พร้อม structured data (Schema Markup) | เพิ่ม clicks จาก 1,009 → 2,000+ | Wealth / Tech |
| 3 | **Monitor trending topics ทุกเช้า** — เตรียม template สำหรับ viral content ให้ publish ภายใน 30 นาทีหลังเกิดกระแส | ทดแทน viral clicks ที่หายไป ~4,000/สัปดาห์ | ทุกทีม |
| 4 | **เพิ่ม Social content ที่ shareable** — Social Talk ให้ผล 5,746 views/ชิ้น ควรผลิตอย่างน้อย 5 ชิ้น/สัปดาห์ | กู้ Organic Social กลับจาก -23.6% | Social Talk / Marketing |

### ระยะสั้น (ภายใน 2 สัปดาห์)

| ลำดับ | Action | เป้าหมาย |
|---|---|---|
| 5 | **Audit สภาพอากาศ content** — เปรียบเทียบกับคู่แข่งที่ได้ clicks จาก keyword เดียวกัน ปรับ format ให้ตรง search intent | ดึง clicks จาก 368K impressions |
| 6 | **เพิ่ม Internal Linking** ระหว่างบทความ related topics — โดยเฉพาะ Wealth (ราคาทอง → หุ้น → ดาวโจนส์) | เพิ่ม pageviews/session |
| 7 | **Channel Team review:** 48 articles/สัปดาห์ ได้แค่ 2,435 views (50 views/ชิ้น) — ต้อง pivot content strategy หรือปรับ distribution | เพิ่มจาก 12% → 25% ของ target |
| 8 | **ขยาย Referral partnerships** — Referral เป็นช่องทางเดียวที่โต (+10.1%) ควรเจรจากับ news aggregators เพิ่มเติม | เพิ่ม Referral จาก 4,051 → 6,000+ |

---

*ข้อจำกัดของข้อมูล: ตัวเลขคู่แข่ง (ยกเว้น TNN) เป็นข้อมูล W11 เนื่องจากหน้า ranking ของ TrueHit ขัดข้อง (404) ในช่วงสัปดาห์ W12 | GA Traffic data มาจาก dashboard ที่ capture ไว้ก่อนหน้า (ช่วง W12) เนื่องจาก GA date filter ผ่าน URL ไม่ทำงานในขณะดึงข้อมูล*

---
Generated: 24 มี.ค. 2569 | Data Sources: Google Search Console, Google Analytics (GA4), TrueHit Analytics, CMS Dashboard
