import { Operation, Center, Medic, Schedule, TrainingSession } from './types';

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((header) => {
      const val = row[header];
      const str = Array.isArray(val) ? val.join('; ') : String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToJSON(data: unknown, filename: string) {
  const content = JSON.stringify(data, null, 2);
  downloadFile(content, `${filename}.json`, 'application/json');
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  const content = convertToCSV(data);
  downloadFile(content, `${filename}.csv`, 'text/csv');
}

export function exportOperationsToCSV(operations: Operation[]) {
  const data = operations.map((op) => ({
    'رقم الحالة': op.caseId,
    'رقم الموافقة': op.approvalNumber,
    'النوع': op.type,
    'اسم الحالة': op.caseName,
    'التاريخ': op.date,
    'الوقت': op.time,
    'الموقع': op.location || '',
    'الأعضاء': op.memberNames?.join(', ') || op.members.join(', '),
    'التقرير': op.report,
    'الحالة': op.status === 'pending' ? 'قيد الانتظار' : op.status === 'completed' ? 'مكتمل' : 'ملغي',
    'المركز': op.centerName,
  }));
  exportToCSV(data, 'operations');
}

export function exportCenterDataToCSV(center: Center, operations: Operation[], medics: Medic[]) {
  const opsData = operations.map((op) => ({
    'رقم الحالة': op.caseId,
    'رقم الموافقة': op.approvalNumber,
    'النوع': op.type,
    'اسم الحالة': op.caseName,
    'التاريخ': op.date,
    'الحالة': op.status,
  }));

  const medicsData = medics.map((m) => ({
    'الاسم': m.name,
    'الهاتف': m.phone,
    'الدور': m.role,
    'الحالة': m.status,
  }));

  exportToCSV(opsData, `${center.name}-operations`);
  exportToCSV(medicsData, `${center.name}-medics`);
}
