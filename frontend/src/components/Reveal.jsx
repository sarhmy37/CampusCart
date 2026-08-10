import useReveal from '../hooks/useReveal';

/**
 * Wraps children and fades/slides them in once scrolled into view.
 * delay: ms, for staggering multiple items.
 */
export default function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
    const [ref, visible] = useReveal();

    return (
        <Tag
            ref={ref}
            className={`transition-all duration-700 ease-out ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } ${className}`}
            style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
        >
            {children}
        </Tag>
    );
}