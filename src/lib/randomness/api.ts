import { invoke } from "@tauri-apps/api/core";

export interface RandomnessReport {
  chi_square_stat: number;
  chi_square_p: number;
  chi_square_passed: boolean;
  runs_stat: number;
  runs_p: number;
  runs_passed: boolean;
  serial_correlation: number;
  frequency: number[];
  sample_size: number;
  overall_passed: boolean;
}

export async function runRandomnessTests(
  draws: number[],
  minVal: number,
  maxVal: number,
): Promise<RandomnessReport> {
  return invoke("run_randomness_tests", { draws, min_val: minVal, max_val: maxVal });
}

