migrate((app) => {
  const collection=app.findCollectionByNameOrId("kpi_targets");
  collection.fields.getByName("source").values=["va_outcome","endophthalmitis","wound_leak","reoperation","biometry","refractive","custom"];
  collection.fields.add(new JSONField({name:"formula",maxSize:12000}));
  app.save(collection);
}, (app) => {
  if(app.findRecordsByFilter("kpi_targets",'source = "custom"',"",1,0).length) throw new Error("Custom formulas exist; review their retention before rollback.");
  const collection=app.findCollectionByNameOrId("kpi_targets");
  collection.fields.removeByName("formula");
  collection.fields.getByName("source").values=["va_outcome","endophthalmitis","wound_leak","reoperation","biometry","refractive"];
  app.save(collection);
});
