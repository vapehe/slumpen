import { getDb } from "$lib/db";
import type { RandomnessReport } from "./api";

export type RandomnessSource = "synthetic" | "historical";

export async function saveReport(
  report: RandomnessReport,
  source: RandomnessSource,
  minVal: number,
  maxVal: number,
  notes?: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO randomness_tests (
      source, sample_size, min_value, max_value,
      chi_square_stat, chi_square_p, chi_square_passed,
      runs_stat, runs_p, runs_passed,
      serial_correlation, overall_passed, frequency_json, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      source,
      report.sample_size,
      minVal,
      maxVal,
      report.chi_square_stat,
      report.chi_square_p,
      report.chi_square_passed ? 1 : 0,
      report.runs_stat,
      report.runs_p,
      report.runs_passed ? 1 : 0,
      report.serial_correlation,
      report.overall_passed ? 1 : 0,
      JSON.stringify(report.frequency),
      notes ?? null,
    ],
  );
}

export type RandomnessTestRow = {
  id: number;
  created_at: string;
  source: RandomnessSource;
  sample_size: number;
  min_value: number;
  max_value: number;
  chi_square_stat: number;
  chi_square_p: number;
  chi_square_passed: number | boolean;
  runs_stat: number;
  runs_p: number;
  runs_passed: number | boolean;
  serial_correlation: number;
  overall_passed: number | boolean;
  frequency_json: string;
  notes: string | null;
};

export async function getRecentReports(limit = 20): Promise<RandomnessTestRow[]> {
  const db = await getDb();
  return db.select<RandomnessTestRow[]>(
    "SELECT * FROM randomness_tests ORDER BY created_at DESC LIMIT $1",
    [limit],
  );
}

