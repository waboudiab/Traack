const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const server = await MongoMemoryServer.create({
    instance: { port: 62710, dbName: "quotedesk" },
  });
  console.log("URI " + server.getUri("quotedesk"));
  setInterval(() => {}, 1 << 30);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
