import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./CategoryTabs.css";

// Horizontally scrollable category tabs with arrow buttons and faded edges.
function CategoryTabs({ categories, active, onSelect }) {
  const scrollerRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return;

    const update = () => {
      setEdges({
        left: scroller.scrollLeft > 4,
        right:
          scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4
      });
    };

    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    scroller.addEventListener("scroll", update, { passive: true });

    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", update);
    };
  }, []);

  // Bring the selected tab into view, e.g. when arriving from the Home page.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const tab = scroller?.querySelector(".category-tab.active");

    if (!scroller || !tab) return;

    const target =
      tab.offsetLeft - scroller.clientWidth / 2 + tab.clientWidth / 2;

    scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);

  const scrollBy = (direction) => {
    const scroller = scrollerRef.current;

    scroller?.scrollBy({
      left: direction * scroller.clientWidth * 0.7,
      behavior: "smooth"
    });
  };

  const className = [
    "category-tabs",
    edges.left ? "fade-left" : "",
    edges.right ? "fade-right" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {edges.left && (
        <button
          type="button"
          className="tabs-arrow tabs-arrow-left"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll categories left"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      <div className="tabs-scroller" ref={scrollerRef} role="tablist">
        {categories.map(({ name, icon: Icon }) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={active === name}
            className={active === name ? "category-tab active" : "category-tab"}
            onClick={() => onSelect(name)}
          >
            <Icon size={16} />
            {name}
          </button>
        ))}
      </div>

      {edges.right && (
        <button
          type="button"
          className="tabs-arrow tabs-arrow-right"
          onClick={() => scrollBy(1)}
          aria-label="Scroll categories right"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

export default CategoryTabs;
