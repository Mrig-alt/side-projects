import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false,
  max: 5,
  ssl: "require",
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 300,
});
export const db = drizzle(client, { schema });
