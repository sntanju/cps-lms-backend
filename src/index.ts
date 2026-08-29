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

const SHARED_PERMISSIONS = [
  // Our own endpoint, the only one that can return the user's role.
  'api::auth.auth.me',
  'plugin::users-permissions.auth.logout',
];

const COURSE_READ = ['api::course.course.find', 'api::course.course.findOne'];

const COURSE_WRITE = [
  'api::course.course.create',
  'api::course.course.update',
  'api::course.course.delete',
];


const COURSE_ASSIGN = ['api::course.course.assignableInstructors'];

const COURSE_MANAGE_LIST = ['api::course.course.managed'];

const LESSON_READ = ['api::lesson.lesson.find', 'api::lesson.lesson.findOne'];

const LESSON_WRITE = [
  'api::lesson.lesson.create',
  'api::lesson.lesson.update',
  'api::lesson.lesson.delete',
];


const ENROLLMENT_STUDENT = [
  'api::enrollment.enrollment.enroll',
  'api::enrollment.enrollment.mine',
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: [
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...COURSE_ASSIGN,
    ...COURSE_MANAGE_LIST,
    ...LESSON_READ,
    ...LESSON_WRITE,
  ],
  'Content Manager': [
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...COURSE_ASSIGN,
    ...COURSE_MANAGE_LIST,
    ...LESSON_READ,
    ...LESSON_WRITE,
  ],
  Instructor: [
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...COURSE_MANAGE_LIST,
    ...LESSON_READ,
    ...LESSON_WRITE,
  ],
  // A student browses the catalogue and reads lessons, and nothing more. The
  // permission matrix gives them no course- or lesson-write action at all.
  Student: [...COURSE_READ, ...LESSON_READ, ...ENROLLMENT_STUDENT],
};

const PUBLIC_REVOKED_PERMISSIONS = ['plugin::users-permissions.auth.register'];

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: any }) {
   
    for (const role of LMS_ROLES) {
      let lmsRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({
          where: {
            name: role.name,
          },
        });

      if (!lmsRole) {
        lmsRole = await strapi.query('plugin::users-permissions.role').create({
          data: role,
        });

        strapi.log.info(`Created role: ${role.name}`);
      }

      for (const action of [
        ...SHARED_PERMISSIONS,
        ...(ROLE_PERMISSIONS[role.name] ?? []),
      ]) {
        const existingPermission = await strapi
          .query('plugin::users-permissions.permission')
          .findOne({
            where: {
              action,
              role: {
                id: lmsRole.id,
              },
            },
          });

        if (existingPermission) {
          continue;
        }

        await strapi.query('plugin::users-permissions.permission').create({
          data: {
            action,
            role: lmsRole.id,
          },
        });

        strapi.log.info(`Granted ${action} to role: ${role.name}`);
      }
    }

    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({
        where: {
          type: 'public',
        },
      });

    if (publicRole) {
      for (const action of PUBLIC_REVOKED_PERMISSIONS) {
        const permission = await strapi
          .query('plugin::users-permissions.permission')
          .findOne({
            where: {
              action,
              role: {
                id: publicRole.id,
              },
            },
          });

        if (!permission) {
          continue;
        }

        await strapi.query('plugin::users-permissions.permission').delete({
          where: {
            id: permission.id,
          },
        });

        strapi.log.info(`Revoked ${action} from role: Public`);
      }
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
        
        username: adminEmail.toLowerCase(),
        fullName: adminName,
        email: adminEmail.toLowerCase(),
        password: adminPassword,
        
        provider: 'local',
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
