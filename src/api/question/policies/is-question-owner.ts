// A question inherits its owner from quiz -> course -> instructor.
const MANAGE_ANY_ROLES = ['Admin', 'Content Manager'];

async function findQuizById(strapi: any, id: unknown) {
  const numericId = Number(id);

  if (!Number.isInteger(numericId)) {
    return null;
  }

  return strapi.query('api::quiz.quiz').findOne({
    where: { id: numericId },
    populate: { course: { populate: ['instructor'] } },
  });
}


function canManageQuiz(user: any, quiz: any) {
  if (!quiz?.course) {
    return false;
  }

  if (MANAGE_ANY_ROLES.includes(user.role.name)) {
    return true;
  }

  return (
    user.role.name === 'Instructor' && quiz.course.instructor?.id === user.id
  );
}

export default async (policyContext: any, config: any, { strapi }: { strapi: any }) => {
  const user = policyContext.state.user;

  if (!user) {
    return false;
  }

  const { id: documentId } = policyContext.params;
  const requestedQuizId = policyContext.request.body?.data?.quiz;

  if (!documentId) {
    return canManageQuiz(user, await findQuizById(strapi, requestedQuizId));
  }

  const question = await strapi.documents('api::question.question').findOne({
    documentId,
    populate: { quiz: { populate: { course: { populate: ['instructor'] } } } },
  });

  if (!question) {
    return false;
  }

  if (!canManageQuiz(user, question.quiz)) {
    return false;
  }

  if (requestedQuizId !== undefined) {
    return canManageQuiz(user, await findQuizById(strapi, requestedQuizId));
  }

  return true;
};
