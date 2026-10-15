# Security

Report suspected vulnerabilities privately to the maintainers through the repository's private vulnerability-reporting channel once the public repository exists. Until launch, use the private development channel. Never attach credentials or private user data to public issues.

The controller has no network, Node or filesystem globals. Browser interfaces run in a sandbox. LLM input/output is bounded and validated as data. Host policies independently enforce tool grants, authenticated actor identity, spending and owned media. Creator projects cannot set gem rates or wallet balances.

The browser sandbox blocks parent-page access and network APIs such as fetch and WebSocket. Its media policy allows HTTPS images and video, so an interface can still make outbound media requests. A production host must restrict image/media destinations and frame navigation through its own Content-Security-Policy. Keep credentials and sensitive host data outside every interface view. The local author runner restricts frame navigation, sandboxes SVG documents, and rejects asset symlinks that escape the project's assets directory. It provides shared preview identities and must remain on loopback.

Paid live access requires server revocation, not just a short JWT expiry. Sequencer's current paid adapter requires LiveKit Cloud with participant token revocation; self-hosted LiveKit is rejected for this paid path. It issues a lease-scoped identity, stores revocation requests durably and removes expired or leaving viewers. Reactor startup tokens are withheld from paid public viewers until the protected native transport is ready. Cleanup is scheduled before revocation is attempted. If cleanup keeps failing for 30 seconds, the worker requests whole-room teardown. Billing refunds do not block that teardown. A provider outage can still delay both physical revocation and room teardown, so deployments must monitor failures.

Provider reference: [LiveKit token grants](https://docs.livekit.io/frontends/reference/tokens-grants/) and [participant removal](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/).

Prepared clips already delivered to a viewer can be retained, like any browser-playable media. Paid access controls future admission and delivery, and cannot prevent recording. Distributed hosts must supply transactional admission, persistence, scheduler leases, rate limits and operational reconciliation.
