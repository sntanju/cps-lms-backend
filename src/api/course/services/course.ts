/**
 * course service
 */

import { factories } from '@strapi/strapi';

// Roles that reach any course's content, per the permission matrix.
const CONTENT_ANY_ROLES = ['Admin', 'Content Manager'];

export default factories.createCoreService('api::course.course', ({ strapi }) => ({
  // May this user read this course's lessons? Shared, because Phase 6 progress
  // and Phase 8 quizzes ask the identical question.
  //
  // `course` must be populated with its instructor.
  async canAccessContent(user: any, course: any) {
    if (!user || !course) {
      return false;
    }

    if (CONTENT_ANY_ROLES.includes(user.role.name)) {
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
}));
