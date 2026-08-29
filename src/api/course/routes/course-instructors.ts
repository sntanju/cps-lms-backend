

export default {
  routes: [
    {
      method: 'GET',
      path: '/course-instructors',
      handler: 'course.assignableInstructors',
    },
  ],
};
