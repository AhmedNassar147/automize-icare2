/*
 *
 * Helper: `generateAcceptanceLetterHtml`.
 *
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ministryLogo = path.resolve(__dirname, "../images/ministry.png");
const ehalaLogo = path.resolve(__dirname, "../images/ehala.png");

const providerLogo = path.resolve(__dirname, "../images/logo.jpeg");

const toBase64 = (imgPath) =>
  `data:image/png;base64,${fs.readFileSync(imgPath, { encoding: "base64" })}`;

const ministryFileUrl = toBase64(ministryLogo);
const ehalaFileUrl = toBase64(ehalaLogo);
const providerFileUrl = toBase64(providerLogo);

const htmlLayouts = {
  TADAWI: ({
    nationalId,
    nationality,
    patientName,
    requestDate,
    referralId,
    specialty,
    subSpecialty,
    sourceProvider,
    mobileNumber,
    requestedBedType,
    isRejection,
    clientInPdf,
    clientMangerName,
    clientManagerPhone,
    showLetterFinalFooter,
  }) => {
    return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <title>${isRejection ? "نموذج رفض الإحالة" : "نموذج الإحالة"}</title>
    <style>
      body {
        margin: 0;
        padding: 15px;
        background: #fff;
        font-family: "Arial", sans-serif;
        font-size: 15px;
        direction: rtl;
      }

      .container {
        max-width: 900px;
        margin: auto;
        border: 1px solid #ccc;
        padding: 15px;
      }

      .header-logos {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .header-logos img {
        height: 50px;
      }

      .header-center-text {
        text-align: center;
        flex-grow: 1;
        font-size: 16px;
        line-height: 1.5;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
      }

      td {
        border: 1px solid #999;
        padding: 8px 10px;
        font-size: 15px;
      }

      td strong {
        font-size: 16px;
      }

      .section-title td {
        background: #eaeacb;
        text-align: center;
        font-weight: bold;
      }

      .footer {
        text-align: center;
        margin-top: 20px;
      }

      .notes-section {
        margin-top: 10px;
        padding-top: 10px;
      }

      .notes-header {
        text-align: center;
        padding: 10px;
        font-weight: bold;
        border: 1px solid #ccc;
      }

      .notes-body {
        background: #e7f3f8;
        padding: 15px 20px;
        border: 1px solid #ccc;
        border-top: none;
      }

      .notes-body ul {
        margin: 0;
        padding-right: 20px;
      }

      .notes-footer {
        display: flex;
        justify-content: space-between;
        border: 1px solid #ccc;
        background: #f3f0d7;
        margin-top: 10px;
      }

      .notes-footer div {
        flex: 1;
        padding: 10px;
        font-weight: bold;
        border-left: 1px solid #ccc;
        font-size: 14px;
      }

      .notes-footer div:last-child {
        border-left: none;
      }

      @media print {
        html, body {
          margin: 0;
          padding: 0;
        }

        @page {
          size: A4;
          margin: 10mm;
        }

        table, tr, td {
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header-logos">
        <img src="${ehalaFileUrl}" alt="Referral Program">
        <div class="header-center-text">
          المملكة العربية السعودية
          <br>وزارة الصحة
          <br>برنامج الإحالة
          <br>${isRejection ? "إشعار رفض الإحالة" : "إشعار قبول الإحالة"}
        </div>
        <img src="${ministryFileUrl}" alt="Ministry of Health">
      </div>

      <table>
        <tr class="section-title"><td colspan="4">بيانات المريض</td></tr>
        <tr>
          <td><strong>اسم المريض:</strong> ${patientName}</td>
          <td><strong>رقم الإثبات:</strong> ${nationalId}</td>
          <td><strong>الجنسية:</strong> ${nationality || "SAUDI"}</td>
          <td><strong>رقم التواصل:</strong> ${mobileNumber || ""}</td>
        </tr>

        ${
          isRejection
            ? `
        <tr class="section-title"><td colspan="4">سبب الرفض</td></tr>
        <tr>
          <td colspan="4" style="text-align:center; font-weight:bold;">
            لا يوجد سرير متاح
          </td>
        </tr>
        `
            : `
        <tr class="section-title"><td colspan="4">بيانات القبول</td></tr>
        <tr>
          <td><strong>رقم الملف الطبي:</strong></td>
          <td><strong>القسم:</strong> ${specialty || ""}</td>
          <td><strong>الطبيب المعالج:</strong>${subSpecialty || ""}</td>
          <td><strong>رقم الغرفة:</strong></td>
        </tr>
        <tr>
          <td><strong>نوع السرير:</strong>${requestedBedType}</td>
          <td><strong>مدة الحجز:</strong> ٤٨ ساعة</td>
        </tr>
        <tr>
          <td colspan="2"><strong>التاريخ الميلادي:</strong> ${requestDate}</td>
          <td colspan="2"><strong>التاريخ الهجري:</strong></td>
        </tr>
        `
        }
      </table>

      <div style="display: flex; justify-content: space-between;">
        <div>
          <p>سعادة مدير مستشفى / <strong>${sourceProvider}</strong> المحترم</p>
          <p>السلام عليكم ورحمة الله وبركاته،</p>
          <p>إشارة لإحالة رقم <strong>${referralId}</strong> بتاريخ <strong>${requestDate}</strong> بشأن المريض الموضحة بياناته أعلاه،</p>
          <p>
            ${
              isRejection
                ? `نفيد سعادتكم بأنه لم يتم قبول المريض بسبب عدم توفر سرير في الوقت الحالي.`
                : `نفيد سعادتكم بأنه تم قبول المريض حسب ما هو موضح بمعلومات الحجز أعلاه.`
            }
            <br>يرجى اتخاذ كافة الإجراءات اللازمة لأمانة المريض مع مراعاة النقاط المذكورة أعلاه.
          </p>
        </div>

        <img src="${providerFileUrl}" alt="Logo" style="height: 150px; width: 150px;" />
      </div>

      <div class="footer">
        <p>وتقبلوا تحياتنا</p>
          <div style="text-align: center;">
            <strong>${clientInPdf}</strong>
          </div>
      </div>

      <div class="notes-section">
          ${
            isRejection
              ? ""
              : `
            <div class="notes-header">ملاحظات مهمة</div>
            <div class="notes-body">
              <ul>
                <li>يلتزم المستشفى المحال استقبال الحالة المحولة عند تحقق الهدف الأساسي من العلاج.</li>
                <li>الرجاء إحضار أصل هوية المريض عند الحضور للمستشفى.</li>
                <li>الرجاء إحضار أصل التقرير الطبي وصور الفحوصات والأشعة عند الحضور للمستشفى.</li>
                <li>عند اختلاف التاريخ الهجري مع التاريخ الميلادي يرجى اعتماد التاريخ الميلادي للمرجع.</li>
                <li>يرجى الالتزام بتاريخ الموعد المحدد ومدة حجز السرير حتى يتم خدمة المرضى بالشكل المطلوب.</li>
              </ul>
            </div>
        `
          }
          ${
            showLetterFinalFooter
              ? `
            <div class="notes-footer">
              <div>${requestDate}<br>التاريخ</div>
              <div>${clientMangerName || ""}</div>
              <div>${clientManagerPhone || ""}<br>تلفون قسم التنسيق</div>
            </div>
            `
              : ""
          }
      </div>
    </div>
  </body>
  </html>
  `;
  },
  HAYAA: ({
    nationalId,
    nationality,
    patientName,
    requestDate,
    referralId,
    specialty,
    subSpecialty,
    sourceProvider,
    mobileNumber,
    requestedBedType,
    isRejection,
    clientInPdf,
    clientMangerName,
    clientManagerPhone,
    showLetterFinalFooter,
  }) => {
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>إشعار قبول الإحالة</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #fff;
      font-family: "Arial", sans-serif;
      direction: rtl;
      font-size: 15px;
      color: #222;
    }

    .container {
      max-width: 900px;
      margin: auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 25px;
    }

    .header-logo {
      height: 55px;
    }

    .header-title {
      text-align: center;
      font-size: 18px;
      line-height: 1.6;
      font-weight: bold;
    }

    .card {
      background: #f7f7f7;
      border-radius: 8px;
      padding: 12px 10px;
      margin-bottom: 8px;
      border: 1px solid #e0e0e0;
    }

    .card-title {
      font-weight: bold;
      font-size: 15px;
      margin-bottom: 12px;
      color: #333;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .item-label {
      font-weight: bold;
      color: #444;
    }

    .letter-body {
      margin-top: 12px;
      display: flex;
      gap: 10px;
      justify-content: space-between;
    }

    .letter-inner-body {
      line-height: 1.4;
      font-size: 15px;
    }

    .provider-section {
      align-items: flex-start;
    }

    .provider-logo {
      height: 140px;
      width: 140px;
      object-fit: contain;
    }

    .notes {
      margin-top: 15px;
    }

    .notes-header {
      background: #eef6f9;
      padding: 10px;
      font-weight: bold;
      border: 1px solid #d5e7ef;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }

    .notes-body {
      padding: 15px 20px;
      border: 1px solid #d5e7ef;
      border-top: none;
      border-radius: 0 0 8px 8px;
      background: #f3fafe;
    }

    .notes-body ul {
      margin: 0;
      padding-right: 20px;
      line-height: 1.6;
    }

    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 15px;
      font-weight: bold;
    }

    .final-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
      background: #fff9d9;
      padding: 12px;
      border: 1px solid #e6deba;
      border-radius: 6px;
      font-size: 14px;
      line-height: 1.7;
    }

    @media print {
      body {
        padding: 0;
      }
      @page {
        size: A4;
        margin: 12mm;
      }
    }
  </style>
</head>


<body>
  <div class="container">
    <div class="header">
      <img src="${ehalaFileUrl}" class="Referral Program" />
      <div class="header-title">
        المملكة العربية السعودية<br />
        وزارة الصحة<br />
        برنامج الإحالة<br />
        ${isRejection ? "إشعار رفض الإحالة" : "إشعار قبول الإحالة"}
      </div>
      <img src="${ministryFileUrl}" class="header-logo" />
    </div>

    <div class="card">
      <div class="card-title">بيانات المريض</div>
      <div class="grid-2">
        <div><span class="item-label">اسم المريض:</span> ${patientName}</div>
        <div><span class="item-label">رقم الإثبات:</span> ${nationalId}</div>
        <div><span class="item-label">الجنسية:</span> ${nationality}</div>
        <div><span class="item-label">رقم التواصل:</span> ${mobileNumber}</div>
      </div>
    </div>

    <div class="card">
    ${
      isRejection
        ? `
        <div class="grid-2">
          <div><span class="item-label">سبب الرفض:</span> لا يوجد سرير</div>
        </div>
        `
        : `
        <div class="card-title">بيانات القبول</div>
        <div class="grid-2">
          <div><span class="item-label">الطبيب المعالج:</span> ${subSpecialty}</div>
          <div><span class="item-label">القسم:</span> ${specialty}</div>
          <div><span class="item-label">نوع السرير:</span> ${requestedBedType}</div>
          <div><span class="item-label">مدة الحجز:</span> ٤٨ ساعة</div>
          <div><span class="item-label">التاريخ الميلادي:</span> ${requestDate}</div>
        </div>
        `
    }
      </div>


    <div class="letter-body">
      <div class="letter-inner-body">
        <p>سعادة مدير مستشفى / <strong>${sourceProvider}</strong> المحترم</p>

        <p>السلام عليكم ورحمة الله وبركاته،</p>

        <p>
          إشارة لإحالة رقم <strong>${referralId}</strong> بتاريخ
          <strong>${requestDate}</strong> بشأن المريض الموضحة بياناته أعلاه،
        </p>

        <p>
          نفيد سعادتكم بأنه ${
            isRejection ? "لن يتم" : "تم"
          }  قبول المريض حسب ما هو موضح بمعلومات الحجز أعلاه.
          <br />يرجى اتخاذ كافة الإجراءات اللازمة لأمانة المريض.
        </p>
      </div>

      <div class="provider-section">
        <img src="${providerFileUrl}" class="provider-logo" />
      </div>
    </div>

    <div class="footer">
      وتقبلوا تحياتنا<br />
      <strong>${clientInPdf}</strong>
    </div>


    ${
      isRejection
        ? ""
        : `
        <div class="notes">
         <div class="notes-header">ملاحظات مهمة</div>
        <div class="notes-body">
        <ul>
          <li>يلتزم المستشفى المحال استقبال الحالة المحولة عند تحقق الهدف الأساسي من العلاج.</li>
          <li>إحضار أصل هوية المريض عند الحضور.</li>
          <li>إحضار أصل التقرير الطبي وصور الفحوصات والأشعة.</li>
          <li>عند اختلاف التاريخ الهجري والميلادي يرجى اعتماد الميلادي.</li>
          <li>الالتزام بمدة حجز السرير والموعد المحدد.</li>
        </ul>
      </div>
    </div>
        `
    }

    ${
      showLetterFinalFooter
        ? `
      <div class="final-footer">
        <div>${requestDate}<br />التاريخ</div>
        <div>${clientMangerName}</div>
        <div>${clientManagerPhone}<br />تلفون قسم التنسيق</div>
      </div>
      `
        : ""
    }
  </div>
</body>
</html>
`;
  },
};

const generateAcceptanceLetterHtml = ({
  nationalId,
  nationality,
  patientName,
  requestDate: _requestDate,
  referralId,
  specialty,
  subSpecialty,
  sourceProvider,
  mobileNumber,
  requestedBedType,
  isRejection,
  clientInPdf,
  clientMangerName,
  clientManagerPhone,
  clientId,
}) => {
  const [date] = _requestDate.split("T");
  const [year, month, day] = date.split("-");
  const requestDate = `${day}/${month}/${year}`;

  const showLetterFinalFooter = !!(clientMangerName || clientManagerPhone);

  const _clientId = clientId || "HAYAA";
  const htmlCreator = htmlLayouts[_clientId];

  return htmlCreator({
    nationalId,
    nationality,
    patientName,
    requestDate,
    referralId,
    specialty,
    subSpecialty,
    sourceProvider,
    mobileNumber,
    requestedBedType,
    isRejection,
    clientInPdf,
    clientMangerName,
    clientManagerPhone,
    showLetterFinalFooter,
  });
};

export default generateAcceptanceLetterHtml;
