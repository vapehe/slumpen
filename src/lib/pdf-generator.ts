import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

import type { Draw, Lottery, Participant } from "./db";
import { participantDisplayName } from "./draw-reel";

export async function generateLotteryProtocol(
  lottery: Lottery,
  draws: Draw[],
  participants: Participant[],
): Promise<Blob> {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text(lottery.name, 20, 20);

  doc.setFontSize(12);
  let yPos = 35;

  if (lottery.description) {
    doc.text(`Beskrivning: ${lottery.description}`, 20, yPos);
    yPos += 10;
  }

  doc.text(`Datum: ${new Date(lottery.created_at).toLocaleString("sv-SE")}`, 20, yPos);
  yPos += 7;

  doc.text(`Antal deltagare: ${participants.length}`, 20, yPos);
  yPos += 7;

  doc.text(`Typ: ${lottery.with_replacement ? "Med återläggning" : "Utan återläggning"}`, 20, yPos);
  yPos += 15;

  const participantById = new Map(participants.map((p) => [p.id, p]));

  const tableRows: string[][] = draws.map((draw) => {
    const participant = participantById.get(draw.participant_id);
    const name =
      participant != null
        ? participantDisplayName(participant, lottery.name_column)
        : "(okänd deltagare)";
    return [String(draw.position), name];
  });

  autoTable(doc, {
    head: [["Placering", "Vinnare"]],
    body: tableRows,
    startY: yPos,
    theme: "grid",
    headStyles: { fillColor: [66, 139, 202] },
  });

  type DocWithAutoTable = typeof doc & {
    lastAutoTable?: { finalY: number };
  };
  const afterTable = (doc as DocWithAutoTable).lastAutoTable?.finalY ?? yPos + 10;
  yPos = afterTable + 15;

  doc.setFontSize(9);
  const seedLine =
    lottery.seed != null && lottery.seed !== ""
      ? `Dragning genomförd med lotterigenerator. Seed: ${lottery.seed}`
      : "Dragning genomförd med lotterigenerator. (Ingen seed sparad.)";
  doc.text(seedLine, 20, yPos);
  doc.text("(Seeden gör att dragningen kan verifieras och reproduceras.)", 20, yPos + 5);

  yPos += 25;
  doc.setFontSize(11);

  const signatureStartY = yPos;
  const signatureSpacing = 25;

  doc.text("Dragningsförrättare:", 20, signatureStartY);
  doc.line(20, signatureStartY + 8, 90, signatureStartY + 8);
  doc.setFontSize(9);
  doc.text("Namnförtydligande", 20, signatureStartY + 12);

  doc.setFontSize(11);
  doc.text("Vittne 1:", 110, signatureStartY);
  doc.line(110, signatureStartY + 8, 180, signatureStartY + 8);
  doc.setFontSize(9);
  doc.text("Namnförtydligande", 110, signatureStartY + 12);

  doc.setFontSize(11);
  doc.text("Vittne 2:", 20, signatureStartY + signatureSpacing);
  doc.line(20, signatureStartY + signatureSpacing + 8, 90, signatureStartY + signatureSpacing + 8);
  doc.setFontSize(9);
  doc.text("Namnförtydligande", 20, signatureStartY + signatureSpacing + 12);

  return doc.output("blob");
}
