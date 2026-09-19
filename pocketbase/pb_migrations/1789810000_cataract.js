migrate((app) => {
  const active = '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true';
  const writer = `(${active}) && (@request.auth.role = "editor" || @request.auth.role = "admin")`;
  const admin = `(${active}) && @request.auth.role = "admin"`;
  const text = (name, max = 120, required = false) => ({ type: "text", name, max, required });
  const choice = (name, values, required = false) => ({ type: "select", name, values, required, maxSelect: 1 });
  const stamps = () => [text("created_by"), text("updated_by"), { type: "autodate", name: "created", onCreate: true }, { type: "autodate", name: "updated", onCreate: true, onUpdate: true }];
  app.save(new Collection({ name: "cases", type: "base", listRule: active, viewRule: active, createRule: writer, updateRule: writer, deleteRule: null,
    fields: [text("hn", 30, true), text("patient_name", 200, true), text("surgery_date", 10, true), text("surgeon", 120, true), text("diagnosis", 200), text("procedure", 120, true), choice("eye", ["OD", "OS", "OU"], true), text("anesthesia"), text("surgery_time", 5), text("preop_va", 30), text("implant"), text("lens_type"), choice("guidance", ["Callisto", "Verion", "None"]),
      ...["day1", "week1", "month1"].flatMap(p => [text(p + "_date", 10), text(p + "_va", 30)]),
      ...["va_outcome", "biometry", "refractive"].map(n => choice(n, ["pass", "fail"])),
      ...["endophthalmitis", "wound_leak", "reoperation"].map(n => choice(n, ["yes", "no"])),
      text("pain_score", 4), text("notes", 4000), { type: "bool", name: "archived" }, { type: "number", name: "revision", onlyInt: true, min: 1 }, ...stamps()],
    indexes: ['CREATE UNIQUE INDEX idx_cases_identity ON cases (hn, surgery_date, eye) WHERE archived = false', 'CREATE INDEX idx_cases_surgery ON cases (surgery_date)'] }));
  app.save(new Collection({ name: "kpi_targets", type: "base", listRule: active, viewRule: active, createRule: null, updateRule: admin, deleteRule: null,
    fields: [text("key", 40, true), text("label", 120, true), { type: "number", name: "target", min: 0, max: 100 }, { type: "bool", name: "enabled" }, { type: "number", name: "min_sample", min: 1, onlyInt: true, required: true }, choice("direction", ["gte", "lte"], true), ...stamps()], indexes: ['CREATE UNIQUE INDEX idx_kpi_key ON kpi_targets (key)'] }));
  const defs = [["va_outcome", "VA 1 เดือน >6/12", "gte"], ["endophthalmitis", "Endophthalmitis", "lte"], ["wound_leak", "Wound leak", "lte"], ["reoperation", "Re-operation", "lte"], ["biometry", "Biometry ±0.50D", "gte"], ["refractive", "Refractive outcome ±1.0D", "gte"]];
  defs.forEach(([key, label, direction]) => { const r = new Record(app.findCollectionByNameOrId("kpi_targets")); r.load({key, label, direction, target: 0, enabled: false, min_sample: 1}); app.save(r); });
  app.save(new Collection({ name: "quality_actions", type: "base", listRule: active, viewRule: active, createRule: writer, updateRule: writer, deleteRule: null,
    fields: [text("month", 7, true), text("title", 200, true), text("owner", 120, true), choice("stage", ["plan", "do", "check", "act"], true), text("due_date", 10, true), text("detail", 4000), ...stamps()] }));
  app.save(new Collection({ name: "audit_logs", type: "base", listRule: admin, viewRule: admin, createRule: null, updateRule: null, deleteRule: null,
    fields: [text("entity", 40, true), text("record_id", 30, true), text("actor", 120, true), text("operation", 30, true), { type: "json", name: "changes", maxSize: 30000 }, { type: "autodate", name: "created", onCreate: true }] }));
  // Preserve legacy data but retire the starter API for application accounts.
  const legacy = app.findCollectionByNameOrId("items");
  legacy.listRule = legacy.viewRule = legacy.createRule = legacy.updateRule = legacy.deleteRule = null;
  app.save(legacy);
  const settings = app.settings(); settings.meta.appName = "nines-cataract-outcome-kpi-tracking-system"; app.save(settings);
}, (app) => {
  ["audit_logs", "quality_actions", "kpi_targets", "cases"].forEach(n => app.delete(app.findCollectionByNameOrId(n)));
  const active = '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true';
  const writer = `(${active}) && (@request.auth.role = "editor" || @request.auth.role = "admin")`;
  const legacy = app.findCollectionByNameOrId("items");
  legacy.listRule = legacy.viewRule = active;
  legacy.createRule = legacy.updateRule = legacy.deleteRule = writer;
  app.save(legacy);
  const settings = app.settings(); settings.meta.appName = "pb-crud-app-starter"; app.save(settings);
});
