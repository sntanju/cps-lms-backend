/**
 * course controller
 */

import { factories } from '@strapi/strapi';

// Who owns a course, in the only shape a client is allowed to see.
//
// This exists because `?populate=instructor` does not work from the REST API.
// The content API sanitizer strips populated user relations out of the response
// silently — the request still answers 200, the field is just missing. It is the
// same behaviour already documented in src/api/auth/services/auth.ts for the
// user's `role`, and it has the same cause: authorizing a user relation would
// need a content API permission that Strapi never registers.
//
// The alternative fix would be granting plugin::users-permissions.user.find, but
// that also opens GET /api/users — a full listing of every account on the
// platform — to every signed-in student. Attaching the field here instead keeps
// that route closed.
//
// Built by hand rather than spread from the record: a user row carries
// `password`, `resetPasswordToken` and `confirmationToken`, and this response
// goes to every signed-in user. Same whitelisting rule as the auth service.
function publicInstructor(instructor: any) {
  if (!instructor) {
    return null;
  }

  return {
    id: instructor.id,
    // Falls back to the username for accounts created before `fullName` existed.
    fullName: instructor.fullName ?? instructor.username,
  };
}

export default factories.createCoreController('api::course.course', ({ strapi }) => ({
  async find(ctx) {
    // super.find keeps Strapi's own filtering, sorting and pagination — this
    // only adds the instructor the sanitizer removed.
    const response = await super.find(ctx);

    if (!response?.data?.length) {
      return response;
    }

    // One extra query for the whole page, not one per course.
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
    }));

    return response;
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);

    if (!response?.data) {
      return response;
    }

    const course = await strapi.documents('api::course.course').findOne({
      documentId: response.data.documentId,
      populate: ['instructor'],
    });

    response.data.instructor = publicInstructor(course?.instructor);

    return response;
  },
}));
