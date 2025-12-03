 export function escapeHtml(s: any) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildPayslipHtml(payload: any, logoUrl?: string) {
  const monthLabel = payload.month ?? '';
  const emp = payload.employee ?? {};
  const fmt = (n: any) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
  const daysPresent = Math.round(((emp.attendancePercentage ?? payload.attendancePercentage ?? 0) / 100) * 30);


     const logoHtml = logoUrl
    ? `<div class="logo-container" aria-hidden="true" style="position:relative;width:40px;height:40px;flex:0 0 40px;">
         <img src="${escapeHtml(logoUrl)}" alt="Company Logo"
           style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border-radius:999px;display:block;"
           onerror="this.style.display='none'"/>
       </div>`
    : `<div class="logo-wrap" aria-hidden="true" style="position:relative;width:40px;height:40px;border-radius:999px;background:#0f172a;display:inline-flex;align-items:center;justify-content:center;flex:0 0 40px;box-shadow:0 6px 18px rgba(2,6,23,0.08);">
         <div style="color:#fff;font-weight:700;font-size:18px;line-height:1;">L</div>
         <div style="position:absolute;right:-6px;top:-6px;width:12px;height:12px;border-radius:50%;background:#10b981;box-shadow:0 1px 0 rgba(0,0,0,0.08) inset;"></div>
       </div>`;
       
  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      /* Fonts & base */
      :root{
        --slate-50:#f8fafc;
        --slate-100:#f1f5f9;
        --slate-200:#e6e9ee;
        --slate-400:#94a3b8;
        --slate-500:#64748b;
        --slate-700:#334155;
        --slate-800:#0f172a;
        --emerald-50:#ecfdf5;
        --emerald-100:#d1fae5;
        --emerald-700:#065f46;
        --emerald-900:#064e3b;
        --yellow-50:#fffbeb;
        --yellow-200:#fef3c7;
        --yellow-800:#92400e;
        --danger:#dc2626;
      }
      html,body{height:100%}
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        background: var(--slate-50);
        color: var(--slate-800);
        margin: 0;
        padding: 20px;
        -webkit-font-smoothing:antialiased;
        -moz-osx-font-smoothing:grayscale;
      }

      /* card */
      #printable-area { 
        max-width: 720px;
        margin: 0 auto;
        background: #fff;
        border: 1px solid var(--slate-200);
        border-radius: 14px;
        padding: 32px;
        box-shadow: 0 6px 18px rgba(2,6,23,0.06);
      }

      /* header */
      .header {
        text-align:center;
        border-bottom:1px solid var(--slate-200);
        padding-bottom:20px;
        margin-bottom:20px;
      }
      .brand {
        display:inline-flex;
        align-items:center;
        gap:12px;
        margin-bottom:6px;
      }
      .logo-wrap {
        position:relative;
        width:40px;
        height:40px;
        border-radius:999px;
        background:var(--slate-800);
        display:inline-flex;
        align-items:center;
        justify-content:center;
        box-shadow: 0 6px 18px rgba(2,6,23,0.08);
      }
      
    

      .company h1 { margin:0; font-size:20px; font-weight:800; color:var(--slate-800); line-height:1; text-align:left; }
      .company p { margin:0; font-size:10px; color:var(--slate-500); font-weight:700; letter-spacing:1px; text-transform:uppercase; }

      .locations { color:var(--slate-400); font-size:11px; font-weight:700; letter-spacing:0.5px; margin-top:6px; text-transform:uppercase; }

      /* details grid (two columns) */
      .details {
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap:12px 20px;
        margin-bottom:20px;
        font-size:13px;
        color:var(--slate-700);
      }
      .field .label { font-size:10px; color:var(--slate-500); text-transform:uppercase; letter-spacing:1px; }
      .field .value { font-weight:700; color:var(--slate-800); margin-top:4px; }
      .text-right { text-align:right; }

      /* salary table */
      .salary-box {
        border:1px solid var(--slate-200);
        border-radius:10px;
        overflow:hidden;
        margin-bottom:20px;
        background:#fff;
      }
      .salary-header {
        display:grid;
        grid-template-columns:1fr 1fr;
        background:var(--slate-100);
        color:var(--slate-700);
        font-weight:700;
        padding:12px 14px;
        border-bottom:1px solid var(--slate-200);
      }
      .salary-body { padding:14px; display:block; font-size:13px; color:var(--slate-700); }
      .earning-row, .deduction-row {
        display:flex;
        justify-content:space-between;
        margin:8px 0;
      }
      .two-col {
        display:grid;
        grid-template-columns: 1fr 1fr;
      }
      .deductions-col { border-left:1px solid var(--slate-200); padding-left:14px; background: rgba(248,250,252,0.5); }

      hr.sep { border:none; border-top:1px dashed var(--slate-200); margin:12px 0; }

      .summary-row { display:flex; justify-content:space-between; font-weight:700; padding:12px 14px; background:#fbfdff; border-top:1px solid var(--slate-200); }
      .summary-row .deduction { color: var(--danger); }

      /* net pay band */
      .net-band {
        display:flex;
        justify-content:space-between;
        align-items:center;
        background:var(--emerald-50);
        border:1px solid var(--emerald-100);
        padding:14px;
        border-radius:10px;
        font-weight:800;
        margin-bottom:14px;
      }
      .net-band .amount { font-size:22px; color:var(--emerald-700); font-weight:900; }

      /* remarks */
      .remarks {
        background:var(--yellow-50);
        border:1px solid var(--yellow-200);
        padding:12px;
        border-radius:10px;
        margin-bottom:8px;
        color:var(--yellow-800);
      }
      .remarks .quote { font-style:italic; color:var(--slate-700); margin-top:6px; }

      .footer { font-size:10px; color:var(--slate-400); text-align:center; margin-top:18px; }

      @media print {
        body { background: #fff; padding:0; }
        #printable-area { box-shadow:none; border:none; margin:0; padding:18px; }
      }
    </style>
  </head>
  <body>
    <div id="printable-area">
      <div class="header">
        <div class="brand" style="justify-content:center;">
          <div class="logo-wrap" aria-hidden="true">
            ${logoHtml}
          </div>
          <div class="company" style="text-align:left;">
            <h1>Lomaa</h1>
            <p>IT SOLUTIONS</p>
          </div>
        </div>
        <div class="locations">India | USA | Australia | Ireland</div>
      </div>

      <div style="text-align:center; font-weight:700; color:var(--slate-700); margin-bottom:14px;">Payslip — ${escapeHtml(monthLabel)}</div>

      <div class="details">
        <div class="field">
          <div class="label">Employee Name</div>
          <div class="value">${escapeHtml(emp.name ?? payload.employeeName ?? 'N/A')}</div>
        </div>

        <div class="field text-right">
          <div class="label">Employee ID</div>
          <div class="value">${escapeHtml(payload.employeeId ?? 'N/A')}</div>
        </div>

        <div class="field">
          <div class="label">Department</div>
          <div class="value">${escapeHtml(emp.department ?? payload.employee?.department ?? 'N/A')}</div>
        </div>

        <div class="field text-right">
          <div class="label">Designation</div>
          <div class="value">${escapeHtml(emp.role ?? payload.employee?.role ?? 'N/A')}</div>
        </div>

        <div class="field">
          <div class="label">Bank Account</div>
          <div class="value">${escapeHtml(emp.bankAccountNumber ?? payload.employee?.bankAccountNumber ?? 'N/A')}</div>
        </div>

        <div class="field text-right">
          <div class="label">PAN Number</div>
          <div class="value">${escapeHtml((emp.pan ?? payload.employee?.pan ?? 'N/A').toString().toUpperCase())}</div>
        </div>

        <div class="field">
          <div class="label">PF No</div>
          <div class="value">${escapeHtml(emp.pfAccountNumber ?? payload.employee?.pfAccountNumber ?? 'N/A')}</div>
        </div>

        <div class="field text-right">
          <div class="label">Days Present</div>
          <div class="value">${daysPresent} days</div>
        </div>
      </div>

      <div class="salary-box">
        <div class="salary-header">
          <div>Earnings</div>
          <div style="text-align:right">Deductions</div>
        </div>

        <div class="salary-body two-col">
          <div>
            <div class="earning-row"><div>Basic Salary</div><div>${fmt(payload.earnings.basic)}</div></div>
            <div class="earning-row"><div>HRA</div><div>${fmt(payload.earnings.hra)}</div></div>
            <div class="earning-row"><div>DA</div><div>${fmt(payload.earnings.da)}</div></div>
            <div class="earning-row"><div>Special Allow.</div><div>${fmt(payload.earnings.specialAllowance)}</div></div>
          </div>

          <div class="deductions-col">
            <div class="deduction-row" style="justify-content:space-between;"><div>PF (12%)</div><div>${fmt(payload.deductions.pf)}</div></div>
            <div class="deduction-row" style="justify-content:space-between;"><div>ESI (0.75%)</div><div>${fmt(payload.deductions.esi)}</div></div>
            <div class="deduction-row" style="justify-content:space-between;"><div>Prof. Tax</div><div>${fmt(payload.deductions.pt)}</div></div>
            <div class="deduction-row" style="justify-content:space-between;"><div>TDS</div><div>${fmt(payload.deductions.tax)}</div></div>
          </div>
        </div>

        <hr class="sep" />

        <div class="summary-row">
          <div>Gross Earnings</div>
          <div>${fmt(payload.earnings.gross)}</div>
        </div>
        <div class="summary-row" style="border-top:none;">
          <div style="visibility:hidden">x</div>
          <div class="deduction">Total Ded. ${fmt(payload.deductions.totalDeductions)}</div>
        </div>
      </div>

      <div class="net-band">
        <div style="font-weight:900; color:var(--emerald-900);">Net Pay</div>
        <div class="amount">${fmt(payload.netSalary)}</div>
      </div>

      ${payload.remarks ?? emp.remarks ? `
        <div class="remarks">
          <div style="display:flex;align-items:center;gap:8px;font-weight:700;text-transform:uppercase;font-size:11px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zM10 14l6-6" stroke="#92400e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            HR Remarks
          </div>
          <div class="quote">"${escapeHtml(payload.remarks ?? emp.remarks ?? '')}"</div>
        </div>
      ` : ''}

      <div class="footer">This is a system-generated payslip and does not require a signature.</div>
    </div>
  </body>
  </html>
  `;
}
