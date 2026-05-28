import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, created, ok, optionalString, readBody, stringArray } from "@/lib/http";
import { ERROR_CODES } from "@/lib/error-codes";
import { isAdminRole, requireUser } from "@/lib/session";
import { defaultContactVisibility } from "@/lib/contact";
import { demoPortfolioItems, demoUserForAccount, isDemoUser } from "@/lib/demo-data";
import { createDemoFollowRequest, sanitizeDemoUser } from "@/lib/demo-store";
import { extractReadableText, fileExtensionOf, hasAcceptableMimeForExtension, isAllowedProfileFile, isRiskyProfileFile, parseResumeText, previewKindForFile, profileUploadPurposeOptions, safeUploadName } from "@/lib/profile-assets";
import { storeProfileUpload } from "@/lib/upload-storage";
import { userInclude, academicLockForUser, publicUser } from "@/lib/server/services/user-service";
import { toJson, operationLog } from "@/lib/server/services/system-service";
import { assertSameSchool } from "@/lib/server/services/course-service";
import { publicUserForViewer } from "@/lib/server/services/social-service";
import { jsonObject, portfolioPayload, resumeBufferFromUrl } from "@/lib/server/services/profile-service";
import { buildOfficialAcademicLinks, officialAcademicLinksForUser } from "@/lib/server/services/official-links-service";
import { parseResumeTextWithAi } from "@/lib/server/services/resume-ai-service";

