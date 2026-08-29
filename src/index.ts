// // import type { Core } from '@strapi/strapi';

// The four LMS roles. These are database rows, not code, so a fresh database (a new Railway deployment) starts with none of them. Seed them on boot.

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

const LESSON_LIST = ['api::lesson.lesson.find'];

const LESSON_READ_ONE = ['api::lesson.lesson.findOne'];

const LESSON_READ = [...LESSON_LIST, ...LESSON_READ_ONE];

// The lessons of one course, gated on enrolment. Every role needs it.
const COURSE_LESSONS = ['api::course.course.lessons'];

const LESSON_WRITE = [
  'api::lesson.lesson.create',
  'api::lesson.lesson.update',
  'api::lesson.lesson.delete',
];

const PROGRESS_STUDENT = [
  'api::lesson-completion.lesson-completion.complete',
  'api::lesson-completion.lesson-completion.uncomplete',
  'api::course.course.progress',
];

const PROGRESS_ROSTER = ['api::course.course.studentsProgress'];

const QUIZ_WRITE = [
  
  'api::quiz.quiz.find',
  'api::quiz.quiz.findOne',
  'api::quiz.quiz.create',
  'api::quiz.quiz.update',
  'api::quiz.quiz.delete',
  'api::question.question.create',
  'api::question.question.update',
  'api::question.question.delete',
];

const QUIZ_TAKE = [
  'api::quiz.quiz.take',
  'api::quiz-result.quiz-result.submit',
  'api::quiz-result.quiz-result.forQuiz',
  'api::quiz-result.quiz-result.mine',
];

const QUIZ_RESULTS_ROSTER = ['api::quiz-result.quiz-result.forCourse'];

const BLOG_READ = [
  'api::blog-post.blog-post.find',
  'api::blog-post.blog-post.findOne',
];

const BLOG_WRITE = [
  'api::blog-post.blog-post.create',
  'api::blog-post.blog-post.update',
  'api::blog-post.blog-post.delete',
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
    ...COURSE_LESSONS,
    ...PROGRESS_ROSTER,
    ...LESSON_READ,
    ...LESSON_WRITE,
    ...QUIZ_WRITE,
    ...QUIZ_RESULTS_ROSTER,
    ...BLOG_READ,
    ...BLOG_WRITE,
  ],
  'Content Manager': [
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...COURSE_ASSIGN,
    ...COURSE_MANAGE_LIST,
    ...COURSE_LESSONS,
    ...PROGRESS_ROSTER,
    ...LESSON_READ,
    ...LESSON_WRITE,
    ...QUIZ_WRITE,
    ...QUIZ_RESULTS_ROSTER,
    ...BLOG_READ,
    ...BLOG_WRITE,
  ],
  Instructor: [
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...COURSE_MANAGE_LIST,
    ...COURSE_LESSONS,
    ...PROGRESS_ROSTER,
    ...LESSON_READ,
    ...LESSON_WRITE,
    ...QUIZ_WRITE,
    ...QUIZ_RESULTS_ROSTER,
    ...BLOG_READ,
  ],
  
  Student: [
    ...COURSE_READ,
    ...COURSE_LESSONS,
    ...LESSON_READ_ONE,
    ...ENROLLMENT_STUDENT,
    ...PROGRESS_STUDENT,
    ...QUIZ_TAKE,
    ...BLOG_READ,
  ],
};

const ROLE_REVOKED_PERMISSIONS: Record<string, string[]> = {
  
  Student: ['api::lesson.lesson.find'],
};

const PUBLIC_PERMISSIONS = [...BLOG_READ];

const PUBLIC_REVOKED_PERMISSIONS = ['plugin::users-permissions.auth.register'];

const UNIQUE_INDEXES = [
  {
    name: 'enrollments_student_course_unique',
    table: 'enrollments',
    column: 'student_course_key',
  },
  {
    name: 'lesson_completions_student_lesson_unique',
    table: 'lesson_completions',
    column: 'student_lesson_key',
  },
];

async function ensureUniqueIndexes(strapi: any) {
  for (const index of UNIQUE_INDEXES) {
    try {
      await strapi.db.connection.raw(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${index.name} ON ${index.table} (${index.column})`,
      );
    } catch (error: any) {
      
      strapi.log.error(`Could not create ${index.name}: ${error.message}`);
    }
  }
}

async function grantPermissions(
  strapi: any,
  role: any,
  roleName: string,
  actions: string[],
) {
  for (const action of actions) {
    const existing = await strapi
      .query('plugin::users-permissions.permission')
      .findOne({
        where: { action, role: { id: role.id } },
      });

    // Idempotent: bootstrap runs on every boot, including every autoReload.
    if (existing) {
      continue;
    }

    await strapi.query('plugin::users-permissions.permission').create({
      data: { action, role: role.id },
    });

    strapi.log.info(`Granted ${action} to role: ${roleName}`);
  }
}

async function revokePermissions(
  strapi: any,
  role: any,
  roleName: string,
  actions: string[],
) {
  for (const action of actions) {
    const permission = await strapi
      .query('plugin::users-permissions.permission')
      .findOne({
        where: { action, role: { id: role.id } },
      });

    if (!permission) {
      continue;
    }

    await strapi.query('plugin::users-permissions.permission').delete({
      where: { id: permission.id },
    });

    strapi.log.info(`Revoked ${action} from role: ${roleName}`);
  }
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: any }) {
    await ensureUniqueIndexes(strapi);

   
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

      await grantPermissions(strapi, lmsRole, role.name, [
        ...SHARED_PERMISSIONS,
        ...(ROLE_PERMISSIONS[role.name] ?? []),
      ]);

      await revokePermissions(
        strapi,
        lmsRole,
        role.name,
        ROLE_REVOKED_PERMISSIONS[role.name] ?? [],
      );
    }

    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({
        where: {
          type: 'public',
        },
      });

    if (publicRole) {
      await grantPermissions(strapi, publicRole, 'Public', PUBLIC_PERMISSIONS);

      await revokePermissions(
        strapi,
        publicRole,
        'Public',
        PUBLIC_REVOKED_PERMISSIONS,
      );
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
