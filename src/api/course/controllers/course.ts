/**
 * course controller
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ApplicationError } = errors;

const ASSIGNABLE_ROLES = ['Admin', 'Content Manager', 'Instructor'];

const CAN_ASSIGN_ROLES = ['Admin', 'Content Manager'];

function publicInstructor(instructor: any) {
  if (!instructor) {
    return null;
  }

  return {
    id: instructor.id,
    fullName: instructor.fullName ?? instructor.username,
  };
}

function lessonSummary(lesson: any) {
  return {
    id: lesson.id,
    documentId: lesson.documentId,
    title: lesson.title,
    order: lesson.order,
  };
}

async function attachInstructor(strapi: any, entry: any) {
  if (!entry) {
    return entry;
  }

  const course = await strapi.documents('api::course.course').findOne({
    documentId: entry.documentId,
    populate: ['instructor'],
  });

  entry.instructor = publicInstructor(course?.instructor);

  return entry;
}

async function attachQuiz(strapi: any, entry: any) {
  if (!entry) {
    return entry;
  }

  const course = await strapi.documents('api::course.course').findOne({
    documentId: entry.documentId,
    populate: { quizzes: { populate: ['questions'] } },
  });

  const quiz = (course as any)?.quizzes?.[0];

  entry.quiz = quiz
    ? {
        documentId: quiz.documentId,
        title: quiz.title,
        questionCount: quiz.questions?.length ?? 0,
      }
    : null;

  return entry;
}

async function attachLessons(strapi: any, entry: any) {
  if (!entry) {
    return entry;
  }

  const course = await strapi.documents('api::course.course').findOne({
    documentId: entry.documentId,
    populate: ['lessons'],
  });

  entry.lessons = [...(course?.lessons ?? [])]
    .sort((a: any, b: any) => a.order - b.order)
    .map(lessonSummary);

  return entry;
}


async function setInstructor(strapi: any, entry: any, instructorId: number | null) {
  if (!entry || instructorId === null) {
    return entry;
  }

  await strapi.documents('api::course.course').update({
    documentId: entry.documentId,
    data: { instructor: instructorId },
  });

  return attachInstructor(strapi, entry);
}

async function resolveInstructorId(strapi: any, user: any, requested: unknown) {
  
  if (requested === undefined || requested === null || requested === '') {
    return user.id;
  }

  
  if (Number(requested) === user.id) {
    return user.id;
  }

  if (!CAN_ASSIGN_ROLES.includes(user.role.name)) {
    throw new ApplicationError('You can only create courses for yourself');
  }

  const target = await strapi.query('plugin::users-permissions.user').findOne({
    where: { id: Number(requested) },
    populate: ['role'],
  });

  if (!target) {
    throw new ApplicationError('That user does not exist');
  }

  if (!target.role || !ASSIGNABLE_ROLES.includes(target.role.name)) {
    throw new ApplicationError(
      'A course can only be assigned to an admin, content manager or instructor',
    );
  }

  return target.id;
}

export default factories.createCoreController('api::course.course', ({ strapi }) => ({
  async find(ctx) {
    
    const response = await super.find(ctx);

    if (!response?.data?.length) {
      return response;
    }

    
    const courses = await strapi.documents('api::course.course').findMany({
      filters: {
        documentId: { $in: response.data.map((course: any) => course.documentId) },
      },
      populate: ['instructor'],
    });

    const instructorByDocumentId = new Map(
      courses.map((course: any) => [
        course.documentId,
        publicInstructor(course.instructor),
      ]),
    );

    response.data = response.data.map((course: any) => ({
      ...course,
      instructor: instructorByDocumentId.get(course.documentId) ?? null,
      // ?populate=lessons on the catalogue would otherwise hand out every
      // lesson body on the platform. A list never needs them.
      ...(course.lessons
        ? { lessons: course.lessons.map(lessonSummary) }
        : {}),
    }));

    return response;
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    const entry = response?.data;

    await attachInstructor(strapi, entry);
    await attachLessons(strapi, entry);
    await attachQuiz(strapi, entry);

    return response;
  },

  async create(ctx) {
    const data = ctx.request.body?.data ?? {};

    const instructorId = await resolveInstructorId(
      strapi,
      ctx.state.user,
      data.instructor,
    );

    delete data.instructor;
    ctx.request.body.data = data;

    const response = await super.create(ctx);

    await setInstructor(strapi, response?.data, instructorId);

    return response;
  },

  async update(ctx) {
    const data = ctx.request.body?.data ?? {};
    const reassigning = 'instructor' in data;

    const instructorId = reassigning
      ? await resolveInstructorId(strapi, ctx.state.user, data.instructor)
      : null;

    if (reassigning) {
      delete data.instructor;
      ctx.request.body.data = data;
    }

    const response = await super.update(ctx);

    if (reassigning) {
      await setInstructor(strapi, response?.data, instructorId);
    } else {
      await attachInstructor(strapi, response?.data);
    }

    return response;
  },

  async managed(ctx) {
    const user = ctx.state.user;
    const actsPlatformWide = CAN_ASSIGN_ROLES.includes(user.role.name);

    const courses = await strapi.documents('api::course.course').findMany({
      // The instructor id comes from the token, never from the query string.
      filters: actsPlatformWide ? {} : { instructor: user.id },
      populate: ['instructor'],
      sort: { createdAt: 'desc' },
    });

    ctx.body = {
      data: courses.map((course: any) => ({
        id: course.id,
        documentId: course.documentId,
        title: course.title,
        description: course.description,
        coverImageUrl: course.coverImageUrl,
        instructor: publicInstructor(course.instructor),
      })),
    };
  },

  async lessons(ctx) {
    const course = await strapi.documents('api::course.course').findOne({
      documentId: ctx.params.documentId,
      populate: ['instructor', 'lessons'],
    });

    if (!course) {
      return ctx.notFound();
    }

    const allowed = await strapi
      .service('api::course.course')
      .canAccessContent(ctx.state.user, course);

    if (!allowed) {
      return ctx.forbidden('Enrol in this course to view its lessons');
    }

    const lessons = [...(course.lessons ?? [])].sort(
      (a: any, b: any) => a.order - b.order,
    );

    ctx.body = {
      data: lessons,
      
      meta: {
        course: {
          documentId: course.documentId,
          title: course.title,
        },
      },
    };
  },

  
  async progress(ctx) {
    const course = await strapi.documents('api::course.course').findOne({
      documentId: ctx.params.documentId,
      populate: ['instructor'],
    });

    if (!course) {
      return ctx.notFound();
    }

    const allowed = await strapi
      .service('api::course.course')
      .canAccessContent(ctx.state.user, course);

    if (!allowed) {
      return ctx.forbidden('Enrol in this course to track your progress');
    }

    ctx.body = {
      data: await strapi
        .service('api::course.course')
        .courseProgress(ctx.state.user.id, course),
    };
  },

  async studentsProgress(ctx) {
    const course = await strapi.documents('api::course.course').findOne({
      documentId: ctx.params.documentId,
      populate: ['instructor'],
    });

    if (!course) {
      return ctx.notFound();
    }

    const courseService = strapi.service('api::course.course');

    if (!courseService.canManageCourse(ctx.state.user, course)) {
      return ctx.forbidden('You do not manage this course');
    }

    const enrollments: any[] = await strapi
      .documents('api::enrollment.enrollment')
      .findMany({
        filters: { course: { id: course.id } },
        populate: ['student'],
        sort: { enrolledAt: 'asc' },
      });

    const rows = [];

    for (const enrollment of enrollments) {
      if (!enrollment.student) {
        continue;
      }

      const progress = await courseService.courseProgress(
        enrollment.student.id,
        course,
      );

      rows.push({
        
        student: {
          id: enrollment.student.id,
          fullName: enrollment.student.fullName ?? enrollment.student.username,
          email: enrollment.student.email,
        },
        enrolledAt: enrollment.enrolledAt,
        completed: progress.completed,
        total: progress.total,
        percentage: progress.percentage,
      });
    }

    ctx.body = {
      data: rows,
      meta: {
        course: {
          documentId: course.documentId,
          title: course.title,
        },
      },
    };
  },

  async assignableInstructors(ctx) {
    const users = await strapi.query('plugin::users-permissions.user').findMany({
      where: { role: { name: { $in: ASSIGNABLE_ROLES } } },
      populate: ['role'],
      orderBy: { fullName: 'asc' },
    });

    ctx.body = {
      data: users.map((user: any) => ({
        id: user.id,
        fullName: user.fullName ?? user.username,
        email: user.email,
        role: user.role.name,
      })),
    };
  },
}));
