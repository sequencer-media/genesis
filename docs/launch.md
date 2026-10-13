# Private launch preparation

Status: local and unpublished. The independent local repository lives alongside the parent development project. No npm publication or public GitHub creation is performed.

The launch story is one concrete demonstration: two people join a vintage pixel battle, a backend LLM creates four moves, shared controller rules resolve turns, and a generated scene returns with its real checkpoint. An offline fixture lets developers understand the same loop before spending credit. Include a short recorded demo, mobile screenshots and the one-key Sequencer guide before launch.

Release readiness:

- Run the complete Node 20/22 CI matrix and inspect the npm pack contents.
- Run one bounded real LLM call and private stream through deployed adapters, including stop/refund and viewer revocation.
- Load test distributed session workers and viewer billing, including provider outages and reconciliation.
- Verify current pricing, provider limits, license and fixture provenance.
- Add the chosen private repository remote and enable private vulnerability reporting before making it public.
- Configure the release registry, then remove private:true only for the approved release.

The comparison table describes supported workflows and ownership responsibilities. Avoid unverified competitor claims or promises of unlimited sessions. Keep external-provider adapters small and independently testable.
