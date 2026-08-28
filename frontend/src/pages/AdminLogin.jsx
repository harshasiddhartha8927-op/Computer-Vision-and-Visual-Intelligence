import { LockKeyhole, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ADMIN_SESSION_KEY, isAdminAuthenticated } from "../utils/bookingStorage";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  if (isAdminAuthenticated()) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    if (credentials.username === "admin" && credentials.password === "admin123") {
      window.localStorage.setItem(ADMIN_SESSION_KEY, "true");
      navigate("/admin", { replace: true });
      return;
    }

    setError("Invalid username or password.");
  };

  return (
    <section className="flex min-h-[calc(100vh-144px)] items-center bg-petal/45 py-12">
      <div className="page-shell">
        <div className="mx-auto max-w-md rounded-lg border border-rose/10 bg-white p-6 shadow-salon sm:p-8">
          <div className="mb-7 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose text-white shadow-salon">
              <ShieldCheck size={25} aria-hidden="true" />
            </span>
            <p className="mt-5 text-sm font-bold uppercase text-gold">Admin Login</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-plum">Glam Beauty Parlour</h1>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5">
            <label className="grid gap-2">
              <span className="field-label">Username</span>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rose" size={18} />
                <input
                  className="field-input pl-10"
                  value={credentials.username}
                  onChange={(event) => {
                    setCredentials((current) => ({ ...current, username: event.target.value }));
                    setError("");
                  }}
                  placeholder="admin"
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="field-label">Password</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rose" size={18} />
                <input
                  className="field-input pl-10"
                  type="password"
                  value={credentials.password}
                  onChange={(event) => {
                    setCredentials((current) => ({ ...current, password: event.target.value }));
                    setError("");
                  }}
                  placeholder="admin123"
                />
              </div>
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <button type="submit" className="primary-button w-full">
              <ShieldCheck size={18} aria-hidden="true" />
              Login
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
