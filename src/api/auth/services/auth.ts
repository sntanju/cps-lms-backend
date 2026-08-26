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

    // Create the user
    const user = await strapi
      .plugin('users-permissions')
      .service('user')
      .add({
        username: name,
        email: normalizedEmail,
        password,
        confirmed: true,
        blocked: false,
        role: studentRole.id,
      });

    // Never return the password
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: {
        id: studentRole.id,
        name: studentRole.name,
      },
    };
  },
});