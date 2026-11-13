const OFFER_TEXT =
  "Festival & holiday season special offers on events & rentals — enquire now info@jnvspectra.com or +1 (352) 773-2872";

const OfferBanner = () => (
  <div className="w-full bg-[#f5c518] text-black flex items-stretch overflow-hidden relative z-[60]">
    <div className="bg-black text-white text-[11px] sm:text-xs font-bold px-2 sm:px-3 flex items-center shrink-0 tracking-wider">
      NOTICE
    </div>
    <div className="offer-marquee flex items-center text-[11px] sm:text-sm font-medium py-1.5 whitespace-nowrap">
      {[0, 1].map((i) => (
        <span key={i} className="px-8" aria-hidden={i === 1}>
          {OFFER_TEXT}&nbsp;&nbsp;•&nbsp;&nbsp;{OFFER_TEXT}&nbsp;&nbsp;•&nbsp;&nbsp;
        </span>
      ))}
    </div>
    <style>{`
      .offer-marquee { display: inline-flex; animation: offer-scroll 30s linear infinite; }
      @keyframes offer-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    `}</style>
  </div>
);

export default OfferBanner;
