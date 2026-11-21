import { redirect } from "next/navigation";
import { activeSeason, SEASONS, seasonPath } from "@/lib/holiday";

/** /holidays goes to this season's page, or the latest one between seasons. */
export default function HolidaysIndex() {
  redirect(seasonPath(activeSeason() ?? SEASONS[SEASONS.length - 1]));
}
