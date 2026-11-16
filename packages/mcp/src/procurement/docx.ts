/** Deterministic OOXML writer adapted from Tenhaw's website RFP exporter. Code: MIT. */
import { deflateRawSync } from "node:zlib";

export type DocBlock =
  | { type: "title" | "h1" | "h2" | "h3" | "p" | "note" | "bullet"; text: string; keepWithNext?: boolean; pageBreakBefore?: boolean }
  | { type: "table"; header: string[]; rows: string[][]; /** Column widths in twentieths of a point. They should total about 9,600. */ widths: number[] };

export interface DocFile {
  /** Without the extension. Letters, digits and hyphens. */
  filename: string;
  title: string;
  blocks: DocBlock[];
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; data: string }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  /* 1 January 2026, midnight. A fixed date keeps the output reproducible. */
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const raw = Buffer.from(file.data, "utf8");
    const packed = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** Escapes text for XML and drops the control characters XML 1.0 does not allow. */
const esc = (text: string) =>
  String(text)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const run = (text: string, bold = false) =>
  `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
const paragraph = (runs: string, style = "Normal", options: { keepWithNext?: boolean; pageBreakBefore?: boolean; centre?: boolean } = {}) =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/>${options.keepWithNext ? '<w:keepNext/>' : ''}${options.pageBreakBefore ? '<w:pageBreakBefore/>' : ''}${options.centre ? '<w:jc w:val="center"/>' : ''}</w:pPr>${runs}</w:p>`;

function table(header: string[], rows: string[][], widths: number[]): string {
  const total = widths.reduce((sum, width) => sum + width, 0);
  const cell = (text: string, width: number, head: boolean, centre: boolean) =>
    `<w:tc><w:tcPr><w:vAlign w:val="center"/><w:tcW w:w="${width}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E7EBF0"/>' : ""}</w:tcPr>${paragraph(run(text, head), "TableText", { centre })}</w:tc>`;
  const row = (cells: string[], head: boolean) =>
    `<w:tr><w:trPr>${head ? "<w:tblHeader/>" : ""}<w:cantSplit/></w:trPr>${widths.map((width, index) => cell(cells[index] ?? "", width, head, index === 0)).join("")}</w:tr>`;
  const border = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${row(header, true)}${rows.map((cells) => row(cells, false)).join("")}</w:tbl>`;
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function style(id: string, name: string, options: { size?: number; bold?: boolean; italic?: boolean; before?: number; after?: number; colour?: string; outline?: number; hanging?: number } = {}): string {
  const { size, bold, italic, before = 0, after = 120, colour, outline, hanging } = options;
  return `<w:style w:type="paragraph"${id === "Normal" ? ' w:default="1"' : ""} w:styleId="${id}"><w:name w:val="${name}"/>${id === "Normal" ? "" : '<w:basedOn w:val="Normal"/>'}<w:qFormat/><w:pPr>${outline !== undefined ? "<w:keepNext/>" : ""}<w:spacing w:before="${before}" w:after="${after}"/>${hanging ? `<w:ind w:left="${hanging}" w:hanging="${hanging}"/>` : ""}${outline !== undefined ? `<w:outlineLvl w:val="${outline}"/>` : ""}</w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b w:val="${bold ? 1 : 0}"/><w:i w:val="${italic ? 1 : 0}"/><w:color w:val="${colour ?? "000000"}"/><w:sz w:val="${size ?? 22}"/><w:szCs w:val="${size ?? 22}"/></w:rPr></w:style>`;
}

const STYLES = `${XML}<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${style("Normal", "Normal")}${style("Title", "Title", { size: 44, bold: true, after: 160 })}${style("Heading1", "heading 1", { size: 32, bold: true, before: 360, outline: 0 })}${style("Heading2", "heading 2", { size: 26, bold: true, before: 280, after: 100, outline: 1 })}${style("Heading3", "heading 3", { size: 22, bold: true, before: 200, after: 80, outline: 2 })}${style("Bullet", "Bullet", { hanging: 360, after: 60 })}${style("Note", "Note", { size: 18, italic: true, colour: "55606E" })}${style("TableText", "Table Text", { size: 20, after: 0 })}</w:styles>`;

const PARAGRAPH_STYLE: Record<string, string> = { title: "Title", h1: "Heading1", h2: "Heading2", h3: "Heading3", note: "Note", bullet: "Bullet", p: "Normal" };

export function buildDocx(file: DocFile): Buffer {
  const body = file.blocks
    .map((block) => {
      if (block.type === "table") return table(block.header, block.rows, block.widths) + paragraph("");
      return paragraph(run(block.type === "bullet" ? `•  ${block.text}` : block.text), PARAGRAPH_STYLE[block.type], block);
    })
    .join("");
  const document = `${XML}<w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const contentTypes = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const documentRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const core = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(file.title)}</dc:title><dc:creator>Tenhaw</dc:creator></cp:coreProperties>`;
  return zip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rels },
    { name: "docProps/core.xml", data: core },
    { name: "word/document.xml", data: document },
    { name: "word/_rels/document.xml.rels", data: documentRels },
    { name: "word/styles.xml", data: STYLES },
  ]);
}
