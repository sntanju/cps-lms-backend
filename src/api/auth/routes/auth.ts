// export default {
//   routes: [
//     // {
//     //  method: 'GET',
//     //  path: '/auth',
//     //  handler: 'auth.exampleAction',
//     //  config: {
//     //    policies: [],
//     //    middlewares: [],
//     //  },
//     // },
//   ],
// };

export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/register',
      handler: 'auth.register',
      config: {
        auth: false,
      },
    },
  ],
};
