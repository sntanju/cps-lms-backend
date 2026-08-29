import { errors } from '@strapi/utils';

const { ApplicationError, ForbiddenError } = errors;

// Tracking your own progress is a Student action; the other three roles have no
// progress of their own.
const COMPLETING_ROLE = 'Student';

// The lesson, with enough of its course to answer "may this user read it?".
async function findLesson(strapi: any, lessonDocumentId: string) {
  if (!lessonDocumentId) {
    throw new ApplicationError('A lesson is required');
  }

  const lesson = await strapi.documents('api::lesson.lesson').findOne({
    documentId: lessonDocumentId,
    populate: { course: { populate: ['instructor'] } },
  });

  if (!lesson) {
    throw new ApplicationError('That lesson does not exist');
  }

  return lesson;
}

export default ({ strapi }: { strapi: any }) => ({
  // `user` is ctx.state.user. The student is taken from it, never from the body.
  async complete(user: any, lessonDocumentId: string) {
    if (user.role?.name !== COMPLETING_ROLE) {
      throw new ForbiddenError('Only students can mark a lesson complete');
    }

    const lesson = await findLesson(strapi, lessonDocumentId);

    // The Phase 5 check, reused: you cannot complete a lesson in a course you
    // never joined.
    const allowed = await strapi
      .service('api::course.course')
      .canAccessContent(user, lesson.course);

    if (!allowed) {
      throw new ForbiddenError('Enrol in this course to track its lessons');
    }

    // Idempotent: without this, five clicks on one lesson counts five times and
    // the percentage runs past 100.
    const existing = await strapi
      .query('api::lesson-completion.lesson-completion')
      .findOne({
        where: {
          student: user.id,
          lesson: lesson.id,
        },
      });

    if (existing) {
      return { created: false };
    }

    try {
      await strapi.documents('api::lesson-completion.lesson-completion').create({
        data: {
          student: user.id,
          lesson: lesson.id,
          // Denormalised from the lesson, never taken from the client, so it
          // cannot drift. It turns "how many lessons of this course has this
          // student finished" into one flat count.
          course: lesson.course.id,
          completedAt: new Date(),
          studentLessonKey: `${user.id}:${lesson.id}`,
        },
      });
    } catch (error: any) {
      // Two clicks raced past the check above and the unique index rejected the
      // second insert. Rather than trying to recognise the database's error, ask
      // the question that actually matters: is the row there now? If it is, the
      // caller got what they wanted.
      const raced = await strapi
        .query('api::lesson-completion.lesson-completion')
        .findOne({
          where: {
            student: user.id,
            lesson: lesson.id,
          },
        });

      if (raced) {
        return { created: false };
      }

      throw error;
    }

    return { created: true };
  },

  async uncomplete(user: any, lessonDocumentId: string) {
    if (user.role?.name !== COMPLETING_ROLE) {
      throw new ForbiddenError('Only students can change their own progress');
    }

    const lesson = await findLesson(strapi, lessonDocumentId);

    // Scoped to this student's own row: the id comes from the token, so there is
    // nothing here a client could edit to clear somebody else's progress.
    const existing = await strapi
      .query('api::lesson-completion.lesson-completion')
      .findOne({
        where: {
          student: user.id,
          lesson: lesson.id,
        },
      });

    if (!existing) {
      return { deleted: false };
    }

    await strapi.documents('api::lesson-completion.lesson-completion').delete({
      documentId: existing.documentId,
    });

    return { deleted: true };
  },
});
