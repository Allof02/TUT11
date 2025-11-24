import React, { createContext, useContext, useEffect, useState} from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

// TODO: get the BACKEND_URL.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

/*
 * This provider should export a `user` context state that is 
 * set (to non-null) when:
 *     1. a hard reload happens while a user is logged in.
 *     2. the user just logged in.
 * `user` should be set to null when:
 *     1. a hard reload happens when no users are logged in.
 *     2. the user just logged out.
 */
export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Runs once on mount: restores session from localStorage if token exists
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      return;
    }

    const fetchMe = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/user/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          // Token is invalid / expired
          localStorage.removeItem("token");
          setUser(null);
          return;
        }

        const data = await res.json();
        // data should be { user: { ... } }
        setUser(data.user);
      } catch (err) {
        console.error("Failed to fetch /user/me:", err);
        setUser(null);
      }
    };

    fetchMe();
  }, []);

  /*
   * Logout the currently authenticated user.
   *
   * This clears token + user and sends them home.
   */
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/");
  };

  /**
   * Login a user with their credentials.
   *
   * @remarks Upon success, navigates to "/profile".
   * @param {string} username
   * @param {string} password
   * @returns {string | undefined} error message on failure, nothing on success
   */
  const login = async (username, password) => {
    try {
      const res = await fetch(`${BACKEND_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        let message = "Login failed";
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch (_) {
          // ignore JSON parse errors
        }
        return message;
      }

      const data = await res.json(); // { token: "jwt_token_here" }
      const token = data.token;
      localStorage.setItem("token", token);

      // Fetch user info to populate context
      const meRes = await fetch(`${BACKEND_URL}/user/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (meRes.ok) {
        const meData = await meRes.json();
        setUser(meData.user);
      } else {
        // If /user/me fails, still logged in but no user object; safest is to clear
        localStorage.removeItem("token");
        setUser(null);
        return "Login succeeded, but failed to fetch user profile.";
      }

      navigate("/profile");
      // no return on success
    } catch (err) {
      console.error("Login error:", err);
      return "Network error during login.";
    }
  };

  /**
   * Registers a new user.
   *
   * @remarks Upon success, navigates to "/success".
   * @param {Object} userData - { username, firstname, lastname, password }
   * @returns {string | undefined} error message on failure
   */
  const register = async (userData) => {
    try {
      const res = await fetch(`${BACKEND_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!res.ok) {
        let message = "Registration failed";
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch (_) {
          // ignore JSON parse errors
        }
        return message;
      }

      // On 201 Created, just navigate to success page
      navigate("/success");
      // no return on success
    } catch (err) {
      console.error("Register error:", err);
      return "Network error during registration.";
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
