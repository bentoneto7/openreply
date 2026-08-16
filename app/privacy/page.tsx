import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy - Comentou",
  description:
    "How Comentou handles Instagram account data, webhook payloads, billing data, and customer campaign information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      description="Comentou helps businesses send Meta-compliant private replies when people comment on connected Instagram posts or reels."
      updatedAt="August 16, 2026"
    >
      <section>
        <h2 className="text-xl font-bold text-white">Data We Collect</h2>
        <p className="mt-3">
          We collect account email addresses and WhatsApp numbers for
          authentication and support, workspace and billing metadata, connected
          Instagram account identifiers, encrypted Instagram access tokens,
          campaign settings, webhook payloads, comments needed to process
          campaigns, delivery logs, and operational diagnostics.
        </p>
        <p className="mt-3">
          For accounts that grant the direct message permission, we also process
          the direct message conversations of the connected account: the message
          text, the sender&apos;s Instagram-scoped ID and username, and the
          timestamp. We read this only for conversations the connected account
          is already part of. Message content is fetched from the Meta API when
          a screen is opened and is not stored in our database; what we keep is
          the derived lead record — the sender&apos;s Instagram-scoped ID and
          username, the conversation status, and the time of the last contact.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">How We Use Data</h2>
        <p className="mt-3">
          We use this data to authenticate users, connect Instagram
          integrations, match comment keywords, send private replies through the
          official Meta APIs, prevent duplicate sends, troubleshoot failures,
          and protect the service.
        </p>
        <p className="mt-3">
          Direct message data is used to show the connected account which of its
          own conversations are still unanswered, to rank them by how much of
          Meta&apos;s 24-hour messaging window remains, and to deliver the
          replies the account&apos;s own operator writes. We do not use message
          content for advertising, we do not sell it, and we do not combine it
          across customers.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Instagram And Meta Data</h2>
        <p className="mt-3">
          Comentou does not ask for Instagram passwords, scrape Instagram, or
          use browser automation. Instagram tokens are encrypted at rest and are
          used only to perform actions authorized by the connected business
          account.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Subprocessors</h2>
        <p className="mt-3">
          The hosted Comentou service runs on infrastructure provided by Vultr
          Holdings Corporation, which hosts the application servers, the
          PostgreSQL database, and the Redis queue where Platform Data is
          stored. We also use Stripe for subscription payments and Resend for
          transactional email. These providers process data only as needed to
          run the service and are not permitted to use it for their own
          purposes.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Retention And Deletion</h2>
        <p className="mt-3">
          Customers can disconnect Instagram from settings, which removes the
          stored Instagram connection and stops campaigns. Deleting the
          connection also deletes the encrypted access token and every record
          tied to that account, including leads, delivery logs, processed
          comments and follower history. Direct message content is read live
          from the Meta API each time a screen is opened and is not kept in our
          database after the connection is removed. For account or data
          deletion, follow the Data Deletion page linked from the footer.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Contact</h2>
        <p className="mt-3">
          For privacy questions, data access requests, or deletion requests,
          contact us at bentoneto.com@gmail.com or on WhatsApp at
          +55 41 98896-9127. We answer within 5 business days.
        </p>
      </section>
    </LegalShell>
  );
}
