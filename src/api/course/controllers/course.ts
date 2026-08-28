/**
 * course controller
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ApplicationError } = errors;

// Roles that may be set as a course's instructor. A Student is excluded: giving
// one a course would hand them edit rights the permission matrix denies them.
const ASSIGNABLE_ROLES = ['Admin', 'Content Manager', 'Instructor'];

// Roles that may assign a course to somebody other than themselves.
const CAN_ASSIGN_ROLES = ['Admin', 'Content Manager'];

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

// Re-reads one course with its instructor and attaches it to the response body.
async function attachInstructor(strapi: any, entry: any) {
  if (!entry) {
    return entry;
  }

  const course = await strapi.documents('api::course.course').findOne({
    documentId: entry.documentId,
    populate: ['instructor'],
  });

  entry.instructor = publicInstructor(course?.instructor);

  return entry;
}

// Writes the instructor relation and reflects it back in the response.
//
// Done through the document service rather than the request body — see the note
// in create() for why the content API cannot carry this field.
async function setInstructor(strapi: any, entry: any, instructorId: number | null) {
  if (!entry || instructorId === null) {
    return entry;
  }

  await strapi.documents('api::course.course').update({
    documentId: entry.documentId,
    data: { instructor: instructorId },
  });

  return attachInstructor(strapi, entry);
}

// Works out who should own a course, from the authenticated user and whatever
// the client asked for.
//
// `requested` comes straight out of the request body, so it is untrusted: it is
// honoured only for roles allowed to assign, and only after the target account
// has been checked. Everyone else silently owns what they create.
async function resolveInstructorId(strapi: any, user: any, requested: unknown) {
  // Nothing asked for — the creator owns it. This is also what keeps ownership
  // total: no course is ever left without an instructor for the policy to trip
  // over.
  if (requested === undefined || requested === null || requested === '') {
    return user.id;
  }

  // Assigning a course to yourself is not really assigning, so an Instructor
  // sending their own id is fine rather than an error.
  if (Number(requested) === user.id) {
    return user.id;
  }

  if (!CAN_ASSIGN_ROLES.includes(user.role.name)) {
    throw new ApplicationError('You can only create courses for yourself');
  }

  const target = await strapi.query('plugin::users-permissions.user').findOne({
    where: { id: Number(requested) },
    populate: ['role'],
  });

  if (!target) {
    throw new ApplicationError('That user does not exist');
  }

  if (!target.role || !ASSIGNABLE_ROLES.includes(target.role.name)) {
    throw new ApplicationError(
      'A course can only be assigned to an admin, content manager or instructor',
    );
  }

  return target.id;
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

    await attachInstructor(strapi, response?.data);

    return response;
  },

  async create(ctx) {
    const data = ctx.request.body?.data ?? {};

    // Decided here, from the authenticated user — never taken from the body as
    // given, whatever the client sent.
    const instructorId = await resolveInstructorId(
      strapi,
      ctx.state.user,
      data.instructor,
    );

    // ...and then removed from the body, because the content API will not write
    // a relation to a user. Its sanitizer drops `instructor` from the accepted
    // input keys for the same reason it drops it from `populate` on the way out,
    // and config/api.ts sets strictParams, which turns a dropped key into a 400
    // ("Invalid key instructor") rather than a silent ignore. The relation is
    // set just below through the document service, which runs server-side and is
    // not sanitized.
    delete data.instructor;
    ctx.request.body.data = data;

    const response = await super.create(ctx);

    await setInstructor(strapi, response?.data, instructorId);

    return response;
  },

  async update(ctx) {
    const data = ctx.request.body?.data ?? {};
    const reassigning = 'instructor' in data;

    // Reassigning is checked the same way as assigning on create, so an
    // instructor cannot hand their course to someone else — or take one — by
    // editing this field. The route's is-course-owner policy has already
    // established they may edit this course at all.
    const instructorId = reassigning
      ? await resolveInstructorId(strapi, ctx.state.user, data.instructor)
      : null;

    if (reassigning) {
      delete data.instructor;
      ctx.request.body.data = data;
    }

    const response = await super.update(ctx);

    if (reassigning) {
      await setInstructor(strapi, response?.data, instructorId);
    } else {
      await attachInstructor(strapi, response?.data);
    }

    return response;
  },

  // The courses this user may manage, scoped on the server.
  //
  // For Admin and Content Manager that is every course, because the permission
  // matrix lets them act platform-wide. For an Instructor it is only their own —
  // the same rule the is-course-owner policy applies to a single course, applied
  // here to a list.
  async managed(ctx) {
    const user = ctx.state.user;
    const actsPlatformWide = CAN_ASSIGN_ROLES.includes(user.role.name);

    const courses = await strapi.documents('api::course.course').findMany({
      // The instructor id comes from the token, never from the query string.
      filters: actsPlatformWide ? {} : { instructor: user.id },
      populate: ['instructor'],
      sort: { createdAt: 'desc' },
    });

    ctx.body = {
      data: courses.map((course: any) => ({
        id: course.id,
        documentId: course.documentId,
        title: course.title,
        description: course.description,
        coverImageUrl: course.coverImageUrl,
        instructor: publicInstructor(course.instructor),
      })),
    };
  },

  // Feeds the instructor picker on the course form. Admin and Content Manager
  // only — an Instructor cannot assign a course to anyone, so they have no use
  // for a list of colleagues.
  async assignableInstructors(ctx) {
    const users = await strapi.query('plugin::users-permissions.user').findMany({
      where: { role: { name: { $in: ASSIGNABLE_ROLES } } },
      populate: ['role'],
      orderBy: { fullName: 'asc' },
    });

    // Whitelisted again, and for the same reason: never hand out raw user rows.
    // The email is included because two people can share a name and the person
    // picking needs to tell them apart.
    ctx.body = {
      data: users.map((user: any) => ({
        id: user.id,
        fullName: user.fullName ?? user.username,
        email: user.email,
        role: user.role.name,
      })),
    };
  },
}));
