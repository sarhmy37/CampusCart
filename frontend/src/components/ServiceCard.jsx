import { Link } from 'react-router-dom';
import { MapPin, Star, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';

export default function ServiceCard({ service }) {
    const hasRating = service.rating && parseFloat(service.rating) > 0;

    const isPlanActive = service.seller_plan && service.seller_plan !== 'free' &&
        service.seller_plan_expires_at && new Date(service.seller_plan_expires_at) > new Date();
    const planTier = isPlanActive ? service.seller_plan.toLowerCase() : null;

    return (
        <Link
            to={`/service/${service.id}`}
            className="group block bg-white dark:bg-ink-800 rounded-2xl border border-slate-200 dark:border-ink-600 overflow-hidden hover:shadow-xl hover:shadow-slate-900/5 dark:hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-300"
        >
            {/* IMAGE */}
            <div className="relative aspect-[4/3] bg-slate-100 dark:bg-ink-700 overflow-hidden">
                {service.primary_image ? (
                    <img
                        src={service.primary_image}
                        alt={service.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-gold-300/20">
                        <ShieldCheck size={32} />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-transparent pointer-events-none" />

                {/* SERVICE badge */}
                <span className="absolute top-2 left-2 bg-emerald-600/90 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Service
                </span>

                {/* Duration, if set */}
                {service.service_duration && (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 bg-black/50 backdrop-blur text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {service.service_duration}
                    </span>
                )}
            </div>

            {/* BODY */}
            <div className="p-3.5">
                {/* TITLE + verified/premium badge */}
                <div className="flex items-center gap-1">
                    <p className="font-bold text-sm text-slate-900 dark:text-gold-50 truncate">
                        {service.title || service.name}
                    </p>
                    {planTier === 'premium' && (
                        <Sparkles size={12} className="text-purple-500 fill-purple-500 shrink-0" />
                    )}
                    {planTier === 'pro' && (
                        <Star size={12} className="text-blue-500 fill-blue-500 shrink-0" />
                    )}
                    {service.seller_verified && (
                        <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                    )}
                </div>

                {service.description && (
                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5 line-clamp-2 leading-snug">
                        {service.description}
                    </p>
                )}

                {/* RATING + LOCATION */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-ink-600 space-y-1">
                    {hasRating && (
                        <div className="flex items-center gap-1">
                            <Star size={11} className="text-gold-400 fill-gold-400" />
                            <span className="text-xs font-semibold text-slate-700 dark:text-gold-200">
                                {parseFloat(service.rating).toFixed(1)}
                            </span>
                            {service.review_count > 0 && (
                                <span className="text-[10px] text-slate-400 dark:text-gold-200/50">
                                    ({service.review_count})
                                </span>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-1 text-slate-500 dark:text-gold-200/60">
                        <MapPin size={11} className="shrink-0" />
                        <span className="text-xs truncate">
                            {service.seller_school || 'Location not specified'}
                        </span>
                    </div>
                </div>

                {/* CTA */}
                <span className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 text-xs font-bold group-hover:bg-brand-700 dark:group-hover:bg-gold-400 transition">
                    Book now
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
            </div>
        </Link>
    );
}