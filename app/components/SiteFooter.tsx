import { Logo } from "./Logo";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Logo height={38} variant="light" />
          <p className="site-footer-tag">
            Industrial Construction&nbsp;&nbsp;•&nbsp;&nbsp;Home Elevation
          </p>
        </div>
        <div className="site-footer-meta">
          <p>Holiday Portal — Work &amp; Benefit Filing</p>
          <p className="muted">
            © {year} Byrdson Services LLC. Internal use only.
          </p>
        </div>
      </div>
    </footer>
  );
}
