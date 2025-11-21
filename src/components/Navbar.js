import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import {
  Bars3Icon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  UserIcon,
  CalendarIcon,
  // AcademicCapIcon,
} from "@heroicons/react/24/outline";
// Navbar styles converted to Tailwind — removed external CSS import
import aceLogo from '../assets/ace-logo2.png';


const Navbar = ({ user, role }) => {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false); // New state for modal

  const handleLogoutClick = () => {
    setShowLogoutModal(true); // Open the modal
  };

  const confirmLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  const cancelLogout = () => {
    setShowLogoutModal(false); // Close the modal
  };

  const getNavLinkClass = ({ isActive }) => {
    const base =
      "flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 py-2 rounded-md text-white text-sm md:text-base w-16 md:w-auto hover:bg-gray-700 transition-colors";
    return isActive ? `${base} bg-gray-600` : base;
  };

  const location = useLocation();
  const isDetailPage = location.pathname.includes("/scanner") 
                    || location.pathname.includes("/attendance") 
                    || location.pathname.includes("/students");

  const navLinks = (
    <>
      {!user && (
        <NavLink to="/login" className={getNavLinkClass} title="Login">
          <ArrowRightOnRectangleIcon className="h-6 w-6" />
          <span className="mt-1 md:mt-0 md:ml-2 text-sm">Login</span>
        </NavLink>
      )}
      {role === "admin" && (
        <NavLink
          to="/admin-dashboard"
          className={getNavLinkClass}
          title="Admin"
        >
          <UserIcon className="h-6 w-6" />
          <span className="mt-1 md:mt-0 md:ml-2 text-sm">Admin</span>
        </NavLink>
      )}
      {/* {user && role === "admin" && (
        <span className="text-gray-300">Welcome, Admin</span>
      )} */}
      <NavLink to="/" className={getNavLinkClass} title="Events">
        <CalendarIcon className="h-6 w-6" />
        <span className="mt-1 md:mt-0 md:ml-2 text-sm">Events</span>
      </NavLink>
      {user && (
        <button
          onClick={handleLogoutClick}
          title="Logout"
          className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 py-2 rounded-md text-red-500 text-sm md:text-base w-16 md:w-auto hover:bg-gray-700 md:bg-transparent md:hover:bg-red-700 transition-colors"
        >
          <ArrowLeftOnRectangleIcon className="h-6 w-6" />
          <span className="mt-1 md:mt-0 md:ml-2 text-sm">Logout</span>
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Top Navbar (Desktop) */}
      {!isDetailPage && (
        <nav className="bg-gray-800 text-white px-6 py-3 shadow-md sticky top-0 z-50 hidden md:flex justify-between items-center">
          <NavLink
            to="/"
            className="flex items-center gap-2 text-xl font-bold cursor-pointer hover:text-blue-400 transition-colors"
            title="ACE ATTENDANCE"
          >
              <img src={aceLogo} alt="ACE Logo" className="h-12 w-12 object-contain" />
              <span>ACE Attendance</span>
          </NavLink>
          {!isDetailPage && <div className="flex items-center gap-4">{navLinks}</div>}
        </nav>
      )}

      {/* Bottom Navbar (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white shadow-lg md:hidden z-50">
        {!isDetailPage && <div className="flex justify-around items-center h-16">{navLinks}</div>}
      </nav>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Confirm Logout</h2>
            <p className="text-gray-700 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelLogout}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
