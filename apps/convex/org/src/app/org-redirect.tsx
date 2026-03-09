/* oxlint-disable react/no-danger */
const OrgRedirect = ({ orgId, slug, to }: { orgId: string; slug: string; to: string }) => (
  <script
    // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled redirect pattern
    dangerouslySetInnerHTML={{
      __html: `window.location.href="/api/set-org?orgId=${encodeURIComponent(orgId)}&slug=${encodeURIComponent(slug)}&to=${encodeURIComponent(to)}"`
    }}
  />
)

export default OrgRedirect
