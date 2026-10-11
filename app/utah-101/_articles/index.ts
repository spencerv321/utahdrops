import type { ComponentType } from "react";
import BarsAndRestaurants from "./bars-and-restaurants";
import BuyingAlcohol from "./buying-alcohol";
import Glossary from "./glossary";
import MythsAndQuirks from "./myths-and-quirks";
import RareBottles from "./rare-bottles";
import VisitorGuide from "./visitor-guide";

/** Article bodies by slug; titles, dates and sources live in lib/utah-101.ts. */
export const ARTICLE_BODIES: Record<string, ComponentType> = {
  "visitor-guide": VisitorGuide,
  "buying-alcohol": BuyingAlcohol,
  "bars-and-restaurants": BarsAndRestaurants,
  "myths-and-quirks": MythsAndQuirks,
  "rare-bottles": RareBottles,
  glossary: Glossary,
};
