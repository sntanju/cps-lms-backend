import { errors } from '@strapi/utils';

const { ApplicationError, ForbiddenError } = errors;

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

    const allowed = await strapi
      .service('api::course.course')
      .canAccessContent(user, lesson.course);

    if (!allowed) {
      throw new ForbiddenError('Enrol in this course to track its lessons');
    }

    
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
          
          course: lesson.course.id,
          completedAt: new Date(),
          studentLessonKey: `${user.id}:${lesson.id}`,
        },
      });
    } catch (error: any) {
      
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
