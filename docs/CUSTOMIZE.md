# แนวทางพัฒนาต่อ

โปรเจคนี้เปลี่ยนจาก starter เป็น Cataract Outcome แล้ว สัญญาปัจจุบันอยู่ใน ARCHITECTURE.md และ SECURITY.md เอกสาร starter หรือ collection `items` เดิมไม่ใช่ฟอร์มหลักอีกต่อไป

## เพิ่ม/เปลี่ยนข้อมูล

1. สร้าง migration ใหม่ใน `pocketbase/pb_migrations/` ห้ามแก้ migration ที่นำไปใช้แล้ว ออกแบบ backfill สำหรับข้อมูลเดิมเมื่อเพิ่ม required field
2. เพิ่ม/แก้ field metadata ใน `public/app.js` (groups / fieldNames), writable whitelist และ validation ใน `pocketbase/pb_hooks/cataract.pb.js`
3. หากเปลี่ยน KPI ให้ปรับ pure functions ใน `public/clinical.js`, คำอธิบายตัวตั้ง/ตัวหารใน UI และ tests/cataract-tests.mjs พร้อมกัน เกณฑ์ทางคลินิกต้องรับรองโดยหน่วยงาน
4. ตรวจ privacy masking และ audit redaction สำหรับฟิลด์ใหม่ทุกครั้ง โดยเฉพาะข้อมูลระบุตัวบุคคล
5. รัน `node tests/integration.mjs` บน OS Temp และตรวจหน้า desktop/mobile ห้ามใช้ฐานข้อมูลจริง
6. เปลี่ยน asset `?v=` ทุกตัวใน index.html และ register.html เป็น Asia/Bangkok YYYYMMDDHHmm ค่าเดียวกัน ตรวจ JS/PowerShell/Bash syntax และ git diff --check
7. อัปเดต README, HANDOFF และเอกสารสัญญาที่เกี่ยวข้อง

## ขอบเขตระบบ

ข้อมูลเป็นทีมเดียว ไม่มี tenant หรือ ownership isolation หากเพิ่มองค์กร/แผนก ต้องบังคับ relation และสิทธิ์ผ่าน API rules พร้อมทดสอบข้ามองค์กร ห้ามอาศัย UI filters

KPI Monitoring, Data Import, Master Data และ Settings ไม่มีหน้าในขอบเขตรอบนี้ หากเพิ่มภายหลังให้สร้าง migration, validation, audit และสิทธิ์ที่เหมาะสม ไม่ใช้ localStorage เป็นฐานข้อมูล

## การตั้งค่าเป้าหมาย

Admin เพิ่มและแก้เป้าหมายจากเมนูเป้าหมาย KPI ได้ โดยใช้สูตรเดิมหรือกำหนดตัวตั้ง/ตัวหาร/เงื่อนไขด้วยตัวสร้างสูตร ร้อยละและค่าเฉลี่ย Pain score รองรับใน `public/kpi-formula.js` โมดูลนี้ใช้ทั้ง browser, server validation และ tests หากเพิ่มฟิลด์หรือตัวเปรียบเทียบ ให้ปรับ whitelist/validation/calculation พร้อมกันและทดสอบข้อมูลขาดกับ privacy ห้ามใช้ eval หรือ SQL ที่ผู้ใช้กรอก

ชื่อ/แหล่งข้อมูล/สูตร/ทิศทางแก้ไม่ได้หลังสร้าง ส่วน target/min_sample/enabled แก้ได้ ไม่มี target version ตามวันเริ่มใช้ เกณฑ์ล่าสุดใช้ทุกช่วงเวลา อ่านขั้นตอนและตัวอย่างสูตรใน README ห้ามกรอก superuser credentials ใน public config.js เริ่มต้นเป้าหมายทั้งหมดปิดเพื่อไม่ตีความข้อมูลด้วยเกณฑ์ที่ยังไม่รับรอง
