
export default {
  routes: [
    {
      method: 'GET',
      path: '/courses/:documentId/lessons',
      handler: 'course.lessons',
    },
  ],
};
