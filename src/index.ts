// // import type { Core } from '@strapi/strapi';

// The four LMS roles. These are database rows, not code, so a fresh database
// (a new Railway deployment) starts with none of them. Seed them on boot.
const LMS_ROLES = [
  {
    name: 'Admin',
    type: 'admin',
    description: 'Full control of the platform, including users and roles.',
  },
  {
    name: 'Content Manager',
    type: 'content_manager',
    description: 'Manages courses, lessons and blog posts across the platform.',
  },
  {
    name: 'Instructor',
    type: 'instructor',
    description: 'Manages the lessons and quizzes of their own courses.',
  },
  {
    name: 'Student',
    type: 'student',
    description: 'Enrolls in courses, views lessons and takes quizzes.',
  },
];

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: any }) {
    // Create any role that does not exist yet. Runs on every boot, so it must
    // do nothing when the roles are already there.
    for (const role of LMS_ROLES) {
      const existingRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({
          where: {
            name: role.name,
          },
        });

      if (existingRole) {
        continue;
      }

      await strapi.query('plugin::users-permissions.role').create({
        data: role,
      });

      strapi.log.info(`Created role: ${role.name}`);
    }

    const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const adminName = process.env.INITIAL_ADMIN_NAME;

    if (!adminEmail || !adminPassword || !adminName) {
      throw new Error(
        'INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD and INITIAL_ADMIN_NAME must be set',
      );
    }

    // Find the LMS Admin role
    const adminRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({
        where: {
          name: 'Admin',
        },
      });

    if (!adminRole) {
      throw new Error(
        'Admin role not found. Create the Admin role in Strapi Admin first.',
      );
    }

    // Check if the initial Admin user already exists
    const existingAdmin = await strapi
      .query('plugin::users-permissions.user')
      .findOne({
        where: {
          email: adminEmail.toLowerCase(),
        },
      });

    if (existingAdmin) {
      strapi.log.info('Initial Admin already exists.');
      return;
    }

    // Create the initial LMS Admin user
    const adminUser = await strapi
      .plugin('users-permissions')
      .service('user')
      .add({
        username: adminName,
        email: adminEmail.toLowerCase(),
        password: adminPassword,
        confirmed: true,
        blocked: false,
        role: adminRole.id,
      });

    strapi.log.info(
      `Initial LMS Admin created successfully: ${adminUser.email}`,
    );
  },
};

// export default {
//   /**
//    * An asynchronous register function that runs before
//    * your application is initialized.
//    *
//    * This gives you an opportunity to extend code.
//    */
//   register(/* { strapi }: { strapi: Core.Strapi } */) {},

//   /**
//    * An asynchronous bootstrap function that runs before
//    * your application gets started.
//    *
//    * This gives you an opportunity to set up your data model,
//    * run jobs, or perform some special logic.
//    */
//   bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
// };
