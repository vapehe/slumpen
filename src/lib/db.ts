import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:app.db");
  }
  return db;
}

/** Valfria kontaktuppgifter för en signatär (PDF-protokoll). */
export interface ProtocolSignatoryContact {
  name?: string;
  email?: string;
  mobile?: string;
}

export interface ProtocolSignatories {
  drawingOfficial?: ProtocolSignatoryContact;
  witness1?: ProtocolSignatoryContact;
  witness2?: ProtocolSignatoryContact;
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
  protocol_signatories: ProtocolSignatories | null;
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
  protocol_signatories_json?: string | null;
};

function parseProtocolSignatoriesJson(raw: string | null | undefined): ProtocolSignatories | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }
  try {
    const v = JSON.parse(raw) as unknown;
    if (v == null || typeof v !== "object" || Array.isArray(v)) {
      return null;
    }
    return v as ProtocolSignatories;
  } catch {
    return null;
  }
}

function rowToLottery(row: LotteryRow): Lottery {
  const wr = row.with_replacement;
  const { protocol_signatories_json, ...rest } = row;
  return {
    ...rest,
    with_replacement: wr === true || wr === 1,
    protocol_signatories: parseProtocolSignatoriesJson(protocol_signatories_json),
  };
}

function trimContactField(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t === "" || t == null ? undefined : t;
}

function normalizeSignatory(
  input: ProtocolSignatoryContact | undefined,
): ProtocolSignatoryContact | undefined {
  if (input == null) {
    return undefined;
  }
  const name = trimContactField(input.name);
  const email = trimContactField(input.email);
  const mobile = trimContactField(input.mobile);
  if (name == null && email == null && mobile == null) {
    return undefined;
  }
  const out: ProtocolSignatoryContact = {};
  if (name != null) {
    out.name = name;
  }
  if (email != null) {
    out.email = email;
  }
  if (mobile != null) {
    out.mobile = mobile;
  }
  return out;
}

/** Returnerar JSON-sträng för DB, eller null om inget att spara. */
export function protocolSignatoriesToJson(signatories: ProtocolSignatories): string | null {
  const drawingOfficial = normalizeSignatory(signatories.drawingOfficial);
  const witness1 = normalizeSignatory(signatories.witness1);
  const witness2 = normalizeSignatory(signatories.witness2);
  const payload: ProtocolSignatories = {};
  if (drawingOfficial != null) {
    payload.drawingOfficial = drawingOfficial;
  }
  if (witness1 != null) {
    payload.witness1 = witness1;
  }
  if (witness2 != null) {
    payload.witness2 = witness2;
  }
  if (
    payload.drawingOfficial == null &&
    payload.witness1 == null &&
    payload.witness2 == null
  ) {
    return null;
  }
  return JSON.stringify(payload);
}

export async function createLottery(
  name: string,
  description: string | null,
  numDraws: number,
  withReplacement: boolean,
  nameColumn: string,
  seed: string,
  protocolSignatories: ProtocolSignatories = {},
): Promise<number> {
  const database = await getDb();
  const protocolJson = protocolSignatoriesToJson(protocolSignatories);
  const result = await database.execute(
    `INSERT INTO lotteries (name, description, num_draws, with_replacement, name_column, seed, protocol_signatories_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      name,
      description,
      numDraws,
      withReplacement ? 1 : 0,
      nameColumn,
      seed,
      protocolJson,
    ],
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

export async function deleteLottery(id: number): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM lotteries WHERE id = $1", [id]);
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
