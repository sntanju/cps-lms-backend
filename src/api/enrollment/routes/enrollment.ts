
export default {
  routes: [
    {
      method: 'POST',
      path: '/enrollments/enroll',
      handler: 'enrollment.enroll',
    },
    {
      method: 'GET',
      path: '/enrollments/mine',
      handler: 'enrollment.mine',
    },
  ],
};
