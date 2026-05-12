import { Pool } from "pg";
import fs from "fs";
import path from "path";

export async function runInspectionMigration(): Promise<{ ok: boolean; message: string }> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const sqlPath = path.join(process.cwd(), "supabase/migrations/034_inspection_wizard.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Run the whole migration as a single query (pg supports multi-statement)
    await pool.query(sql);
    return { ok: true, message: "Migration 034 applied successfully." };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, message };
  } finally {
    await pool.end();
  }
}
