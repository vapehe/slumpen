import { invoke } from "@tauri-apps/api/core";

export async function generateSeed(): Promise<string> {
  return invoke("generate_seed");
}

export async function drawWinners(
  participantIds: number[],
  numDraws: number,
  withReplacement: boolean,
  seed: string,
): Promise<number[]> {
  return invoke("draw_winners", {
    participant_ids: participantIds,
    num_draws: numDraws,
    with_replacement: withReplacement,
    seed,
  });
}

export async function simulateSyntheticDraws(
  numOutcomes: number,
  sampleSize: number,
  seed: string,
): Promise<number[]> {
  return invoke("simulate_synthetic_draws", {
    num_outcomes: numOutcomes,
    sample_size: sampleSize,
    seed,
  });
}
