/**
 * Lists the accounts a course may be assigned to, for the instructor picker on
 * the course form.
 *
 * The path is deliberately not /courses/something: the core router already owns
 * /courses/:documentId, and a sibling path would be ambiguous with it.
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/course-instructors',
      handler: 'course.assignableInstructors',
    },
  ],
};
