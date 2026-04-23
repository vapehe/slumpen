import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:app.db");
  }
  return db;
}

export interface Lottery {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  num_draws: number;
  with_replacement: boolean;
  name_column: string;
  seed: string | null;
}

export interface Participant {
  id: number;
  lottery_id: number;
  row_index: number;
  data_json: string; // JSON-sträng
}

export interface Draw {
  id: number;
  lottery_id: number;
  position: number;
  participant_id: number;
  drawn_at: string;
}

/** Parsed participant data (efter JSON.parse av data_json) */
export interface ParticipantData {
  [key: string]: string;
}
