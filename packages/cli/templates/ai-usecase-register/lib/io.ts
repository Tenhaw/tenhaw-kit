export function record(value: unknown, path = "input"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path}: expected an object.`);
  return value as Record<string, unknown>;
}
export function text(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2000) throw new Error(`${path}: use text between 1 and 2,000 characters.`);
  return value.trim();
}
export function finite(value: unknown, path: string, min = 0, max = 1_000_000_000): number {
  if (value === "" || value === null || value === undefined) throw new Error(`${path}: a number is required.`);
  const result = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(`${path}: use a number between ${min} and ${max}.`);
  return result;
}
export function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error(`${path}: expected an array of at most 10,000 records.`);
  return value;
}

/** RFC 4180-style parsing; quoted commas, double quotes and embedded newlines supported. */
export function parseCsv(source: string): Record<string,string>[] {
 const rows:string[][]=[]; let row:string[]=[], field="",quoted=false,closed=false;
 const input=source.replace(/^\uFEFF/,"");
 for(let i=0;i<input.length;i++) {const char=input[i];
  if(quoted) {if(char==='"'&&input[i+1]==='"'){field+='"';i++;}else if(char==='"'){quoted=false;closed=true;}else field+=char;}
  else if(char==='"'){if(field || closed) throw new Error("CSV: unexpected quote.");quoted=true;}
  else if(char===","){row.push(field);field="";closed=false;}
  else if(char==="\n"||char==="\r"){if(char==="\r"&&input[i+1]==="\n")i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field="";closed=false;}
  else {if(closed)throw new Error("CSV: unexpected text after a closing quote.");field+=char;}
 }
 if(quoted)throw new Error("CSV: an opening quote is not closed.");
 row.push(field);if(row.some(Boolean))rows.push(row);
 const headers=rows.shift()?.map(header=>header.trim());
 if(!headers?.length || headers.some(header=>!header) || new Set(headers).size!==headers.length)throw new Error("CSV: use unique, non-empty column headers.");
 if(rows.length>10000)throw new Error("CSV: at most 10,000 rows are supported.");
 return rows.map((cells,i)=>{if(cells.length!==headers.length)throw new Error(`CSV row ${i+2}: expected ${headers.length} columns.`);return Object.fromEntries(headers.map((header,j)=>[header,cells[j]]));});
}
export function toCsv(rows: Record<string,unknown>[], headers?:string[]): string {
 const columns=headers??Object.keys(rows[0]??{});
 const escape=(value:unknown)=>{let content=value===null||value===undefined?"":String(value);if(/^[\t\r\n ]*[=+@-]/.test(content)&&typeof value!=="number")content="'"+content;return '"'+content.replaceAll('"','""')+'"';};
 return [columns.map(escape).join(","),...rows.map(row=>columns.map(key=>escape(row[key])).join(","))].join("\r\n");
}
