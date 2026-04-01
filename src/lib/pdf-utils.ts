import jsPDF from 'jspdf';
import { Operation, CenterDamageEvent, VehicleDamageEvent, InjuredMedicEvent, MartyrMedicEvent, CenterInfo, Deployment } from './types';

// ─── Shared HTML-to-PDF renderer ─────────────────────────────────────────────
// Renders an HTML string inside a visible (but off-screen) element so the
// browser performs full Arabic text shaping (connecting letters). Then captures
// the result with html2canvas and produces a multi-page PDF. We use Google Fonts
// Tajawal via the CSS already loaded in globals.css.

async function htmlToPDF(html: string, filename: string): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;

  // Ensure Tajawal font is fully loaded before rendering
  await document.fonts.ready;
  try {
    await Promise.all([
      document.fonts.load('400 20px "Tajawal"'),
      document.fonts.load('500 20px "Tajawal"'),
      document.fonts.load('700 20px "Tajawal"'),
      document.fonts.load('800 20px "Tajawal"'),
      document.fonts.load('900 20px "Tajawal"'),
    ]);
  } catch {}

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
    "font-family:'Tajawal',sans-serif",
    'direction:rtl',
    'unicode-bidi:plaintext',
    'padding:0',
    'margin:0',
    'box-sizing:border-box',
    'color:#1e293b',
    'font-size:15px',
    'line-height:1.8',
    '-webkit-font-smoothing:antialiased',
    'text-rendering:optimizeLegibility',
    'word-break:break-word',
    'overflow-wrap:break-word',
  ].join(';');

  container.innerHTML = html;
  document.body.appendChild(container);

  // Force layout so the browser shapes Arabic glyphs with the loaded font
  container.getBoundingClientRect();
  await new Promise((r) => setTimeout(r, 500));

  const A4_WIDTH_PX = 794;
  const A4_HEIGHT_PX = 1123; // 297mm at 96dpi

  try {
    // Measure the full height
    const totalHeight = container.scrollHeight;
    const pages: HTMLCanvasElement[] = [];

    // Capture each A4-sized page separately to avoid cut-off text
    for (let y = 0; y < totalHeight; y += A4_HEIGHT_PX) {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: A4_WIDTH_PX,
        height: Math.min(A4_HEIGHT_PX, totalHeight - y),
        windowWidth: A4_WIDTH_PX,
        x: 0,
        y: y,
        scrollX: 0,
        scrollY: -y,
      });
      pages.push(canvas);
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;

    pages.forEach((canvas, idx) => {
      if (idx > 0) pdf.addPage();
      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, Math.min(imgHeight, pageHeight));
    });

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
  <div style="background:linear-gradient(135deg,#065f46 0%,#059669 50%,#10b981 100%);padding:0;margin:0;">
    <table style="width:100%;border-collapse:collapse;direction:rtl;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:120px;padding:28px 20px 28px 0;vertical-align:middle;text-align:center;">
          <img src="/risala.png" crossorigin="anonymous" style="width:90px;height:90px;border-radius:18px;border:3px solid rgba(255,255,255,0.4);object-fit:contain;background:white;padding:6px;" />
        </td>
        <td style="padding:28px 12px 28px 28px;vertical-align:middle;">
          <div style="color:#d1fae5;font-size:15px;margin-bottom:8px;letter-spacing:0.5px;font-weight:600;unicode-bidi:plaintext;direction:rtl;">جمعية الرسالة للإسعاف الصحي - المنطقة الثانية</div>
          <div style="color:white;font-size:28px;font-weight:900;margin:6px 0;letter-spacing:0.3px;unicode-bidi:plaintext;direction:rtl;">${title}</div>
          ${subtitle ? `<div style="color:#a7f3d0;font-size:15px;font-weight:600;margin-top:8px;unicode-bidi:plaintext;direction:rtl;">${subtitle}</div>` : ''}
        </td>
      </tr>
    </table>
  </div>`;
}

// ─── Shared footer ───────────────────────────────────────────────────────────
function pdfFooter(exportDate: string) {
  return `
  <div style="margin-top:36px;border-top:3px solid #10b981;background:#f0fdf4;">
    <table style="width:100%;border-collapse:collapse;direction:rtl;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:16px 28px;vertical-align:middle;">
          <img src="/risala.png" crossorigin="anonymous" style="width:28px;height:28px;border-radius:6px;object-fit:contain;vertical-align:middle;margin-left:10px;" />
          <span style="font-size:13px;color:#059669;font-weight:800;vertical-align:middle;unicode-bidi:plaintext;direction:rtl;">جمعية الرسالة للإسعاف الصحي - المنطقة الثانية</span>
        </td>
        <td style="padding:16px 28px;text-align:left;vertical-align:middle;">
          <span style="font-size:13px;color:#64748b;font-weight:600;unicode-bidi:plaintext;direction:rtl;">تاريخ التصدير: ${exportDate}</span>
        </td>
      </tr>
    </table>
  </div>`;
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
    <td style="padding:14px 24px;font-size:15px;color:#475569;border-bottom:1px solid #f1f5f9;width:35%;white-space:nowrap;background:#fafbfc;font-weight:700;unicode-bidi:plaintext;direction:rtl;">${label}</td>
    <td style="padding:14px 24px;font-size:16px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;word-break:break-word;overflow-wrap:break-word;unicode-bidi:plaintext;direction:rtl;">${value}</td>
  </tr>`;
}

