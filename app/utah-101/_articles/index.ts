import type { ComponentType } from "react";
import BarsAndRestaurants from "./bars-and-restaurants";
import BuyingAlcohol from "./buying-alcohol";
import Glossary from "./glossary";
import History from "./history";
import HostingAndEvents from "./hosting-and-events";
import MovingToUtah from "./moving-to-utah";
import MythsAndQuirks from "./myths-and-quirks";
import NewToDrinking from "./new-to-drinking";
import OutAndAbout from "./out-and-about";
import RareBottles from "./rare-bottles";
import VisitorGuide from "./visitor-guide";

/** Article bodies by slug; titles, dates and sources live in lib/utah-101.ts. */
export const ARTICLE_BODIES: Record<string, ComponentType> = {
  "visitor-guide": VisitorGuide,
  "buying-alcohol": BuyingAlcohol,
  "bars-and-restaurants": BarsAndRestaurants,
  "out-and-about": OutAndAbout,
  "new-to-drinking": NewToDrinking,
  "moving-to-utah": MovingToUtah,
  "hosting-and-events": HostingAndEvents,
  "myths-and-quirks": MythsAndQuirks,
  "rare-bottles": RareBottles,
  history: History,
  glossary: Glossary,
};
