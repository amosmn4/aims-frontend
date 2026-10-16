import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ReportBlock, ReportDocument } from "./report-document";

const NAVY = "085599";
const MUTED = "6E6E6E";
const FONT = "Calibri";
const LINE = { style: BorderStyle.SINGLE, size: 4, color: "D9DFE8" };

function table(block: Extract<ReportBlock, { kind: "table" }>): (Paragraph | Table)[] {
  if (block.rows.length === 0) {
    return [
      new Paragraph({
        children: [new TextRun({ text: block.emptyText ?? "Nothing to show.", color: MUTED })],
      }),
    ];
  }
  const numeric = new Set(block.numeric ?? []);
  const cell = (text: string, i: number, head: boolean, shaded: boolean) =>
    new TableCell({
      shading: head
        ? { type: ShadingType.CLEAR, color: "auto", fill: NAVY }
        : shaded
          ? { type: ShadingType.CLEAR, color: "auto", fill: "F5F7FA" }
          : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          alignment: numeric.has(i) ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [
            new TextRun({
              text,
              bold: head,
              color: head ? "FFFFFF" : "282828",
              size: 18,
              font: FONT,
            }),
          ],
        }),
      ],
    });
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: LINE,
        bottom: LINE,
        left: LINE,
        right: LINE,
        insideHorizontal: LINE,
        insideVertical: LINE,
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: block.columns.map((c, i) => cell(c, i, true, false)),
        }),
        ...block.rows.map(
          (r, ri) => new TableRow({ children: r.map((v, i) => cell(v, i, false, ri % 2 === 1)) }),
        ),
      ],
    }),
    new Paragraph({ text: "" }),
  ];
}

function blockToDocx(block: ReportBlock): (Paragraph | Table)[] {
  switch (block.kind) {
    case "heading":
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 },
          children: [new TextRun({ text: block.text, color: NAVY, bold: true, font: FONT })],
        }),
      ];
    case "paragraph":
      return [
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: block.text,
              color: block.muted ? MUTED : "3C3C3C",
              size: block.muted ? 18 : 21,
              font: FONT,
            }),
          ],
        }),
      ];
    case "bullets":
      return block.items.map(
        (item) =>
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [new TextRun({ text: item, size: 21, font: FONT })],
          }),
      );
    case "table":
      return table(block);
  }
}

export async function renderReportDocx(report: ReportDocument): Promise<Blob> {
  const doc = new Document({
    creator: "AIMS",
    title: report.title,
    description: report.subtitle,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${report.title} · Page `, size: 16, color: MUTED }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
                  new TextRun({ text: " of ", size: 16, color: MUTED }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [
              new TextRun({ text: report.title, bold: true, color: NAVY, size: 40, font: FONT }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: report.subtitle, size: 24, color: "3C3C3C" })],
          }),
          ...(report.meta.length
            ? [
                new Paragraph({
                  spacing: { after: 200 },
                  children: [
                    new TextRun({ text: report.meta.join("  ·  "), size: 18, color: MUTED }),
                  ],
                }),
              ]
            : []),
          ...report.blocks.flatMap(blockToDocx),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}