// Wrap entire document body
function wrapDoc(inner: string) {
  return `<div style="font-family:Tajawal,'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;unicode-bidi:plaintext;width:794px;box-sizing:border-box;overflow:hidden;">${inner}</div>`;
}

// ─── Operation PDF ────────────────────────────────────────────────────────────
export async function exportOperationToPDF(operation: Operation): Promise<void> {
  const exportDate = formatArabicDate();

  const html = wrapDoc(`
  ${pdfHeader('تقرير حالة', 'رقم الحالة: ' + operation.caseId)}

  <div style="padding:36px 44px">
    <div style="background:#f8fafc;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
        ${row('رقم الموافقة', operation.approvalNumber)}
        ${row('اسم الحالة', operation.caseName)}
        ${row('النوع', '<span style="background:' + typeColor(operation.type) + ';color:white;padding:6px 20px;border-radius:20px;font-size:14px;font-weight:700;unicode-bidi:plaintext;">' + typeLabel(operation.type) + '</span>')}
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
    <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:16px;padding:24px 28px;margin-bottom:24px;">
      <div style="font-size:15px;color:#15803d;margin-bottom:12px;font-weight:800;unicode-bidi:plaintext;direction:rtl;">نوع الحالة / الوصف</div>
      <div style="font-size:16px;color:#1e293b;line-height:2.2;unicode-bidi:plaintext;direction:rtl;">${operation.report}</div>
    </div>` : ''}
  </div>

  ${pdfFooter(exportDate)}
  `);

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
        <td style="padding:14px 0;font-size:16px;color:#475569;font-weight:600;unicode-bidi:plaintext;direction:rtl;">${name}</td>
        <td style="padding:14px 0;font-weight:800;color:#10b981;font-size:18px;text-align:left;">${value}</td>
      </tr>
    </table>`).join('') ?? '';

  const html = wrapDoc(`
  ${pdfHeader(title)}

  <div style="padding:36px 44px">
    <div style="background:#f8fafc;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
        ${dataRows}
      </table>
    </div>

    ${chartRows ? `
    <div style="background:white;border-radius:16px;padding:28px;border:1px solid #e2e8f0;margin-bottom:24px;">
      <div style="font-size:16px;color:#10b981;font-weight:800;margin-bottom:18px;padding-bottom:12px;border-bottom:3px solid #10b981;display:inline-block;unicode-bidi:plaintext;direction:rtl;">إحصائيات تفصيلية</div>
      ${chartRows}
    </div>` : ''}
  </div>

  ${pdfFooter(exportDate)}
  `);

  await htmlToPDF(html, title + '.pdf');
}

