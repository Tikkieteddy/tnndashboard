# TNN Dashboard Auto-Update: Setup Guide

## ภาพรวมระบบ

```
GitHub Pages (Frontend)  →  Google Apps Script (Backend)  →  Google Sheets / GSC / GA4
     HTML + JS                     Web App API                    Data Sources
```

Dashboard จะดึงข้อมูลอัตโนมัติทุกครั้งที่เปิดหน้าเว็บ ไม่ต้องมาแก้ HTML อีกต่อไป

---

## ขั้นตอนที่ 1: สร้าง Google Apps Script Project

1. เปิด https://script.google.com
2. กด **"New project"** (โปรเจกต์ใหม่)
3. ลบ Code.gs เดิมที่มีอยู่ทิ้งทั้งหมด
4. Copy เนื้อหาจากไฟล์ `Code.gs` ในโฟลเดอร์นี้ ไปวางแทน
5. ตั้งชื่อโปรเจกต์: **"TNN Dashboard API"**
6. กด **Ctrl+S** (Save)

## ขั้นตอนที่ 2: ตั้งค่า CONFIG

แก้ไขบรรทัดต้นๆ ของ Code.gs:

```javascript
const CONFIG = {
  SHEET_ID: '1vuHDop1s4ZmydRIJsg0O26O1TsUKyeac0iU06Cl6NNY',  // ← ใช้ค่านี้ได้เลย
  GSC_SITE_URL: 'https://www.tnnthailand.com/',                 // ← ใช้ค่านี้ได้เลย
  GA4_PROPERTY_ID: 'ใส่ GA4 Property ID ตรงนี้',                // ← ต้องหาจาก GA4
  CACHE_SECONDS: 3600,
};
```

### หา GA4 Property ID:
1. เปิด Google Analytics 4: https://analytics.google.com
2. กด **Admin** (ล่างซ้าย)
3. เลือก Property ของ tnnthailand.com
4. ดูตรง **Property Settings** → **Property ID** (ตัวเลข เช่น `123456789`)
5. Copy ตัวเลขนี้ไปใส่ใน CONFIG

## ขั้นตอนที่ 3: เปิด API Services

1. ใน Apps Script editor กดเมนู **Services** (ไอคอน + ข้างๆ Libraries)
2. เพิ่ม services เหล่านี้:
   - **Google Sheets API** (v4)
   - **Google Search Console API** (v1) — *ถ้ามีในรายการ*
3. กด **Add**

> หมายเหตุ: GSC API ถูกเรียกผ่าน UrlFetchApp + OAuth token โดยตรง ไม่จำเป็นต้องเพิ่ม service ก็ได้ แต่ถ้ามีให้เพิ่มก็ดี

## ขั้นตอนที่ 4: Deploy เป็น Web App

1. กดเมนู **Deploy** → **New deployment**
2. กดไอคอน gear ⚙️ → เลือก **Web app**
3. ตั้งค่า:
   - **Description**: `TNN Dashboard API v1`
   - **Execute as**: `Me (your email)`
   - **Who has access**: `Anyone`
4. กด **Deploy**
5. **สำคัญ!** Copy URL ที่ได้ (จะมีรูปแบบประมาณนี้):
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
6. เก็บ URL นี้ไว้ — ต้องใส่ใน dashboard HTML

## ขั้นตอนที่ 5: ทดสอบ API

เปิด URL นี้ในเบราว์เซอร์:

```
https://script.google.com/macros/s/YOUR_ID/exec?action=sheets
```

ถ้าทำงานถูกต้อง จะเห็น JSON data ของ Sheets

ทดสอบ endpoint อื่น:
- `?action=gsc` — ข้อมูล Search Console
- `?action=ga4` — ข้อมูล Google Analytics 4
- `?action=all` — ข้อมูลทั้งหมดรวมกัน
- `?action=sheets&week=week13` — ข้อมูล Sheets สัปดาห์ที่ 13

## ขั้นตอนที่ 6: ใส่ URL ใน Dashboard

เปิดไฟล์ `web_all_dynamic.html` แล้วแก้บรรทัด:

```javascript
const API_BASE = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

แทนที่ `YOUR_DEPLOYMENT_ID` ด้วย URL จริงที่ได้จากขั้นตอนที่ 4

## ขั้นตอนที่ 7: Push ขึ้น GitHub

1. เปิด GitHub Desktop
2. Commit ไฟล์ `web_all_dynamic.html`
3. Push to origin

---

## การอัปเดต Apps Script

เมื่อต้องการแก้ไข Code.gs:
1. แก้ไขใน Apps Script editor
2. กด **Deploy** → **Manage deployments**
3. กดไอคอนดินสอ ✏️ ที่ deployment เดิม
4. เปลี่ยน **Version** เป็น **New version**
5. กด **Deploy**

> สำคัญ: ต้องสร้าง New version ทุกครั้งที่แก้ code ไม่งั้นจะยังใช้ code เก่าอยู่

---

## Troubleshooting

| ปัญหา | วิธีแก้ |
|--------|---------|
| CORS error | ตรวจสอบว่า Deploy เป็น "Anyone" access |
| 403 Forbidden | ต้อง Authorize ก่อน — เปิด Apps Script แล้วรัน `doGet` ด้วยมือ กด Allow |
| GSC ไม่มีข้อมูล | ตรวจสอบว่า Google account มีสิทธิ์เข้าถึง Search Console ของ tnnthailand.com |
| GA4 error | ตรวจสอบ GA4_PROPERTY_ID ว่าถูกต้อง |
| Cache เก่า | Cache จะหมดอายุใน 1 ชั่วโมง หรือรอ 60 นาที |

---

## Architecture Notes

- **Caching**: ข้อมูลถูก cache 1 ชั่วโมงใน Apps Script CacheService เพื่อลดการเรียก API
- **Free tier**: Google Apps Script มี quota:
  - 20,000 URL fetches/วัน
  - 6 นาที execution time/call
  - เพียงพอสำหรับ dashboard ขนาดนี้
- **Security**: Web app ทำงานในบัญชีของเจ้าของ ข้อมูล Sheets/GSC/GA4 เข้าถึงผ่าน OAuth ของเจ้าของ
