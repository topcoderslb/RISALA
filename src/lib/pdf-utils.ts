import jsPDF from 'jspdf';
import { Operation, CenterDamageEvent, VehicleDamageEvent, InjuredMedicEvent, MartyrMedicEvent, CenterInfo, Deployment } from './types';

// ─── Shared HTML-to-PDF renderer ─────────────────────────────────────────────
// Renders an HTML string inside a hidden element, captures it with html2canvas,
// and embeds the resulting image into a jsPDF document. The browser handles all
// text shaping so Arabic (and RTL) is rendered perfectly using the Tajawal font.

async function htmlToPDF(html: string, filename: string): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;

  // Preload the logo image before rendering
  await new Promise<void>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = '/risala.png';
  });

  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'width:794px',
    'background:white',
    "font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif",
    'direction:rtl',
    'padding:0',
    'box-sizing:border-box',
    'color:#1e293b',
    'font-size:14px',
    'line-height:1.7',
    '-webkit-font-smoothing:antialiased',
    'text-rendering:optimizeLegibility',
  ].join(';');
  container.innerHTML = html;
  document.body.appendChild(container);

  // Wait for fonts & images to fully load
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 500));

  try {
    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

// ─── Format date in Arabic ───────────────────────────────────────────────────
function formatArabicDate(dateStr?: string): string {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    const day = d.getDate();
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr || new Date().toLocaleDateString('ar');
  }
}

// ─── Shared header with logo ─────────────────────────────────────────────────
function pdfHeader(title: string, subtitle?: string) {
  return `
  <table style="width:100%;border-collapse:collapse;background:linear-gradient(135deg,#0d9668 0%,#10b981 50%,#34d399 100%);direction:rtl;" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:90px;padding:24px 16px 24px 0;vertical-align:middle;text-align:center;">
        <img src="/risala.png" crossorigin="anonymous" style="width:68px;height:68px;border-radius:14px;border:3px solid rgba(255,255,255,0.3);object-fit:contain;background:white;padding:4px;" />
      </td>
      <td style="padding:24px 8px 24px 24px;vertical-align:middle;">
        <div style="color:#d1fae5;font-size:13px;margin-bottom:6px;letter-spacing:0.3px;font-weight:500;">جمعية الرسالة للإسعاف الصحي - المنطقة الثانية</div>
        <div style="color:white;font-size:24px;font-weight:800;margin:4px 0;letter-spacing:0.2px;">${title}</div>
        ${subtitle ? `<div style="color:#a7f3d0;font-size:13px;font-weight:500;margin-top:6px;">${subtitle}</div>` : ''}
      </td>
    </tr>
  </table>`;
}

