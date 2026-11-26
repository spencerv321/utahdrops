"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Share } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { sendDiscoverEvent } from "@/lib/beacon";
import { YearCardView } from "@/components/year-card";
import type { YearCard } from "@/lib/year-in-bottles-cards";
import { cardPath, markBannerSeen } from "@/lib/year-in-bottles-paths";
import { cn } from "@/lib/utils";

/**
 * The card deck: a horizontal row that snaps card by card (swipe on phones,
 * arrows or the dots elsewhere). Every card is in the page at rest, so it
 * reads without script. `focus` opens a shared card's link on that card;
 * `end` is a closing panel (not shareable) after the last card.
 */
export function YearDeck({
  cards,
  edition,
  windowLabel,
  focus,
  end,
}: {
  cards: YearCard[];
  edition: string;
  windowLabel: string;
  focus?: string;
  end?: React.ReactNode;
}) {
  const track = useRef<HTMLOListElement>(null);
  const deck = useRef<HTMLDivElement>(null);
  const last = cards.length - (end ? 0 : 1);
  const [current, setCurrent] = useState(() => Math.max(0, cards.findIndex((c) => c.slug === focus)));

  const go = useCallback((i: number, smooth = true) => {
    const el = track.current?.children[i] as HTMLElement | undefined;
    if (!el || !track.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.current.scrollTo({
      left: el.offsetLeft - track.current.offsetLeft,
      behavior: smooth && !reduce ? "smooth" : "auto",
    });
  }, []);

  // Seen it: the site-wide banner stops pointing here.
  useEffect(() => markBannerSeen(), []);

  // How far people get: each card counted once per page view when it's mostly on screen.
  const counted = useRef(new Set<number>());

  useEffect(() => {
    if (!focus) return;
    // A shared card's link: bring the deck into view, opened on that card.
    deck.current?.scrollIntoView({ block: "start" });
    go(Math.max(0, cards.findIndex((c) => c.slug === focus)), false);
  }, [focus, cards, go]);

  useEffect(() => {
    const root = track.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.index);
          setCurrent(i);
          if (!counted.current.has(i)) {
            counted.current.add(i);
            sendDiscoverEvent("shown", `year:card-${i < cards.length ? cards[i].slug : "next"}`);
          }
        }
      },
      { root, threshold: 0.6 }
    );
    for (const child of Array.from(root.children)) io.observe(child);
    return () => io.disconnect();
  }, [cards]);

  return (
    <div ref={deck} className="scroll-mt-20 space-y-4">
      <ol
        ref={track}
        aria-label="Year in bottles cards"
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(Math.min(last, current + 1));
          if (e.key === "ArrowLeft") go(Math.max(0, current - 1));
        }}
      >
        {cards.map((card, i) => (
          <li key={card.slug} id={card.slug} data-index={i} className="w-[min(84vw,22rem)] shrink-0 snap-start">
            <YearCardView
              card={card}
              index={i}
              total={cards.length}
              windowLabel={windowLabel}
              share={
                <ShareButton
                  title={`Utah's Year in Bottles: ${card.ogLine}`}
                  surface={`year-${card.slug}`}
                  path={cardPath(edition, card.slug)}
                  label={`Share the ${card.kicker} card`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-current/30 text-current hover:border-current"
                >
                  <Share className="size-[18px]" aria-hidden />
                </ShareButton>
              }
            />
          </li>
        ))}
        {end ? (
          <li id="whats-next" data-index={cards.length} className="w-[min(84vw,22rem)] shrink-0 snap-start">
            {end}
          </li>
        ) : null}
      </ol>

      <div className="flex items-center justify-between gap-4">
        <div className="flex" role="group" aria-label="Go to card">
          {[...cards.map((c, i) => `Card ${i + 1}: ${c.kicker}`), ...(end ? ["What's next"] : [])].map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => go(i)}
              aria-label={label}
              aria-current={i === current ? "true" : undefined}
              className="flex h-11 w-[22px] items-center justify-center"
            >
              <span
                className={cn("block h-1.5 rounded-full transition-all", i === current ? "w-5 bg-primary" : "w-1.5 bg-input")}
              />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label="Previous card"
            className="flex size-11 items-center justify-center rounded-full border border-input hover:border-primary disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(Math.min(last, current + 1))}
            disabled={current === last}
            aria-label="Next card"
            className="flex size-11 items-center justify-center rounded-full border border-input hover:border-primary disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
