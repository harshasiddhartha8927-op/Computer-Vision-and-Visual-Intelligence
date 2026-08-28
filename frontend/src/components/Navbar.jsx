import { CalendarCheck, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Services", to: "/services" },
  { label: "Reviews", to: "/reviews" },
  { label: "Book Appointment", to: "/booking" },
  { label: "Admin Login", to: "/admin-login" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${
      isActive ? "bg-petal text-rose" : "text-plum/75 hover:bg-petal hover:text-plum"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-rose/10 bg-white/90 backdrop-blur">
      <nav className="page-shell flex h-20 items-center justify-between">
        <Link to="/" className="flex min-w-0 items-center gap-3" onClick={() => setIsOpen(false)}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose text-white shadow-salon">
            <Sparkles size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-xl font-bold text-plum">
              Glam Beauty Parlour
            </span>
            <span className="hidden text-xs font-semibold uppercase text-gold sm:block">
              Salon and spa studio
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/admin-login" className="secondary-button px-4 py-2">
            <ShieldCheck size={17} aria-hidden="true" />
            Admin
          </Link>
          <Link to="/booking" className="primary-button px-5 py-2.5">
            <CalendarCheck size={17} aria-hidden="true" />
            Book
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-rose/20 text-plum lg:hidden"
          aria-label="Toggle navigation menu"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </nav>

      {isOpen && (
        <div className="border-t border-rose/10 bg-white lg:hidden">
          <div className="page-shell grid gap-2 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={linkClass}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
