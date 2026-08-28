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

// The permissions every LMS role needs just to complete a login round-trip.
// Like the roles above, the Strapi admin grid stores these as database rows, so
// a fresh database has none of them and the four LMS roles start with zero
// permissions. Without seeding, a user logs in successfully and then gets 403
// on /api/users/me, because they hold an LMS role rather than 'Authenticated'.
const SHARED_PERMISSIONS = [
  // Our own endpoint, the only one that can return the user's role.
  'api::auth.auth.me',
  'plugin::users-permissions.auth.logout',
];

// Reading the course catalogue. Every signed-in role gets this: a student needs
// it to find a course to enroll in, and the other three need it to manage one.
// The catalogue is not public — the Public role is granted nothing here.
const COURSE_READ = ['api::course.course.find', 'api::course.course.findOne'];

// Writing courses. Granting this to Instructor does NOT mean "any course" — the
// is-course-owner policy on the update and delete routes narrows it to their
// own, which is the part this grid cannot express.
const COURSE_WRITE = [
  'api::course.course.create',
  'api::course.course.update',
  'api::course.course.delete',
];

// The instructor picker on the course form. Only the roles that may assign a
// course to somebody else have any use for a list of who that could be.
const COURSE_ASSIGN = ['api::course.course.assignableInstructors'];

// The authoring list — "the courses I may manage". Scoped on the server, so a
// student holding this permission would still see nothing; they simply have no
// courses. Granted to the three authoring roles only, since the page it feeds
// is behind the same guard.
const COURSE_MANAGE_LIST = ['api::course.course.managed'];

// Feature permissions, per role. A map rather than one shared list, because from
// here the roles diverge: reading a course is for everyone, writing one is not.
//
// What this grid can and cannot do is worth being precise about. It decides
// whether a role may attempt an action at all, and nothing more. It cannot
// express the spec's "own only" rules — ticking course.update for Instructor
// would let any instructor edit every course on the platform — so ownership is
// checked in a route policy instead, added with the feature that needs it.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: [...COURSE_READ, ...COURSE_WRITE, ...COURSE_ASSIGN, ...COURSE_MANAGE_LIST],
  'Content Manager': [
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...COURSE_ASSIGN,
    ...COURSE_MANAGE_LIST,
  ],
  Instructor: [...COURSE_READ, ...COURSE_WRITE, ...COURSE_MANAGE_LIST],
  // A student browses the catalogue and nothing more. The permission matrix
  // gives them no course-write action at all.
  Student: [...COURSE_READ],
};

// Permissions that must NOT be left on the Public role. Strapi grants these by
// default when it first creates Public, so a fresh database arrives with them.
//
// `auth.register` is the plugin's own signup endpoint, POST /api/auth/local/register.
// It assigns the role named in the advanced settings — 'Authenticated' — so a user
// created through it lands outside the four LMS roles entirely, bypassing the
// Student role our own register service hardcodes. Our POST /api/auth/register is
// the only signup path we want, so this one is revoked on every boot.
const PUBLIC_REVOKED_PERMISSIONS = ['plugin::users-permissions.auth.register'];

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: any }) {
    // Create any role that does not exist yet. Runs on every boot, so it must
    // do nothing when the roles are already there.
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

      // Grant the permissions this role is missing. Also runs on every boot, so
      // it must skip the ones that are already granted.
      //
      // This only ever grants. Removing an action from the lists above will not
      // revoke it from a database that already holds it — untick it in
      // Settings -> Roles, or add it to the revocation loop below.
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

    // Take back the permissions Public must not keep. Like the grants above this
    // runs on every boot, so it must do nothing once they are already gone.
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
        // Same split as the register service: the email is the unique username,
        // the person's name lives in fullName.
        username: adminEmail.toLowerCase(),
        fullName: adminName,
        email: adminEmail.toLowerCase(),
        password: adminPassword,
        // Required for POST /api/auth/local to find this user; see the note in
        // src/api/auth/services/auth.ts.
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
