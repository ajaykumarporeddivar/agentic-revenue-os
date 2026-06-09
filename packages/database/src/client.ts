import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const globalForDb = globalThis as unknown as { db: ReturnType<typeof drizzle> | undefined };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const queryClient = postgres(url, { prepare: false });
  return drizzle(queryClient, { schema });
}

function getDb() {
  if (!globalForDb.db) {
    globalForDb.db = createClient();
  }
  return globalForDb.db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  },
});

export { schema };
export type DB = ReturnType<typeof drizzle>;
