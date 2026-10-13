import { useNavigate } from 'react-router-dom';
import { COUPLE, WEDDING_DATE_LABEL } from '../lib/config';

export default function Privacy() {
  const nav = useNavigate();

  return (
    <main className="page">
      <h1 style={{ textAlign: 'center', marginTop: 24 }}>Privacy Policy</h1>
      <p style={{ textAlign: 'center', color: 'var(--ink-soft)', marginTop: 4 }}>
        {COUPLE} &middot; Wedding Photo Sharing &middot; {WEDDING_DATE_LABEL}
      </p>

      <div className="prose" style={{ marginTop: 20 }}>
        <p>
          This is a small, private website for sharing photos at the wedding of{' '}
          {COUPLE}. It is run by the couple for their guests. We care about your
          privacy and keep this simple.
        </p>

        <h2>What this app does</h2>
        <p>
          You can take or choose photos on your phone and upload them to a
          private photo collection that belongs to the couple. There are no
          accounts, no passwords, and no sign-up.
        </p>

        <h2>What we store</h2>
        <ul>
          <li>
            <strong>The photos you choose to upload.</strong> These are stored in
            the couple&rsquo;s private Google Drive folder and are visible in the
            wedding gallery to other guests using this site.
          </li>
          <li>
            <strong>A random &ldquo;guest&rdquo; code saved on your own device.</strong>{' '}
            This lets you find the photos you personally uploaded under
            &ldquo;My Photos.&rdquo; It is a random identifier, not your name, email,
            or phone number, and it stays in your browser.
          </li>
          <li>
            <strong>Basic technical data</strong> that any website receives, such
            as your request&rsquo;s approximate timing, used only to keep the site
            working and to limit abuse. We do not use advertising or tracking
            cookies.
          </li>
        </ul>

        <h2>How your photos are used</h2>
        <p>
          Uploaded photos are used only to let the couple and their guests view
          and keep the wedding memories. We do not sell your photos or data, and
          we do not share them with advertisers.
        </p>

        <h2>Google Drive</h2>
        <p>
          Photos are stored using Google Drive. The app can only access the
          files it creates for this event &mdash; it cannot see anything else in
          anyone&rsquo;s Google account. Google&rsquo;s handling of stored files is
          covered by{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google&rsquo;s Privacy Policy
          </a>
          .
        </p>

        <h2>Deleting a photo</h2>
        <p>
          If you&rsquo;d like a photo you uploaded removed, please ask the couple
          and they can delete it from the collection.
        </p>

        <h2>Contact</h2>
        <p>
          For any privacy questions, please contact the couple directly through
          the channel they shared your wedding invitation on.
        </p>
      </div>

      <button
        className="btn secondary"
        style={{ marginTop: 24 }}
        onClick={() => nav('/')}
      >
        &larr; Back to home
      </button>
    </main>
  );
}
