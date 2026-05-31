import { ses } from "tencentcloud-sdk-nodejs-ses";
import { ApiError } from "@/lib/http";
import { isDesktopRuntime } from "@/lib/server/runtime-paths";

type VerificationEmailInput = {
  email: string;
  code: string;
  schoolName?: string;
  purpose?: "register" | "reset_password" | "login";
};

const SesClient = ses.v20201002.Client;

type SesClientInstance = InstanceType<typeof SesClient>;

let sesClient: SesClientInstance | null = null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSesClient() {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey) return null;

  sesClient ??= new SesClient({
    credential: {
      secretId,
      secretKey
    },
    region: process.env.TENCENTCLOUD_SES_REGION || "ap-guangzhou",
    profile: {
      signMethod: "TC3-HMAC-SHA256",
      httpProfile: {
        reqMethod: "POST",
        reqTimeout: 30
      }
    }
  });

  return sesClient;
}

function emailCopy(purpose: VerificationEmailInput["purpose"]) {
  if (purpose === "reset_password") {
    return {
      subject: "重置你的 TEAMAKING 密码",
      title: "TEAMAKING 密码重置验证码",
      action: "重置密码"
    };
  }

  return {
    subject: "完成你的 TEAMAKING 邮箱注册",
    title: "TEAMAKING 注册验证码",
    action: "完成注册"
  };
}

function templateIdForPurpose(purpose: VerificationEmailInput["purpose"]) {
  const specific =
    purpose === "reset_password"
      ? process.env.TENCENTCLOUD_SES_RESET_TEMPLATE_ID
      : process.env.TENCENTCLOUD_SES_REGISTER_TEMPLATE_ID;
  return Number(specific || process.env.TENCENTCLOUD_SES_TEMPLATE_ID || 0);
}

function verificationEmailHtml(email: string, code: string, schoolName?: string, purpose: VerificationEmailInput["purpose"] = "register") {
  const copy = emailCopy(purpose);
  const schoolLine = schoolName ? `<p style="margin:0 0 16px;color:#475569;">学校：${escapeHtml(schoolName)}</p>` : "";
  const emailLine = `<p style="margin:0 0 16px;color:#475569;">登录邮箱：${escapeHtml(email)}</p>`;
  const escapedCode = escapeHtml(code);

  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a;">
      <h1 style="margin:0 0 16px;font-size:22px;">${copy.title}</h1>
      ${schoolLine}
      ${emailLine}
      <p style="margin:0 0 12px;">请输入下面的 6 位验证码${copy.action}：</p>
      <p style="margin:0 0 16px;font-size:30px;font-weight:700;letter-spacing:6px;">${escapedCode}</p>
      <p style="margin:0;color:#64748b;">验证码 10 分钟内有效。如果不是你本人操作，可以忽略这封邮件。</p>
    </div>
  `;
}

function recipientFor(email: string) {
  if (process.env.NODE_ENV === "production") return email;
  return process.env.TENCENTCLOUD_SES_TEST_RECIPIENT_EMAIL || email;
}

function templateData(email: string, code: string, schoolName?: string, purpose: VerificationEmailInput["purpose"] = "register") {
  const copy = emailCopy(purpose);
  return JSON.stringify({
    code,
    email,
    schoolName: schoolName ?? "",
    action: copy.action,
    title: copy.title
  });
}

function simpleContent(email: string, code: string, schoolName?: string, purpose: VerificationEmailInput["purpose"] = "register") {
  const copy = emailCopy(purpose);
  const text = `你的 TEAMAKING ${copy.action}验证码是 ${code}，10 分钟内有效。登录邮箱：${email}。`;
  return {
    Html: Buffer.from(verificationEmailHtml(email, code, schoolName, purpose)).toString("base64"),
    Text: Buffer.from(text).toString("base64")
  };
}

export function shouldExposeVerificationCode() {
  return isDesktopRuntime() || process.env.EMAIL_DEBUG_CODE_RESPONSE === "true" || (!process.env.TENCENTCLOUD_SECRET_ID && process.env.NODE_ENV !== "production");
}

export async function sendVerificationEmail({ email, code, schoolName, purpose = "register" }: VerificationEmailInput) {
  const client = getSesClient();
  const from = process.env.TENCENTCLOUD_SES_FROM_EMAIL;
  const templateId = templateIdForPurpose(purpose);
  const recipient = recipientFor(email);
  const copy = emailCopy(purpose);

  if (!client) {
    if (process.env.NODE_ENV === "production" && !isDesktopRuntime()) {
      throw new ApiError(500, "腾讯云邮件服务尚未配置，请稍后再试。");
    }

    console.info(`[email:dev] TEAMAKING verification code for ${email}: ${code}`);
    return;
  }

  if (!from) {
    throw new ApiError(500, "邮件发件地址尚未配置，请设置 TENCENTCLOUD_SES_FROM_EMAIL。");
  }

  try {
    await client.SendEmail({
      FromEmailAddress: from,
      Destination: [recipient],
      Subject: copy.subject,
      ReplyToAddresses: process.env.TENCENTCLOUD_SES_REPLY_TO_EMAIL,
      TriggerType: 1,
      ...(templateId > 0
        ? {
            Template: {
              TemplateID: templateId,
              TemplateData: templateData(email, code, schoolName, purpose)
            }
          }
        : {
            Simple: simpleContent(email, code, schoolName, purpose)
          })
    });
  } catch (error) {
    console.error("Tencent Cloud SES failed to send verification email", error);
    throw new ApiError(502, "验证码邮件发送失败，请检查腾讯云邮件推送配置后再试。");
  }
}
