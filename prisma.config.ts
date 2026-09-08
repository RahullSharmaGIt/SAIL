// prisma.config.ts
import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config"; // 💡 Import your DB engine helper

export default definePrismaConfig({
  schema: "prisma/schema.prisma",

  // 💡 Nest DB settings inside the 'orm' envelope using native process.env
  orm: ormConfig({
    contract: "./prisma/schema.prisma", 
    db: {
      connection: process.env.DATABASE_URL!, 
    },
  }),

  // Your skills block remains perfectly valid here
  skills: {
    agents: ["claude", "cursor", "agents", "devin"],
  },
});
