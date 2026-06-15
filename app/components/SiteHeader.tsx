import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Logo height={42} />
        <div className="site-header-portal">
          <span className="portal-title">Operations Portal</span>
          <span className="portal-sub">Work &amp; Benefit Filing</span>
        </div>
      </div>
    </header>
  );
}
