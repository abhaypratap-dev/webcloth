import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const EASE = [0.7, 0, 0.2, 1] as const;
const SWIPE_THRESHOLD = 60;

export type GalleryImage = { url: string; alt: string | null };

/** Product image switcher: thumbnail rail + crossfade on desktop, swipeable carousel with dots on mobile. */
export function ProductGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const count = images.length;

  if (count === 0) {
    return <div className="aspect-[4/5] bg-secondary" />;
  }

  const go = (i: number) => setIndex(((i % count) + count) % count);
  const active = images[index];

  function onDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_THRESHOLD) go(index + 1);
    else if (info.offset.x > SWIPE_THRESHOLD) go(index - 1);
  }

  return (
    <div className="md:flex">
      {count > 1 && (
        <div className="hidden md:flex md:flex-col md:w-20 md:shrink-0 md:border-r md:border-hairline md:overflow-y-auto no-scrollbar">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === index}
              className={`relative aspect-[4/5] overflow-hidden border-b border-hairline shrink-0 transition-opacity ${
                i === index ? "opacity-100" : "opacity-45 hover:opacity-80"
              }`}
            >
              <img src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              {i === index && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-bone" />}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex-1 aspect-[4/5] overflow-hidden bg-secondary group">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="absolute inset-0"
            drag={count > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={onDragEnd}
          >
            <img
              src={active.url}
              alt={active.alt ?? title}
              className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:scale-110"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              onClick={() => go(index - 1)}
              aria-label="Previous image"
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center border border-hairline bg-ink/50 backdrop-blur opacity-0 group-hover:opacity-100 transition hover:border-bone/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => go(index + 1)}
              aria-label="Next image"
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center border border-hairline bg-ink/50 backdrop-blur opacity-0 group-hover:opacity-100 transition hover:border-bone/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="md:hidden absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Go to image ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === index ? "w-5 bg-bone" : "w-1.5 bg-bone/40"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
