export const BOOKINGS_STORAGE_KEY = "glam_beauty_bookings";
export const ADMIN_SESSION_KEY = "glam_beauty_admin_logged_in";

const canUseStorage = () => typeof window !== "undefined" && window.localStorage;

export const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getBookings = () => {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const storedBookings = window.localStorage.getItem(BOOKINGS_STORAGE_KEY);
    return storedBookings ? JSON.parse(storedBookings) : [];
  } catch {
    return [];
  }
};

export const saveBookings = (bookings) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
};

export const addBooking = (booking) => {
  const bookings = getBookings();
  const nextBookings = [booking, ...bookings];
  saveBookings(nextBookings);
  return nextBookings;
};

export const cancelBooking = (bookingId) => {
  const nextBookings = getBookings().map((booking) =>
    booking.id === bookingId ? { ...booking, status: "Cancelled" } : booking,
  );
  saveBookings(nextBookings);
  return nextBookings;
};

export const deleteBooking = (bookingId) => {
  const nextBookings = getBookings().filter((booking) => booking.id !== bookingId);
  saveBookings(nextBookings);
  return nextBookings;
};

export const isSlotBooked = (bookings, date, time) =>
  bookings.some(
    (booking) =>
      booking.date === date && booking.time === time && booking.status !== "Cancelled",
  );

export const isAdminAuthenticated = () =>
  canUseStorage() && window.localStorage.getItem(ADMIN_SESSION_KEY) === "true";
