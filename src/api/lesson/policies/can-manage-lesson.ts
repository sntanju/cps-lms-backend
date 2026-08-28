
// Roles that act platform-wide on content, per the permission matrix.
const MANAGE_ANY_ROLES = ['Admin', 'Content Manager'];

async function findCourseById(strapi: any, id: unknown) {
  const numericId = Number(id);

  if (!Number.isInteger(numericId)) {
    return null;
  }

  return strapi.query('api::course.course').findOne({
    where: { id: numericId },
    populate: ['instructor'],
  });
}

function canManageCourse(user: any, course: any) {
  if (!course) {
    return false;
  }

  if (MANAGE_ANY_ROLES.includes(user.role.name)) {
    return true;
  }

  return user.role.name === 'Instructor' && course.instructor?.id === user.id;
}

export default async (policyContext: any, config: any, { strapi }: { strapi: any }) => {
  
  const user = policyContext.state.user;

  if (!user) {
    return false;
  }

  const { id: documentId } = policyContext.params;

  const requestedCourseId = policyContext.request.body?.data?.course;

  if (!documentId) {
    return canManageCourse(user, await findCourseById(strapi, requestedCourseId));
  }

  const lesson = await strapi.documents('api::lesson.lesson').findOne({
    documentId,
    populate: { course: { populate: ['instructor'] } },
  });

  if (!lesson) {
    return false;
  }

  if (!canManageCourse(user, lesson.course)) {
    return false;
  }

  if (requestedCourseId !== undefined) {
    return canManageCourse(user, await findCourseById(strapi, requestedCourseId));
  }

  return true;
};
