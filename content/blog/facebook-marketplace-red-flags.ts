import type { BlogPost } from "@/lib/blog/types";

const post: BlogPost = {
  slug: "facebook-marketplace-red-flags",
  title: "5 Red Flags Every Buyer Should Spot Before Meeting a Facebook Marketplace Seller",
  excerpt:
    "Lake County buyers are losing thousands on private-party deals. Our RideCheckers flagged these warning patterns in the last 30 days alone.",
  category: "Fraud Alerts",
  publishedDate: "2025-03-14",
  author: "RideCheck Intelligence",
  featuredImageAlt: "Used car listing on a phone screen",
  verdict: "RED_FLAG",
  locationTag: "Lake County, IL",
  featured: true,
  seoTitle: "5 Facebook Marketplace Car Red Flags — RideCheck Fraud Alert",
  seoDescription:
    "Before you meet a private seller, learn the five warning signs our RideCheckers see most often in Lake County used car listings.",
  ctaText: "Book a RideCheck Before You Meet",
  body: [
    {
      type: "paragraph",
      text: "Facebook Marketplace has become one of the most popular places to buy a used car — and one of the easiest places to get burned. In the last 30 days, RideCheckers inspecting vehicles for Lake County buyers flagged these five patterns repeatedly. If you see more than two of these in a listing, walk away.",
    },
    {
      type: "heading",
      level: 2,
      text: "1. Stock photos or suspiciously clean images",
    },
    {
      type: "paragraph",
      text: "Legitimate sellers take photos of the actual car, often in their driveway. If the listing photos look like they came from a dealership brochure — perfect lighting, no background details, or inconsistent vehicle angles — the seller may not actually own the car.",
    },
    {
      type: "heading",
      level: 2,
      text: "2. No VIN provided, or refusal to share it",
    },
    {
      type: "paragraph",
      text: "Every vehicle has a VIN. A seller who refuses to provide it before a meet is hiding something — a salvage title, outstanding liens, or prior accident records. Always run the VIN through NICB or a paid service before you drive out.",
    },
    {
      type: "heading",
      level: 2,
      text: "3. The price is 20%+ below market",
    },
    {
      type: "paragraph",
      text: "Urgency pricing is the oldest trick in private-party fraud. 'I'm moving next week,' 'Going through a divorce,' 'Need it gone.' These stories are designed to create FOMO. If a 2021 Honda CR-V with 40k miles is $5,000 below book value, that delta is a warning signal, not a deal.",
    },
    {
      type: "heading",
      level: 2,
      text: "4. Seller won't let you have an inspection done",
    },
    {
      type: "paragraph",
      text: "A confident seller with a clean car has nothing to fear from an independent inspection. If a seller pushes back, delays, or makes excuses when you ask to have a RideChecker evaluate the vehicle, that tells you everything you need to know.",
    },
    {
      type: "alert",
      variant: "danger",
      text: "If a seller says 'I've had five other people look at it already' or tries to rush you to a decision before you can get an inspection scheduled, treat that as a disqualifying red flag.",
    },
    {
      type: "heading",
      level: 2,
      text: "5. Title issues or 'title in transit' language",
    },
    {
      type: "paragraph",
      text: "In Illinois, a seller should be able to show you the title at or before the sale. 'Title in transit,' 'waiting on title from the bank,' or 'I lost the title' are common stall tactics. You have no legal vehicle until the title transfers cleanly.",
    },
    {
      type: "callout",
      label: "Bottom line",
      text: "Private-party deals can be great. But you need someone in your corner who knows what to look for. A RideCheck inspection costs $139–$299 and can save you from a $4,000–$15,000 mistake.",
    },
  ],
};

export default post;
