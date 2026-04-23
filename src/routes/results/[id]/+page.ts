import type { PageLoad } from "./$types";
import { getDrawsByLottery, getLotteryById, getParticipantsByLottery } from "$lib/db";

export const load: PageLoad = async ({ params }) => {
  const raw = params.id;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1 || raw !== String(id)) {
    return { ok: false as const, reason: "bad_id" as const };
  }

  const lottery = await getLotteryById(id);
  if (!lottery) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const [participants, draws] = await Promise.all([
    getParticipantsByLottery(id),
    getDrawsByLottery(id),
  ]);

  return {
    ok: true as const,
    lotteryId: id,
    lottery,
    participants,
    draws,
  };
};
