import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "C:/Users/mahes/Downloads/TEST PROGONOSA.xlsx";
const outputDir = "C:/projects/to-generator/outputs/prognosa_susut";
const outputPath = `${outputDir}/Prognosa Pencapaian Susut Teluk Naga Desember.xlsx`;

const months = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const col = (n) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
};
const avg = (items) => items.reduce((a, b) => a + b, 0) / items.length;
const cleanNumber = (value) => (typeof value === "number" ? value : 0);

const input = await FileBlob.load(inputPath);
const sourceWorkbook = await SpreadsheetFile.importXlsx(input);
const sourceSheet = sourceWorkbook.worksheets.getItem("Lembar1");
const source = sourceSheet.getRange("A1:BA60").values;

const target = cleanNumber(source[2][2]);
const rowMonthly = (rowNumber) => source[rowNumber - 1].slice(7, 19).map(cleanNumber);
const actualCount = 5;
const rows = {
  siapSalur: rowMonthly(6),
  siapJual: rowMonthly(34),
  jual: rowMonthly(35),
  jualTT: rowMonthly(36),
  emin: rowMonthly(40),
  susutDenganEmin: rowMonthly(45),
  susutTanpaEmin: rowMonthly(53),
};

const forecast = {
  siapSalur: avg(rows.siapSalur.slice(0, actualCount)),
  siapJual: avg(rows.siapJual.slice(0, actualCount)),
  jual: avg(rows.jual.slice(0, actualCount)),
  jualTT: avg(rows.jualTT.slice(0, actualCount)),
  emin: avg(rows.emin.slice(0, actualCount)),
};

const wb = Workbook.create();
const summary = wb.worksheets.add("Ringkasan");
const forecastSheet = wb.worksheets.add("Prognosa Bulanan");
const assumptions = wb.worksheets.add("Asumsi & Sumber");

for (const sheet of [summary, forecastSheet, assumptions]) {
  sheet.showGridLines = false;
}

forecastSheet.getRange("A1:L1").merge();
forecastSheet.getRange("A1").values = [["Prognosa Pencapaian Susut Area Teluk Naga sampai Desember"]];
forecastSheet.getRange("A2:L2").merge();
forecastSheet.getRange("A2").values = [["Baseline: bulan Juni-Desember menggunakan rata-rata realisasi Januari-Mei untuk energi, penjualan, TT, dan EMIN."]];
forecastSheet.getRange("A4:L4").values = [[
  "Bulan",
  "Status",
  "Siap Salur Distribusi",
  "KWh Siap Jual",
  "KWh Jual",
  "KWh Jual TT",
  "KWh EMIN",
  "Susut Dengan EMIN",
  "Susut Tanpa EMIN",
  "% Bulanan Dengan TT Tanpa EMIN",
  "% Kum. Dengan TT Tanpa EMIN",
  "% Kum. Tanpa TT Tanpa EMIN",
]];

const dataRows = months.map((month, i) => {
  if (i < actualCount) {
    return [
      month,
      "Aktual",
      rows.siapSalur[i],
      rows.siapJual[i],
      rows.jual[i],
      rows.jualTT[i],
      rows.emin[i],
      rows.susutDenganEmin[i],
      rows.susutTanpaEmin[i],
      null,
      null,
      null,
    ];
  }
  return [
    month,
    "Prognosa",
    forecast.siapSalur,
    forecast.siapJual,
    forecast.jual,
    forecast.jualTT,
    forecast.emin,
    null,
    null,
    null,
    null,
    null,
  ];
});
forecastSheet.getRange("A5:L16").values = dataRows;

for (let r = 5; r <= 16; r++) {
  forecastSheet.getRange(`H${r}`).formulas = [[`=D${r}-E${r}`]];
  forecastSheet.getRange(`I${r}`).formulas = [[`=D${r}-E${r}+G${r}`]];
  forecastSheet.getRange(`J${r}`).formulas = [[`=IFERROR(I${r}/C${r},"")`]];
  forecastSheet.getRange(`K${r}`).formulas = [[`=IFERROR(SUM($I$5:I${r})/SUM($C$5:C${r}),"")`]];
  forecastSheet.getRange(`L${r}`).formulas = [[`=IFERROR(SUM($I$5:I${r})/(SUM($C$5:C${r})-SUM($F$5:F${r})),"")`]];
}

