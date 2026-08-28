import { CalendarCheck, ChevronRight, Heart, Scissors, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import ServiceCard from "../components/ServiceCard";
import { HERO_IMAGE, SERVICES, STUDIO_IMAGE } from "../data/beautyData";

export default function Home() {
  const featuredServices = SERVICES.slice(0, 4);

  return (
    <>
      <section className="relative min-h-[76vh] overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="Professional makeup and beauty styling"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-plum/85 via-plum/55 to-rose/20" />
        <div className="relative z-10 flex min-h-[76vh] items-center">
          <div className="page-shell py-14">
            <div className="max-w-2xl text-white">
              <p className="inline-flex items-center gap-2 text-sm font-bold uppercase text-gold">
                <Sparkles size={18} aria-hidden="true" />
                Soft glam studio
              </p>
              <h1 className="mt-5 font-display text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
                Glam Beauty Parlour
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-white/88 sm:text-lg">
                A modern beauty parlour for hair, skin, makeup, nails, spa care, and confident everyday glow.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/booking" className="primary-button bg-gold text-plum hover:bg-white">
                  <CalendarCheck size={19} aria-hidden="true" />
                  Book Appointment
                </Link>
                <Link to="/services" className="secondary-button border-white/35 bg-white/10 text-white hover:bg-white hover:text-plum">
                  View Services
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="page-shell">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-gold">Popular picks</p>
              <h2 className="section-title mt-2">Signature Services</h2>
            </div>
            <Link to="/services" className="secondary-button self-start">
              All Services
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-20">
        <div className="page-shell grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="overflow-hidden rounded-lg shadow-salon">
            <img src={STUDIO_IMAGE} alt="Beauty salon styling chairs" className="h-full min-h-[340px] w-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase text-gold">Polished care</p>
            <h2 className="section-title mt-2">Your appointment, beautifully organized</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-plum/70">
              Choose from salon essentials and special occasion services, then reserve a clear time slot online. The
              booking calendar marks booked appointments in red and available slots in green.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-rose/10 bg-petal p-4">
                <Scissors className="text-rose" size={25} aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-plum">Hair experts</p>
              </div>
              <div className="rounded-lg border border-lavender/40 bg-lavender/20 p-4">
                <Heart className="text-plum" size={25} aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-plum">Skin and spa</p>
              </div>
              <div className="rounded-lg border border-gold/20 bg-gold/10 p-4">
                <Sparkles className="text-gold" size={25} aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-plum">Event glam</p>
              </div>
            </div>
            <Link to="/booking" className="primary-button mt-8">
              <CalendarCheck size={19} aria-hidden="true" />
              Reserve a Slot
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
