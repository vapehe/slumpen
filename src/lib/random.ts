import { invokeTauri } from "./tauri-error";

export async function generateSeed(): Promise<string> {
  return invokeTauri("generate_seed");
}

export async function drawWinners(
  participantIds: number[],
  numDraws: number,
  withReplacement: boolean,
  seed: string,
): Promise<number[]> {
  return invokeTauri("draw_winners", {
    participantIds,
    numDraws,
    withReplacement,
    seed,
  });
}

export async function simulateSyntheticDraws(
  numOutcomes: number,
  sampleSize: number,
  seed: string,
): Promise<number[]> {
  return invokeTauri("simulate_synthetic_draws", {
    numOutcomes,
    sampleSize,
    seed,
  });
}
