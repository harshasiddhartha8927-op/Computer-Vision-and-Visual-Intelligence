import { DEFAULT_REVIEWS } from "../data/beautyData";

export const REVIEWS_STORAGE_KEY = "glam_beauty_reviews";

const canUseStorage = () => typeof window !== "undefined" && window.localStorage;

export const getReviews = () => {
  if (!canUseStorage()) {
    return DEFAULT_REVIEWS;
  }

  try {
    const storedReviews = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
    return storedReviews ? JSON.parse(storedReviews) : DEFAULT_REVIEWS;
  } catch {
    return DEFAULT_REVIEWS;
  }
};

export const saveReviews = (reviews) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
};

export const addReview = (review) => {
  const nextReviews = [review, ...getReviews()];
  saveReviews(nextReviews);
  return nextReviews;
};
