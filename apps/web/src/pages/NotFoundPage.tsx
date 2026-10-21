import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="container-page py-20 text-center">
      <h1 className="font-display text-2xl font-semibold text-cocoa-800">Page not found</h1>
      <p className="mt-2 text-cocoa-500">The page you were looking for does not exist.</p>
      <Link to="/" className="btn-primary mt-6">
        Back to home
      </Link>
    </section>
  );
}
