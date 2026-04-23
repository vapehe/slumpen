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

/** Rå rad från SQLite (boolean sparas som 0/1) */
type LotteryRow = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  num_draws: number;
  with_replacement: number | boolean;
  name_column: string;
  seed: string | null;
};

function rowToLottery(row: LotteryRow): Lottery {
  const wr = row.with_replacement;
  return {
    ...row,
    with_replacement: wr === true || wr === 1,
  };
}

export async function createLottery(
  name: string,
  description: string | null,
  numDraws: number,
  withReplacement: boolean,
  nameColumn: string,
  seed: string,
): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO lotteries (name, description, num_draws, with_replacement, name_column, seed)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [name, description, numDraws, withReplacement ? 1 : 0, nameColumn, seed],
  );
  if (result.lastInsertId != null) {
    return result.lastInsertId;
  }
  const fallback = await database.select<Array<{ last_id: number }>>(
    "SELECT last_insert_rowid() AS last_id",
  );
  const id = fallback[0]?.last_id;
  if (id == null) {
    throw new Error("Kunde inte hämta id för nytt lotteri.");
  }
  return id;
}

export async function addParticipants(
  lotteryId: number,
  participants: { rowIndex: number; data: Record<string, string> }[],
): Promise<void> {
  const database = await getDb();
  for (const p of participants) {
    await database.execute(
      "INSERT INTO participants (lottery_id, row_index, data_json) VALUES ($1, $2, $3)",
      [lotteryId, p.rowIndex, JSON.stringify(p.data)],
    );
  }
}

export async function getAllLotteries(): Promise<Lottery[]> {
  const database = await getDb();
  const rows = await database.select<LotteryRow[]>(
    "SELECT * FROM lotteries ORDER BY created_at DESC",
  );
  return rows.map(rowToLottery);
}

export async function getLotteryById(id: number): Promise<Lottery | null> {
  const database = await getDb();
  const results = await database.select<LotteryRow[]>(
    "SELECT * FROM lotteries WHERE id = $1",
    [id],
  );
  const row = results[0];
  return row ? rowToLottery(row) : null;
}

export async function getParticipantsByLottery(lotteryId: number): Promise<Participant[]> {
  const database = await getDb();
  return database.select<Participant[]>(
    "SELECT * FROM participants WHERE lottery_id = $1 ORDER BY row_index ASC",
    [lotteryId],
  );
}

export async function saveDraws(
  lotteryId: number,
  draws: { position: number; participantId: number }[],
): Promise<void> {
  const database = await getDb();
  for (const draw of draws) {
    await database.execute(
      "INSERT INTO draws (lottery_id, position, participant_id) VALUES ($1, $2, $3)",
      [lotteryId, draw.position, draw.participantId],
    );
  }
}

export async function getDrawsByLottery(lotteryId: number): Promise<Draw[]> {
  const database = await getDb();
  return database.select<Draw[]>(
    "SELECT * FROM draws WHERE lottery_id = $1 ORDER BY position ASC",
    [lotteryId],
  );
}
