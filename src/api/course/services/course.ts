/**
 * course service
 */

import { factories } from '@strapi/strapi';

// Roles that act platform-wide, per the permission matrix.
const PLATFORM_WIDE_ROLES = ['Admin', 'Content Manager'];

export default factories.createCoreService('api::course.course', ({ strapi }) => ({

  async canAccessContent(user: any, course: any) {
    if (!user || !course) {
      return false;
    }

    if (PLATFORM_WIDE_ROLES.includes(user.role.name)) {
      return true;
    }

    if (course.instructor?.id === user.id) {
      return true;
    }

    const enrollment = await strapi.query('api::enrollment.enrollment').findOne({
      where: {
        student: user.id,
        course: course.id,
      },
    });

    return Boolean(enrollment);
  },

  canManageCourse(user: any, course: any) {
    if (!user || !course) {
      return false;
    }

    if (PLATFORM_WIDE_ROLES.includes(user.role.name)) {
      return true;
    }

    return user.role.name === 'Instructor' && course.instructor?.id === user.id;
  },

  async courseProgress(userId: number, course: any) {
    const total = await strapi.documents('api::lesson.lesson').count({
      filters: { course: { id: course.id } },
    });

    const completions = await strapi
      .documents('api::lesson-completion.lesson-completion')
      .findMany({
        filters: { student: { id: userId }, course: { id: course.id } },
        populate: ['lesson'],
      });

    const completedLessonIds = completions
      .filter((completion: any) => completion.lesson)
      .map((completion: any) => completion.lesson.documentId);

    const completed = completedLessonIds.length;

    return {
      completed,
      total,
      // A course with no lessons is 0%, not a division by zero.
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
      completedLessonIds,
    };
  },
}));
