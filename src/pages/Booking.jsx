import { useSearchParams } from "react-router-dom";
import BookingForm from "../components/BookingForm";

export default function Booking() {
  const [searchParams] = useSearchParams();
  const defaultServiceId = searchParams.get("service") || "";

  return (
    <section className="bg-petal/45 py-12 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto mb-9 max-w-3xl text-center">
          <p className="text-sm font-bold uppercase text-gold">Appointment calendar</p>
          <h1 className="section-title mt-2">Choose Your Glam Slot</h1>
          <p className="mt-4 text-base leading-7 text-plum/70">
            Bookings are stored locally in your browser and the admin dashboard updates from the same saved schedule.
          </p>
        </div>
        <BookingForm defaultServiceId={defaultServiceId} />
      </div>
    </section>
  );
}
