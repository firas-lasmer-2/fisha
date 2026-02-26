/**
 * Transactional email via Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY    — your Resend API key (re_...)
 *   RESEND_FROM_EMAIL — sender address (default: noreply@shifa.tn)
 *
 * All functions are fire-and-forget safe — they log errors but never throw,
 * so email failures never break primary request flows.
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL || "noreply@shifa.tn";
const APP_NAME = "Shifa شفاء";

// ─── HTML template helper ─────────────────────────────────────────────────────

function htmlWrap(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#f6f6f6; margin:0; padding:0; direction:rtl; }
    .wrap { max-width:560px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header { background:#1a6b55; color:#fff; padding:28px 32px; }
    .header h1 { margin:0; font-size:22px; font-weight:700; }
    .header p { margin:4px 0 0; opacity:.8; font-size:13px; }
    .body { padding:32px; color:#333; line-height:1.7; font-size:15px; }
    .body h2 { color:#1a6b55; margin-top:0; }
    .cta { display:inline-block; margin:20px 0 0; background:#1a6b55; color:#fff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:15px; }
    .footer { padding:20px 32px; font-size:12px; color:#888; border-top:1px solid #eee; text-align:center; }
    .badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600; }
    .badge-green { background:#d1fae5; color:#065f46; }
    .badge-red   { background:#fee2e2; color:#991b1b; }
    .badge-blue  { background:#dbeafe; color:#1e40af; }
    .detail-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f0f0f0; }
    .detail-label { color:#666; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>${APP_NAME}</h1>
    <p>منصة الصحة النفسية التونسية · Plateforme tunisienne de santé mentale</p>
  </div>
  <div class="body">
    ${bodyHtml}
  </div>
  <div class="footer">
    © ${new Date().getFullYear()} ${APP_NAME} · هذا البريد تم إرساله تلقائياً، يُرجى عدم الرد عليه<br/>
    Cet email est automatique, merci de ne pas y répondre.
  </div>
</div>
</body>
</html>`;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    const resend = getResend();
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[email] Failed to send email:", err);
  }
}

// ─── Email functions ──────────────────────────────────────────────────────────

export interface AppointmentEmailDetails {
  clientName: string;
  therapistName: string;
  scheduledAt: string;   // ISO string
  durationMinutes: number;
  sessionType: string;
  priceDinar: number | null;
  meetLink?: string | null;
}

export async function sendAppointmentConfirmation(
  to: string,
  details: AppointmentEmailDetails,
): Promise<void> {
  const date = new Date(details.scheduledAt);
  const dateStr = date.toLocaleString("ar-TN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const meetSection = details.meetLink
    ? `<p>🔗 <strong>رابط الجلسة:</strong> <a href="${details.meetLink}" style="color:#1a6b55">${details.meetLink}</a></p>`
    : "";

  const html = htmlWrap("تأكيد الموعد", `
    <h2>✅ تم تأكيد موعدك</h2>
    <p>مرحباً <strong>${details.clientName}</strong>،</p>
    <p>تم تأكيد موعدك مع <strong>${details.therapistName}</strong>.</p>
    <div class="detail-row"><span class="detail-label">التاريخ والوقت</span><span>${dateStr}</span></div>
    <div class="detail-row"><span class="detail-label">المدة</span><span>${details.durationMinutes} دقيقة</span></div>
    <div class="detail-row"><span class="detail-label">نوع الجلسة</span><span>${details.sessionType}</span></div>
    ${details.priceDinar != null ? `<div class="detail-row"><span class="detail-label">السعر</span><span>${details.priceDinar} د.ت</span></div>` : ""}
    ${meetSection}
    <p style="margin-top:20px;color:#666;font-size:13px;">
      Rendez-vous confirmé avec <strong>${details.therapistName}</strong> le ${date.toLocaleDateString("fr-TN")}.
    </p>
  `);

  await send(to, `تأكيد الموعد — ${details.therapistName} | ${APP_NAME}`, html);
}

export async function sendAppointmentReminder(
  to: string,
  details: AppointmentEmailDetails,
): Promise<void> {
  const meetSection = details.meetLink
    ? `<a href="${details.meetLink}" class="cta">انضم للجلسة · Rejoindre la séance</a>`
    : "";

  const html = htmlWrap("تذكير بالموعد", `
    <h2>⏰ موعدك خلال ساعة</h2>
    <p>مرحباً <strong>${details.clientName}</strong>،</p>
    <p>تذكير: موعدك مع <strong>${details.therapistName}</strong> سيبدأ خلال ساعة واحدة.</p>
    ${meetSection}
    <p style="margin-top:20px;color:#666;font-size:13px;">
      Rappel : votre séance avec <strong>${details.therapistName}</strong> commence dans 1 heure.
    </p>
  `);

  await send(to, `تذكير بالموعد — ${APP_NAME}`, html);
}

export async function sendVerificationStatusUpdate(
  to: string,
  therapistName: string,
  status: "approved" | "rejected",
  notes?: string | null,
): Promise<void> {
  const approved = status === "approved";
  const badgeClass = approved ? "badge-green" : "badge-red";
  const statusAr = approved ? "مقبول ✅" : "مرفوض ❌";
  const statusFr = approved ? "Approuvé" : "Rejeté";

  const html = htmlWrap("حالة التحقق", `
    <h2>تحديث حالة التحقق المهني</h2>
    <p>مرحباً <strong>${therapistName}</strong>،</p>
    <p>تم مراجعة ملفك المهني. الحالة: <span class="badge ${badgeClass}">${statusAr}</span></p>
    ${notes ? `<p><strong>ملاحظات:</strong> ${notes}</p>` : ""}
    ${!approved ? `<p>يمكنك تحديث وثائقك وإعادة التقديم من خلال لوحة تحكمك.</p>` : ""}
    <p style="margin-top:20px;color:#666;font-size:13px;">
      Mise à jour de votre vérification professionnelle : <strong>${statusFr}</strong>.
      ${notes ? `Notes : ${notes}` : ""}
    </p>
  `);

  await send(to, `حالة التحقق: ${statusAr} — ${APP_NAME}`, html);
}

export async function sendListenerApplicationUpdate(
  to: string,
  listenerName: string,
  status: "approved" | "rejected" | "changes_requested",
): Promise<void> {
  const statusMap: Record<string, { ar: string; fr: string; badge: string }> = {
    approved:           { ar: "مقبول ✅", fr: "Approuvée",           badge: "badge-green" },
    rejected:           { ar: "مرفوض ❌", fr: "Rejetée",             badge: "badge-red" },
    changes_requested:  { ar: "يتطلب تعديلات ⚠️", fr: "Modifications demandées", badge: "badge-blue" },
  };

  const { ar, fr, badge } = statusMap[status] ?? statusMap.changes_requested;

  const html = htmlWrap("طلب المستمع", `
    <h2>تحديث طلب المستمع</h2>
    <p>مرحباً <strong>${listenerName}</strong>،</p>
    <p>تم مراجعة طلبك ليصبح مستمعاً. الحالة: <span class="badge ${badge}">${ar}</span></p>
    ${status === "changes_requested" ? `<p>يُرجى مراجعة ملفك الشخصي وتحديث المعلومات المطلوبة.</p>` : ""}
    <p style="margin-top:20px;color:#666;font-size:13px;">
      Mise à jour de votre candidature d'écouteur : <strong>${fr}</strong>.
    </p>
  `);

  await send(to, `طلب المستمع: ${ar} — ${APP_NAME}`, html);
}

export async function sendWelcome(to: string, name: string): Promise<void> {
  const html = htmlWrap("مرحباً بك في شفاء", `
    <h2>مرحباً بك في شفاء 💚</h2>
    <p>مرحباً <strong>${name}</strong>،</p>
    <p>نحن سعداء بانضمامك إلى مجتمع شفاء — منصة الصحة النفسية التونسية.</p>
    <ul>
      <li>🧠 جلسات نفسية مع معالجين متخصصين</li>
      <li>💬 دعم الأقران في بيئة آمنة</li>
      <li>📓 تتبع مزاجك ومسيرتك العلاجية</li>
    </ul>
    <p style="margin-top:20px;color:#666;font-size:13px;">
      Bienvenue sur Shifa, la plateforme tunisienne de santé mentale.<br/>
      Bonjour <strong>${name}</strong>, nous sommes ravis de vous accueillir.
    </p>
  `);

  await send(to, `مرحباً بك في ${APP_NAME}`, html);
}