export async function handleProfile(method: string, path: string[], request: NextRequest) {
  const user = await requireUser();

  if (method === "POST" && path[2] === "follow-request") {
    const receiverId = path[1];
    if (!receiverId) throw new ApiError(404, "缺少关注对象。");
    if (isDemoUser(user)) {
      const result = createDemoFollowRequest(user, receiverId);
      if (result.error) throw new ApiError(400, result.error);
      return created({ request: result.request, existing: result.existing });
    }

    if (receiverId === user.id) throw new ApiError(400, "不能关注自己。");
    const target = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!target) throw new ApiError(404, "找不到这个用户。");
    assertSameSchool(user, target.schoolId);
    const requestRow = await prisma.followRequest.upsert({
      where: { senderId_receiverId: { senderId: user.id, receiverId } },
      update: { status: "pending" },
      create: { senderId: user.id, receiverId, status: "pending" }
    });
    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "follow_requests.create",
      targetType: "FollowRequest",
      targetId: requestRow.id,
      method,
      path: request.nextUrl.pathname,
      summary: { receiverId }
    });
    return created({ request: requestRow });
  }

  if (isDemoUser(user)) {
    if (path[1] === "me") {
      if (path[2] === "portfolio-items") {
        if (method === "POST") {
          const body = await readBody(request);
          return created({
            portfolioItem: {
              id: "demo-portfolio-created",
              userId: user.id,
              ...portfolioPayload(body)
            },
            message: "本地视觉演示模式已模拟保存作品/证明材料。"
          });
        }
        if (method === "PATCH" && path[3]) {
          const body = await readBody(request);
          return ok({
            portfolioItem: {
              id: path[3],
              userId: user.id,
              ...portfolioPayload(body)
            },
            message: "本地视觉演示模式已模拟更新作品/证明材料。"
          });
        }
        if (method === "DELETE" && path[3]) {
          return ok({ message: "本地视觉演示模式已模拟删除作品/证明材料。" });
        }
      }
      if (method === "POST" && path[2] === "reparse-resume") {
        const resumeText = user.profile?.resumeParsedData && typeof user.profile.resumeParsedData === "object" && "rawText" in user.profile.resumeParsedData
          ? String((user.profile.resumeParsedData as Record<string, unknown>).rawText ?? "")
          : "";
        const resumeParsedData = parseResumeText(resumeText, user.profile?.resumeFileName ?? "demo-resume.txt");
        return ok({ resumeParsedData, message: "本地视觉演示模式已模拟重新整理简历。" });
      }
      if (method === "GET") {
        return ok({
          user: publicUser(user),
          contactInfo: user.contactInfo,
          portfolioItems: demoPortfolioItems(user.id.replace("demo-user-", "")),
          officialLinks: buildOfficialAcademicLinks(user)
        });
      }
      if (method === "PATCH") return ok({ profile: { ...user.profile, ...(await readBody(request)) }, message: "本地视觉演示模式已模拟保存 Profile。" });
    }
    if (method === "GET" && path[1]) {
      const account = path[1].includes("cs") ? "cs" : path[1].includes("admin") ? "admin" : "media";
      const target = { ...demoUserForAccount(account), portfolioItems: demoPortfolioItems(account) };
      const sanitized = sanitizeDemoUser(target, user.id);
      return ok({
        user: publicUser(sanitized),
        portfolioItems: sanitized.portfolioItems ?? [],
        contactInfo: sanitized.contactInfo ?? {}
      });
    }
  }

  if (path[1] === "me") {
    if (path[2] === "portfolio-items") {
      if (method === "POST") {
        const body = await readBody(request);
        const portfolioItem = await prisma.portfolioItem.create({
          data: {
            userId: user.id,
            ...portfolioPayload(body)
          }
        });
        await operationLog({
          actorUserId: user.id,
          actorRole: user.role,
          action: "portfolio_items.create",
          targetType: "PortfolioItem",
          targetId: portfolioItem.id,
          method,
          path: request.nextUrl.pathname,
          summary: { title: portfolioItem.title, type: portfolioItem.type }
        });
        return created({ portfolioItem });
      }

      if (method === "PATCH" && path[3]) {
        const existing = await prisma.portfolioItem.findUnique({ where: { id: path[3] } });
        if (!existing || existing.userId !== user.id) throw new ApiError(404, "找不到这个作品或证明材料。");
        const body = await readBody(request);
        const portfolioItem = await prisma.portfolioItem.update({
          where: { id: path[3] },
          data: portfolioPayload(body, existing)
        });
        await operationLog({
          actorUserId: user.id,
          actorRole: user.role,
          action: "portfolio_items.patch",
          targetType: "PortfolioItem",
          targetId: portfolioItem.id,
          method,
          path: request.nextUrl.pathname,
          summary: { title: portfolioItem.title, type: portfolioItem.type }
        });
        return ok({ portfolioItem });
      }

      if (method === "DELETE" && path[3]) {
        await prisma.portfolioItem.deleteMany({ where: { id: path[3], userId: user.id } });
        await operationLog({
          actorUserId: user.id,
          actorRole: user.role,
          action: "portfolio_items.delete",
          targetType: "PortfolioItem",
          targetId: path[3],
          method,
          path: request.nextUrl.pathname
        });
        return ok({ message: "作品或证明材料已删除。" });
      }
    }

    if (method === "POST" && path[2] === "reparse-resume") {
      const fullUser = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { profile: true }
      });
      const resumeUrl = fullUser.profile?.resumeUrl;
      const resumeFileName = fullUser.profile?.resumeFileName ?? "resume";
      if (!resumeUrl) throw new ApiError(400, "当前 Profile 还没有简历 URL。");
      const buffer = await resumeBufferFromUrl(resumeUrl);
      const parsedText = await extractReadableText(resumeFileName, buffer);
      const resumeParsedData = await parseResumeTextWithAi(parsedText, resumeFileName, {
        actorUserId: user.id,
        actorRole: user.role,
        targetType: "UserProfile",
        targetId: fullUser.profile?.id ?? user.id,
        method,
        path: request.nextUrl.pathname,
        trigger: "profile_reparse"
      });
      const profile = await prisma.userProfile.update({
        where: { userId: user.id },
        data: { resumeParsedData: toJson(resumeParsedData) }
      });
      await operationLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: "profile.resume.reparse",
        targetType: "UserProfile",
        targetId: profile.id,
        method,
        path: request.nextUrl.pathname,
        summary: {
          resumeFileName,
          parser: resumeParsedData.parser,
          analysis: {
            provider: resumeParsedData.analysis?.provider,
            model: resumeParsedData.analysis?.model,
            status: resumeParsedData.analysis?.status,
            highlightCount: resumeParsedData.analysis?.highlights?.length ?? 0
          },
          skills: resumeParsedData.skills,
          sections: Object.keys(resumeParsedData.sections ?? {})
        }
      });
      return ok({ resumeParsedData, message: "简历已重新整理。" });
    }

    if (method === "GET") {
      const fullUser = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          ...userInclude,
          portfolioItems: { include: { relatedCourse: true }, orderBy: { createdAt: "desc" } }
        }
      });
      return ok({
        user: publicUser(fullUser),
        contactInfo: fullUser.contactInfo,
        portfolioItems: fullUser.portfolioItems,
        officialLinks: await officialAcademicLinksForUser(fullUser)
      });
    }

    if (method === "PATCH") {
      const body = await readBody(request);
      const academic = academicLockForUser(user);
      const profile = await prisma.userProfile.upsert({
        where: { userId: user.id },
        update: {
          displayName: optionalString(body.displayName) ?? user.profile?.displayName ?? user.email.split("@")[0],
          nickname: optionalString(body.nickname),
          avatarUrl: optionalString(body.avatarUrl),
          backgroundImageUrl: optionalString(body.backgroundImageUrl),
          headline: optionalString(body.headline),
          bio: optionalString(body.bio) ?? "",
          grade: academic.grade,
          entryYear: academic.entryYear ?? null,
          entryTerm: academic.entryTerm,
          facultyId: optionalString(body.facultyId),
          majorId: optionalString(body.majorId),
          outputTags: stringArray(body.outputTags),
          resumeUrl: optionalString(body.resumeUrl),
          resumeFileName: optionalString(body.resumeFileName),
          resumeParsedData: jsonObject(body.resumeParsedData),
          openToBeDiscovered: typeof body.openToBeDiscovered === "boolean" ? body.openToBeDiscovered : true
        },
        create: {
          userId: user.id,
          displayName: optionalString(body.displayName) ?? user.email.split("@")[0],
          nickname: optionalString(body.nickname),
          avatarUrl: optionalString(body.avatarUrl),
          backgroundImageUrl: optionalString(body.backgroundImageUrl),
          headline: optionalString(body.headline),
          bio: optionalString(body.bio) ?? "",
          grade: academic.grade,
          entryYear: academic.entryYear ?? null,
          entryTerm: academic.entryTerm,
          facultyId: optionalString(body.facultyId),
          majorId: optionalString(body.majorId),
          outputTags: stringArray(body.outputTags),
          resumeUrl: optionalString(body.resumeUrl),
          resumeFileName: optionalString(body.resumeFileName),
          resumeParsedData: jsonObject(body.resumeParsedData)
        }
      });

      const contactBody = jsonObject(body.contactInfo);
      if (Object.keys(contactBody).length > 0) {
        await prisma.contactInfo.upsert({
          where: { userId: user.id },
          update: {
            schoolEmail: user.email,
            wechatId: optionalString(contactBody.wechatId),
            wechatQrImageUrl: optionalString(contactBody.wechatQrImageUrl),
            linkedinUrl: optionalString(contactBody.linkedinUrl),
            personalEmail: optionalString(contactBody.personalEmail),
            visibilitySettings: jsonObject(contactBody.visibilitySettings, defaultContactVisibility)
          },
          create: {
            userId: user.id,
            schoolEmail: user.email,
            wechatId: optionalString(contactBody.wechatId),
            wechatQrImageUrl: optionalString(contactBody.wechatQrImageUrl),
            linkedinUrl: optionalString(contactBody.linkedinUrl),
            personalEmail: optionalString(contactBody.personalEmail),
            visibilitySettings: jsonObject(contactBody.visibilitySettings, defaultContactVisibility)
          }
        });
      }

      const skills = stringArray(body.skills);
      if (skills.length > 0) {
        await prisma.userSkill.deleteMany({ where: { userId: user.id } });
        for (const skillName of skills) {
          const skill = await prisma.skill.upsert({
            where: { name: skillName },
            update: {},
            create: { name: skillName, category: "user_defined" }
          });
          await prisma.userSkill.create({
            data: {
              userId: user.id,
              skillId: skill.id,
              level: "intermediate",
              evidenceNote: "用户在个人资料中填写"
            }
          });
        }
      }

      await operationLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: "profile.patch",
        targetType: "UserProfile",
        targetId: profile.id,
        method,
        path: request.nextUrl.pathname,
        summary: { displayName: profile.displayName, grade: profile.grade, entryYear: profile.entryYear, entryTerm: profile.entryTerm }
      });
      return ok({ profile });
    }
  }

  if (method === "GET" && path[1]) {
    const target = await prisma.user.findUnique({
      where: { id: path[1] },
      include: {
        ...userInclude,
        portfolioItems: { include: { relatedCourse: true }, orderBy: { createdAt: "desc" } }
      }
    });

    if (!target) throw new ApiError(404, "找不到这个用户。");
    if (!isAdminRole(user.role) && target.schoolId !== user.schoolId) {
      throw new ApiError(403, "MVP 中仅允许同校已验证用户互相查看基础资料。");
    }

    const publicTarget = await publicUserForViewer(target, user);
    return ok({
      user: publicTarget,
      portfolioItems: publicTarget.portfolioItems ?? [],
      contactInfo: publicTarget.contactInfo ?? {}
    });
  }

  throw new ApiError(404, "找不到个人资料接口。");
}

