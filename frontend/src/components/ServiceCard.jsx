import { Link } from 'react-router-dom';
import { Clock, Star, ShieldCheck, ArrowRight } from 'lucide-react';

export default function ServiceCard({ service }) {
    const hasRating = service.rating && parseFloat(service.rating) > 0;

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

                {/* Price pill */}
                <span className="absolute bottom-2 right-2 bg-white/95 dark:bg-ink-900/90 backdrop-blur text-brand-700 dark:text-gold-400 text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                    GHS {parseFloat(service.price).toFixed(2)}
                </span>

                {/* Duration, if set */}
                {service.service_duration && (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 bg-black/50 backdrop-blur text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        <Clock size={10} />
                        {service.service_duration}
                    </span>
                )}
            </div>

            {/* BODY */}
            <div className="p-3.5">
                <p className="font-bold text-sm text-slate-900 dark:text-gold-50 truncate">
                    {service.title || service.name}
                </p>

                {service.description && (
                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5 line-clamp-2 leading-snug">
                        {service.description}
                    </p>
                )}

                {/* SELLER ROW */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-ink-600">
                    {service.seller_avatar ? (
                        <img
                            src={service.seller_avatar}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {service.seller_name?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                            <p className="text-xs font-semibold text-slate-700 dark:text-gold-200 truncate">
                                {service.seller_name || 'Service provider'}
                            </p>
                            {service.seller_verified && (
                                <ShieldCheck size={11} className="text-emerald-500 shrink-0" />
                            )}
                        </div>
                        {hasRating && (
                            <div className="flex items-center gap-0.5">
                                <Star size={10} className="text-gold-400 fill-gold-400" />
                                <span className="text-[10px] text-slate-400 dark:text-gold-200/50">
                                    {parseFloat(service.rating).toFixed(1)}
                                    {service.review_count ? ` (${service.review_count})` : ''}
                                </span>
                            </div>
                        )}
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