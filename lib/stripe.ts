import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      typescript: true,
    });
  }
  return stripeClient;
}

export function getStripePriceId(): string {
  return requireEnv("STRIPE_PRICE_ID");
}
