import ServiceCard from "../components/ServiceCard";
import { SERVICES } from "../data/beautyData";

export default function Services() {
  return (
    <section className="py-12 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-sm font-bold uppercase text-gold">Salon menu</p>
          <h1 className="section-title mt-2">Beauty Services</h1>
          <p className="mt-4 text-base leading-7 text-plum/70">
            Hair, makeup, skin, nails, and spa services with clear pricing, duration, and instant booking.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SERVICES.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}
