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
        // Account creation is unauthenticated, so throttle it the same way the
        // plugin throttles its own auth routes. Without this the endpoint can be
        // hammered to create accounts or to probe which emails are registered.
        middlewares: ['plugin::users-permissions.rateLimit'],
      },
    },
    {
      method: 'GET',
      path: '/auth/me',
      handler: 'auth.me',
    },
  ],
};
