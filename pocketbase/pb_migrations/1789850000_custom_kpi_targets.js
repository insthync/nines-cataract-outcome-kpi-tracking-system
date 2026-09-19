migrate((app) => {
  const collection = app.findCollectionByNameOrId("kpi_targets");
  collection.fields.add(new SelectField({name: "source", values: ["va_outcome", "endophthalmitis", "wound_leak", "reoperation", "biometry", "refractive"], maxSelect: 1}));
  app.save(collection);
  // Preserve existing targets and metadata; this is a schema backfill, not a user edit.
  app.db().newQuery("UPDATE kpi_targets SET source = key").execute();
  collection.fields.getByName("source").required = true;
  collection.createRule = '@request.auth.id != "" && @request.auth.collectionName = "users" && @request.auth.active = true && @request.auth.role = "admin"';
  collection.indexes.push('CREATE UNIQUE INDEX idx_kpi_label ON kpi_targets (label COLLATE NOCASE)');
  app.save(collection);
}, (app) => {
  // Do not silently discard custom definitions on rollback.
  const custom = app.findRecordsByFilter("kpi_targets", 'key ~ "custom_"', "", 1, 0);
  if (custom.length) throw new Error("Disable/remove custom KPI definitions with an operator-reviewed plan before rollback.");
  const collection = app.findCollectionByNameOrId("kpi_targets");
  collection.createRule = null;
  collection.fields.removeByName("source");
  collection.indexes = collection.indexes.filter(index => !index.includes("idx_kpi_label"));
  app.save(collection);
});
