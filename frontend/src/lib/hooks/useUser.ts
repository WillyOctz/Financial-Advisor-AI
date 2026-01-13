import { useAuth } from "../../../contexts/AuthContexts";

export function useUser() {
  const { user, token } = useAuth();

  return {
    user,
    userId: user?.id || null,
    token: token,
    isAuthenticated: !!user && !!token,
  };
}
