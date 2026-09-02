'use client';

import SocietyPage from './society-page';
import SocietyErrorBoundary from './society-error-boundary';

export default function Page() {
  return (
    <SocietyErrorBoundary>
      <SocietyPage />
    </SocietyErrorBoundary>
  );
}
