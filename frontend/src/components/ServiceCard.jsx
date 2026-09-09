import { Link } from 'react-router-dom';

export default function ServiceCard({ service }) {
  return (
    <div className="bg-white dark:bg-ink-800 rounded-xl border border-slate-200 dark:border-ink-600 overflow-hidden hover:shadow-lg transition-all p-4">
      <div className="flex items-start gap-3">
        {service.seller_avatar ? (
          <img src={service.seller_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center font-bold text-sm">
            {service.seller_name?.[0] || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-slate-900 dark:text-gold-50 truncate">{service.title || service.name}</p>
          <p className="text-xs text-slate-500 dark:text-gold-200/60">{service.seller_name || 'Service provider'}</p>
          <p className="text-brand-600 dark:text-gold-400 font-bold text-sm mt-1">GHS {parseFloat(service.price).toFixed(2)}</p>
        </div>
      </div>
      <Link
        to={`/service/${service.id}`}
        className="mt-3 w-full block text-center py-2 rounded-lg bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 text-sm font-semibold hover:bg-brand-700 dark:hover:bg-gold-400 transition"
      >
        Book now
      </Link>
    </div>
  );
}