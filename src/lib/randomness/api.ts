import { invokeTauri } from "$lib/tauri-error";

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
  return invokeTauri("run_randomness_tests", { draws, minVal, maxVal });
}

