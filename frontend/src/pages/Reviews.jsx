import { CheckCircle2, MessageCircle, Send, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { SERVICES } from "../data/beautyData";
import { addReview, getReviews } from "../utils/reviewStorage";

const emptyReview = {
  customerName: "",
  serviceName: "",
  rating: 5,
  comment: "",
};

function RatingStars({ rating, onChange }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={rating === value}
          aria-label={`${value} star rating`}
          onClick={() => onChange(value)}
          className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
            value <= rating
              ? "border-gold bg-gold/15 text-gold"
              : "border-rose/15 bg-white text-plum/25 hover:border-gold/50"
          }`}
        >
          <Star size={19} fill={value <= rating ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <article className="rounded-lg border border-rose/10 bg-white p-5 shadow-salon">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-plum">{review.customerName}</h3>
          <p className="mt-1 text-sm font-semibold text-rose">{review.serviceName}</p>
        </div>
        <div className="flex gap-1 text-gold" aria-label={`${review.rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Star
              key={value}
              size={16}
              fill={value <= review.rating ? "currentColor" : "none"}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-plum/70">{review.comment}</p>
      <p className="mt-5 text-xs font-bold uppercase text-plum/45">
        {new Date(review.createdAt).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </p>
    </article>
  );
}

export default function Reviews() {
  const [reviews, setReviews] = useState(() => getReviews());
  const [form, setForm] = useState(emptyReview);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) {
      return "0.0";
    }

    const total = reviews.reduce((sum, review) => sum + Number(review.rating), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setSubmitted(false);
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.customerName.trim()) {
      nextErrors.customerName = "Name is required.";
    }

    if (!form.serviceName) {
      nextErrors.serviceName = "Please choose a service.";
    }

    if (!form.comment.trim()) {
      nextErrors.comment = "Please write your review.";
    } else if (form.comment.trim().length < 10) {
      nextErrors.comment = "Review should be at least 10 characters.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const review = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      customerName: form.customerName.trim(),
      serviceName: form.serviceName,
      rating: Number(form.rating),
      comment: form.comment.trim(),
      createdAt: new Date().toISOString(),
    };

    setReviews(addReview(review));
    setForm(emptyReview);
    setSubmitted(true);
  };

  return (
    <section className="bg-petal/45 py-12 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-sm font-bold uppercase text-gold">Customer Reviews</p>
          <h1 className="section-title mt-2">Loved by Glam Clients</h1>
          <p className="mt-4 text-base leading-7 text-plum/70">
            Read customer experiences and share your own visit to Glam Beauty Parlour.
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-rose/10 bg-white p-5 text-center shadow-salon">
            <p className="text-3xl font-extrabold text-plum">{averageRating}</p>
            <p className="mt-1 text-sm font-bold text-plum/65">Average rating</p>
          </article>
          <article className="rounded-lg border border-gold/20 bg-white p-5 text-center shadow-salon">
            <p className="text-3xl font-extrabold text-plum">{reviews.length}</p>
            <p className="mt-1 text-sm font-bold text-plum/65">Total reviews</p>
          </article>
          <article className="rounded-lg border border-lavender/40 bg-white p-5 text-center shadow-salon">
            <p className="text-3xl font-extrabold text-plum">5</p>
            <p className="mt-1 text-sm font-bold text-plum/65">Star experience goal</p>
          </article>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={handleSubmit} className="rounded-lg border border-rose/10 bg-white p-5 shadow-salon sm:p-7">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose text-white">
                  <MessageCircle size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold uppercase text-gold">Write a review</p>
                  <h2 className="font-display text-3xl font-bold text-plum">Share Your Experience</h2>
                </div>
              </div>
            </div>

            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="field-label">Customer name</span>
                <input
                  className="field-input"
                  value={form.customerName}
                  onChange={(event) => updateField("customerName", event.target.value)}
                  placeholder="Your name"
                />
                {errors.customerName && <span className="text-sm font-semibold text-red-600">{errors.customerName}</span>}
              </label>

              <label className="grid gap-2">
                <span className="field-label">Service</span>
                <select
                  className="field-input"
                  value={form.serviceName}
                  onChange={(event) => updateField("serviceName", event.target.value)}
                >
                  <option value="">Choose a service</option>
                  {SERVICES.map((service) => (
                    <option key={service.id} value={service.name}>
                      {service.name}
                    </option>
                  ))}
                </select>
                {errors.serviceName && <span className="text-sm font-semibold text-red-600">{errors.serviceName}</span>}
              </label>

              <div className="grid gap-2">
                <span className="field-label">Rating</span>
                <RatingStars rating={form.rating} onChange={(rating) => updateField("rating", rating)} />
              </div>

              <label className="grid gap-2">
                <span className="field-label">Review</span>
                <textarea
                  className="field-input min-h-32 resize-y"
                  value={form.comment}
                  onChange={(event) => updateField("comment", event.target.value)}
                  placeholder="Tell us what you loved about your visit"
                />
                {errors.comment && <span className="text-sm font-semibold text-red-600">{errors.comment}</span>}
              </label>
            </div>

            {submitted && (
              <div className="mt-5 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={18} aria-hidden="true" />
                Review submitted successfully.
              </div>
            )}

            <button type="submit" className="primary-button mt-6 w-full">
              <Send size={18} aria-hidden="true" />
              Submit Review
            </button>
          </form>

          <div className="grid gap-5">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
