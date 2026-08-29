// The signed-in student's own progress in one course.
export default {
  routes: [
    {
      method: 'GET',
      path: '/courses/:documentId/progress',
      handler: 'course.progress',
    },
  ],
};
