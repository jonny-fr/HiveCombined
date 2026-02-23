import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/events">Hive</Link>
      </div>

      {/* Hamburger button - visible only on mobile */}
      <button
        className="md:hidden nav-button-icon"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        {menuOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Desktop nav links */}
      <div className="nav-links hidden md:flex">
        <Link to="/events">Events</Link>
        {user && (
          <>
            <span className="nav-user">Hello, {user.username}</span>
            <button onClick={logout} className="nav-button">
              Logout
            </button>
          </>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#1a1a2e] border-b border-[#2d2d44] p-4 flex flex-col gap-3 shadow-lg md:hidden z-50">
          <Link
            to="/events"
            onClick={() => setMenuOpen(false)}
            className="text-gray-300 hover:text-purple-400 transition-colors font-medium py-2"
          >
            Events
          </Link>
          {user && (
            <>
              <span className="nav-user py-2">Hello, {user.username}</span>
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="nav-button w-full text-center"
              >
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
