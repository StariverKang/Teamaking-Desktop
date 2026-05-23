import { Resend } from "resend";
import { ApiError } from "@/lib/http";

type VerificationEmailInput = {
  email: string;
  code: string;
  schoolName?: string;
};

let resendClient: Resend | null = null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  resendClient ??= new Resend(apiKey);
  return resendClient;
}

function verificationEmailHtml(email: string, code: string, schoolName?: string) {
  const schoolLine = schoolName ? `<p style="margin:0 0 16px;color:#475569;">学校：${escapeHtml(schoolName)}</p>` : "";
  const emailLine = `<p style="margin:0 0 16px;color:#475569;">登录邮箱：${escapeHtml(email)}</p>`;
  const escapedCode = escapeHtml(code);

  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a;">
      <h1 style="margin:0 0 16px;font-size:22px;">TEAMAKING 验证码</h1>
      ${schoolLine}
      ${emailLine}
      <p style="margin:0 0 12px;">请输入下面的 6 位验证码完成学校邮箱登录：</p>
      <p style="margin:0 0 16px;font-size:30px;font-weight:700;letter-spacing:6px;">${escapedCode}</p>
      <p style="margin:0;color:#64748b;">验证码 10 分钟内有效。如果不是你本人操作，可以忽略这封邮件。</p>
    </div>
  `;
}

function recipientFor(email: string) {
  if (process.env.NODE_ENV === "production") return email;
  return process.env.RESEND_TEST_RECIPIENT_EMAIL || email;
}

export function shouldExposeVerificationCode() {
  return process.env.EMAIL_DEBUG_CODE_RESPONSE === "true" || (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production");
}

export async function sendVerificationEmail({ email, code, schoolName }: VerificationEmailInput) {
  const client = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL;
  const recipient = recipientFor(email);

  if (!client) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(500, "邮件服务尚未配置，请稍后再试。");
    }

    console.info(`[email:dev] TEAMAKING verification code for ${email}: ${code}`);
    return;
  }

  if (!from) {
    throw new ApiError(500, "邮件发件地址尚未配置，请设置 RESEND_FROM_EMAIL。");
  }

  const { error } = await client.emails.send({
    from,
    to: recipient,
    subject: "你的 TEAMAKING 验证码",
    html: verificationEmailHtml(email, code, schoolName),
    text: `你的 TEAMAKING 验证码是 ${code}，10 分钟内有效。登录邮箱：${email}。`
  });

  if (error) {
    console.error("Resend failed to send verification email", error);
    if (error.message.toLowerCase().includes("resolved") || error.message.toLowerCase().includes("fetch")) {
      throw new ApiError(502, "无法连接 Resend 邮件服务，请检查当前网络、DNS 或代理后再试。");
    }

    throw new ApiError(502, "验证码邮件发送失败，请稍后再试。");
  }
}
