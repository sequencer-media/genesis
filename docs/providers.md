# Provider integration

A provider is a host module. Projects submit semantic effects and never receive provider credentials. Register providers and allowed capabilities when creating GenesisHost. Paid providers require services.authorizeTool, even when the creator requests access in the manifest.

## Prepared media

createCachedProvider([{videoUrl,imageUrl}]) exercises queue, completion, playback and checkpoints with owned prepared assets. The image must represent the clip's actual last frame. Starter assets are included for no-cost local development.

## Replicate

createReplicateProvider takes a server token and a host-registered model map. Each entry pins a 64-character version hash, provides maxEstimatedCostUsd, maps the Genesis job to model-specific inputs, and persists returned media through an asynchronous result callback. The callback must produce an immutable imageUrl for the actual final frame of scene videos. decodeGenesisEndFrame(inputPath,outputPath) handles bounded owned local files when ffmpeg/ffprobe are installed.

The adapter uses POST /v1/predictions, GET /v1/predictions/{id}, and POST /v1/predictions/{id}/cancel. Requests use Bearer authentication. See https://replicate.com/docs/reference/http for the provider protocol.

Model costs are estimates, not a guaranteed external spending cap. Hosts enforce admission and actual billing through their own services and provider account controls. No creator price controls are introduced. Retry behavior depends on provider idempotency support. Replicate submission is deduplicated within the adapter process; uncertain submissions after process loss require reconciliation before a new attempt. The reference host does not automatically resubmit them.

Output storage and remote downloading are host responsibilities. Allowlist provider/storage domains, validate redirects, bound download size and duration, and retain immutable assets. Do not let creator URLs become unrestricted server fetch targets.

Protocol tests run without secrets. A deployment must test its chosen model's input mapping, output persistence and generation fidelity with live media before production use.

## Custom services

A provider can declare tool.audio.speak or tool.maps.lookup alongside its own argument validator and server implementation. Controllers request tool.request with toolId and data. Grant tool IDs independently in host policy. Return bounded result.data; the controller chooses what to expose to participants. Generic tool completion does not automatically replace the video stage.

Uncertain paid submissions block participant retry. An operator can reconcile an existing prediction with host.reconcileProviderJob(jobId,providerId,predictionId). Restrict this to authenticated operator infrastructure. GenesisProviderSubmissionError(message,false) identifies a confirmed rejected submission; other paid start failures remain uncertain. This prevents automatic repeat charges after ambiguous network failures.
