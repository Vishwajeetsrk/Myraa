import { _React, _Vue, Nextjs } from '@dev.icons/react';

// Real Devicons from @dev.icons/react (MIT). No emoji, no hand-drawn logos.
export default function Stack() {
  return (
    <div className="flex gap-4">
      <_React size={48} />
      <_Vue size={48} />
      <Nextjs size={48} alt="Next.js" />
    </div>
  );
}