forecastSheet.getRange("N4:Q16").values = [
  ["Bulan", "Kum. Dengan TT", "Kum. Tanpa TT", "Target"],
  ...shortMonths.map((m) => [m, null, null, target]),
];
for (let r = 5; r <= 16; r++) {
  forecastSheet.getRange(`O${r}`).formulas = [[`=K${r}`]];
  forecastSheet.getRange(`P${r}`).formulas = [[`=L${r}`]];
}

summary.getRange("A1:H1").merge();
summary.getRange("A1").values = [["Ringkasan Prognosa Pencapaian Susut"]];
summary.getRange("A2:H2").merge();
summary.getRange("A2").values = [["Area Teluk Naga | Sumber: TEST PROGONOSA.xlsx | Target susut: 9,88%"]];

summary.getRange("A4:B10").values = [
  ["Indikator Utama", "Nilai"],
  ["Target susut", target],
  ["Realisasi s.d. Mei - Dengan TT Tanpa EMIN", null],
  ["Prognosa s.d. Desember - Dengan TT Tanpa EMIN", null],
  ["Gap prognosa vs target", null],
  ["Status baseline", null],
  ["Rata-rata susut bulanan Jun-Des agar tepat target", null],
];
summary.getRange("B6").formulas = [["='Prognosa Bulanan'!K9"]];
summary.getRange("B7").formulas = [["='Prognosa Bulanan'!K16"]];
summary.getRange("B8").formulas = [["=B7-B5"]];
summary.getRange("B9").formulas = [[`=IF(B7<=B5,"Tercapai","Belum tercapai")`]];
summary.getRange("B10").formulas = [[`=IFERROR((B5*SUM('Prognosa Bulanan'!C5:C16)-SUM('Prognosa Bulanan'!I5:I9))/SUM('Prognosa Bulanan'!C10:C16),"")`]];

summary.getRange("D4:H9").values = [
  ["Skenario", "Asumsi", "Susut Des", "Gap vs Target", "Status"],
  ["Baseline", "Rata-rata Jan-Mei", null, null, null],
  ["Perbaikan 3%", "Susut kWh Jun-Des turun 3% dari baseline", null, null, null],
  ["Perbaikan 5%", "Susut kWh Jun-Des turun 5% dari baseline", null, null, null],
  ["Tepat Target", "Susut Jun-Des disesuaikan agar Desember = target", null, null, null],
  ["Tanpa TT Baseline", "Pembanding denominator tanpa KWh Jual TT", null, null, null],
];
summary.getRange("F5").formulas = [["='Prognosa Bulanan'!K16"]];
summary.getRange("F6").formulas = [["=(SUM('Prognosa Bulanan'!I5:I9)+SUM('Prognosa Bulanan'!I10:I16)*97%)/SUM('Prognosa Bulanan'!C5:C16)"]];
summary.getRange("F7").formulas = [["=(SUM('Prognosa Bulanan'!I5:I9)+SUM('Prognosa Bulanan'!I10:I16)*95%)/SUM('Prognosa Bulanan'!C5:C16)"]];
summary.getRange("F8").formulas = [["=$B$5"]];
summary.getRange("F9").formulas = [["='Prognosa Bulanan'!L16"]];
for (let r = 5; r <= 9; r++) {
  summary.getRange(`G${r}`).formulas = [[`=F${r}-$B$5`]];
  summary.getRange(`H${r}`).formulas = [[`=IF(F${r}<=$B$5,"Tercapai","Belum tercapai")`]];
}

summary.getRange("A13:D25").values = [
  ["Bulan", "Kum. Dengan TT", "Kum. Tanpa TT", "Target"],
  ...shortMonths.map((m) => [m, null, null, target]),
];
for (let r = 14; r <= 25; r++) {
  const src = r - 9;
  summary.getRange(`B${r}`).formulas = [[`='Prognosa Bulanan'!K${src}`]];
  summary.getRange(`C${r}`).formulas = [[`='Prognosa Bulanan'!L${src}`]];
}

