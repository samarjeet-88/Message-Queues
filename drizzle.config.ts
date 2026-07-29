import { defineConfig } from "drizzle-kit";
import "dotenv/config";

const dbUrl = `postgresql://${process.env.dbUsername}:${process.env.dbPassword}@${process.env.dbHost}:${process.env.dbPort}/${process.env.dbName}`;

export default defineConfig({
  dialect: "postgresql",
  schema: "./01Redis/table.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbUrl,
  },
});
