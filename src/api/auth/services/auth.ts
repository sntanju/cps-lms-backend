interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export default ({ strapi }: { strapi: any }) => ({
  async register({ name, email, password }: RegisterInput) {
    // Validate input
    if (!name || !email || !password) {
      throw new Error('Name, email and password are required');
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate password
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if email already exists
    const existingUser = await strapi
      .query('plugin::users-permissions.user')
      .findOne({
        where: {
          email: normalizedEmail,
        },
      });

    if (existingUser) {
      throw new Error('Email is already registered');
    }

    // Find Student role
    const studentRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({
        where: {
          name: 'Student',
        },
      });

    if (!studentRole) {
      throw new Error(
        'Student role not found. Create the Student role in Strapi Admin first.',
      );
    }

    // Create the user.
    //
    // `username` is unique in the schema, so the person's name cannot go in it:
    // two students genuinely called "Sarah Ahmed" would collide and the second
    // signup would fail on the unique constraint. The email is already unique
    // (checked above), so it becomes the username, and the name is stored
    // separately in `fullName` where it is free to repeat.
    const user = await strapi
      .plugin('users-permissions')
      .service('user')
      .add({
        username: normalizedEmail,
        fullName: name,
        email: normalizedEmail,
        password,
        // Login (POST /api/auth/local) looks the user up with a hard filter on
        // provider === 'local'. The column has no default, so leaving it out
        // stores NULL and the account can never log in.
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: studentRole.id,
      });

    // Never return the password
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: {
        id: studentRole.id,
        name: studentRole.name,
      },
    };
  },

  // Returns the signed-in user together with their role.
  //
  // Why this exists instead of GET /api/users/me?populate=role: the content API
  // sanitizer strips `role` out of `populate`, because authorizing it would need
  // a content API permission on plugin::users-permissions.role and no such
  // action is registered (Strapi only registers admin-panel `roles.*` actions).
  // So /api/users/me answers 200 with no role, and the frontend has no way to
  // know which role the user holds.
  async me(userId: number) {
    const user = await strapi
      .query('plugin::users-permissions.user')
      .findOne({
        where: {
          id: userId,
        },
        populate: ['role'],
      });

    if (!user) {
      throw new Error('User not found');
    }

    // Same whitelisted shape as register — never the raw record.
    return {
      id: user.id,
      // Falls back to the username for accounts that predate `fullName` and for
      // any user created by hand in the Strapi admin panel, where it is blank.
      fullName: user.fullName ?? user.username,
      email: user.email,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
          }
        : null,
    };
  },
});
