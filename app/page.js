'use client';

import SocietyPage from './society-page';
import SocietyErrorBoundary from './society-error-boundary';
import GroupInviteNotice from './components/group-invite-notice';
import GroupTabs from './components/group-tabs';

export default function Page() {
  return (
    <SocietyErrorBoundary>
      <GroupInviteNotice />
      <SocietyPage />
      <GroupTabs />
      <style dangerouslySetInnerHTML={{ __html: `
        .sf-modal-backdrop { z-index: 1000 !important; }
        .sf-modal { max-height: min(88vh, 760px); overflow-y: auto; box-sizing: border-box; }
        .sf-draw-preview-backdrop { align-items: center; padding: 12px; box-sizing: border-box; }
        .sf-draw-preview-modal { width: min(100%, 480px); max-height: min(88vh, 760px); overflow-x: hidden; }
        .sf-draw-preview-teams { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; width: 100%; }
        .sf-draw-preview-team { min-width: 0; overflow: hidden; }
        .sf-draw-preview-team .sf-rsvp-list { min-width: 0; }
        .sf-draw-preview-team .sf-rsvp-row { min-width: 0; overflow-wrap: anywhere; }
        @media (max-width: 430px) {
          .sf-draw-preview-teams { grid-template-columns: 1fr; }
        }
      ` }} />
    </SocietyErrorBoundary>
  );
}