// ─── HTML to Image renderer ──────────────────────────────────────────────────
async function htmlToImage(html: string, filename: string): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;

  await document.fonts.ready;
  try {
    await Promise.all([
      document.fonts.load('400 20px "Tajawal"'),
      document.fonts.load('700 20px "Tajawal"'),
      document.fonts.load('800 20px "Tajawal"'),
    ]);
  } catch {}

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
    'unicode-bidi:plaintext',
    'padding:0',
    'box-sizing:border-box',
    'color:#1e293b',
    'font-size:15px',
    'line-height:1.8',
    '-webkit-font-smoothing:antialiased',
    'text-rendering:optimizeLegibility',
    'word-break:break-word',
    'overflow-wrap:break-word',
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

  const html = wrapDoc(`
  ${pdfHeader('تقرير حالة', 'رقم الحالة: ' + operation.caseId)}

  <div style="padding:36px 44px">
    <div style="background:#f8fafc;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
        ${row('رقم الموافقة', operation.approvalNumber)}
        ${row('اسم الحالة', operation.caseName)}
        ${row('النوع', '<span style="background:' + typeColor(operation.type) + ';color:white;padding:6px 20px;border-radius:20px;font-size:14px;font-weight:700;unicode-bidi:plaintext;">' + typeLabel(operation.type) + '</span>')}
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
    <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:16px;padding:24px 28px;margin-bottom:24px;">
      <div style="font-size:15px;color:#15803d;margin-bottom:12px;font-weight:800;unicode-bidi:plaintext;direction:rtl;">نوع الحالة / الوصف</div>
      <div style="font-size:16px;color:#1e293b;line-height:2.2;unicode-bidi:plaintext;direction:rtl;">${operation.report}</div>
    </div>` : ''}
  </div>

  ${pdfFooter(exportDate)}
  `);

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
  const html = wrapDoc(`
  ${pdfHeader('استمارة أضرار مركز', item.centerName)}
  <div style="padding:36px 44px">
    <div style="background:#f8fafc;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
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
  `);
  await htmlToPDF(html, 'أضرار-مركز-' + item.centerName + '.pdf');
}

export async function exportVehicleDamageToPDF(item: VehicleDamageEvent): Promise<void> {
  const exportDate = formatArabicDate();
  const html = wrapDoc(`
  ${pdfHeader('استمارة أضرار سيارة', item.centerName)}
  <div style="padding:36px 44px">
    <div style="background:#f8fafc;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
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
  `);
  await htmlToPDF(html, 'أضرار-سيارة-' + item.vehicleNumber + '.pdf');
}

export async function exportInjuredMedicToPDF(item: InjuredMedicEvent): Promise<void> {
  const exportDate = formatArabicDate();
  const html = wrapDoc(`
  ${pdfHeader('استمارة جريح مسعف', item.centerName)}
  <div style="padding:36px 44px">
    <div style="background:#f8fafc;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
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
  `);
  await htmlToPDF(html, 'جريح-' + item.fullName + '.pdf');
}

export async function exportMartyrMedicToPDF(item: MartyrMedicEvent): Promise<void> {
  const exportDate = formatArabicDate();
  const html = wrapDoc(`
  ${pdfHeader('استمارة شهيد مسعف', item.centerName)}
  <div style="padding:36px 44px">
    <div style="background:#f8fafc;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
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
  `);
  await htmlToPDF(html, 'شهيد-' + item.fullName + '.pdf');
}

// ─── Bulk Event PDFs ──────────────────────────────────────────────────────────

export async function exportAllCenterDamagesToPDF(items: CenterDamageEvent[]): Promise<void> {
  const exportDate = formatArabicDate();
  const rows = items.map(item => `<tr>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;unicode-bidi:plaintext;direction:rtl;">${item.centerName}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${damageLevelLabel[item.damageLevel]}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${attackTypeLabel[item.attackType]}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.attackDate}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.estimatedCost || '—'}</td>
  </tr>`).join('');
  const html = wrapDoc(`
  ${pdfHeader('تقرير أضرار المراكز', items.length + ' سجل')}
  <div style="padding:28px 34px">
    <table style="width:100%;border-collapse:collapse;text-align:right;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;table-layout:fixed;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">المركز</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">مستوى الضرر</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">نوع الاعتداء</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">التاريخ</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">الكلفة</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${pdfFooter(exportDate)}
  `);
  await htmlToPDF(html, 'تقرير-أضرار-المراكز.pdf');
}

export async function exportAllVehicleDamagesToPDF(items: VehicleDamageEvent[]): Promise<void> {
  const exportDate = formatArabicDate();
  const rows = items.map(item => `<tr>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;unicode-bidi:plaintext;direction:rtl;">${item.centerName}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.vehicleNumber}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.vehicleTypeModel || '—'}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.incidentDate}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${fieldStatusLabel[item.fieldStatus]}</td>
  </tr>`).join('');
  const html = wrapDoc(`
  ${pdfHeader('تقرير أضرار السيارات', items.length + ' سجل')}
  <div style="padding:28px 34px">
    <table style="width:100%;border-collapse:collapse;text-align:right;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;table-layout:fixed;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">المركز</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">رقم السيارة</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">النوع/الموديل</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">التاريخ</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">الوضع</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${pdfFooter(exportDate)}
  `);
  await htmlToPDF(html, 'تقرير-أضرار-السيارات.pdf');
}

export async function exportAllInjuredMedicsToPDF(items: InjuredMedicEvent[]): Promise<void> {
  const exportDate = formatArabicDate();
  const rows = items.map(item => `<tr>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;unicode-bidi:plaintext;direction:rtl;">${item.centerName}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.fullName}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.injuryDate}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.injuryType || '—'}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${severityLabel[item.severity]}</td>
  </tr>`).join('');
  const html = wrapDoc(`
  ${pdfHeader('تقرير جرحى المسعفين', items.length + ' سجل')}
  <div style="padding:28px 34px">
    <table style="width:100%;border-collapse:collapse;text-align:right;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;table-layout:fixed;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">المركز</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">الاسم</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">تاريخ الإصابة</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">نوع الإصابة</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">الخطورة</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${pdfFooter(exportDate)}
  `);
  await htmlToPDF(html, 'تقرير-جرحى-المسعفين.pdf');
}

export async function exportAllMartyrMedicsToPDF(items: MartyrMedicEvent[]): Promise<void> {
  const exportDate = formatArabicDate();
  const rows = items.map(item => `<tr>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;unicode-bidi:plaintext;direction:rtl;">${item.centerName}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.fullName}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.martyrdomDate}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.martyrdomPlace || '—'}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;unicode-bidi:plaintext;direction:rtl;">${item.mission || '—'}</td>
  </tr>`).join('');
  const html = wrapDoc(`
  ${pdfHeader('تقرير شهداء المسعفين', items.length + ' سجل')}
  <div style="padding:28px 34px">
    <table style="width:100%;border-collapse:collapse;text-align:right;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;table-layout:fixed;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">المركز</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">الاسم</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">تاريخ الاستشهاد</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">مكان الاستشهاد</th>
        <th style="padding:14px 16px;font-size:14px;color:#475569;font-weight:800;border-bottom:2px solid #e2e8f0;unicode-bidi:plaintext;direction:rtl;">المهمة</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${pdfFooter(exportDate)}
  `);
  await htmlToPDF(html, 'تقرير-شهداء-المسعفين.pdf');
}

// ─── Center Info PDF ──────────────────────────────────────────────────────────

export async function exportCenterInfoToPDF(info: CenterInfo): Promise<void> {
  const exportDate = formatArabicDate();
  const vehicleRows = (nums: string[], type: string) => nums.map((n, i) => row(type + ' ' + (i + 1), n)).join('');
  const html = wrapDoc(`
  ${pdfHeader('معلومات المركز', info.centerName)}
  <div style="padding:36px 44px">
    <div style="background:#f8fafc;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
        ${row('اسم المركز', info.centerName)}
        ${row('البلدة', info.townName)}
        ${row('قائد الفرقة', info.squadLeaderName)}
        ${row('هاتف القائد', info.squadLeaderPhone)}
        ${row('عدد آليات الإسعاف', String(info.ambulanceCount))}
        ${info.ambulanceNumbers?.length ? vehicleRows(info.ambulanceNumbers, 'آلية إسعاف') : ''}
      </table>
    </div>
    ${info.hasFireDepartment ? `
    <div style="background:#fef2f2;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #fecaca;">
      <div style="padding:14px 24px;background:#fee2e2;font-weight:800;font-size:16px;color:#991b1b;unicode-bidi:plaintext;direction:rtl;">قسم الإطفاء</div>
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
        ${row('مسؤول الإطفاء', info.fireManagerName || '—')}
        ${row('هاتف المسؤول', info.fireManagerPhone || '—')}
        ${row('عدد الآليات', String(info.fireVehicleCount || 0))}
        ${info.fireVehicleNumbers?.length ? vehicleRows(info.fireVehicleNumbers, 'آلية إطفاء') : ''}
      </table>
    </div>` : ''}
    ${info.hasRescueDepartment ? `
    <div style="background:#fffbeb;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #fde68a;">
      <div style="padding:14px 24px;background:#fef3c7;font-weight:800;font-size:16px;color:#92400e;unicode-bidi:plaintext;direction:rtl;">قسم الإنقاذ</div>
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
        ${row('مسؤول الإنقاذ', info.rescueManagerName || '—')}
        ${row('هاتف المسؤول', info.rescueManagerPhone || '—')}
        ${row('عدد الآليات', String(info.rescueVehicleCount || 0))}
        ${info.rescueVehicleNumbers?.length ? vehicleRows(info.rescueVehicleNumbers, 'آلية إنقاذ') : ''}
      </table>
    </div>` : ''}
  </div>
  ${pdfFooter(exportDate)}
  `);
  await htmlToPDF(html, 'معلومات-مركز-' + info.centerName + '.pdf');
}

// ─── Deployments PDF ──────────────────────────────────────────────────────────

export async function exportDeploymentsToPDF(deployments: Deployment[], centerName?: string): Promise<void> {
  const exportDate = formatArabicDate();
  const cards = deployments.map(d => `
    <div style="background:#f8fafc;border-radius:16px;overflow:hidden;margin-bottom:18px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;text-align:right;table-layout:fixed;">
        ${row('المركز', d.centerName)}
        ${row('الموقع', d.location)}
        ${row('التاريخ', formatArabicDate(d.date))}
        ${row('معلومات الآلية', d.vehicleInfo || '—')}
        ${row('الفريق المنتشر', d.teamMembers.join(' ، '))}
        ${d.notes ? row('ملاحظات', d.notes) : ''}
      </table>
    </div>`).join('');
  const html = wrapDoc(`
  ${pdfHeader('سجل الانتشار', centerName || 'جميع المراكز')}
  <div style="padding:28px 34px">${cards}</div>
  ${pdfFooter(exportDate)}
  `);
  await htmlToPDF(html, 'سجل-انتشار' + (centerName ? '-' + centerName : '') + '.pdf');
}