export async function handleContactInfo(method: string, request: NextRequest) {
  const user = await requireUser();

  if (isDemoUser(user)) {
    if (method === "GET") return ok({ contactInfo: user.contactInfo });
    if (method === "PATCH") return ok({ contactInfo: user.contactInfo, message: "本地视觉演示模式已模拟保存联系方式。" });
  }

  if (method === "GET") {
    const contactInfo = await prisma.contactInfo.upsert({
      where: { userId: user.id },
      update: { schoolEmail: user.email },
      create: {
        userId: user.id,
        schoolEmail: user.email,
        visibilitySettings: defaultContactVisibility
      }
    });
    return ok({ contactInfo });
  }

  if (method === "PATCH") {
    const body = await readBody(request);
    const contactInfo = await prisma.contactInfo.upsert({
      where: { userId: user.id },
      update: {
        schoolEmail: user.email,
        wechatId: optionalString(body.wechatId),
        wechatQrImageUrl: optionalString(body.wechatQrImageUrl),
        linkedinUrl: optionalString(body.linkedinUrl),
        personalEmail: optionalString(body.personalEmail),
        visibilitySettings:
          body.visibilitySettings && typeof body.visibilitySettings === "object"
            ? (body.visibilitySettings as object)
            : defaultContactVisibility
      },
      create: {
        userId: user.id,
        schoolEmail: user.email,
        wechatId: optionalString(body.wechatId),
        wechatQrImageUrl: optionalString(body.wechatQrImageUrl),
        linkedinUrl: optionalString(body.linkedinUrl),
        personalEmail: optionalString(body.personalEmail),
        visibilitySettings:
          body.visibilitySettings && typeof body.visibilitySettings === "object"
            ? (body.visibilitySettings as object)
            : defaultContactVisibility
      }
    });

    await operationLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: "contact_info.patch",
      targetType: "ContactInfo",
      targetId: contactInfo.id,
      method,
      path: request.nextUrl.pathname,
      summary: { visibilitySettings: contactInfo.visibilitySettings }
    });
    return ok({ contactInfo });
  }

  throw new ApiError(405, "这个联系方式接口不支持当前请求方式。");
}

