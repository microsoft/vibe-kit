import { useState, useEffect, useCallback } from "react";

export interface TourStep {
  target: string;
  title: string;
  content: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "header",
    title: "Welcome to Aurora Finetune",
    content:
      "This demo visualizes how training data size affects Microsoft Aurora weather model performance.",
  },
  {
    target: "input-config",
    title: "Choose Your Data",
    content:
      "Select a training dataset size and surface variable to explore different finetuning scenarios.",
  },
  {
    target: "loss-curves",
    title: "Track Training Performance",
    content:
      "Watch how training and validation loss change over epochs, and compare against the persistence baseline.",
  },
  {
    target: "heatmap-controls",
    title: "Explore Predictions",
    content:
      "Adjust the epoch and sample index to see how predictions evolve during training.",
  },
  {
    target: "heatmaps",
    title: "Compare Models",
    content:
      "Side-by-side comparison of the finetuned model, persistence baseline, and ground truth observations.",
  },
];

const TOUR_STORAGE_KEY = "aurora-finetune-tour-seen";

export function useTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  const next = useCallback(() => {
    setStep((s) => {
      if (s < TOUR_STEPS.length - 1) return s + 1;
      setActive(false);
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      return s;
    });
  }, []);

  const prev = useCallback(() => {
    setStep((s) => (s > 0 ? s - 1 : s));
  }, []);

  const dismiss = useCallback(() => {
    setActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  }, []);

  // Auto-start on first visit
  useEffect(() => {
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      const timer = setTimeout(() => start(), 1000);
      return () => clearTimeout(timer);
    }
  }, [start]);

  return { active, step, steps: TOUR_STEPS, start, next, prev, dismiss };
}
