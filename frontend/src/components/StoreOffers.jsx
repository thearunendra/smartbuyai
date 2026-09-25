import { ExternalLink } from "lucide-react";
import "./StoreOffers.css";

// Price list across stores, cheapest first. offers come sorted from the API.
function StoreOffers({ offers }) {
  if (!offers || offers.length === 0) {
    return null;
  }

  const lowest = offers.find((offer) => offer.price !== null);

  return (
    <div className="store-offers">
      <p className="store-offers-title">
        Compared across {offers.length} store{offers.length > 1 ? "s" : ""}
      </p>

      {offers.map((offer) => {
        const isLowest = offer === lowest;

        const content = (
          <>
            <span className="offer-store">
              {offer.store}
              {isLowest && <em>Lowest</em>}
            </span>

            <span className="offer-price">
              {offer.price
                ? `₹${offer.price.toLocaleString("en-IN")}`
                : "See price"}
            </span>

            <span className="offer-go">
              {offer.link ? (
                <>
                  Buy <ExternalLink size={12} />
                </>
              ) : (
                "No link"
              )}
            </span>
          </>
        );

        const className = isLowest ? "offer-row offer-lowest" : "offer-row";

        return offer.link ? (
          <a
            key={offer.store}
            href={offer.link}
            target="_blank"
            rel="noreferrer"
            className={className}
          >
            {content}
          </a>
        ) : (
          <div key={offer.store} className={`${className} offer-no-link`}>
            {content}
          </div>
        );
      })}

      <p className="offers-note">
        Live prices from search results. Confirm on the store before buying.
      </p>
    </div>
  );
}

export default StoreOffers;
