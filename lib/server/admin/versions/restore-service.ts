
import { defaultContactVisibility } from "@/lib/contact";import { operationLog } from "@/lib/server/audit";
import { ApiError } from "@/lib/http";

import { ERROR_CODES } from "@/lib/error-codes";
import { prisma } from "@/lib/prisma";
import { toJson } from "@/lib/server/json-utils";

export function chunkArray(chunks: any[], name: string) {
  const data = chunks.find((chunk) => chunk.name === name)?.data;
  return Array.isArray(data) ? data : [];
}

export function dateOrNull(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateOrUndefined(value: unknown) {
  return dateOrNull(value) ?? undefined;
}

export async function restoreCheckpointAsNewVersion(checkpointId: string, admin: any) {
  const checkpoint = await prisma.versionCheckpoint.findUnique({
    where: { id: checkpointId },
    include: { chunks: true, appVersion: true }
  });
  if (!checkpoint) throw new ApiError(404, "找不到这个版本检查点。", ERROR_CODES.CHECKPOINT_NOT_FOUND);

  const restored = await prisma.$transaction(async (tx) => {
    await tx.appVersion.updateMany({
      where: { status: "active" },
      data: { status: "closed", endedAt: new Date() }
    });
    const version = await tx.appVersion.create({
      data: {
        name: `Restored: ${checkpoint.label}`,
        phase: checkpoint.appVersion.phase,
        status: "active",
        notes: `Restored from checkpoint ${checkpoint.id}`,
        createdByUserId: admin.id
      }
    });

    const schoolMap = new Map<string, string>();
    const facultyMap = new Map<string, string>();
    const majorMap = new Map<string, string>();
    const semesterMap = new Map<string, string>();
    const courseMap = new Map<string, string>();
    const offeringMap = new Map<string, string>();
    const boardMap = new Map<string, string>();
    const sectionMap = new Map<string, string>();
    const userMap = new Map<string, string>();
    const postMap = new Map<string, string>();

    for (const school of chunkArray(checkpoint.chunks, "schools_and_course_catalog")) {
      const createdSchool = await tx.school.create({
        data: {
          appVersionId: version.id,
          name: school.name,
          shortName: school.shortName,
          status: school.status ?? "active"
        }
      });
      schoolMap.set(school.id, createdSchool.id);

      for (const domain of school.domains ?? []) {
        await tx.schoolEmailDomain.create({
          data: { schoolId: createdSchool.id, domain: domain.domain, status: domain.status ?? "active" }
        });
      }
      for (const faculty of school.faculties ?? []) {
        const createdFaculty = await tx.faculty.create({
          data: { schoolId: createdSchool.id, code: faculty.code ?? null, name: faculty.name }
        });
        facultyMap.set(faculty.id, createdFaculty.id);
      }
      for (const major of school.majors ?? []) {
        const facultyId = facultyMap.get(major.facultyId);
        if (!facultyId) continue;
        const createdMajor = await tx.major.create({
          data: {
            schoolId: createdSchool.id,
            facultyId,
            code: major.code ?? null,
            name: major.name,
            degreeType: major.degreeType ?? "undergraduate"
          }
        });
        majorMap.set(major.id, createdMajor.id);
      }
      for (const semester of school.semesters ?? []) {
        const createdSemester = await tx.semester.create({
          data: {
            schoolId: createdSchool.id,
            code: semester.code ?? null,
            name: semester.name,
            year: Number(semester.year),
            term: semester.term,
            isCurrent: Boolean(semester.isCurrent)
          }
        });
        semesterMap.set(semester.id, createdSemester.id);
      }
      for (const course of school.courses ?? []) {
        const createdCourse = await tx.course.create({
          data: {
            schoolId: createdSchool.id,
            code: course.code,
            title: course.title,
            description: course.description ?? "",
            credits: course.credits ?? null,
            ownerUnit: toJson(course.ownerUnit ?? {}),
            categoryTags: toJson(course.categoryTags ?? []),
            sourceRefIds: toJson(course.sourceRefIds ?? []),
            manualOverrideFields: toJson(course.manualOverrideFields ?? []),
            manualNote: course.manualNote ?? null,
            catalogEffectiveYear: course.catalogEffectiveYear ?? null,
            catalogValidThroughYear: course.catalogValidThroughYear ?? null,
            catalogFingerprint: course.catalogFingerprint ?? null,
            courseType: course.courseType ?? "coursework",
            status: course.status ?? "active",
            source: course.source ?? "checkpoint_restore",
            mergedIntoCourseId: course.mergedIntoCourseId ? courseMap.get(course.mergedIntoCourseId) ?? null : null,
            mergedAt: dateOrNull(course.mergedAt),
            mergeNote: course.mergeNote ?? null
          }
        });
        courseMap.set(course.id, createdCourse.id);
      }
      for (const course of school.courses ?? []) {
        const courseId = courseMap.get(course.id);
        if (!courseId) continue;
        for (const mapping of course.mappings ?? []) {
          const majorId = majorMap.get(mapping.majorId);
          if (!majorId) continue;
          await tx.courseMajorMapping.create({
            data: {
              courseId,
              majorId,
              recommendedGrade: mapping.recommendedGrade,
              isRequired: Boolean(mapping.isRequired),
              isDefaultRecommended: mapping.isDefaultRecommended !== false
            }
          }).catch(() => null);
        }
        for (const rule of course.curriculumRules ?? []) {
          const semesterId = semesterMap.get(rule.semesterId);
          if (!semesterId) continue;
          await tx.courseCurriculumRule.create({
            data: {
              courseId,
              semesterId,
              externalId: rule.externalId,
              classification: rule.classification,
              classificationLabel: rule.classificationLabel ?? null,
              studentAction: rule.studentAction,
              audience: toJson(rule.audience ?? {}),
              relativeTermCodes: toJson(rule.relativeTermCodes ?? []),
              ownerUnit: toJson(rule.ownerUnit ?? {}),
              sourceRefIds: toJson(rule.sourceRefIds ?? []),
              confidence: rule.confidence ?? "unknown",
              status: rule.status ?? "active",
              raw: toJson(rule.raw ?? {})
            }
          }).catch(() => null);
        }
        for (const offering of course.offerings ?? []) {
          const semesterId = semesterMap.get(offering.semesterId);
          if (!semesterId) continue;
          const createdOffering = await tx.courseOffering.create({
            data: {
              courseId,
              semesterId,
              teacherName: offering.teacherName ?? null,
              section: offering.section ?? null,
              sourceRefIds: toJson(offering.sourceRefIds ?? []),
              status: offering.status ?? "active"
            }
          });
          offeringMap.set(offering.id, createdOffering.id);
          if (offering.syllabusMetadata) {
            await tx.courseSyllabusMetadata.create({
              data: {
                courseOfferingId: createdOffering.id,
                teamworkRequirement: offering.syllabusMetadata.teamworkRequirement ?? "unknown",
                teamworkSummary: offering.syllabusMetadata.teamworkSummary ?? null,
                evidenceSourceRefIds: toJson(offering.syllabusMetadata.evidenceSourceRefIds ?? []),
                confidence: offering.syllabusMetadata.confidence ?? "unknown",
                raw: toJson(offering.syllabusMetadata.raw ?? {})
              }
            });
          }
          for (const board of offering.boards ?? []) {
            const createdBoard = await tx.courseBoard.create({
              data: {
                courseOfferingId: createdOffering.id,
                title: board.title,
                status: board.status ?? "active",
                rules: board.rules ?? undefined,
                openFrom: dateOrNull(board.openFrom),
                openUntil: dateOrNull(board.openUntil)
              }
            });
            boardMap.set(board.id, createdBoard.id);
            for (const section of board.sections ?? []) {
              const createdSection = await tx.courseBoardSection.create({
                data: {
                  boardId: createdBoard.id,
                  code: section.code,
                  source: section.source ?? "checkpoint_restore"
                }
              });
              sectionMap.set(section.id, createdSection.id);
            }
          }
        }
      }
    }

    for (const user of chunkArray(checkpoint.chunks, "users")) {
      const schoolId = user.schoolId ? schoolMap.get(user.schoolId) : null;
      const createdUser = await tx.user.create({
        data: {
          appVersionId: version.id,
          email: user.email,
          schoolId,
          role: user.role ?? "verified_user",
          passwordHash: user.passwordHash ?? null,
          status: user.status ?? "active",
          suspendedUntil: dateOrNull(user.suspendedUntil),
          adminNote: user.adminNote ?? null,
          isEmailVerified: Boolean(user.isEmailVerified),
          onboardingCompleted: Boolean(user.onboardingCompleted)
        }
      });
      userMap.set(user.id, createdUser.id);
      if (user.profile) {
        await tx.userProfile.create({
          data: {
            userId: createdUser.id,
            displayName: user.profile.displayName,
            nickname: user.profile.nickname ?? null,
            avatarUrl: user.profile.avatarUrl ?? null,
            backgroundImageUrl: user.profile.backgroundImageUrl ?? null,
            headline: user.profile.headline ?? null,
            bio: user.profile.bio ?? "",
            grade: user.profile.grade ?? null,
            entryYear: user.profile.entryYear ?? null,
            entryTerm: user.profile.entryTerm ?? null,
            facultyId: user.profile.facultyId ? facultyMap.get(user.profile.facultyId) ?? null : null,
            majorId: user.profile.majorId ? majorMap.get(user.profile.majorId) ?? null : null,
            outputTags: toJson(user.profile.outputTags ?? []),
            resumeUrl: user.profile.resumeUrl ?? null,
            resumeFileName: user.profile.resumeFileName ?? null,
            resumeParsedData: toJson(user.profile.resumeParsedData ?? {}),
            openToBeDiscovered: user.profile.openToBeDiscovered !== false,
            visibilitySettings: toJson(user.profile.visibilitySettings ?? {})
          }
        });
      }
      if (user.contactInfo) {
        await tx.contactInfo.create({
          data: {
            userId: createdUser.id,
            schoolEmail: user.contactInfo.schoolEmail ?? user.email,
            wechatId: user.contactInfo.wechatId ?? null,
            wechatQrImageUrl: user.contactInfo.wechatQrImageUrl ?? null,
            linkedinUrl: user.contactInfo.linkedinUrl ?? null,
            personalEmail: user.contactInfo.personalEmail ?? null,
            visibilitySettings: toJson(user.contactInfo.visibilitySettings ?? defaultContactVisibility)
          }
        });
      }
      for (const portfolio of user.portfolioItems ?? []) {
        await tx.portfolioItem.create({
          data: {
            userId: createdUser.id,
            title: portfolio.title,
            type: portfolio.type,
            relatedCourseId: portfolio.relatedCourseId ? courseMap.get(portfolio.relatedCourseId) ?? null : null,
            semesterText: portfolio.semesterText ?? null,
            myRole: portfolio.myRole ?? null,
            contributionDescription: portfolio.contributionDescription ?? "",
            isGroupWork: Boolean(portfolio.isGroupWork),
            fileName: portfolio.fileName ?? null,
            fileMimeType: portfolio.fileMimeType ?? null,
            fileSize: portfolio.fileSize ?? null,
            fileExtension: portfolio.fileExtension ?? null,
            storageKey: portfolio.storageKey ?? null,
            storageMode: portfolio.storageMode ?? null,
            storageProvider: portfolio.storageProvider ?? null,
            objectKey: portfolio.objectKey ?? null,
            scanStatus: portfolio.scanStatus ?? "not_scanned",
            fileUrl: portfolio.fileUrl ?? null,
            externalUrl: portfolio.externalUrl ?? null,
            previewKind: portfolio.previewKind ?? "link",
            outcome: portfolio.outcome ?? null,
            reflection: portfolio.reflection ?? null,
            parsedText: portfolio.parsedText ?? null,
            metadata: toJson(portfolio.metadata ?? {}),
            visibility: portfolio.visibility ?? "same_school",
            isPinned: Boolean(portfolio.isPinned)
          }
        });
      }
      for (const membership of user.memberships ?? []) {
        const boardId = boardMap.get(membership.boardId);
        if (!boardId) continue;
        await tx.courseBoardMembership.create({
          data: {
            userId: createdUser.id,
            boardId,
            sectionId: membership.sectionId ? sectionMap.get(membership.sectionId) ?? null : null,
            sectionCode: membership.sectionCode ?? null,
            source: membership.source ?? "checkpoint_restore",
            status: membership.status ?? "active",
            originRuleId: membership.originRuleId ?? null,
            joinedAt: dateOrUndefined(membership.joinedAt),
            leftAt: dateOrNull(membership.leftAt)
          }
        }).catch(() => null);
      }
      for (const submission of user.submittedCourses ?? []) {
        const mappedSchoolId = submission.schoolId ? schoolMap.get(submission.schoolId) : schoolId;
        if (!mappedSchoolId) continue;
        await tx.userSubmittedCourse.create({
          data: {
            submittedByUserId: createdUser.id,
            schoolId: mappedSchoolId,
            code: submission.code,
            title: submission.title,
            teacherName: submission.teacherName ?? null,
            semesterText: submission.semesterText ?? null,
            status: submission.status ?? "pending",
            adminNote: submission.adminNote ?? null,
            matchedCourseId: submission.matchedCourseId ? courseMap.get(submission.matchedCourseId) ?? null : null
          }
        });
      }
    }

    for (const post of chunkArray(checkpoint.chunks, "teamaking_posts")) {
      const boardId = boardMap.get(post.boardId);
      const userId = userMap.get(post.userId);
      const offeringId = offeringMap.get(post.courseOfferingId);
      if (!boardId || !userId || !offeringId) continue;
      const createdPost = await tx.teamakingPost.create({
        data: {
          boardId,
          userId,
          courseOfferingId: offeringId,
          title: post.title,
          status: post.status ?? "open",
          strengths: toJson(post.strengths ?? []),
          contributionTypes: toJson(post.contributionTypes ?? []),
          expectedOutcome: post.expectedOutcome,
          portfolioItemIds: toJson([]),
          showWechatId: Boolean(post.showWechatId),
          showWechatQr: Boolean(post.showWechatQr),
          showLinkedin: Boolean(post.showLinkedin),
          showPersonalEmail: Boolean(post.showPersonalEmail),
          visibility: post.visibility ?? "same_course_board",
          expiresAt: dateOrNull(post.expiresAt)
        }
      });
      postMap.set(post.id, createdPost.id);
    }
    for (const request of chunkArray(checkpoint.chunks, "team_up_requests")) {
      const postId = postMap.get(request.postId);
      const senderId = userMap.get(request.senderId);
      const receiverId = userMap.get(request.receiverId);
      if (!postId || !senderId || !receiverId) continue;
      await tx.teamUpRequest.create({
        data: {
          postId,
          senderId,
          receiverId,
          message: request.message,
          senderContribution: request.senderContribution,
          senderContactSnapshot: toJson(request.senderContactSnapshot ?? {}),
          receiverContactSnapshot: toJson(request.receiverContactSnapshot ?? {}),
          status: request.status ?? "sent"
        }
      }).catch(() => null);
    }
    for (const request of chunkArray(checkpoint.chunks, "follow_requests")) {
      const senderId = userMap.get(request.senderId);
      const receiverId = userMap.get(request.receiverId);
      if (!senderId || !receiverId) continue;
      await tx.followRequest.create({
        data: { senderId, receiverId, status: request.status ?? "pending" }
      }).catch(() => null);
    }
    for (const ticket of chunkArray(checkpoint.chunks, "support_tickets")) {
      await tx.supportTicket.create({
        data: {
          submittedByUserId: ticket.submittedByUserId ? userMap.get(ticket.submittedByUserId) ?? null : null,
          email: ticket.email ?? null,
          category: ticket.category ?? "other",
          title: ticket.title,
          description: ticket.description,
          relatedUrl: ticket.relatedUrl ?? null,
          status: ticket.status ?? "open",
          adminNote: ticket.adminNote ?? null,
          adminReply: ticket.adminReply ?? null,
          adminRepliedAt: dateOrNull(ticket.adminRepliedAt)
        }
      });
    }
    for (const config of chunkArray(checkpoint.chunks, "site_configs")) {
      await tx.siteConfig.upsert({
        where: { key: config.key },
        update: { value: toJson(config.value ?? {}), updatedByUserId: userMap.get(admin.id) ?? admin.id },
        create: { key: config.key, value: toJson(config.value ?? {}), updatedByUserId: userMap.get(admin.id) ?? admin.id }
      });
    }

    return {
      version,
      mappedCounts: {
        schools: schoolMap.size,
        courses: courseMap.size,
        offerings: offeringMap.size,
        boards: boardMap.size,
        users: userMap.size,
        posts: postMap.size
      }
    };
  }, { timeout: 30000 });

  await operationLog({
    appVersionId: restored.version.id,
    actorUserId: admin.id,
    actorRole: admin.role,
    action: "admin.versions.restore_as_new_version",
    targetType: "VersionCheckpoint",
    targetId: checkpoint.id,
    summary: restored.mappedCounts
  });
  return { checkpoint, ...restored };
}