// ─── Shared footer ───────────────────────────────────────────────────────────
function pdfFooter(exportDate: string) {
  return `
  <table style="width:100%;border-collapse:collapse;margin-top:32px;border-top:3px solid #10b981;background:#f8faf9;direction:rtl;" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:14px 24px;vertical-align:middle;">
        <img src="/risala.png" crossorigin="anonymous" style="width:24px;height:24px;border-radius:6px;object-fit:contain;vertical-align:middle;margin-left:8px;" />
        <span style="font-size:11px;color:#10b981;font-weight:700;vertical-align:middle;">جمعية الرسالة للإسعاف الصحي - المنطقة الثانية</span>
      </td>
      <td style="padding:14px 24px;text-align:left;vertical-align:middle;">
        <span style="font-size:11px;color:#64748b;font-weight:500;">تاريخ التصدير: ${exportDate}</span>
      </td>
    </tr>
  </table>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function typeColor(type: string) {
  if (type === 'EMS') return '#3b82f6';
  if (type === 'FIRE') return '#ef4444';
  return '#f97316';
}
function typeLabel(type: string) {
  if (type === 'EMS') return 'إسعاف';
  if (type === 'FIRE') return 'إطفاء';
  return 'إنقاذ';
}
function row(label: string, value: string) {
  return `<tr>
    <td style="padding:12px 20px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;width:35%;white-space:nowrap;background:#fafbfc;font-weight:600;">${label}</td>
    <td style="padding:12px 20px;font-size:14px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;word-break:break-word;">${value}</td>
  </tr>`;
}

// ─── Operation PDF ────────────────────────────────────────────────────────────
export async function exportOperationToPDF(operation: Operation): Promise<void> {
  const exportDate = formatArabicDate();

  const html = `
  <div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('تقرير حالة', 'رقم الحالة: ' + operation.caseId)}

  <div style="padding:32px 40px">
    <div style="background:#f8fafc;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('رقم الموافقة', operation.approvalNumber)}
        ${row('اسم الحالة', operation.caseName)}
        ${row('النوع', '<span style="background:' + typeColor(operation.type) + ';color:white;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:700;">' + typeLabel(operation.type) + '</span>')}
        ${row('التاريخ', formatArabicDate(operation.date))}
        ${row('الوقت', operation.time)}
        ${row('المركز', operation.centerName)}
        ${row('الموقع', operation.location || '—')}
        ${operation.vehicleType ? row('نوع السيارة', operation.vehicleType) : ''}
        ${operation.vehicleNumber ? row('رقم السيارة', '<span dir="ltr">' + operation.vehicleNumber + '</span>') : ''}
        ${operation.memberNames?.length ? row('الفريق', operation.memberNames.join(' ، ')) : ''}
      </table>
    </div>

    ${operation.report ? `
    <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:14px;padding:20px 24px;margin-bottom:20px;">
      <div style="font-size:12px;color:#15803d;margin-bottom:10px;font-weight:800;">نوع الحالة / الوصف</div>
      <div style="font-size:14px;color:#1e293b;line-height:2;">${operation.report}</div>
    </div>` : ''}
  </div>

  ${pdfFooter(exportDate)}
  </div>`;

  await htmlToPDF(html, 'حالة-' + operation.caseId + '.pdf');
}

// ─── Report PDF ───────────────────────────────────────────────────────────────
export async function exportReportToPDF(
  title: string,
  data: { label: string; value: string | number }[],
  chartData?: { name: string; value: number }[]
): Promise<void> {
  const exportDate = formatArabicDate();

  const dataRows = data.map(({ label, value }) => row(label, String(value))).join('');

  const chartRows = chartData?.map(({ name, value }) => `
    <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #f1f5f9;direction:rtl;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:12px 0;font-size:14px;color:#475569;font-weight:500;">${name}</td>
        <td style="padding:12px 0;font-weight:800;color:#10b981;font-size:16px;text-align:left;">${value}</td>
      </tr>
    </table>`).join('') ?? '';

  const html = `
  <div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader(title)}

  <div style="padding:32px 40px">
    <div style="background:#f8fafc;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${dataRows}
      </table>
    </div>

    ${chartRows ? `
    <div style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;margin-bottom:20px;">
      <div style="font-size:14px;color:#10b981;font-weight:800;margin-bottom:16px;padding-bottom:10px;border-bottom:3px solid #10b981;display:inline-block;">إحصائيات تفصيلية</div>
      ${chartRows}
    </div>` : ''}
  </div>

  ${pdfFooter(exportDate)}
  </div>`;

  await htmlToPDF(html, title + '.pdf');
}

// ─── HTML to Image renderer ──────────────────────────────────────────────────
async function htmlToImage(html: string, filename: string): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;

  await new Promise<void>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = '/risala.png';
  });

  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'width:794px',
    'background:white',
    "font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif",
    'direction:rtl',
    'padding:0',
    'box-sizing:border-box',
    'color:#1e293b',
    'font-size:14px',
    'line-height:1.7',
    '-webkit-font-smoothing:antialiased',
    'text-rendering:optimizeLegibility',
  ].join(';');
  container.innerHTML = html;
  document.body.appendChild(container);

  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 500));

  try {
    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    document.body.removeChild(container);
  }
}

// ─── Operation Image ──────────────────────────────────────────────────────────
export async function exportOperationToImage(operation: Operation): Promise<void> {
  const exportDate = formatArabicDate();

  const html = `
  <div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('تقرير حالة', 'رقم الحالة: ' + operation.caseId)}

  <div style="padding:32px 40px">
    <div style="background:#f8fafc;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('رقم الموافقة', operation.approvalNumber)}
        ${row('اسم الحالة', operation.caseName)}
        ${row('النوع', '<span style="background:' + typeColor(operation.type) + ';color:white;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:700;">' + typeLabel(operation.type) + '</span>')}
        ${row('التاريخ', formatArabicDate(operation.date))}
        ${row('الوقت', operation.time)}
        ${row('المركز', operation.centerName)}
        ${row('الموقع', operation.location || '—')}
        ${operation.vehicleType ? row('نوع السيارة', operation.vehicleType) : ''}
        ${operation.vehicleNumber ? row('رقم السيارة', '<span dir="ltr">' + operation.vehicleNumber + '</span>') : ''}
        ${operation.memberNames?.length ? row('الفريق', operation.memberNames.join(' ، ')) : ''}
      </table>
    </div>

    ${operation.report ? `
    <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:14px;padding:20px 24px;margin-bottom:20px;">
      <div style="font-size:12px;color:#15803d;margin-bottom:10px;font-weight:800;">نوع الحالة / الوصف</div>
      <div style="font-size:14px;color:#1e293b;line-height:2;">${operation.report}</div>
    </div>` : ''}
  </div>

  ${pdfFooter(exportDate)}
  </div>`;

  await htmlToImage(html, 'حالة-' + operation.caseId + '.png');
}

// ─── Labels ───────────────────────────────────────────────────────────────────
const damageLevelLabel: Record<string, string> = { total: 'تدمير كامل', partial: 'تدمير جزئي', cracks: 'تصدعات وتكسر زجاج' };
const attackTypeLabel: Record<string, string> = { direct: 'غارة مباشرة', nearby: 'غارة قريبة' };
const damageSizeLabel: Record<string, string> = { big: 'كبير', small: 'صغير' };
const maintenanceTypeLabel: Record<string, string> = { direct: 'صيانة مباشرة', difficult: 'صعوبة إجراء الصيانة' };
const fieldStatusLabel: Record<string, string> = { out_of_service: 'خارجة عن الخدمة', in_service: 'دخلت الخدمة' };
const severityLabel: Record<string, string> = { serious: 'خطيرة', moderate: 'متوسطة', minor: 'طفيفة' };
const followUpLabel: Record<string, string> = { medical: 'طبية', surgical: 'جراحية', pharmaceutical: 'دوائية' };

// ─── Single Event PDFs ────────────────────────────────────────────────────────

export async function exportCenterDamageToPDF(item: CenterDamageEvent): Promise<void> {
  const exportDate = formatArabicDate();
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('استمارة أضرار مركز', item.centerName)}
  <div style="padding:32px 40px">
    <div style="background:#f8fafc;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('المركز', item.centerName)}
        ${row('مستوى الضرر', damageLevelLabel[item.damageLevel] || item.damageLevel)}
        ${row('نوع الاعتداء', attackTypeLabel[item.attackType] || item.attackType)}
        ${row('تاريخ الاعتداء', formatArabicDate(item.attackDate))}
        ${row('تقدير كلفة الصيانة', item.estimatedCost || '—')}
        ${item.notes ? row('ملاحظات', item.notes) : ''}
      </table>
    </div>
  </div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'أضرار-مركز-' + item.centerName + '.pdf');
}

export async function exportVehicleDamageToPDF(item: VehicleDamageEvent): Promise<void> {
  const exportDate = formatArabicDate();
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('استمارة أضرار سيارة', item.centerName)}
  <div style="padding:32px 40px">
    <div style="background:#f8fafc;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('المركز', item.centerName)}
        ${row('رقم السيارة', item.vehicleNumber)}
        ${row('النوع والموديل', item.vehicleTypeModel || '—')}
        ${row('تاريخ الحادثة', formatArabicDate(item.incidentDate))}
        ${row('حجم الضرر', damageSizeLabel[item.damageSize] || item.damageSize)}
        ${row('تقدير كلفة الصيانة', item.estimatedCost || '—')}
        ${row('نوع الصيانة', maintenanceTypeLabel[item.maintenanceType] || item.maintenanceType)}
        ${row('الوضع الميداني', fieldStatusLabel[item.fieldStatus] || item.fieldStatus)}
        ${item.resultingDefects ? row('الأعطال الناجمة', item.resultingDefects) : ''}
        ${item.notes ? row('ملاحظات', item.notes) : ''}
      </table>
    </div>
  </div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'أضرار-سيارة-' + item.vehicleNumber + '.pdf');
}

export async function exportInjuredMedicToPDF(item: InjuredMedicEvent): Promise<void> {
  const exportDate = formatArabicDate();
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('استمارة جريح مسعف', item.centerName)}
  <div style="padding:32px 40px">
    <div style="background:#f8fafc;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('المركز', item.centerName)}
        ${row('الاسم الثلاثي', item.fullName)}
        ${row('تاريخ الولادة', item.birthDate ? formatArabicDate(item.birthDate) : '—')}
        ${row('المهمة', item.mission || '—')}
        ${row('تاريخ الإصابة', formatArabicDate(item.injuryDate))}
        ${row('نوع الإصابة', item.injuryType || '—')}
        ${row('مكان الإصابة', item.injuryLocation || '—')}
        ${row('الخطورة', severityLabel[item.severity] || item.severity)}
        ${row('المستشفى', item.hospitalName || '—')}
        ${row('نوع المتابعة', followUpLabel[item.followUpType] || item.followUpType)}
        ${item.notes ? row('ملاحظات', item.notes) : ''}
      </table>
    </div>
  </div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'جريح-' + item.fullName + '.pdf');
}

export async function exportMartyrMedicToPDF(item: MartyrMedicEvent): Promise<void> {
  const exportDate = formatArabicDate();
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('استمارة شهيد مسعف', item.centerName)}
  <div style="padding:32px 40px">
    <div style="background:#f8fafc;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('المركز', item.centerName)}
        ${row('الاسم الثلاثي', item.fullName)}
        ${row('تاريخ الولادة', item.birthDate ? formatArabicDate(item.birthDate) : '—')}
        ${row('الوضع العائلي', item.familyStatus || '—')}
        ${row('المهمة', item.mission || '—')}
        ${row('تاريخ الاستشهاد', formatArabicDate(item.martyrdomDate))}
        ${row('مكان الاستشهاد', item.martyrdomPlace || '—')}
        ${row('المستشفى', item.hospitalName || '—')}
        ${item.notes ? row('ملاحظات', item.notes) : ''}
      </table>
    </div>
  </div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'شهيد-' + item.fullName + '.pdf');
}

// ─── Bulk Event PDFs ──────────────────────────────────────────────────────────

export async function exportAllCenterDamagesToPDF(items: CenterDamageEvent[]): Promise<void> {
  const exportDate = formatArabicDate();
  const rows = items.map(item => `<tr>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;">${item.centerName}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${damageLevelLabel[item.damageLevel]}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${attackTypeLabel[item.attackType]}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.attackDate}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.estimatedCost || '—'}</td>
  </tr>`).join('');
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('تقرير أضرار المراكز', items.length + ' سجل')}
  <div style="padding:24px 30px">
    <table style="width:100%;border-collapse:collapse;text-align:right;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">المركز</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">مستوى الضرر</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">نوع الاعتداء</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">التاريخ</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">الكلفة</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'تقرير-أضرار-المراكز.pdf');
}

export async function exportAllVehicleDamagesToPDF(items: VehicleDamageEvent[]): Promise<void> {
  const exportDate = formatArabicDate();
  const rows = items.map(item => `<tr>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;">${item.centerName}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.vehicleNumber}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.vehicleTypeModel || '—'}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.incidentDate}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${fieldStatusLabel[item.fieldStatus]}</td>
  </tr>`).join('');
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('تقرير أضرار السيارات', items.length + ' سجل')}
  <div style="padding:24px 30px">
    <table style="width:100%;border-collapse:collapse;text-align:right;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">المركز</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">رقم السيارة</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">النوع/الموديل</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">التاريخ</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">الوضع</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'تقرير-أضرار-السيارات.pdf');
}

export async function exportAllInjuredMedicsToPDF(items: InjuredMedicEvent[]): Promise<void> {
  const exportDate = formatArabicDate();
  const rows = items.map(item => `<tr>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;">${item.centerName}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.fullName}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.injuryDate}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.injuryType || '—'}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${severityLabel[item.severity]}</td>
  </tr>`).join('');
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('تقرير جرحى المسعفين', items.length + ' سجل')}
  <div style="padding:24px 30px">
    <table style="width:100%;border-collapse:collapse;text-align:right;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">المركز</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">الاسم</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">تاريخ الإصابة</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">نوع الإصابة</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">الخطورة</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'تقرير-جرحى-المسعفين.pdf');
}

export async function exportAllMartyrMedicsToPDF(items: MartyrMedicEvent[]): Promise<void> {
  const exportDate = formatArabicDate();
  const rows = items.map(item => `<tr>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;">${item.centerName}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.fullName}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.martyrdomDate}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.martyrdomPlace || '—'}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;">${item.mission || '—'}</td>
  </tr>`).join('');
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('تقرير شهداء المسعفين', items.length + ' سجل')}
  <div style="padding:24px 30px">
    <table style="width:100%;border-collapse:collapse;text-align:right;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">المركز</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">الاسم</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">تاريخ الاستشهاد</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">مكان الاستشهاد</th>
        <th style="padding:12px 14px;font-size:12px;color:#475569;font-weight:700;border-bottom:2px solid #e2e8f0;">المهمة</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'تقرير-شهداء-المسعفين.pdf');
}

// ─── Center Info PDF ──────────────────────────────────────────────────────────

export async function exportCenterInfoToPDF(info: CenterInfo): Promise<void> {
  const exportDate = formatArabicDate();
  const vehicleRows = (nums: string[], type: string) => nums.map((n, i) => row(type + ' ' + (i + 1), n)).join('');
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('معلومات المركز', info.centerName)}
  <div style="padding:32px 40px">
    <div style="background:#f8fafc;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('اسم المركز', info.centerName)}
        ${row('البلدة', info.townName)}
        ${row('قائد الفرقة', info.squadLeaderName)}
        ${row('هاتف القائد', info.squadLeaderPhone)}
        ${row('عدد آليات الإسعاف', String(info.ambulanceCount))}
        ${info.ambulanceNumbers?.length ? vehicleRows(info.ambulanceNumbers, 'آلية إسعاف') : ''}
      </table>
    </div>
    ${info.hasFireDepartment ? `
    <div style="background:#fef2f2;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #fecaca;">
      <div style="padding:12px 20px;background:#fee2e2;font-weight:800;font-size:14px;color:#991b1b;">قسم الإطفاء</div>
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('مسؤول الإطفاء', info.fireManagerName || '—')}
        ${row('هاتف المسؤول', info.fireManagerPhone || '—')}
        ${row('عدد الآليات', String(info.fireVehicleCount || 0))}
        ${info.fireVehicleNumbers?.length ? vehicleRows(info.fireVehicleNumbers, 'آلية إطفاء') : ''}
      </table>
    </div>` : ''}
    ${info.hasRescueDepartment ? `
    <div style="background:#fffbeb;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid #fde68a;">
      <div style="padding:12px 20px;background:#fef3c7;font-weight:800;font-size:14px;color:#92400e;">قسم الإنقاذ</div>
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('مسؤول الإنقاذ', info.rescueManagerName || '—')}
        ${row('هاتف المسؤول', info.rescueManagerPhone || '—')}
        ${row('عدد الآليات', String(info.rescueVehicleCount || 0))}
        ${info.rescueVehicleNumbers?.length ? vehicleRows(info.rescueVehicleNumbers, 'آلية إنقاذ') : ''}
      </table>
    </div>` : ''}
  </div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'معلومات-مركز-' + info.centerName + '.pdf');
}

// ─── Deployments PDF ──────────────────────────────────────────────────────────

export async function exportDeploymentsToPDF(deployments: Deployment[], centerName?: string): Promise<void> {
  const exportDate = formatArabicDate();
  const cards = deployments.map(d => `
    <div style="background:#f8fafc;border-radius:14px;overflow:hidden;margin-bottom:16px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;">
        ${row('المركز', d.centerName)}
        ${row('الموقع', d.location)}
        ${row('التاريخ', formatArabicDate(d.date))}
        ${row('معلومات الآلية', d.vehicleInfo || '—')}
        ${row('الفريق المنتشر', d.teamMembers.join(' ، '))}
        ${d.notes ? row('ملاحظات', d.notes) : ''}
      </table>
    </div>`).join('');
  const html = `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  ${pdfHeader('سجل الانتشار', centerName || 'جميع المراكز')}
  <div style="padding:24px 30px">${cards}</div>
  ${pdfFooter(exportDate)}
  </div>`;
  await htmlToPDF(html, 'سجل-انتشار' + (centerName ? '-' + centerName : '') + '.pdf');
}
