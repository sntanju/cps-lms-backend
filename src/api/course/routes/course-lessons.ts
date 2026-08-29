// The lessons of one course, for whoever is allowed to read them.
//
// A child path, so it never collides with the core router's /courses/:id.
export default {
  routes: [
    {
      method: 'GET',
      path: '/courses/:documentId/lessons',
      handler: 'course.lessons',
    },
  ],
};
