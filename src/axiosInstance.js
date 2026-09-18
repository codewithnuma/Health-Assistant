import axios from "axios";

const BASE_URL =
  "https://9a85-182-93-68-229.ngrok-free.app/api";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "ngrok-skip-browser-warning": "69420",
  },
});

let isRefreshing = false;
let refreshPromise = null;
let isLoggedOut = false;

export const markLoggedOut = () => {
  isLoggedOut = true;
};

export const resetLogoutState = () => {
  isLoggedOut = false;
};

axiosInstance.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (isLoggedOut) {
      return Promise.reject(error);
    }

    const noRefreshUrls = [
      "/accounts/login/",
      "/accounts/logout/",
      "/accounts/refresh/",
      "/accounts/rasa-token/",
    ];

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !noRefreshUrls.some((url) =>
        originalRequest?.url?.includes(url)
      )
    ) {
      originalRequest._retry = true;

      try {
        if (!isRefreshing) {
          isRefreshing = true;

          refreshPromise = axios
            .post(
              `${BASE_URL}/accounts/refresh/`,
              {},
              {
                withCredentials: true,
                headers: {
                  "ngrok-skip-browser-warning": "69420",
                },
              }
            )
            .finally(() => {
              isRefreshing = false;
              refreshPromise = null;
            });
        }

        await refreshPromise;

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        isLoggedOut = true;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;