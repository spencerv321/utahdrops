import { redirect } from "next/navigation";
import { CURRENT_EDITION, editionPath } from "@/lib/year-in-bottles-cards";

/** /year-in-bottles goes to the current edition. */
export default function YearInBottlesIndex() {
  redirect(editionPath(CURRENT_EDITION));
}
