export default (policyContext: any) =>
  policyContext.state.user?.role?.name === 'Admin';