assumptions.getRange("A1:F1").merge();
assumptions.getRange("A1").values = [["Asumsi & Sumber Data"]];
assumptions.getRange("A3:F11").values = [
  ["Parameter", "Nilai", "Catatan", "Row sumber", "Periode aktual", "Metode prognosa"],
  ["Area", "TELUK NAGA", "Diambil dari cell C2 workbook sumber", "C2", "Jan-Mei", "Rata-rata aktual Jan-Mei"],
  ["Target susut", target, "Diambil dari cell C3 workbook sumber", "C3", "Jan-Mei", "Dibandingkan dengan prognosa Desember"],
  ["Siap Salur Distribusi", forecast.siapSalur, "Rata-rata aktual Jan-Mei", "Row 6", "Jan-Mei", "Jun-Des = rata-rata Jan-Mei"],
  ["KWh Siap Jual", forecast.siapJual, "Rata-rata aktual Jan-Mei", "Row 34", "Jan-Mei", "Jun-Des = rata-rata Jan-Mei"],
  ["KWh Jual", forecast.jual, "Rata-rata aktual Jan-Mei", "Row 35", "Jan-Mei", "Jun-Des = rata-rata Jan-Mei"],
  ["KWh Jual TT", forecast.jualTT, "Rata-rata aktual Jan-Mei", "Row 36", "Jan-Mei", "Jun-Des = rata-rata Jan-Mei"],
  ["KWh EMIN", forecast.emin, "Rata-rata aktual Jan-Mei", "Row 40", "Jan-Mei", "Jun-Des = rata-rata Jan-Mei"],
  ["Definisi utama", "Dengan TT Tanpa EMIN", "Susut Tanpa EMIN / Siap Salur Distribusi", "Rows 53 / 6", "Jan-Mei", "Formula berjalan sampai Desember"],
];

const sourceExtract = [["Uraian", ...months]];
const sourceRows = [
  ["Siap Salur Distribusi", ...rows.siapSalur],
  ["KWh Siap Jual", ...rows.siapJual],
  ["KWh Jual", ...rows.jual],
  ["KWh Jual TT", ...rows.jualTT],
  ["KWh EMIN", ...rows.emin],
  ["Susut Dengan EMIN", ...rows.susutDenganEmin],
  ["Susut Tanpa EMIN", ...rows.susutTanpaEmin],
];
assumptions.getRange(`A14:${col(13)}21`).values = [...sourceExtract, ...sourceRows];

const titleStyle = { fill: "#14532D", font: { bold: true, color: "#FFFFFF", size: 15 } };
const subtitleStyle = { fill: "#DCFCE7", font: { color: "#14532D" } };
for (const sheet of [summary, forecastSheet, assumptions]) {
  sheet.getRange("A1").format = titleStyle;
  sheet.getRange("A2").format = subtitleStyle;
  sheet.getRange("A1").format.rowHeightPx = 30;
}
forecastSheet.getRange("A4:L4").format = { fill: "#166534", font: { bold: true, color: "#FFFFFF" }, wrapText: true };
forecastSheet.getRange("N4:Q4").format = { fill: "#166534", font: { bold: true, color: "#FFFFFF" }, wrapText: true };
summary.getRange("A4:B4").format = { fill: "#166534", font: { bold: true, color: "#FFFFFF" } };
summary.getRange("D4:H4").format = { fill: "#166534", font: { bold: true, color: "#FFFFFF" } };
summary.getRange("A13:D13").format = { fill: "#166534", font: { bold: true, color: "#FFFFFF" } };
assumptions.getRange("A3:F3").format = { fill: "#166534", font: { bold: true, color: "#FFFFFF" } };
assumptions.getRange("A14:M14").format = { fill: "#166534", font: { bold: true, color: "#FFFFFF" } };

