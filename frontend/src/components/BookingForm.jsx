import { CalendarCheck, CheckCircle2, Clock, Mail, Phone, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SERVICES, TIME_SLOTS } from "../data/beautyData";
import { addBooking, getBookings, getTodayDate, isSlotBooked } from "../utils/bookingStorage";

const emptyForm = {
  customerName: "",
  phone: "",
  email: "",
  serviceId: "",
  date: "",
  time: "",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BookingForm({ defaultServiceId = "" }) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    serviceId: SERVICES.some((service) => service.id === defaultServiceId) ? defaultServiceId : "",
  }));
  const [errors, setErrors] = useState({});
  const [bookings, setBookings] = useState(() => getBookings());
  const [successBooking, setSuccessBooking] = useState(null);
  const today = getTodayDate();

  useEffect(() => {
    if (SERVICES.some((service) => service.id === defaultServiceId)) {
      setForm((current) => ({ ...current, serviceId: defaultServiceId }));
    }
  }, [defaultServiceId]);

  const selectedService = useMemo(
    () => SERVICES.find((service) => service.id === form.serviceId),
    [form.serviceId],
  );

  const bookedTimesForDate = useMemo(() => {
    if (!form.date) {
      return [];
    }
    return TIME_SLOTS.filter((slot) => isSlotBooked(bookings, form.date, slot));
  }, [bookings, form.date]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setSuccessBooking(null);
  };

  const validateForm = () => {
    const nextErrors = {};
    const phoneDigits = form.phone.replace(/\D/g, "");

    if (!form.customerName.trim()) {
      nextErrors.customerName = "Customer name is required.";
    }

    if (!phoneDigits || phoneDigits.length < 10 || phoneDigits.length > 15) {
      nextErrors.phone = "Enter a valid phone number.";
    }

    if (!emailPattern.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!form.serviceId) {
      nextErrors.serviceId = "Please select a service.";
    }

    if (!form.date) {
      nextErrors.date = "Please select an appointment date.";
    } else if (form.date < today) {
      nextErrors.date = "Past dates cannot be booked.";
    }

    if (!form.time) {
      nextErrors.time = "Please select an available time slot.";
    } else if (isSlotBooked(bookings, form.date, form.time)) {
      nextErrors.time = "This slot is already booked. Please choose another time.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    const booking = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      servicePrice: selectedService.price,
      serviceDuration: selectedService.duration,
      date: form.date,
      time: form.time,
      status: "Confirmed",
      createdAt: new Date().toISOString(),
    };

    const nextBookings = addBooking(booking);
    setBookings(nextBookings);
    setSuccessBooking(booking);
    setForm({ ...emptyForm, serviceId: form.serviceId, date: form.date });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={handleSubmit} className="rounded-lg border border-rose/10 bg-white p-5 shadow-salon sm:p-7">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase text-gold">Online Booking</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-plum">Book Appointment</h2>
          <p className="mt-2 text-sm leading-6 text-plum/70">
            Select a service, choose a free slot, and your appointment will be saved instantly.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="field-label">Customer name</span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rose" size={18} />
              <input
                className="field-input pl-10"
                type="text"
                value={form.customerName}
                onChange={(event) => updateField("customerName", event.target.value)}
                placeholder="Your full name"
              />
            </div>
            {errors.customerName && <span className="text-sm font-semibold text-red-600">{errors.customerName}</span>}
          </label>

          <label className="grid gap-2">
            <span className="field-label">Phone number</span>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rose" size={18} />
              <input
                className="field-input pl-10"
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="9876543210"
              />
            </div>
            {errors.phone && <span className="text-sm font-semibold text-red-600">{errors.phone}</span>}
          </label>

          <label className="grid gap-2 sm:col-span-2">
            <span className="field-label">Email</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rose" size={18} />
              <input
                className="field-input pl-10"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="name@example.com"
              />
            </div>
            {errors.email && <span className="text-sm font-semibold text-red-600">{errors.email}</span>}
          </label>

          <label className="grid gap-2 sm:col-span-2">
            <span className="field-label">Select service</span>
            <select
              className="field-input"
              value={form.serviceId}
              onChange={(event) => updateField("serviceId", event.target.value)}
            >
              <option value="">Choose a service</option>
              {SERVICES.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} - {service.price} - {service.duration}
                </option>
              ))}
            </select>
            {errors.serviceId && <span className="text-sm font-semibold text-red-600">{errors.serviceId}</span>}
          </label>

          <label className="grid gap-2">
            <span className="field-label">Select date</span>
            <input
              className="field-input"
              type="date"
              min={today}
              value={form.date}
              onChange={(event) => updateField("date", event.target.value)}
            />
            {errors.date && <span className="text-sm font-semibold text-red-600">{errors.date}</span>}
          </label>

          <div className="rounded-lg border border-lavender/50 bg-lavender/10 p-4">
            <p className="text-sm font-bold text-plum">Selected service</p>
            <p className="mt-2 text-sm text-plum/70">
              {selectedService
                ? `${selectedService.name} - ${selectedService.price} - ${selectedService.duration}`
                : "Choose a service to see details."}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="field-label">Select time slot</span>
            {form.date && (
              <span className="text-xs font-bold text-plum/60">
                {TIME_SLOTS.length - bookedTimesForDate.length} available
              </span>
            )}
          </div>

          {form.date ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TIME_SLOTS.map((slot) => {
                const booked = bookedTimesForDate.includes(slot);
                const selected = form.time === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={booked}
                    onClick={() => updateField("time", slot)}
                    className={`rounded-lg border px-3 py-3 text-left text-sm font-bold transition ${
                      booked
                        ? "border-red-200 bg-red-50 text-red-700"
                        : selected
                          ? "border-gold bg-gold/15 text-plum ring-4 ring-gold/15"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:-translate-y-0.5"
                    }`}
                  >
                    <span className="block">{slot}</span>
                    <span className="mt-1 block text-xs font-semibold">
                      {booked ? "Not Available" : "Available"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-rose/25 bg-petal/60 p-4 text-sm font-semibold text-plum/70">
              Select a date to view available and booked slots.
            </div>
          )}
          {errors.time && <span className="mt-2 block text-sm font-semibold text-red-600">{errors.time}</span>}
        </div>

        <button type="submit" className="primary-button mt-7 w-full">
          <CalendarCheck size={19} aria-hidden="true" />
          Confirm Booking
        </button>
      </form>

      <aside className="space-y-5">
        <div className="rounded-lg border border-gold/20 bg-white p-5 shadow-gold">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/10 text-gold">
              <Clock size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-plum">Slot availability</p>
              <p className="text-sm text-plum/65">Green slots are free. Red slots are already booked.</p>
            </div>
          </div>
        </div>

        {successBooking && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-salon">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-700" size={24} aria-hidden="true" />
              <h3 className="text-lg font-bold">Booking confirmed</h3>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Customer</dt>
                <dd>{successBooking.customerName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Service</dt>
                <dd>{successBooking.serviceName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Date</dt>
                <dd>{successBooking.date}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Time</dt>
                <dd>{successBooking.time}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">Status</dt>
                <dd>{successBooking.status}</dd>
              </div>
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}
