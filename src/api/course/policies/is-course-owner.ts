
export default async (policyContext: any, config: any, { strapi }: { strapi: any }) => {

  const user = policyContext.state.user;

  if (!user) {
    return false;
  }

  if (user.role.name === 'Admin' || user.role.name === 'Content Manager') {
    return true;
  }

  const { id: documentId } = policyContext.params;

  const course = await strapi.documents('api::course.course').findOne({
    documentId,
    populate: ['instructor'],
  });

  if (!course) {
    return false;
  }

  return course.instructor?.id === user.id;
};
