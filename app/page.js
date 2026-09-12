'use client';

import SocietyPage from './society-page';
import SocietyErrorBoundary from './society-error-boundary';
import GroupInviteNotice from './components/group-invite-notice';

export default function Page() {
  return (
    <SocietyErrorBoundary>
      <GroupInviteNotice />
      <SocietyPage />
    </SocietyErrorBoundary>
  );
}
