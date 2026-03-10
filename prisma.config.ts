import "dotenv/config";
import { defineConfig } from "prisma/config";
import { getNormalizedDatabaseUrl } from "./lib/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getNormalizedDatabaseUrl(),
  },
});
