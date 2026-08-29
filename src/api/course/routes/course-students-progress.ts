export default {
  routes: [
    {
      method: 'GET',
      path: '/courses/:documentId/students-progress',
      handler: 'course.studentsProgress',
    },
  ],
};
