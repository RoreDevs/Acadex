import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header]?.toString() || '';
        return value.includes(',') ? `"${value}"` : value;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportToExcel(data: Record<string, any>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  data: Record<string, any>[],
  filename: string,
  title: string,
  columns: string[]
) {
  const doc = new jsPDF('landscape');

  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

  const tableData = data.map((row) =>
    columns.map((col) => row[col]?.toString() || '')
  );

  (doc as any).autoTable({
    head: [columns],
    body: tableData,
    startY: 28,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  });

  doc.save(`${filename}.pdf`);
}