forecastSheet.getRange("C5:I16").format.numberFormat = "#,##0";
forecastSheet.getRange("J5:L16").format.numberFormat = "0.00%";
forecastSheet.getRange("Q5:Q16").format.numberFormat = "0.00%";
summary.getRange("B5:B8").format.numberFormat = "0.00%";
summary.getRange("B10").format.numberFormat = "0.00%";
summary.getRange("F5:G9").format.numberFormat = "0.00%";
summary.getRange("B14:D25").format.numberFormat = "0.00%";
assumptions.getRange("B5:B11").format.numberFormat = "#,##0";
assumptions.getRange("B5").format.numberFormat = "0.00%";
assumptions.getRange("B6").format.numberFormat = "#,##0";
assumptions.getRange("B7:B10").format.numberFormat = "#,##0";
assumptions.getRange("B15:M21").format.numberFormat = "#,##0";

for (const sheet of [summary, forecastSheet, assumptions]) {
  sheet.getRange("A:Q").format.font = { name: "Aptos", size: 10 };
}
summary.getRange("A:H").format.columnWidthPx = 140;
summary.getRange("A:A").format.columnWidthPx = 340;
summary.getRange("D:D").format.columnWidthPx = 190;
summary.getRange("E:E").format.columnWidthPx = 360;
summary.getRange("H:H").format.columnWidthPx = 150;
forecastSheet.getRange("A:A").format.columnWidthPx = 105;
forecastSheet.getRange("B:B").format.columnWidthPx = 95;
forecastSheet.getRange("C:I").format.columnWidthPx = 145;
forecastSheet.getRange("J:L").format.columnWidthPx = 150;
assumptions.getRange("A:A").format.columnWidthPx = 190;
assumptions.getRange("B:B").format.columnWidthPx = 140;
assumptions.getRange("C:F").format.columnWidthPx = 180;

summary.getRange("A4:B10").format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };
summary.getRange("D4:H9").format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };
summary.getRange("A13:D25").format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };
forecastSheet.getRange("A4:L16").format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };
assumptions.getRange("A3:F11").format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };
assumptions.getRange("A14:M21").format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };

forecastSheet.freezePanes.freezeRows(4);
summary.freezePanes.freezeRows(3);

const chart = summary.charts.add("line", summary.getRange("A13:D25"));
chart.title = "Tren Susut Kumulatif vs Target";
chart.hasLegend = true;
chart.xAxis = { axisType: "textAxis" };
chart.yAxis = { numberFormatCode: "0.0%" };
chart.setPosition("F12", "M28");

await fs.mkdir(outputDir, { recursive: true });

const summaryPreview = await wb.render({ sheetName: "Ringkasan", range: "A1:M28", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/ringkasan_preview.png`, new Uint8Array(await summaryPreview.arrayBuffer()));
const forecastPreview = await wb.render({ sheetName: "Prognosa Bulanan", range: "A1:L16", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/prognosa_preview.png`, new Uint8Array(await forecastPreview.arrayBuffer()));
const assumptionsPreview = await wb.render({ sheetName: "Asumsi & Sumber", range: "A1:M21", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/asumsi_preview.png`, new Uint8Array(await assumptionsPreview.arrayBuffer()));

const inspectSummary = await wb.inspect({
  kind: "table",
  range: "Ringkasan!A4:H10",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 8,
});
console.log(inspectSummary.ndjson);

const formulaErrors = [];
for (const sheetName of ["Ringkasan", "Prognosa Bulanan", "Asumsi & Sumber"]) {
  const sheet = wb.worksheets.getItem(sheetName);
  const used = sheet.getUsedRange();
  for (const [rowIndex, row] of used.values.entries()) {
    for (const [colIndex, value] of row.entries()) {
      if (typeof value === "string" && /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A)/.test(value)) {
        formulaErrors.push(`${sheetName}!${col(colIndex + 1)}${rowIndex + 1}: ${value}`);
      }
    }
  }
}
console.log(JSON.stringify({ formulaErrors }));
if (formulaErrors.length > 0) {
  throw new Error(`Formula errors found: ${formulaErrors.join(", ")}`);
}

const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath }));
process.exitCode = 0;
