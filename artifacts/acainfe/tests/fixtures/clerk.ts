// Component tests isolate identity; real cookie/session wiring is tested end-to-end.
export function useUser() {
  return {
    isLoaded: true, isSignedIn: true,
    user: { id: 'user_clerk_test', externalId: 'test-user', fullName: 'Pessoa de teste', primaryEmailAddress: { emailAddress: 'user@example.test' } },
  };
}
export function useClerk() {
  return { signOut: async () => {} };
}
