// Request metadata is server-owned. Model hooks validate even non-HTTP saves.
function stampCataract(e) {
  const body = e.requestInfo().body || {};
  if (!e.hasSuperuserAuth() && ["created_by", "updated_by", "created", "updated"].some(k => Object.hasOwn(body, k))) throw new BadRequestError("ประวัติผู้บันทึกกำหนดโดยเซิร์ฟเวอร์");
  if (!e.hasSuperuserAuth()) {
    const permitted = e.record.collection().name === "cases"
      ? ["hn", "patient_name", "surgery_date", "surgeon", "diagnosis", "procedure", "eye", "anesthesia", "surgery_time", "preop_va", "implant", "lens_type", "guidance", "day1_date", "day1_va", "week1_date", "week1_va", "month1_date", "month1_va", "va_outcome", "endophthalmitis", "wound_leak", "reoperation", "biometry", "refractive", "pain_score", "notes", "revision", "archived"]
      : e.record.collection().name === "quality_actions" ? ["month", "due_date", "title", "owner", "stage", "detail"] : e.record.isNew() ? ["label", "source", "target", "enabled", "min_sample"] : ["target", "enabled", "min_sample"];
    if (Object.keys(body).some(k => !permitted.includes(k))) throw new BadRequestError("มีฟิลด์ที่ไม่อนุญาตให้แก้ไข");
  }
  if (e.record.collection().name === "kpi_targets" && e.record.isNew()) {
    e.record.set("key", "custom_" + $security.randomString(20));
    e.record.set("direction", ["va_outcome", "biometry", "refractive"].includes(e.record.getString("source")) ? "gte" : "lte");
  }
  if (e.record.collection().name === "cases") {
    if (!e.hasSuperuserAuth() && e.auth?.getString("role") !== "admin" && Object.hasOwn(body, "archived")) throw new ForbiddenError("เฉพาะผู้ดูแลที่ยกเลิกหรือคืนรายการได้");
    if (!e.record.isNew() && Number(body.revision) !== e.record.original().getInt("revision")) throw new ApiError(409, "ข้อมูลเปลี่ยนแปลงแล้ว กรุณาปิดฟอร์มและโหลดใหม่");
    e.record.set("revision", e.record.isNew() ? 1 : e.record.original().getInt("revision") + 1);
  }
  const actor = e.auth ? e.auth.id : "system";
  if (e.record.isNew()) e.record.set("created_by", actor);
  e.record.set("updated_by", actor);
  e.next();
}
onRecordCreateRequest(stampCataract, "cases", "quality_actions", "kpi_targets");
onRecordUpdateRequest(stampCataract, "cases", "quality_actions", "kpi_targets");
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth() && Object.keys(e.requestInfo().body || {}).some(k => !["target", "enabled", "min_sample"].includes(k))) throw new BadRequestError("ปรับได้เฉพาะเป้าหมาย สถานะ และจำนวนตัวอย่างขั้นต่ำ");
  e.next();
}, "kpi_targets");

onRecordValidate((e) => {
  const label = e.record.getString("label").trim();
  if (!label) throw new BadRequestError("กรุณาระบุชื่อ KPI");
  e.record.set("label", label);
  e.next();
}, "kpi_targets");

onRecordValidate((e) => {
  const r = e.record;
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value + "T00:00:00Z").getTime()) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
  const fields = r.collection().name === "cases" ? ["hn", "patient_name", "surgeon", "procedure"] : ["title", "owner"];
  fields.forEach(k => { const v = r.getString(k).trim(); if (!v) throw new BadRequestError("กรุณากรอกข้อมูลบังคับให้ครบ"); r.set(k, v); });
  if (r.collection().name === "cases") {
    const surgery = r.getString("surgery_date");
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    if (!validDate(surgery) || surgery > today) throw new BadRequestError("วันที่ผ่าตัดไม่ถูกต้องหรืออยู่ในอนาคต");
    if (!/^[A-Za-z0-9-]+$/.test(r.getString("hn"))) throw new BadRequestError("HN ใช้ตัวอักษรอังกฤษ ตัวเลข และขีดเท่านั้น");
    r.set("hn", r.getString("hn").toUpperCase());
    ["day1", "week1", "month1"].forEach(p => {
      const date = r.getString(p + "_date"), va = r.getString(p + "_va");
      if (date && (!validDate(date) || date < surgery || date > today)) throw new BadRequestError("วันที่ติดตามผลต้องอยู่ระหว่างวันผ่าตัดและวันนี้");
      if (Boolean(date) !== Boolean(va)) throw new BadRequestError("กรอกวันที่ติดตามผลและ VA คู่กัน");
    });
    const d1 = r.getString("day1_date"), w1 = r.getString("week1_date"), m1 = r.getString("month1_date");
    if ((d1 && w1 && d1 > w1) || (w1 && m1 && w1 > m1) || (d1 && m1 && d1 > m1)) throw new BadRequestError("ลำดับวันที่ติดตามผลไม่ถูกต้อง");
    if (r.getString("va_outcome") && !m1) throw new BadRequestError("ผล VA 1 เดือนต้องมีวันที่และค่า VA");
    const pain = r.getString("pain_score");
    if (pain && (!/^(10|[0-9])(\.0)?$/.test(pain))) throw new BadRequestError("Pain score ต้องเป็นจำนวนเต็ม 0–10");
    const time = r.getString("surgery_time");
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new BadRequestError("เวลาไม่ถูกต้อง");
  } else if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.getString("month")) || !validDate(r.getString("due_date"))) throw new BadRequestError("เดือนหรือวันครบกำหนดไม่ถูกต้อง");
  e.next();
}, "cases", "quality_actions");

// Data change and audit record commit together. Audit never includes patient identifiers.
function auditCataract(e) {
  const isNew = e.record.isNew();
  // Original schema migration seeds definitions before audit_logs exists.
  if (isNew && e.record.collection().name === "kpi_targets" && !e.record.getString("created_by")) { e.next(); return; }
  const before = e.record.original().publicExport();
  e.app.runInTransaction(tx => {
    e.app = tx;
    if (!isNew && e.record.collection().name === "cases") {
      const current = tx.findRecordById("cases", e.record.id);
      if (current.getInt("revision") !== e.record.getInt("revision") - 1) throw new ApiError(409, "ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่");
    }
    e.next();
    const after = e.record.publicExport(), changes = {};
    Object.keys(after).forEach(k => { if (JSON.stringify(before[k]) !== JSON.stringify(after[k]) && !["collectionId", "collectionName", "id"].includes(k)) changes[k] = ["hn", "patient_name", "notes", "detail"].includes(k) ? "changed (private)" : { before: before[k], after: after[k] }; });
    const log = new Record(tx.findCollectionByNameOrId("audit_logs"));
    log.load({ entity: e.record.collection().name, record_id: e.record.id, actor: e.record.getString("updated_by") || "system", operation: isNew ? "create" : "update", changes });
    tx.save(log);
  });
}
onRecordCreate(auditCataract, "cases", "quality_actions", "kpi_targets");
onRecordUpdate(auditCataract, "cases", "quality_actions", "kpi_targets");

onRecordEnrich((e) => {
  if (!e.requestInfo.hasSuperuserAuth() && e.requestInfo.auth?.getString("role") === "viewer") {
    e.record.set("hn", "••••" + e.record.getString("hn").slice(-2));
    e.record.set("patient_name", "ปกปิดชื่อผู้ป่วย");
    e.record.hide("notes");
  }
  e.next();
}, "cases");
