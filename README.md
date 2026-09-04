# Demo CI/CD Project
commit4 from ft/git-sqash-merge

A minimal Node.js (Express) app with a Jenkins pipeline that builds, tags,
pushes to DigitalOcean Container Registry (DOCR), and deploys to a single
`demo` namespace on DigitalOcean Kubernetes (DOKS).

Scope is intentionally narrow: everything lives in the `demo` namespace, and
no cluster-scoped resource is created or modified. The app relies on the
pre-existing cluster-wide **haproxy** ingress controller and the pre-existing
**letsencrypt-haproxy** cert-manager `ClusterIssuer` — both are only
*referenced* (via `ingressClassName` and the `cert-manager.io/cluster-issuer`
annotation), never installed or reconfigured.

Note: the original spec targeted the nginx ingress controller, but this
cluster's `letsencrypt-haproxy` ClusterIssuer only solves HTTP-01 challenges
through the `haproxy` IngressClass (its DNS-01 solver needs a real
Cloudflare-managed domain, which a `nip.io` address is not). So TLS via
Let's Encrypt would require using the `haproxy` ingress class instead of
`nginx` — see the TLS status note below for why it's not enabled.

This cluster's `haproxy-ingress` controller also requires the legacy
`kubernetes.io/ingress.class: haproxy` annotation in addition to
`ingressClassName: haproxy` to actually route traffic — with only
`ingressClassName` set, requests hit the default backend (404).
`k8s/04-ingress.yaml` sets both.

## File tree

```
project-demo/
├── app/
│   ├── package.json
│   ├── server.js
│   └── .dockerignore
├── Dockerfile
├── Jenkinsfile
├── k8s/
│   ├── 00-namespace.yaml
│   ├── 01-docr-secret.yaml
│   ├── 02-deployment.yaml
│   ├── 03-service.yaml
│   └── 04-ingress.yaml
└── README.md
```

## Registry and cluster (already set for this environment)

- DOCR registry: `demo-registry-cnl` → `registry.digitalocean.com/demo-registry-cnl`
- DOKS cluster context: `do-fra1-supra-prod-cluster`
- Ingress class: `haproxy` (existing `IngressClass`, controller `haproxy.org/ingress-controller`)
- Ingress host: `demo.209.38.114.36.nip.io` (haproxy ingress controller's LoadBalancer IP)
- TLS: **not enabled**. The `letsencrypt-haproxy` ClusterIssuer's solver list
  has no selectors, so cert-manager always tries the DNS-01/Cloudflare solver
  first — which fails permanently for a `nip.io` host ("no Zones for domain").
  Forcing HTTP-01 would require adding a selector to that shared
  ClusterIssuer, which is out of scope here. The app is served over plain
  HTTP. A leftover `Certificate/demo-app-tls` object in `demo` may still show
  `READY: False` and retry in the background — this is expected and harmless
  (delete it with `kubectl delete certificate demo-app-tls -n demo` if you
  want to stop the retries).

## One-time manual steps

Done already:
- ✅ `demo` namespace exists on the cluster.
- ✅ `docr-registry-secret` (dockerconfigjson) created in `demo`, generated via
  `doctl registry kubernetes-manifest demo-registry-cnl --namespace demo --name docr-registry-secret`.
- ✅ `k8s/02-deployment.yaml` image field and `Jenkinsfile` `REGISTRY` updated
  to `demo-registry-cnl`.
- ✅ `k8s/04-ingress.yaml` set to `ingressClassName: haproxy` +
  `kubernetes.io/ingress.class: haproxy` annotation, host
  `demo.209.38.114.36.nip.io`, plain HTTP (see TLS status note above).
- ✅ Deployment, Service, and Ingress applied to `demo`; verified live —
  `curl http://demo.209.38.114.36.nip.io/` and `/health` both return 200.

Done already:
- ✅ Jenkins credentials created:
  - `doctl-token-j` — Secret text credential holding the DOCR API token, used
    for `docker login`.
  - `access-k8s` — Secret file credential holding the kubeconfig for
    `do-fra1-supra-prod-cluster`, used for `kubectl` access during Deploy.
- ✅ `Jenkinsfile` updated to reference these credential IDs. Jenkins agents
  here are dynamically-provisioned DigitalOcean Droplets (real VMs with
  Docker Engine installed natively — confirmed via an existing working
  pipeline in this org that runs `docker build`/`push` directly), but without
  Node/npm or kubectl preinstalled. So:
  - **Install/Test** runs inside a `node:20-alpine` container (Docker
    Pipeline plugin, `agent { docker { ... } }`, `reuseNode: true`).
  - **Build Docker image** / **Push to DOCR** run directly on the droplet
    (Docker Engine is native there, no dockerization needed).
  - **Deploy** runs inside a `bitnami/kubectl` container the same way as
    Install/Test, since kubectl isn't assumed to be preinstalled.
  - Requires the **Docker Pipeline** Jenkins plugin (Manage Jenkins → Plugins)
    for the `agent { docker { ... } }` syntax.

- ✅ Jenkins job pointed at `https://github.com/cloudstackops-dev/demo-app.git`
  (branch `main`, script path `Jenkinsfile`), with a GitHub webhook configured
  for automatic build triggering on push.

Still required from you: none — this commit is a test push to confirm the
webhook triggers a build automatically.

After these steps, every subsequent Jenkins run builds a new image tagged
with the short git commit SHA, pushes it to DOCR, and updates the Deployment
via `kubectl set image` + `kubectl rollout status` (no `latest` tag, no
`rollout restart`).
