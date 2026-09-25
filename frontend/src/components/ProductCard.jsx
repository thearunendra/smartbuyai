import { ShoppingBag, Sparkles, Star } from "lucide-react";
import StoreOffers from "./StoreOffers";
import "./ProductCard.css";

// layout: "grid" (Products page) or "row" (chat results).
function ProductCard({ product, layout = "grid" }) {
  return (
    <article className={`product-card product-card-${layout}`}>
      <div className="product-media">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ShoppingBag size={32} />
        )}
      </div>

      <div className="product-body">
        <h3 className="product-name" title={product.name}>
          {product.name}
        </h3>

        {product.rating && (
          <div className="product-rating">
            <Star size={14} fill="currentColor" />
            {product.rating}
            {product.reviews && (
              <span>({product.reviews.toLocaleString("en-IN")})</span>
            )}
          </div>
        )}

        <div className="product-price">
          ₹{product.price.toLocaleString("en-IN")}
          <span>at {product.store}</span>
        </div>

        {product.reason && (
          <p className="product-reason">
            <Sparkles size={14} />
            {product.reason}
          </p>
        )}

        <StoreOffers offers={product.offers} />
      </div>
    </article>
  );
}

export function ProductCardSkeleton({ layout = "grid" }) {
  return (
    <div className={`product-card product-card-${layout}`} aria-hidden="true">
      <div className="product-media skeleton" />

      <div className="product-body">
        <div className="skeleton" style={{ height: 18, width: "85%" }} />
        <div className="skeleton" style={{ height: 14, width: "40%" }} />
        <div className="skeleton" style={{ height: 24, width: "55%" }} />
        <div className="skeleton" style={{ height: 38, width: "100%" }} />
        <div className="skeleton" style={{ height: 38, width: "100%" }} />
      </div>
    </div>
  );
}

export default ProductCard;
