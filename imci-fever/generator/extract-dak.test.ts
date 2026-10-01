import { expect, test } from "bun:test";
import { elementsOf, parseSheet } from "./extract-dak";

const strings = ["[CHE] Data element ID", "Data element label", "Description and definition/user information", "Input options", "Vomiting everything", "The child vomits everything.\r\n\r\nMore.", "- Yes"];
const sheet = `<sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>Danger signs</t></is></c></row>
<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="C2" t="s"><v>2</v></c><c r="D2" t="s"><v>3</v></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>CHE.B7.DE06</t></is></c><c r="B3" t="s"><v>4</v></c><c r="C3" t="s"><v>5</v></c><c r="D3" t="s"><v>6</v></c></row>
<row r="4"><c r="A4" t="inlineStr"><is><t>Notes</t></is></c><c r="B4"/></row>
</sheetData>`;

test("a sheet's data elements are the rows below the header that have a data element ID", () => {
  expect(elementsOf("Danger signs", parseSheet(sheet, strings))).toEqual([
    { id: "CHE.B7.DE06", sheet: "Danger signs", label: "Vomiting everything", definition: "The child vomits everything.\n\nMore.", options: "- Yes" },
  ]);
});

test("a sheet without a header row has no data elements", () => {
  expect(elementsOf("Cover", parseSheet(`<row r="1"><c r="A1" t="inlineStr"><is><t>Title</t></is></c></row>`, []))).toEqual([]);
});
