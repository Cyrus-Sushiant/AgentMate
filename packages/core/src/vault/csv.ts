export interface CsvParseOptions {
  delimiter?: string;
}

/**
 * RFC 4180 CSV, plus what real password manager exports throw at you: a byte order mark, any
 * line ending, line breaks inside quoted cells, and rows with fewer cells than the header.
 * Blank lines are dropped.
 */
export function parseCsv(input: string, options: CsvParseOptions = {}): string[][] {
  const delimiter = options.delimiter ?? ',';
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  // Tells a row that really has one empty cell apart from a blank line.
  let rowHasContent = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (rowHasContent || row.length > 1) rows.push(row);
    row = [];
    rowHasContent = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      rowHasContent = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += char;
      rowHasContent = true;
    }
  }
  if (cell !== '' || row.length > 0 || rowHasContent) endRow();
  return rows;
}

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'];

/** Guesses the delimiter from the first line, ignoring anything inside quotes. */
export function detectDelimiter(text: string): string {
  let firstLine = '';
  let inQuotes = false;
  for (const char of text.replace(/^﻿/, '')) {
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes && (char === '\n' || char === '\r')) break;
    if (!inQuotes) firstLine += char;
  }
  let best = ',';
  let bestCount = 0;
  for (const candidate of CANDIDATE_DELIMITERS) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function needsQuotes(value: string, delimiter: string): boolean {
  return (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value !== value.trim() ||
    value.charCodeAt(0) === 0xfeff
  );
}

/** Writes CRLF rows (what spreadsheet apps expect) and quotes cells only when they need it. */
export function serializeCsv(rows: string[][], delimiter = ','): string {
  return rows
    .map(
      (row) =>
        `${row
          .map((value) =>
            needsQuotes(value, delimiter) ? `"${value.replace(/"/g, '""')}"` : value,
          )
          .join(delimiter)}\r\n`,
    )
    .join('');
}
