import { errors } from '@strapi/utils';

const { ApplicationError, NotFoundError } = errors;

const LMS_ROLE_NAMES = ['Admin', 'Content Manager', 'Instructor', 'Student'];

// Raw user rows carry password, resetPasswordToken and confirmationToken.
function publicUser(user: any) {
  return {
    id: user.id,
    fullName: user.fullName ?? user.username,
    email: user.email,
    role: user.role ? { id: user.role.id, name: user.role.name } : null,
    createdAt: user.createdAt,
  };
}

async function findLmsRoles(strapi: any) {
  return strapi.query('plugin::users-permissions.role').findMany({
    where: { name: { $in: LMS_ROLE_NAMES } },
  });
}

export default ({ strapi }: { strapi: any }) => ({
  async users() {
    const users = await strapi.query('plugin::users-permissions.user').findMany({
      populate: ['role'],
      orderBy: { createdAt: 'desc' },
    });

    return users.map(publicUser);
  },

  async roles() {
    const roles = await findLmsRoles(strapi);

    return roles
      .map((role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description,
      }))
      .sort(
        (a: any, b: any) =>
          LMS_ROLE_NAMES.indexOf(a.name) - LMS_ROLE_NAMES.indexOf(b.name),
      );
  },

  async setRole(actingUser: any, targetId: unknown, roleId: unknown) {
    const id = Number(targetId);

    if (!Number.isInteger(id)) {
      throw new ApplicationError('That user does not exist');
    }

    const target = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id },
      populate: ['role'],
    });

    if (!target) {
      throw new NotFoundError('That user does not exist');
    }

    if (target.id === actingUser.id) {
      throw new ApplicationError('You cannot change your own role');
    }

    const role = await strapi.query('plugin::users-permissions.role').findOne({
      where: { id: Number(roleId) },
    });

    if (!role || !LMS_ROLE_NAMES.includes(role.name)) {
      throw new ApplicationError('Choose one of the four LMS roles');
    }

    await strapi.query('plugin::users-permissions.user').update({
      where: { id: target.id },
      data: { role: role.id },
    });

    return publicUser({ ...target, role });
  },

  async stats() {
    const roles = await findLmsRoles(strapi);

    const usersByRole = [];

    for (const name of LMS_ROLE_NAMES) {
      const role = roles.find((candidate: any) => candidate.name === name);

      usersByRole.push({
        role: name,
        count: role
          ? await strapi
              .query('plugin::users-permissions.user')
              .count({ where: { role: { id: role.id } } })
          : 0,
      });
    }

    return {
      usersByRole,
      totalUsers: await strapi.query('plugin::users-permissions.user').count(),
      totalCourses: await strapi.documents('api::course.course').count({}),
      totalLessons: await strapi.documents('api::lesson.lesson').count({}),
      totalEnrollments: await strapi
        .documents('api::enrollment.enrollment')
        .count({}),
      totalBlogPosts: await strapi.documents('api::blog-post.blog-post').count({}),
    };
  },
});
