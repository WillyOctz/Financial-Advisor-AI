import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // for cookies
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    // get token from cookies
    if (typeof document !== "undefined") {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error: ", error.response?.data || error.message);

    // Handle 2fa if required
    if (error.response?.status === 401 && error.response?.data?.detail === "2FA verification required") {

      // get partial token from original request
      const originalRequest = error.config;
      const authHeader = originalRequest.headers.Authorization;
      if (authHeader) {
        const partialToken = authHeader.replace("Bearer", "");
        localStorage.setItem("partial_token", partialToken);

        // Redirect to 2fa verification
        if (typeof window !== "undefined") {
          window.location.href = "/verify-2fa"
        }
      } 
      return Promise.reject(error);
    }

    // handle regular error authentications (normal login)
    if (error.response?.status === 401) {
      // Clear all auth data
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("partial_token");

      if (typeof document !== "undefined") {
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "partial_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }

      // Redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    // Handle 403 errors
    if (error.response?.status === 403) {
      console.error("Access forbidden. You don't have permission.");
    }

    return Promise.reject(error);
  }
);
