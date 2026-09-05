// ─────────────────────────────────────────────────────────────────────────
// FullPageLoader
//
// Single shared full-screen loading gate used across every page. Pass a
// `screen` name and it renders that screen's skeleton shape while data +
// assets are still loading (via usePageReady). The error state is the same
// for every screen — only the loading skeleton differs.
//
// To wire up a new page:
//   1. Add a `<ScreenName>Skeleton` function below, shaped like that page.
//   2. Add one line to the SKELETONS map at the bottom of this file.
//   3. Render <FullPageLoader screen="screenName" status={...} onRetry={...} />
// ─────────────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
    return (
        <div className="animate-pulse">
            {/* Header (video) area */}
            <div className="h-64 sm:h-72 bg-slate-200 dark:bg-ink-800" />
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-8 space-y-3">
                {/* Tab pills */}
                <div className="h-10 bg-slate-100 dark:bg-ink-800 rounded-xl w-full sm:w-72 mx-auto" />
                {/* Content rows */}
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-slate-100 dark:bg-ink-800 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

function BrowseSkeleton() {
    return (
        <div className="animate-pulse">
            {/* Header (photo/slideshow) area */}
            <div className="h-40 sm:h-56 bg-slate-200 dark:bg-ink-800" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Filter bar */}
                <div className="hidden sm:flex gap-2 mb-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-8 w-24 bg-slate-100 dark:bg-ink-800 rounded-full" />
                    ))}
                </div>
                {/* Product grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-100 dark:bg-ink-800" />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ProductDetailSkeleton() {
    return (
        <div className="animate-pulse max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
            <div className="aspect-square sm:aspect-[16/9] bg-slate-100 dark:bg-ink-800 rounded-2xl" />
            <div className="h-6 w-2/3 bg-slate-100 dark:bg-ink-800 rounded-lg" />
            <div className="h-4 w-1/3 bg-slate-100 dark:bg-ink-800 rounded-lg" />
            <div className="h-24 bg-slate-100 dark:bg-ink-800 rounded-2xl" />
        </div>
    );
}

function StoreSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="h-40 sm:h-56 bg-slate-200 dark:bg-ink-800" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-100 dark:bg-ink-800" />
                    ))}
                </div>
            </div>
        </div>
    );
}

function CartSkeleton() {
    return (
        <div className="animate-pulse max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-100 dark:bg-ink-800 rounded-2xl" />
            ))}
        </div>
    );
}

// Fallback for any screen that hasn't been given a dedicated skeleton yet.
function GenericSkeleton() {
    return (
        <div className="animate-pulse max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-3">
            <div className="h-40 bg-slate-100 dark:bg-ink-800 rounded-2xl" />
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-ink-800 rounded-2xl" />
            ))}
        </div>
    );
}

// Map of screen name -> skeleton component. Add a line here for every new
// page wired into usePageReady.
const SKELETONS = {
    dashboard: DashboardSkeleton,
    browse: BrowseSkeleton,
    productDetail: ProductDetailSkeleton,
    store: StoreSkeleton,
    cart: CartSkeleton,
};

export default function FullPageLoader({ screen, status = 'loading', onRetry }) {
    if (status === 'error') {
        return (
            <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-white dark:bg-ink-900 px-4 text-center">
                <p className="text-sm text-slate-400 dark:text-gold-200/50 mb-4">
                    Couldn't load this page right now.
                </p>
                <button
                    onClick={onRetry}
                    className="px-5 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition"
                >
                    Try again
                </button>
            </div>
        );
    }

    const Skeleton = SKELETONS[screen] || GenericSkeleton;

    return (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-white dark:bg-ink-900">
            <Skeleton />
        </div>
    );
}