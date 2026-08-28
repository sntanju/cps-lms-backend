/**
 * Decides whether the signed-in user may write to *this particular* course.
 *
 * Why a policy and not the permission grid: the grid in Settings -> Roles is
 * all-or-nothing per action. Ticking course.update for Instructor would let any
 * instructor edit every course on the platform, which is not what the permission
 * matrix says ("Own only"). So the two work together — the grid decides whether
 * a role may attempt the action at all, and this decides whether they may do it
 * to this row.
 */

export default async (policyContext: any, config: any, { strapi }: { strapi: any }) => {
  // Set by Strapi's auth strategy from the verified Bearer token. This is the
  // only trustworthy source of identity — a user id in the body or the query
  // string is just something the client typed.
  const user = policyContext.state.user;

  if (!user) {
    return false;
  }

  // Admin and Content Manager act platform-wide, per the permission matrix.
  // Roles are compared by exact name, the same convention as src/index.ts and
  // src/api/auth/services/auth.ts — renaming a role in the admin panel breaks
  // all three.
  if (user.role.name === 'Admin' || user.role.name === 'Content Manager') {
    return true;
  }

  // The core router names this param `id`, but what it actually holds is the
  // documentId — Strapi 5 addresses entries by documentId in REST URLs while the
  // route parameter kept its old name. Destructuring `documentId` here silently
  // yields undefined, which makes every lookup miss and every owner look like a
  // non-owner.
  const { id: documentId } = policyContext.params;

  const course = await strapi.documents('api::course.course').findOne({
    documentId,
    populate: ['instructor'],
  });

  // A course that does not exist is refused rather than reported as missing, so
  // this route cannot be used to probe which course ids are real.
  if (!course) {
    return false;
  }

  return course.instructor?.id === user.id;
};
