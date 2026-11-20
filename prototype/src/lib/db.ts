import { PrismaClient } from "@prisma/client";

// One Prisma client per process. In development Next.js reloads modules on
// every edit, so the instance is cached on globalThis to avoid exhausting
// SQLite connections. This module is server-only; never import it in browser code.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