export async function handleUploads(method: string, request: NextRequest) {
  if (method !== "POST") throw new ApiError(405, "这个上传接口不支持当前请求方式。");

  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");
  const purposeRaw = formData.get("purpose");
  const purpose = typeof purposeRaw === "string" && profileUploadPurposeOptions().includes(purposeRaw) ? purposeRaw : "portfolio";

  if (!(file instanceof File)) {
    throw new ApiError(400, "请上传一个文件。", ERROR_CODES.UPLOAD_FILE_REQUIRED);
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new ApiError(400, "单个文件暂时限制为 30MB。", ERROR_CODES.UPLOAD_FILE_TOO_LARGE, { size: file.size });
  }

  if (!isAllowedProfileFile(file.name) || isRiskyProfileFile(file.name)) {
    throw new ApiError(400, `暂不支持这个文件后缀：${fileExtensionOf(file.name) || "unknown"}`, ERROR_CODES.UPLOAD_EXTENSION_BLOCKED, {
      fileName: file.name
    });
  }

  const contentType = file.type || "application/octet-stream";
  if (!hasAcceptableMimeForExtension(file.name, contentType)) {
    throw new ApiError(400, "文件类型和后缀不匹配，请检查后重新上传。", ERROR_CODES.UPLOAD_MIME_MISMATCH, {
      fileName: file.name,
      contentType
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = safeUploadName(file.name);
  const parsedText = await extractReadableText(file.name, buffer);
  const resumeParsedData = purpose === "resume" ? await parseResumeTextWithAi(parsedText, file.name, {
    actorUserId: user.id,
    actorRole: user.role,
    targetType: "UserProfile",
    targetId: user.profile?.id ?? user.id,
    method,
    path: request.nextUrl.pathname,
    trigger: "resume_upload"
  }) : undefined;
  const stored = await storeProfileUpload({
    buffer,
    userId: user.id,
    safeName,
    contentType
  }).catch((error) => {
    throw new ApiError(500, "文件保存失败，请稍后再试。", ERROR_CODES.UPLOAD_STORAGE_FAILED, {
      fileName: file.name,
      message: error instanceof Error ? error.message : String(error)
    });
  });

  const upload = {
    fileUrl: stored.fileUrl,
    storageKey: stored.storageKey,
    fileName: file.name,
    fileMimeType: contentType,
    fileSize: file.size,
    fileExtension: fileExtensionOf(file.name),
    previewKind: previewKindForFile(file.name),
    parsedText,
    resumeParsedData,
    purpose,
    storageMode: stored.storageMode,
    storageProvider: stored.storageProvider,
    objectKey: stored.objectKey,
    scanStatus: "basic_checked"
  };

  return created({ upload });
}
