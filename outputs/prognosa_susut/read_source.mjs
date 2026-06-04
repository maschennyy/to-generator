import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/mahes/Downloads/TEST PROGONOSA.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Lembar1");

const values = sheet.getRange("A1:BA60").values;
await fs.writeFile("source_values.json", JSON.stringify(values, null, 2));

const rows = values.map((row, index) => ({
  row: index + 1,
  labelA: row[0],
  labelB: row[1],
  labelC: row[2],
  labelD: row[3],
  monthly: row.slice(7, 19),
  cumulative: row.slice(27, 39),
  quarter: row.slice(47, 53),
}));

console.log(JSON.stringify(rows, null, 2));
