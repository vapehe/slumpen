import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

import type { Draw, Lottery, Participant, ProtocolSignatoryContact } from "./db";
import { formatDateTimeSv } from "./format-swedish-time";
import { participantDisplayName } from "./draw-reel";
import { buildParticipantTableRows, getParticipantCsvColumnOrder } from "./participant-table-for-pdf";

type DocWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

/**
 * Ritar en lodrät signatursektion: rubrik, signaturstreck och valfria rader för
 * namn, e-post och mobil. Returnerar y för nästa sektion (med luft inkluderad).
 */
function drawSignatureSection(
  doc: jsPDF,
  label: string,
  x: number,
  lineRight: number,
  startY: number,
  contact: ProtocolSignatoryContact | undefined,
): number {
  doc.setFontSize(11);
  doc.text(label, x, startY);

  // Lite extra luft mellan rubrik och signaturlinje för handskrift.
  const lineY = startY + 10;
  doc.line(x, lineY, lineRight, lineY);

  let y = lineY + 5;
  doc.setFontSize(10);
  const maxWidth = lineRight - x;

  const name = contact?.name?.trim();
  if (name != null && name !== "") {
    for (const fragment of doc.splitTextToSize(name, maxWidth)) {
      doc.text(fragment, x, y);
      y += 5;
    }
  }

  const email = contact?.email?.trim();
  if (email != null && email !== "") {
    for (const fragment of doc.splitTextToSize(`Email: ${email}`, maxWidth)) {
      doc.text(fragment, x, y);
      y += 5;
    }
  }

  const mobile = contact?.mobile?.trim();
  if (mobile != null && mobile !== "") {
    for (const fragment of doc.splitTextToSize(`Mobil: ${mobile}`, maxWidth)) {
      doc.text(fragment, x, y);
      y += 5;
    }
  }

  return y + 6;
}

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

  doc.text(`Datum: ${formatDateTimeSv(lottery.created_at)}`, 20, yPos);
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

  const sig = lottery.protocol_signatories;
  const sectionX = 20;
  const sectionLineRight = 110;

  yPos = drawSignatureSection(
    doc,
    "Dragningsförrättare",
    sectionX,
    sectionLineRight,
    yPos,
    sig?.drawingOfficial,
  );
  yPos = drawSignatureSection(
    doc,
    "Vittne 1",
    sectionX,
    sectionLineRight,
    yPos,
    sig?.witness1,
  );
  yPos = drawSignatureSection(
    doc,
    "Vittne 2",
    sectionX,
    sectionLineRight,
    yPos,
    sig?.witness2,
  );

  const columns = getParticipantCsvColumnOrder(participants);
  if (columns.length > 0 && participants.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Deltagare (alla kolumner från import)", 20, 18);
    const body = buildParticipantTableRows(participants, columns);
    autoTable(doc, {
      head: [columns],
      body,
      startY: 24,
      theme: "grid",
      headStyles: { fillColor: [66, 139, 202], fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
      margin: { left: 14, right: 14 },
    });
  }

  // Sidnumrering (t.ex. 1/4) nere till höger på varje sida.
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    const label = `Sida ${page}/${totalPages}`;
    doc.text(label, pageWidth - 14, pageHeight - 10, { align: "right" });
  }

  return doc.output("blob");
}
