import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false,
  max: 1,
  // Use SSL in production (Render) but not locally
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
  // Explicit connect timeout to fail fast rather than hang
  connect_timeout: 10,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
