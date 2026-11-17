import { Link } from "react-router-dom";
import { ArrowRight, Check, Heart, Scale, ShoppingBag, Sparkles, Star } from "lucide-react";
import StoreOffers from "./StoreOffers";
import { productPath } from "../utils/product";
import "./ProductCard.css";

// layout: "grid" (Products page) or "row" (chat results).
function ProductCard({ product, layout = "grid", selectedForCompare = false, onCompare, isWishlisted = false, wishlistBusy = false, onWishlist }) {
  return (
    <article className={`product-card product-card-${layout}`}>
      <div className="product-media">
        {(onCompare || onWishlist) && (
          <div className="product-card-actions">
            {onWishlist && (
              <button
                type="button"
                className={isWishlisted ? "product-quick-action saved" : "product-quick-action"}
                onClick={onWishlist}
                disabled={wishlistBusy}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart size={17} fill={isWishlisted ? "currentColor" : "none"} />
              </button>
            )}
            {onCompare && (
              <button
                type="button"
                className={selectedForCompare ? "product-quick-action selected" : "product-quick-action"}
                onClick={onCompare}
                aria-pressed={selectedForCompare}
                aria-label={selectedForCompare ? "Remove from comparison" : "Add to comparison"}
                title={selectedForCompare ? "Remove from comparison" : "Add to comparison"}
              >
                {selectedForCompare ? <Check size={17} /> : <Scale size={17} />}
              </button>
            )}
          </div>
        )}
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

        <Link
          to={productPath(product)}
          state={{ product }}
          className="btn btn-secondary product-details-link"
        >
          View details <ArrowRight size={16} />
        </Link>
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
