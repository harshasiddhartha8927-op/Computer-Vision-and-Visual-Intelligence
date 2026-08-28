import { CalendarCheck, Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function ServiceCard({ service }) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-rose/10 bg-white p-5 shadow-salon transition hover:-translate-y-1 hover:border-rose/25">
      <div className="mb-5 flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-petal text-rose">
          <Sparkles size={20} aria-hidden="true" />
        </span>
        <span className="rounded-full bg-gold/10 px-3 py-1 text-sm font-bold text-gold">
          {service.price}
        </span>
      </div>

      <h3 className="font-display text-2xl font-bold text-plum">{service.name}</h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-plum/70">{service.description}</p>

      <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-plum/70">
        <Clock size={16} aria-hidden="true" />
        <span>{service.duration}</span>
      </div>

      <Link to={`/booking?service=${service.id}`} className="primary-button mt-6 w-full">
        <CalendarCheck size={18} aria-hidden="true" />
        Book Now
      </Link>
    </article>
  );
}
