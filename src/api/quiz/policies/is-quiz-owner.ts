// A quiz inherits its owner from its course, the same way a lesson does.
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

  // Create: the course named in the body decides it.
  if (!documentId) {
    return canManageCourse(user, await findCourseById(strapi, requestedCourseId));
  }

  const quiz = await strapi.documents('api::quiz.quiz').findOne({
    documentId,
    populate: { course: { populate: ['instructor'] } },
  });

  if (!quiz) {
    return false;
  }

  if (!canManageCourse(user, quiz.course)) {
    return false;
  }

  // Moving a quiz to another course needs rights on that course too.
  if (requestedCourseId !== undefined) {
    return canManageCourse(user, await findCourseById(strapi, requestedCourseId));
  }

  return true;
};
