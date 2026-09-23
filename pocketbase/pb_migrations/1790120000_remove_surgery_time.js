migrate((app) => {
  const collection = app.findCollectionByNameOrId("cases");
  collection.fields.removeByName("surgery_time");
  app.save(collection);
}, (app) => {
  // Rollback restores the optional field only; deleted values cannot be recovered.
  const collection = app.findCollectionByNameOrId("cases");
  collection.fields.add(new TextField({name:"surgery_time",max:5}));
  app.save(collection);
});
