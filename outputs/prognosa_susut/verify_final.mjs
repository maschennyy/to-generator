import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const finalPath = "C:/projects/to-generator/outputs/prognosa_susut/Prognosa Pencapaian Susut Teluk Naga Desember.xlsx";
const input = await FileBlob.load(finalPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const check = await workbook.inspect({
  kind: "workbook,sheet,table",
  range: "Ringkasan!A4:H10",
  include: "values",
  maxChars: 4000,
  tableMaxRows: 8,
  tableMaxCols: 8,
});
console.log(check.ndjson);
