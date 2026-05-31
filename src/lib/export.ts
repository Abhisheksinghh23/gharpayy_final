/**
 * General browser-side utility to export array data as a CSV download.
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers?: string[]
) {
  if (!data || data.length === 0) {
    return;
  }

  const keys = Object.keys(data[0]);
  const displayHeaders = headers || keys;

  const csvRows = [];
  
  // Header row
  csvRows.push(displayHeaders.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));

  // Data rows
  for (const row of data) {
    const values = keys.map((key) => {
      const val = row[key];
      const cellVal = val === null || val === undefined ? "" : String(val);
      return `"${cellVal.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
