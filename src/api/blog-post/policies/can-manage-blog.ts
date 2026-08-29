
const BLOG_ROLES = ['Admin', 'Content Manager'];

export default async (policyContext: any) => {
  const user = policyContext.state.user;

  if (!user) {
    return false;
  }

  return BLOG_ROLES.includes(user.role.name);
};
