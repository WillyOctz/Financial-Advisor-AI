import axios from "axios";
import { error } from "console";
import { response } from "express";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

    // Handle authentication errors
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    } else if (error.response?.status === 403) {
      console.error("Access forbidden. You don't have permission.");
    } else if (error.response?.status === 404) {
      console.error("Endpoint not found. Check your API routes.");
    } else if (error.response?.status === 500) {
      console.error("Server error. Check backend logs.");
    }

    return Promise.reject(error);
  }
);
