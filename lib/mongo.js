import dns from "node:dns";
import { MongoClient } from "mongodb";

async function connectableUri(uri) {
  if (!uri.startsWith("mongodb+srv://")) return uri;
  const parsed = new URL(uri.replace("mongodb+srv://", "https://"));
  const resolver = new dns.promises.Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  const host = parsed.hostname;
  const [srv, txt] = await Promise.all([
    resolver.resolveSrv(`_mongodb._tcp.${host}`),
    resolver.resolveTxt(host).catch(() => []),
  ]);
  const hosts = srv.map((item) => `${item.name}:${item.port || 27017}`).join(",");
  const params = new URLSearchParams(txt.flat().join(""));
  params.set("ssl", "true");
  if (!params.get("authSource")) params.set("authSource", "admin");
  const dbName = parsed.pathname.replace(/^\//, "") || "quotedesk";
  const user = encodeURIComponent(decodeURIComponent(parsed.username));
  const pass = encodeURIComponent(decodeURIComponent(parsed.password));
  return `mongodb://${user}:${pass}@${hosts}/${dbName}?${params.toString()}`;
}

const globalMongo = globalThis;

function cache() {
  if (!globalMongo.__quotedeskMongo || globalMongo.__quotedeskMongo.version !== 2) {
    globalMongo.__quotedeskMongo = { promise: null, indexed: false, version: 2 };
  }
  return globalMongo.__quotedeskMongo;
}

async function ensureIndexes(db) {
  await db.collection("shops").createIndex({ email: 1 }, { unique: true });
  await db.collection("leads").createIndex({ shopId: 1, number: 1 }, { unique: true });
  await db.collection("leads").createIndex({ shopId: 1, customerEmail: 1 });
  await db.collection("leads").createIndex({ shopId: 1, customerPhone: 1 });
  await db.collection("messages").createIndex({ shopId: 1, externalId: 1 }, { unique: true });
  await db.collection("messages").createIndex({ leadId: 1, at: 1 });
}

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const slot = cache();
  if (!slot.promise) {
    const client = new MongoClient(await connectableUri(uri));
    slot.promise = client.connect().catch((error) => {
      slot.promise = null;
      throw error;
    });
  }
  const client = await slot.promise;
  const db = client.db();
  if (!slot.indexed) {
    slot.indexed = true;
    try {
      await ensureIndexes(db);
    } catch (error) {
      slot.indexed = false;
      throw error;
    }
  }
  return db;
}

export function docOf(result) {
  if (!result) return null;
  if (
    Object.prototype.hasOwnProperty.call(result, "ok") &&
    Object.prototype.hasOwnProperty.call(result, "value")
  ) {
    return result.value;
  }
  return result;
}
